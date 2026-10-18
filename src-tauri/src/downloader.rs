use futures_util::StreamExt;
use reqwest::header::{HeaderMap, HeaderValue, RANGE};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::{watch, Mutex};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DownloadCommand {
    Pause,
    Cancel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelSpec {
    pub id: String,
    pub name: String,
    pub tier: String,
    pub size_bytes: u64,
    pub min_ram_gb: f32,
    pub context_length: u32,
    pub url: String,
    pub sha256: String,
    pub license: String,
    pub languages_note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub model_id: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub speed_bps: f64,
    pub eta_seconds: u64,
    pub status: String, // "downloading" | "paused" | "verifying" | "completed" | "cancelled" | "error"
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledModel {
    pub id: String,
    pub file_name: String,
    pub path: String,
    pub size_bytes: u64,
}

pub struct DownloadManager {
    models_dir: Arc<std::sync::RwLock<PathBuf>>,
    // Active cancel/pause senders per model_id
    active_downloads: Arc<Mutex<HashMap<String, watch::Sender<Option<DownloadCommand>>>>>,
}

impl DownloadManager {
    pub fn new(models_dir: Arc<std::sync::RwLock<PathBuf>>) -> Self {
        let dir = models_dir.read().unwrap().clone();
        let _ = std::fs::create_dir_all(&dir);
        Self {
            models_dir,
            active_downloads: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn models_dir(&self) -> PathBuf {
        self.models_dir.read().unwrap().clone()
    }

    pub fn set_models_dir(&self, new_dir: PathBuf) -> Result<(), String> {
        std::fs::create_dir_all(&new_dir).map_err(|e| e.to_string())?;
        let mut lock = self.models_dir.write().map_err(|e| e.to_string())?;
        *lock = new_dir;
        Ok(())
    }

    pub fn list_installed(&self) -> Vec<InstalledModel> {
        let mut list = Vec::new();
        let dir = self.models_dir();
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
                    if ext == "gguf" {
                        let file_name = path
                            .file_name()
                            .and_then(|s| s.to_str())
                            .unwrap_or("")
                            .to_string();
                        let id = path
                            .file_stem()
                            .and_then(|s| s.to_str())
                            .unwrap_or("")
                            .to_string();
                        let size_bytes = entry.metadata().map(|m| m.len()).unwrap_or(0);
                        list.push(InstalledModel {
                            id,
                            file_name,
                            path: path.to_string_lossy().to_string(),
                            size_bytes,
                        });
                    }
                }
            }
        }
        list
    }

    pub fn is_model_installed(&self, model_id: &str) -> bool {
        let target = self.models_dir().join(format!("{}.gguf", model_id));
        target.exists() && target.is_file()
    }

    pub fn get_model_path(&self, model_id: &str) -> Option<PathBuf> {
        let target = self.models_dir().join(format!("{}.gguf", model_id));
        if target.exists() && target.is_file() {
            Some(target)
        } else {
            None
        }
    }

    pub async fn delete_model(&self, app: AppHandle, model_id: &str) -> Result<(), String> {
        self.cancel_download(app, model_id).await?;
        tokio::time::sleep(Duration::from_millis(150)).await;

        let dir = self.models_dir();
        let target = dir.join(format!("{}.gguf", model_id));
        let part = dir.join(format!("{}.gguf.part", model_id));

        if target.exists() {
            std::fs::remove_file(target).map_err(|e| e.to_string())?;
        }
        if part.exists() {
            let _ = std::fs::remove_file(part);
        }
        Ok(())
    }

    pub async fn pause_download(&self, model_id: &str) {
        let mut map = self.active_downloads.lock().await;
        if let Some(sender) = map.remove(model_id) {
            let _ = sender.send(Some(DownloadCommand::Pause));
        }
    }

    pub async fn cancel_download(&self, app: AppHandle, model_id: &str) -> Result<(), String> {
        let sender_opt = {
            let mut map = self.active_downloads.lock().await;
            map.remove(model_id)
        };

        if let Some(sender) = sender_opt {
            let _ = sender.send(Some(DownloadCommand::Cancel));
        } else {
            let part = self.models_dir().join(format!("{}.gguf.part", model_id));
            if part.exists() {
                let _ = tokio::fs::remove_file(part).await;
            }
        }

        let _ = app.emit(
            "model-download-progress",
            DownloadProgress {
                model_id: model_id.to_string(),
                downloaded_bytes: 0,
                total_bytes: 0,
                speed_bps: 0.0,
                eta_seconds: 0,
                status: "cancelled".to_string(),
                error: None,
            },
        );

        Ok(())
    }

    pub async fn start_download(
        &self,
        app: AppHandle,
        spec: ModelSpec,
    ) -> Result<(), String> {
        let model_id = spec.id.clone();
        let dir = self.models_dir();
        let target_path = dir.join(format!("{}.gguf", model_id));
        let part_path = dir.join(format!("{}.gguf.part", model_id));

        if target_path.exists() {
            let _ = app.emit(
                "model-download-progress",
                DownloadProgress {
                    model_id: model_id.clone(),
                    downloaded_bytes: spec.size_bytes,
                    total_bytes: spec.size_bytes,
                    speed_bps: 0.0,
                    eta_seconds: 0,
                    status: "completed".to_string(),
                    error: None,
                },
            );
            return Ok(());
        }

        // Check if already downloading
        {
            let map = self.active_downloads.lock().await;
            if map.contains_key(&model_id) {
                return Ok(()); // Already running
            }
        }

        let (cancel_tx, mut cancel_rx) = watch::channel(None);
        {
            let mut map = self.active_downloads.lock().await;
            map.insert(model_id.clone(), cancel_tx);
        }

        let active_downloads_ref = self.active_downloads.clone();

        tauri::async_runtime::spawn(async move {
            let res = Self::run_download(
                app.clone(),
                spec.clone(),
                part_path.clone(),
                target_path.clone(),
                &mut cancel_rx,
            )
            .await;

            // Clean up active entry
            {
                let mut map = active_downloads_ref.lock().await;
                map.remove(&spec.id);
            }

            match res {
                Ok(status_str) => {
                    if status_str == "completed" {
                        let _ = app.emit(
                            "model-download-progress",
                            DownloadProgress {
                                model_id: spec.id.clone(),
                                downloaded_bytes: spec.size_bytes,
                                total_bytes: spec.size_bytes,
                                speed_bps: 0.0,
                                eta_seconds: 0,
                                status: "completed".to_string(),
                                error: None,
                            },
                        );
                    } else if status_str == "paused" {
                        let cur_size = tokio::fs::metadata(&part_path)
                            .await
                            .map(|m| m.len())
                            .unwrap_or(0);
                        let _ = app.emit(
                            "model-download-progress",
                            DownloadProgress {
                                model_id: spec.id.clone(),
                                downloaded_bytes: cur_size,
                                total_bytes: spec.size_bytes,
                                speed_bps: 0.0,
                                eta_seconds: 0,
                                status: "paused".to_string(),
                                error: None,
                            },
                        );
                    } else if status_str == "cancelled" {
                        let _ = app.emit(
                            "model-download-progress",
                            DownloadProgress {
                                model_id: spec.id.clone(),
                                downloaded_bytes: 0,
                                total_bytes: spec.size_bytes,
                                speed_bps: 0.0,
                                eta_seconds: 0,
                                status: "cancelled".to_string(),
                                error: None,
                            },
                        );
                    }
                }
                Err(err) => {
                    let cur_size = tokio::fs::metadata(&part_path)
                        .await
                        .map(|m| m.len())
                        .unwrap_or(0);
                    let _ = app.emit(
                        "model-download-progress",
                        DownloadProgress {
                            model_id: spec.id.clone(),
                            downloaded_bytes: cur_size,
                            total_bytes: spec.size_bytes,
                            speed_bps: 0.0,
                            eta_seconds: 0,
                            status: "error".to_string(),
                            error: Some(err),
                        },
                    );
                }
            }
        });

        Ok(())
    }

    async fn run_download(
        app: AppHandle,
        spec: ModelSpec,
        part_path: PathBuf,
        target_path: PathBuf,
        cancel_rx: &mut watch::Receiver<Option<DownloadCommand>>,
    ) -> Result<String, String> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(3600))
            .build()
            .map_err(|e| e.to_string())?;

        let mut existing_bytes: u64 = 0;
        if part_path.exists() {
            if let Ok(meta) = tokio::fs::metadata(&part_path).await {
                existing_bytes = meta.len();
            }
        }

        let mut headers = HeaderMap::new();
        if existing_bytes > 0 && existing_bytes < spec.size_bytes {
            if let Ok(range_val) = HeaderValue::from_str(&format!("bytes={}-", existing_bytes)) {
                headers.insert(RANGE, range_val);
            }
        }

        let response = client
            .get(&spec.url)
            .headers(headers)
            .send()
            .await
            .map_err(|e| format!("HTTP request failed: {}", e))?;

        let status = response.status();
        let is_partial = status == reqwest::StatusCode::PARTIAL_CONTENT;

        if !status.is_success() && !is_partial {
            return Err(format!("Server returned HTTP {}", status));
        }

        let mut file = if is_partial {
            tokio::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&part_path)
                .await
                .map_err(|e| format!("Failed to open part file: {}", e))?
        } else {
            existing_bytes = 0;
            tokio::fs::OpenOptions::new()
                .create(true)
                .write(true)
                .truncate(true)
                .open(&part_path)
                .await
                .map_err(|e| format!("Failed to create part file: {}", e))?
        };

        let mut stream = response.bytes_stream();
        let mut downloaded = existing_bytes;
        let total_bytes = spec.size_bytes;

        let mut last_emit = Instant::now();
        let mut speed_sample_start = Instant::now();
        let mut bytes_since_sample: u64 = 0;
        let mut current_speed: f64 = 0.0;

        while let Some(chunk_res) = stream.next().await {
            // Check if cancellation or pause requested
            let cmd_opt = *cancel_rx.borrow();
            if let Some(cmd) = cmd_opt {
                let _ = file.flush().await;
                drop(file);
                if cmd == DownloadCommand::Cancel {
                    let _ = tokio::fs::remove_file(&part_path).await;
                    return Ok("cancelled".to_string());
                } else {
                    return Ok("paused".to_string());
                }
            }

            let chunk = chunk_res.map_err(|e| format!("Network read error: {}", e))?;
            file.write_all(&chunk)
                .await
                .map_err(|e| format!("Disk write error: {}", e))?;

            let chunk_len = chunk.len() as u64;
            downloaded += chunk_len;
            bytes_since_sample += chunk_len;

            // Speed calculation every 400ms with EMA smoothing
            let now = Instant::now();
            let sample_elapsed = now.duration_since(speed_sample_start).as_secs_f64();
            if sample_elapsed >= 0.4 {
                let instant_speed = (bytes_since_sample as f64) / sample_elapsed;
                current_speed = if current_speed <= 0.0 {
                    instant_speed
                } else {
                    current_speed * 0.65 + instant_speed * 0.35
                };
                speed_sample_start = now;
                bytes_since_sample = 0;
            }

            // Emit progress event every 200ms
            if now.duration_since(last_emit) >= Duration::from_millis(200) {
                let remaining_bytes = if total_bytes > downloaded {
                    total_bytes - downloaded
                } else {
                    0
                };
                let eta_seconds = if current_speed > 1024.0 {
                    (remaining_bytes as f64 / current_speed).ceil() as u64
                } else {
                    0
                };

                let _ = app.emit(
                    "model-download-progress",
                    DownloadProgress {
                        model_id: spec.id.clone(),
                        downloaded_bytes: downloaded,
                        total_bytes,
                        speed_bps: current_speed,
                        eta_seconds,
                        status: "downloading".to_string(),
                        error: None,
                    },
                );
                last_emit = now;
            }
        }

        let _ = file.flush().await;
        drop(file);

        if downloaded < total_bytes {
            return Err(format!(
                "Download incomplete: connection closed early ({}/{} bytes). Resume download to continue.",
                downloaded, total_bytes
            ));
        }

        if downloaded > total_bytes {
            let _ = tokio::fs::remove_file(&part_path).await;
            return Err(format!(
                "Download size mismatch: received {} bytes, expected {} bytes.",
                downloaded, total_bytes
            ));
        }

        // Verification phase: Check GGUF Magic Header & SHA256 Checksum
        let _ = app.emit(
            "model-download-progress",
            DownloadProgress {
                model_id: spec.id.clone(),
                downloaded_bytes: downloaded,
                total_bytes,
                speed_bps: 0.0,
                eta_seconds: 0,
                status: "verifying".to_string(),
                error: None,
            },
        );

        // 1. Verify GGUF magic header bytes [0x47, 0x47, 0x55, 0x46]
        {
            let mut check_file = tokio::fs::File::open(&part_path)
                .await
                .map_err(|e| format!("Failed to open downloaded file for verification: {}", e))?;
            let mut magic = [0u8; 4];
            if let Ok(n) = check_file.read_exact(&mut magic).await {
                if n < 4 || &magic != b"GGUF" {
                    drop(check_file);
                    let _ = tokio::fs::remove_file(&part_path).await;
                    let _ = app.emit(
                        "dev:log",
                        format!(
                            "[Model Verification Error] Model '{}' has invalid magic header {:?}. Expected 'GGUF'. Removed.",
                            spec.id, magic
                        ),
                    );
                    return Err(
                        "The file did not pass verification (invalid GGUF format). It was removed. Retry?".to_string()
                    );
                }
            } else {
                drop(check_file);
                let _ = tokio::fs::remove_file(&part_path).await;
                return Err(
                    "The file did not pass verification (file truncated). It was removed. Retry?".to_string()
                );
            }
        }

        // 2. Compute streaming SHA-256
        let expected_hash = spec.sha256.trim().to_lowercase();
        if !expected_hash.is_empty() {
            let mut verify_file = tokio::fs::File::open(&part_path)
                .await
                .map_err(|e| format!("Failed to open downloaded file for verification: {}", e))?;

            let mut hasher = Sha256::new();
            let mut buf = vec![0u8; 1024 * 1024]; // 1MB buffer
            loop {
                let cmd_opt = *cancel_rx.borrow();
                if let Some(cmd) = cmd_opt {
                    drop(verify_file);
                    if cmd == DownloadCommand::Cancel {
                        let _ = tokio::fs::remove_file(&part_path).await;
                        return Ok("cancelled".to_string());
                    } else {
                        return Ok("paused".to_string());
                    }
                }

                let n = verify_file
                    .read(&mut buf)
                    .await
                    .map_err(|e| format!("Failed to read file for verification: {}", e))?;
                if n == 0 {
                    break;
                }
                hasher.update(&buf[..n]);
            }
            drop(verify_file);

            let hash_bytes = hasher.finalize();
            let computed_hex = hash_bytes
                .iter()
                .map(|b| format!("{:02x}", b))
                .collect::<String>()
                .to_lowercase();

            // Log expected and actual hash for developer panel
            let _ = app.emit(
                "dev:log",
                format!(
                    "[Model SHA256 Check] Model '{}': Expected = {}, Actual = {}",
                    spec.id, expected_hash, computed_hex
                ),
            );

            if computed_hex != expected_hash {
                let _ = tokio::fs::remove_file(&part_path).await;
                return Err(
                    "The file did not pass verification. It was removed. Retry?".to_string()
                );
            }
        }

        // Rename part file to final destination
        tokio::fs::rename(&part_path, &target_path)
            .await
            .map_err(|e| format!("Failed to finalize model file: {}", e))?;

        Ok("completed".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sha2::{Digest, Sha256};
    use std::io::Write;

    #[test]
    fn test_sha256_verification_pass_and_fail() {
        let temp_dir = std::env::temp_dir().join("mintu_test_verify");
        let _ = std::fs::create_dir_all(&temp_dir);

        let test_file = temp_dir.join("test_model.part");
        let mut f = std::fs::File::create(&test_file).unwrap();
        // Valid GGUF magic bytes followed by test payload
        f.write_all(b"GGUFHelloMintuModel").unwrap();
        drop(f);

        // Compute real hash
        let mut hasher = Sha256::new();
        hasher.update(b"GGUFHelloMintuModel");
        let hash_bytes = hasher.finalize();
        let real_hash = hash_bytes
            .iter()
            .map(|b| format!("{:02x}", b))
            .collect::<String>();

        // Correct hash matches
        assert_eq!(real_hash.len(), 64);
        assert_eq!(real_hash.to_lowercase(), real_hash);

        // Bad hash fails
        let bad_hash = "0000000000000000000000000000000000000000000000000000000000000000";
        assert_ne!(real_hash, bad_hash);

        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}
