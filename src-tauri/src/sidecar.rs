use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};
use tokio::process::Child;
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SidecarInfo {
    pub status: String, // "stopped" | "starting" | "ready" | "idle_unloaded" | "error"
    pub port: u16,
    pub api_key: String,
    pub model_path: Option<String>,
    pub error: Option<String>,
}

struct InnerState {
    child: Option<Child>,
    port: u16,
    api_key: String,
    model_path: Option<PathBuf>,
    status: String,
    last_activity: Instant,
    context_length: u32,
    threads: u32,
    error: Option<String>,
}

#[derive(Clone)]
pub struct SidecarManager {
    inner: Arc<Mutex<InnerState>>,
}

impl SidecarManager {
    pub fn new() -> Self {
        let manager = Self {
            inner: Arc::new(Mutex::new(InnerState {
                child: None,
                port: 0,
                api_key: String::new(),
                model_path: None,
                status: "stopped".to_string(),
                last_activity: Instant::now(),
                context_length: 2048,
                threads: 4,
                error: None,
            })),
        };

        // Start background idle-unload loop (checks every 30s)
        let inner_clone = manager.inner.clone();
        tauri::async_runtime::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_secs(30)).await;
                let mut state = inner_clone.lock().await;
                if state.status == "ready" {
                    // 10 minutes idle limit
                    if state.last_activity.elapsed() > Duration::from_secs(600) {
                        println!("[Mintu Sidecar] Unloading idle model to free RAM...");
                        if let Some(mut child) = state.child.take() {
                            let _ = child.kill().await;
                        }
                        state.status = "idle_unloaded".to_string();
                    }
                }
            }
        });

        manager
    }

    pub async fn get_info(&self) -> SidecarInfo {
        let state = self.inner.lock().await;
        SidecarInfo {
            status: state.status.clone(),
            port: state.port,
            api_key: state.api_key.clone(),
            model_path: state.model_path.as_ref().map(|p| p.to_string_lossy().to_string()),
            error: state.error.clone(),
        }
    }

    pub async fn touch_activity(&self) {
        let mut state = self.inner.lock().await;
        state.last_activity = Instant::now();
    }

    pub async fn stop(&self) -> Result<(), String> {
        let mut state = self.inner.lock().await;
        if let Some(mut child) = state.child.take() {
            let _ = child.kill().await;
        }
        state.status = "stopped".to_string();
        state.port = 0;
        state.api_key.clear();
        state.error = None;
        Ok(())
    }

    pub async fn ensure_running(&self, app: &AppHandle) -> Result<SidecarInfo, String> {
        let (needs_restart, model_path, ctx, threads) = {
            let state = self.inner.lock().await;
            if state.status == "ready" {
                return Ok(SidecarInfo {
                    status: state.status.clone(),
                    port: state.port,
                    api_key: state.api_key.clone(),
                    model_path: state.model_path.as_ref().map(|p| p.to_string_lossy().to_string()),
                    error: state.error.clone(),
                });
            }
            (
                state.status == "idle_unloaded",
                state.model_path.clone(),
                state.context_length,
                state.threads,
            )
        };

        if needs_restart {
            if let Some(path) = model_path {
                return self.start(app, path, ctx, threads).await;
            }
        }

        Err("Sidecar is not running and no model loaded".to_string())
    }

    pub async fn start(
        &self,
        app: &AppHandle,
        model_path: PathBuf,
        context_length: u32,
        threads: u32,
    ) -> Result<SidecarInfo, String> {
        // First kill any existing child
        self.stop().await?;

        if !model_path.exists() {
            return Err(format!(
                "Model file does not exist: {}",
                model_path.display()
            ));
        }

        let binary_path = find_llama_binary(app)?;

        // Find a random free port on 127.0.0.1
        let port = {
            let listener = std::net::TcpListener::bind("127.0.0.1:0")
                .map_err(|e| format!("Failed to bind ephemeral port: {}", e))?;
            listener
                .local_addr()
                .map_err(|e| format!("Failed to get local addr: {}", e))?
                .port()
        };

        // Generate a random 32-char hex token
        let api_key = generate_api_key();

        {
            let mut state = self.inner.lock().await;
            state.status = "starting".to_string();
            state.port = port;
            state.api_key = api_key.clone();
            state.model_path = Some(model_path.clone());
            state.context_length = context_length;
            state.threads = threads;
            state.error = None;
            state.last_activity = Instant::now();
        }

        let mut cmd = tokio::process::Command::new(&binary_path);
        cmd.arg("-m").arg(&model_path);
        cmd.arg("--port").arg(port.to_string());
        cmd.arg("--host").arg("127.0.0.1");
        cmd.arg("--api-key").arg(&api_key);
        cmd.arg("-c").arg(context_length.to_string());
        cmd.arg("-t").arg(threads.to_string());
        cmd.stderr(std::process::Stdio::piped());

        // Working directory set to binary directory so Windows finds DLLs (ggml.dll, llama.dll)
        if let Some(parent) = binary_path.parent() {
            cmd.current_dir(parent);
        }

        #[cfg(target_os = "windows")]
        {
            // CREATE_NO_WINDOW = 0x08000000
            cmd.creation_flags(0x08000000);
        }

        let child = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn llama-server: {}", e))?;

        {
            let mut state = self.inner.lock().await;
            state.child = Some(child);
        }

        // Poll health check until HTTP 200 OK
        let health_url = format!("http://127.0.0.1:{}/health", port);
        let client = reqwest::Client::builder()
            .timeout(Duration::from_millis(1500))
            .build()
            .map_err(|e| e.to_string())?;

        let start_time = Instant::now();
        let timeout = Duration::from_secs(60); // 60s max for model loading
        let mut ready = false;

        while start_time.elapsed() < timeout {
            tokio::time::sleep(Duration::from_millis(300)).await;

            // Check if process died
            {
                let mut state = self.inner.lock().await;
                if let Some(child_proc) = state.child.as_mut() {
                    if let Ok(Some(exit_status)) = child_proc.try_wait() {
                        let mut stderr_text = String::new();
                        if let Some(mut err_pipe) = child_proc.stderr.take() {
                            use tokio::io::AsyncReadExt;
                            let _ = err_pipe.read_to_string(&mut stderr_text).await;
                        }
                        let detail = if !stderr_text.trim().is_empty() {
                            format!("{}: {}", exit_status, stderr_text.trim())
                        } else {
                            format!("{}", exit_status)
                        };
                        let err_msg = format!("llama-server exited prematurely with status: {}", detail);
                        state.status = "error".to_string();
                        state.error = Some(err_msg.clone());
                        return Err(err_msg);
                    }
                }
            }

            match client
                .get(&health_url)
                .header("Authorization", format!("Bearer {}", api_key))
                .send()
                .await
            {
                Ok(resp) => {
                    if resp.status().is_success() {
                        ready = true;
                        break;
                    }
                }
                Err(_) => {
                    // Not listening yet, continue waiting
                }
            }
        }

        if !ready {
            self.stop().await?;
            let err = "llama-server health check timed out after 60s".to_string();
            let mut state = self.inner.lock().await;
            state.status = "error".to_string();
            state.error = Some(err.clone());
            return Err(err);
        }

        {
            let mut state = self.inner.lock().await;
            state.status = "ready".to_string();
            state.last_activity = Instant::now();
        }

        Ok(SidecarInfo {
            status: "ready".to_string(),
            port,
            api_key,
            model_path: Some(model_path.to_string_lossy().to_string()),
            error: None,
        })
    }
}

fn find_llama_binary(app: &AppHandle) -> Result<PathBuf, String> {
    // 1. Check Tauri resource path
    if let Ok(resource_dir) = app.path().resource_dir() {
        let p = resource_dir.join("binaries/llama/llama-server.exe");
        if p.exists() {
            return Ok(p);
        }
    }

    // 2. Check current exe directory
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let p1 = exe_dir.join("binaries/llama/llama-server.exe");
            if p1.exists() {
                return Ok(p1);
            }
            let p2 = exe_dir.join("llama-server.exe");
            if p2.exists() {
                return Ok(p2);
            }
        }
    }

    // 3. Check workspace development relative paths
    let dev_paths = [
        "src-tauri/binaries/llama/llama-server.exe",
        "binaries/llama/llama-server.exe",
        "../src-tauri/binaries/llama/llama-server.exe",
    ];

    for path_str in dev_paths {
        let p = PathBuf::from(path_str);
        if p.exists() {
            return Ok(std::fs::canonicalize(p).unwrap_or_else(|_| PathBuf::from(path_str)));
        }
    }

    Err("Could not locate llama-server.exe binary".to_string())
}

fn generate_api_key() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let pid = std::process::id();
    format!("mintu-sk-{:x}{:x}", now, pid)
}
