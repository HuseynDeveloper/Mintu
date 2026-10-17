use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationAction {
    pub id: String,
    pub label: String,
    pub primary: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppNotification {
    pub id: String,
    pub title: String,
    pub text: String,
    pub app_name: Option<String>,
    pub app_icon: Option<String>, // Base64 data URL (e.g. data:image/bmp;base64,...)
    pub aumid: Option<String>,
    pub target: Option<String>,
    pub priority: String, // "urgent" | "normal" | "low"
    pub actions: Option<Vec<NotificationAction>>,
    pub timestamp: u64,
}

// Global cache for resolved app sources (AUMID/Key -> (AppName, AppIconBase64))
static APP_SOURCE_CACHE: OnceLock<Mutex<HashMap<String, (String, Option<String>)>>> = OnceLock::new();

fn get_cache() -> &'static Mutex<HashMap<String, (String, Option<String>)>> {
    APP_SOURCE_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

pub struct NotificationManager {
    queue: Arc<Mutex<VecDeque<AppNotification>>>,
    last_seen_ids: Arc<Mutex<Vec<u32>>>,
}

impl NotificationManager {
    pub fn new() -> Self {
        Self {
            queue: Arc::new(Mutex::new(VecDeque::new())),
            last_seen_ids: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub fn push_notification(&self, notif: AppNotification, app: &AppHandle) {
        let mut q = self.queue.lock().unwrap();
        if notif.priority == "urgent" {
            q.push_front(notif.clone());
        } else {
            q.push_back(notif.clone());
        }
        let _ = app.emit("notification-received", notif);
    }

    pub fn pop_notification(&self) -> Option<AppNotification> {
        let mut q = self.queue.lock().unwrap();
        q.pop_front()
    }

    pub fn start_listener(&self, app: AppHandle) {
        let last_seen_ref = self.last_seen_ids.clone();

        tauri::async_runtime::spawn(async move {
            #[cfg(target_os = "windows")]
            {
                use windows::UI::Notifications::Management::{
                    UserNotificationListener, UserNotificationListenerAccessStatus,
                };
                use windows::UI::Notifications::NotificationKinds;

                // Request user notification listener permission safely
                let listener = match UserNotificationListener::Current() {
                    Ok(l) => l,
                    Err(_) => return,
                };

                let access_status = match listener.RequestAccessAsync() {
                    Ok(op) => op.get().unwrap_or(UserNotificationListenerAccessStatus::Denied),
                    Err(_) => UserNotificationListenerAccessStatus::Denied,
                };

                if access_status != UserNotificationListenerAccessStatus::Allowed {
                    return;
                }

                let mut is_first_poll = true;

                loop {
                    tokio::time::sleep(Duration::from_millis(1500)).await;

                    if let Ok(async_op) = listener.GetNotificationsAsync(NotificationKinds::Toast) {
                        if let Ok(toast_list) = async_op.get() {
                            let count = toast_list.Size().unwrap_or(0);

                            // On first run, record all existing notifications as seen so we don't spam old history
                            if is_first_poll {
                                let mut seen = last_seen_ref.lock().unwrap();
                                for i in 0..count {
                                    if let Ok(item) = toast_list.GetAt(i) {
                                        if let Ok(id) = item.Id() {
                                            seen.push(id);
                                        }
                                    }
                                }
                                is_first_poll = false;
                                continue;
                            }

                            for i in 0..count {
                                if let Ok(notif_item) = toast_list.GetAt(i) {
                                    let id = notif_item.Id().unwrap_or(0);
                                    let is_new = {
                                        let mut seen = last_seen_ref.lock().unwrap();
                                        if seen.contains(&id) {
                                            false
                                        } else {
                                            if seen.len() > 100 {
                                                seen.remove(0);
                                            }
                                            seen.push(id);
                                            true
                                        }
                                    };

                                    if is_new {
                                        let mut title = String::new();
                                        let mut body = String::new();

                                        if let Ok(toast) = notif_item.Notification() {
                                            if let Ok(visual) = toast.Visual() {
                                                if let Ok(bindings) = visual.Bindings() {
                                                    let b_count = bindings.Size().unwrap_or(0);
                                                    for b_idx in 0..b_count {
                                                        if let Ok(binding) = bindings.GetAt(b_idx) {
                                                            if let Ok(text_elements) = binding.GetTextElements() {
                                                                let t_count = text_elements.Size().unwrap_or(0);
                                                                for t_idx in 0..t_count {
                                                                    if let Ok(el) = text_elements.GetAt(t_idx) {
                                                                        if let Ok(txt) = el.Text() {
                                                                            let str_val = txt.to_string();
                                                                            if title.is_empty() {
                                                                                title = str_val;
                                                                            } else if body.is_empty() {
                                                                                body = str_val;
                                                                            } else {
                                                                                body.push_str(" ");
                                                                                body.push_str(&str_val);
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }

                                        // Extract AppInfo fields
                                        let app_info = notif_item.AppInfo().ok();
                                        let aumid = app_info
                                            .as_ref()
                                            .and_then(|a| a.AppUserModelId().ok())
                                            .map(|s| s.to_string())
                                            .unwrap_or_default();
                                        let app_id = app_info
                                            .as_ref()
                                            .and_then(|a| a.Id().ok())
                                            .map(|s| s.to_string())
                                            .unwrap_or_default();
                                        let display_info = app_info.as_ref().and_then(|a| a.DisplayInfo().ok());
                                        let display_name = display_info
                                            .as_ref()
                                            .and_then(|d| d.DisplayName().ok())
                                            .map(|s| s.to_string())
                                            .unwrap_or_default();

                                        // Step 1: Log AppInfo fields to developer panel only
                                        let _ = app.emit(
                                            "dev:log",
                                            format!(
                                                "[Notification AppInfo] AUMID='{}', DisplayName='{}', Id='{}'",
                                                aumid, display_name, app_id
                                            ),
                                        );

                                        // Step 2: Resolve app source name and icon (with caching)
                                        let (resolved_name, resolved_icon) =
                                            resolve_app_source(&aumid, &display_name);

                                        if !title.is_empty() || !body.is_empty() {
                                            let now = SystemTime::now()
                                                .duration_since(UNIX_EPOCH)
                                                .unwrap_or_default()
                                                .as_secs();

                                            let payload = AppNotification {
                                                id: id.to_string(),
                                                title: if title.is_empty() {
                                                    "Notification".to_string()
                                                } else {
                                                    title
                                                },
                                                text: body,
                                                app_name: Some(resolved_name),
                                                app_icon: resolved_icon,
                                                aumid: if aumid.is_empty() { None } else { Some(aumid) },
                                                target: None,
                                                priority: "normal".to_string(),
                                                actions: None,
                                                timestamp: now,
                                            };

                                            let _ = app.emit("system-notification-received", payload);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
    }
}

/// Resolves the friendly application name and extracts its icon as base64 data URL.
/// Results are cached in APP_SOURCE_CACHE.
pub fn resolve_app_source(aumid: &str, display_name: &str) -> (String, Option<String>) {
    let cache_key = if !aumid.is_empty() {
        aumid.to_string()
    } else if !display_name.is_empty() {
        display_name.to_string()
    } else {
        "UnknownApp".to_string()
    };

    // 1. Check cache
    {
        if let Ok(cache) = get_cache().lock() {
            if let Some(entry) = cache.get(&cache_key) {
                return entry.clone();
            }
        }
    }

    // 2. Resolve friendly app name
    let clean_display = display_name.trim();
    let name = if !clean_display.is_empty() {
        clean_display.to_string()
    } else {
        let aumid_lower = aumid.to_lowercase();
        if aumid_lower.contains("discord") {
            "Discord".to_string()
        } else if aumid_lower.contains("telegram") {
            "Telegram".to_string()
        } else if aumid_lower == "chrome" || aumid_lower.contains("chrome") {
            "Google Chrome".to_string()
        } else if aumid_lower.contains("edge") || aumid_lower.contains("msedge") {
            "Microsoft Edge".to_string()
        } else if aumid_lower.contains("powershell") {
            "Windows PowerShell".to_string()
        } else if aumid_lower.contains("code") || aumid_lower.contains("vscode") {
            "Visual Studio Code".to_string()
        } else if aumid_lower.contains("slack") {
            "Slack".to_string()
        } else if aumid_lower.contains("spotify") {
            "Spotify".to_string()
        } else if aumid_lower.contains("antigravity") {
            "Antigravity".to_string()
        } else if aumid_lower.contains("screensketch") || aumid_lower.contains("snip") {
            "Snip & Sketch".to_string()
        } else if let Some(filename) = Path::new(aumid).file_stem().and_then(|s| s.to_str()) {
            filename.to_string()
        } else if !aumid.trim().is_empty() {
            aumid.trim().to_string()
        } else {
            "Notification".to_string()
        }
    };

    // 3. Find executable path and extract icon
    let exe_path = find_app_executable(aumid, &name);
    let icon_data_url = exe_path.as_ref().and_then(|p| extract_exe_icon(p));

    let result = (name, icon_data_url);

    // 4. Save to cache
    if let Ok(mut cache) = get_cache().lock() {
        cache.insert(cache_key, result.clone());
    }

    result
}

/// Locates the executable for a given application
pub fn find_app_executable(aumid: &str, app_name: &str) -> Option<PathBuf> {
    // 1. Direct path in AUMID
    let aumid_path = Path::new(aumid);
    if aumid_path.exists() && aumid_path.extension().map_or(false, |ext| ext == "exe") {
        return Some(aumid_path.to_path_buf());
    }

    // 2. Extract path from AUMIDs containing {GUID}\path\foo.exe
    if let Some(idx) = aumid.find('}') {
        let after_brace = &aumid[idx + 1..].trim_start_matches('\\');
        let sys_path = PathBuf::from("C:\\Windows\\System32").join(after_brace);
        if sys_path.exists() {
            return Some(sys_path);
        }
        let win_path = PathBuf::from("C:\\Windows").join(after_brace);
        if win_path.exists() {
            return Some(win_path);
        }
    }

    let norm_name = app_name.to_lowercase();

    // 3. Known application paths
    if norm_name.contains("chrome") {
        let p1 = PathBuf::from(r"C:\Program Files\Google\Chrome\Application\chrome.exe");
        if p1.exists() {
            return Some(p1);
        }
        let p2 = PathBuf::from(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe");
        if p2.exists() {
            return Some(p2);
        }
    }

    if norm_name.contains("discord") {
        if let Some(local) = std::env::var_os("LOCALAPPDATA") {
            let discord_dir = PathBuf::from(local).join("Discord");
            if let Ok(entries) = std::fs::read_dir(&discord_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir()
                        && path
                            .file_name()
                            .and_then(|n| n.to_str())
                            .map_or(false, |n| n.starts_with("app-"))
                    {
                        let exe = path.join("Discord.exe");
                        if exe.exists() {
                            return Some(exe);
                        }
                    }
                }
            }
            let update_exe = discord_dir.join("Update.exe");
            if update_exe.exists() {
                return Some(update_exe);
            }
        }
    }

    if norm_name.contains("telegram") {
        if let Some(appdata) = std::env::var_os("APPDATA") {
            let tg = PathBuf::from(appdata).join(r"Telegram Desktop\Telegram.exe");
            if tg.exists() {
                return Some(tg);
            }
        }
        let p1 = PathBuf::from(r"C:\Program Files\Telegram Desktop\Telegram.exe");
        if p1.exists() {
            return Some(p1);
        }
    }

    if norm_name.contains("powershell") {
        let ps = PathBuf::from(r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe");
        if ps.exists() {
            return Some(ps);
        }
    }

    if norm_name.contains("code") || norm_name.contains("visual studio code") {
        if let Some(local) = std::env::var_os("LOCALAPPDATA") {
            let vsc = PathBuf::from(local).join(r"Programs\Microsoft VS Code\Code.exe");
            if vsc.exists() {
                return Some(vsc);
            }
        }
        let p1 = PathBuf::from(r"C:\Program Files\Microsoft VS Code\Code.exe");
        if p1.exists() {
            return Some(p1);
        }
    }

    if norm_name.contains("edge") || norm_name.contains("msedge") {
        let p1 = PathBuf::from(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe");
        if p1.exists() {
            return Some(p1);
        }
    }

    if norm_name.contains("spotify") {
        if let Some(appdata) = std::env::var_os("APPDATA") {
            let spot = PathBuf::from(appdata).join(r"Spotify\Spotify.exe");
            if spot.exists() {
                return Some(spot);
            }
        }
    }

    if norm_name.contains("slack") {
        if let Some(local) = std::env::var_os("LOCALAPPDATA") {
            let slk = PathBuf::from(local).join(r"slack\slack.exe");
            if slk.exists() {
                return Some(slk);
            }
        }
    }

    None
}

/// Extracts the first icon from an executable and converts it to a 32-bit BMP data URL
#[cfg(target_os = "windows")]
pub fn extract_exe_icon(exe_path: &Path) -> Option<String> {
    use windows_sys::Win32::UI::Shell::ExtractIconExW;
    use windows_sys::Win32::UI::WindowsAndMessaging::*;

    let wide_path: Vec<u16> = exe_path
        .to_string_lossy()
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();

    unsafe {
        let mut hicon_large: HICON = std::ptr::null_mut();
        let mut hicon_small: HICON = std::ptr::null_mut();
        let count = ExtractIconExW(
            wide_path.as_ptr(),
            0,
            &mut hicon_large,
            &mut hicon_small,
            1,
        );

        let hicon = if !hicon_small.is_null() {
            if !hicon_large.is_null() {
                DestroyIcon(hicon_large);
            }
            hicon_small
        } else if !hicon_large.is_null() {
            hicon_large
        } else {
            return None;
        };

        if count == 0 || hicon.is_null() {
            return None;
        }

        let result = hicon_to_base64_bmp(hicon);
        DestroyIcon(hicon);
        result
    }
}

#[cfg(not(target_os = "windows"))]
pub fn extract_exe_icon(_exe_path: &Path) -> Option<String> {
    None
}

/// Converts a Win32 HICON to a valid 32-bit BMP data URL (data:image/bmp;base64,...)
#[cfg(target_os = "windows")]
unsafe fn hicon_to_base64_bmp(hicon: windows_sys::Win32::UI::WindowsAndMessaging::HICON) -> Option<String> {
    use windows_sys::Win32::Graphics::Gdi::*;
    use windows_sys::Win32::UI::WindowsAndMessaging::*;

    let mut icon_info = ICONINFO {
        fIcon: 0,
        xHotspot: 0,
        yHotspot: 0,
        hbmMask: std::ptr::null_mut(),
        hbmColor: std::ptr::null_mut(),
    };

    if GetIconInfo(hicon, &mut icon_info) == 0 {
        return None;
    }

    let hbm = if !icon_info.hbmColor.is_null() {
        icon_info.hbmColor
    } else {
        icon_info.hbmMask
    };

    let mut bm = BITMAP {
        bmType: 0,
        bmWidth: 0,
        bmHeight: 0,
        bmWidthBytes: 0,
        bmPlanes: 0,
        bmBitsPixel: 0,
        bmBits: std::ptr::null_mut(),
    };

    if GetObjectW(
        hbm as _,
        std::mem::size_of::<BITMAP>() as i32,
        &mut bm as *mut _ as *mut _,
    ) == 0
    {
        if !icon_info.hbmColor.is_null() {
            DeleteObject(icon_info.hbmColor as _);
        }
        if !icon_info.hbmMask.is_null() {
            DeleteObject(icon_info.hbmMask as _);
        }
        return None;
    }

    let width = bm.bmWidth;
    let height = bm.bmHeight;
    if width <= 0 || height <= 0 {
        if !icon_info.hbmColor.is_null() {
            DeleteObject(icon_info.hbmColor as _);
        }
        if !icon_info.hbmMask.is_null() {
            DeleteObject(icon_info.hbmMask as _);
        }
        return None;
    }

    let hdc = GetDC(std::ptr::null_mut());
    let mut bi = BITMAPINFO {
        bmiHeader: BITMAPINFOHEADER {
            biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: width,
            biHeight: -height, // top-down
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB,
            biSizeImage: (width * height * 4) as u32,
            biXPelsPerMeter: 0,
            biYPelsPerMeter: 0,
            biClrUsed: 0,
            biClrImportant: 0,
        },
        bmiColors: [RGBQUAD {
            rgbBlue: 0,
            rgbGreen: 0,
            rgbRed: 0,
            rgbReserved: 0,
        }],
    };

    let mut buffer = vec![0u8; (width * height * 4) as usize];
    let lines = GetDIBits(
        hdc,
        hbm,
        0,
        height as u32,
        buffer.as_mut_ptr() as *mut _,
        &mut bi,
        DIB_RGB_COLORS,
    );
    ReleaseDC(std::ptr::null_mut(), hdc);

    if !icon_info.hbmColor.is_null() {
        DeleteObject(icon_info.hbmColor as _);
    }
    if !icon_info.hbmMask.is_null() {
        DeleteObject(icon_info.hbmMask as _);
    }

    if lines == 0 {
        return None;
    }

    // Check if alpha channel exists; if all alpha bytes are 0, make them fully opaque
    let mut has_alpha = false;
    for chunk in buffer.chunks_exact(4) {
        if chunk[3] > 0 {
            has_alpha = true;
            break;
        }
    }
    if !has_alpha {
        for chunk in buffer.chunks_exact_mut(4) {
            chunk[3] = 255;
        }
    }

    // Construct BMP header: 14 bytes BITMAPFILEHEADER + 40 bytes BITMAPINFOHEADER + raw BGRA
    let file_header_size = 14u32;
    let info_header_size = 40u32;
    let pixel_data_size = (width * height * 4) as u32;
    let total_size = file_header_size + info_header_size + pixel_data_size;

    let mut bmp_bytes = Vec::with_capacity(total_size as usize);
    // BITMAPFILEHEADER
    bmp_bytes.extend_from_slice(b"BM");
    bmp_bytes.extend_from_slice(&total_size.to_le_bytes());
    bmp_bytes.extend_from_slice(&0u32.to_le_bytes());
    bmp_bytes.extend_from_slice(&(file_header_size + info_header_size).to_le_bytes());

    // BITMAPINFOHEADER
    bmp_bytes.extend_from_slice(&info_header_size.to_le_bytes());
    bmp_bytes.extend_from_slice(&width.to_le_bytes());
    bmp_bytes.extend_from_slice(&(-height).to_le_bytes());
    bmp_bytes.extend_from_slice(&1u16.to_le_bytes());
    bmp_bytes.extend_from_slice(&32u16.to_le_bytes());
    bmp_bytes.extend_from_slice(&0u32.to_le_bytes());
    bmp_bytes.extend_from_slice(&pixel_data_size.to_le_bytes());
    bmp_bytes.extend_from_slice(&0u32.to_le_bytes());
    bmp_bytes.extend_from_slice(&0u32.to_le_bytes());
    bmp_bytes.extend_from_slice(&0u32.to_le_bytes());
    bmp_bytes.extend_from_slice(&0u32.to_le_bytes());

    bmp_bytes.extend_from_slice(&buffer);

    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bmp_bytes);
    Some(format!("data:image/bmp;base64,{}", b64))
}
