pub mod context;
pub mod credentials;
pub mod downloader;
pub mod hardware;
pub mod hotkeys;
pub mod media;
pub mod notifications;
pub mod sidecar;
pub mod storage;
pub mod tools;
pub mod window_walker;

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, State,
};

use downloader::{DownloadManager, InstalledModel, ModelSpec};
use hardware::{detect_hardware, get_system_status, DiskDriveInfo, HardwareInfo, SystemStatus};
use sidecar::{SidecarInfo, SidecarManager};
use storage::{Conversation, MessageRecord, StorageManager};

pub fn log_step(msg: &str) {
    use std::io::Write;
    let log_path = std::env::temp_dir().join("mintu_startup.log");
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(log_path) {
        let _ = writeln!(f, "[{:?}] {}", std::time::SystemTime::now(), msg);
    }
}

/// Bounding rectangle in logical pixels for interactive regions.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct HitRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ScreenWorkArea {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale_factor: f64,
}

pub struct AppState {
    pub hit_regions: Arc<Mutex<HashMap<String, Vec<HitRect>>>>,
    pub mode: Arc<Mutex<String>>,
    pub storage: Arc<StorageManager>,
    pub downloader: Arc<DownloadManager>,
    pub sidecar: SidecarManager,
    pub models_dir: Arc<std::sync::RwLock<PathBuf>>,
    pub media: Arc<media::MediaManager>,
    pub notifications: Arc<notifications::NotificationManager>,
}

// ==========================================
// Window & Hit Region Commands
// ==========================================

#[tauri::command]
fn set_hit_regions(
    state: State<'_, AppState>,
    window_label: String,
    regions: Vec<HitRect>,
) -> Result<(), String> {
    let mut map = state.hit_regions.lock().map_err(|e| e.to_string())?;
    map.insert(window_label, regions);
    Ok(())
}

#[tauri::command]
fn set_app_mode(
    app: AppHandle,
    state: State<'_, AppState>,
    mode: String,
) -> Result<(), String> {
    {
        let mut current = state.mode.lock().map_err(|e| e.to_string())?;
        *current = mode.clone();
    }
    let _ = app.emit("mode-changed", mode);
    Ok(())
}

#[tauri::command]
fn focus_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_focus();
    }
    Ok(())
}

#[tauri::command]
fn get_work_area(app: AppHandle) -> Result<ScreenWorkArea, String> {
    if let Some(window) = app.get_webview_window("main") {
        if let Ok(Some(monitor)) = window.primary_monitor() {
            let scale = monitor.scale_factor();
            let mon_pos = monitor.position();
            let mon_size = monitor.size();

            #[cfg(target_os = "windows")]
            {
                unsafe {
                    let mut rect = windows_sys::Win32::Foundation::RECT {
                        left: 0,
                        top: 0,
                        right: 0,
                        bottom: 0,
                    };
                    if windows_sys::Win32::UI::WindowsAndMessaging::SystemParametersInfoW(
                        windows_sys::Win32::UI::WindowsAndMessaging::SPI_GETWORKAREA,
                        0,
                        &mut rect as *mut _ as *mut _,
                        0,
                    ) != 0
                    {
                        return Ok(ScreenWorkArea {
                            x: rect.left,
                            y: rect.top,
                            width: (rect.right - rect.left) as u32,
                            height: (rect.bottom - rect.top) as u32,
                            scale_factor: scale,
                        });
                    }
                }
            }

            return Ok(ScreenWorkArea {
                x: mon_pos.x,
                y: mon_pos.y,
                width: mon_size.width,
                height: mon_size.height,
                scale_factor: scale,
            });
        }
    }
    Err("Could not retrieve primary monitor".to_string())
}

#[tauri::command]
fn emit_bus_event(app: AppHandle, event: String, payload: String) -> Result<(), String> {
    app.emit(&event, payload).map_err(|e| e.to_string())
}

// ==========================================
// Hardware & System Commands
// ==========================================

#[tauri::command]
fn get_hardware_info(state: State<'_, AppState>) -> Result<HardwareInfo, String> {
    let p = state.models_dir.read().map_err(|e| e.to_string())?;
    Ok(detect_hardware(&p))
}

#[tauri::command]
fn get_system_status_info() -> Result<SystemStatus, String> {
    Ok(get_system_status())
}

// ==========================================
// Database & Storage Commands
// ==========================================

#[tauri::command]
fn db_list_conversations(state: State<'_, AppState>) -> Result<Vec<Conversation>, String> {
    state.storage.list_conversations()
}

#[tauri::command]
fn db_create_conversation(
    state: State<'_, AppState>,
    id: String,
    title: String,
    model: String,
) -> Result<Conversation, String> {
    state.storage.create_conversation(id, title, model)
}

#[tauri::command]
fn db_rename_conversation(
    state: State<'_, AppState>,
    id: String,
    new_title: String,
) -> Result<(), String> {
    state.storage.rename_conversation(id, new_title)
}

#[tauri::command]
fn db_delete_conversation(state: State<'_, AppState>, id: String) -> Result<(), String> {
    state.storage.delete_conversation(id)
}

#[tauri::command]
fn db_get_messages(
    state: State<'_, AppState>,
    conversation_id: String,
) -> Result<Vec<MessageRecord>, String> {
    state.storage.get_messages(conversation_id)
}

#[tauri::command]
fn db_save_message(state: State<'_, AppState>, msg: MessageRecord) -> Result<(), String> {
    state.storage.save_message(msg)
}

#[tauri::command]
fn db_export_markdown(
    state: State<'_, AppState>,
    conversation_id: String,
) -> Result<String, String> {
    state.storage.export_markdown(conversation_id)
}

#[tauri::command]
fn db_pin_conversation(
    state: State<'_, AppState>,
    id: String,
    pinned: bool,
) -> Result<(), String> {
    state.storage.pin_conversation(id, pinned)
}

#[tauri::command]
fn db_save_draft(
    state: State<'_, AppState>,
    id: String,
    draft: String,
) -> Result<(), String> {
    state.storage.save_draft(id, draft)
}

#[tauri::command]
fn db_duplicate_conversation(
    state: State<'_, AppState>,
    id: String,
    new_id: String,
) -> Result<storage::Conversation, String> {
    state.storage.duplicate_conversation(id, new_id)
}

#[tauri::command]
fn db_clear_messages(
    state: State<'_, AppState>,
    conversation_id: String,
) -> Result<(), String> {
    state.storage.clear_messages(conversation_id)
}

#[tauri::command]
fn db_search_chats(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<storage::ChatSearchResult>, String> {
    state.storage.search_chats(query)
}

#[tauri::command]
fn db_save_memory(
    state: State<'_, AppState>,
    memory: storage::MemoryEntry,
) -> Result<(), String> {
    state.storage.save_memory(memory)
}

#[tauri::command]
fn db_list_memories(
    state: State<'_, AppState>,
) -> Result<Vec<storage::MemoryEntry>, String> {
    state.storage.list_memories()
}

#[tauri::command]
fn db_search_memories(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<storage::MemoryEntry>, String> {
    state.storage.search_memories(query)
}

#[tauri::command]
fn db_pin_memory(
    state: State<'_, AppState>,
    id: String,
    pinned: bool,
) -> Result<(), String> {
    state.storage.pin_memory(id, pinned)
}

#[tauri::command]
fn db_delete_memory(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    state.storage.delete_memory(id)
}

#[tauri::command]
fn db_forget_all_memories(
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.storage.forget_all_memories()
}

#[tauri::command]
fn db_export_memories_markdown(
    state: State<'_, AppState>,
) -> Result<String, String> {
    state.storage.export_memories_markdown()
}

// ==========================================
// Model Downloader Commands
// ==========================================

#[tauri::command]
fn get_installed_models(state: State<'_, AppState>) -> Result<Vec<InstalledModel>, String> {
    Ok(state.downloader.list_installed())
}

#[tauri::command]
async fn start_model_download(
    app: AppHandle,
    state: State<'_, AppState>,
    spec: ModelSpec,
) -> Result<(), String> {
    state.downloader.start_download(app, spec).await
}

#[tauri::command]
async fn pause_model_download(
    state: State<'_, AppState>,
    model_id: String,
) -> Result<(), String> {
    state.downloader.pause_download(&model_id).await;
    Ok(())
}

#[tauri::command]
async fn cancel_model_download(
    app: AppHandle,
    state: State<'_, AppState>,
    model_id: String,
) -> Result<(), String> {
    state.downloader.cancel_download(app, &model_id).await
}

#[tauri::command]
async fn delete_model(
    app: AppHandle,
    state: State<'_, AppState>,
    model_id: String,
) -> Result<(), String> {
    state.downloader.delete_model(app, &model_id).await
}

#[tauri::command]
fn get_models_dir(state: State<'_, AppState>) -> Result<String, String> {
    let path = state.models_dir.read().map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn set_models_dir(
    state: State<'_, AppState>,
    new_path: String,
    move_existing: Option<bool>,
) -> Result<HardwareInfo, String> {
    let trimmed = new_path.trim();
    if trimmed.is_empty() {
        return Err("Path cannot be empty".to_string());
    }
    let new_p = PathBuf::from(trimmed);
    std::fs::create_dir_all(&new_p).map_err(|e| format!("Failed to create folder {}: {}", trimmed, e))?;

    let old_p = {
        let lock = state.models_dir.read().map_err(|e| e.to_string())?;
        lock.clone()
    };

    // Optionally move existing .gguf files
    if move_existing.unwrap_or(false) && old_p != new_p && old_p.exists() {
        if let Ok(entries) = std::fs::read_dir(&old_p) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_file() {
                    let ext = p.extension().and_then(|s| s.to_str()).unwrap_or("");
                    if ext == "gguf" || ext == "part" {
                        if let Some(file_name) = p.file_name() {
                            let dest = new_p.join(file_name);
                            let _ = std::fs::copy(&p, &dest);
                            let _ = std::fs::remove_file(&p);
                        }
                    }
                }
            }
        }
    }

    // Update DownloadManager and state
    state.downloader.set_models_dir(new_p.clone())?;
    {
        let mut lock = state.models_dir.write().map_err(|e| e.to_string())?;
        *lock = new_p.clone();
    }

    // Persist in SQLite
    let _ = state.storage.set_setting("models_dir", &new_p.to_string_lossy());

    // Return new HardwareInfo with disk space re-calculated for new path
    Ok(detect_hardware(&new_p))
}

#[tauri::command]
fn get_available_disks(state: State<'_, AppState>) -> Result<Vec<DiskDriveInfo>, String> {
    let p = state.models_dir.read().map_err(|e| e.to_string())?;
    Ok(hardware::get_available_disks(&p))
}

#[tauri::command]
async fn browse_models_dir() -> Result<Option<String>, String> {
    tokio::task::spawn_blocking(|| {
        #[cfg(target_os = "windows")]
        {
            use std::process::Command;
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;

            let script = r#"
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = 'Select Mintu Models Storage Folder'
$dialog.ShowNewFolderButton = $true
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    Write-Output $dialog.SelectedPath
}
"#;
            let output = Command::new("powershell.exe")
                .arg("-NoProfile")
                .arg("-NonInteractive")
                .arg("-Command")
                .arg(script)
                .creation_flags(CREATE_NO_WINDOW)
                .output()
                .map_err(|e| e.to_string())?;

            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !stdout.is_empty() {
                    return Ok(Some(stdout));
                }
            }
            Ok(None)
        }
        #[cfg(not(target_os = "windows"))]
        {
            Ok(None)
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

// ==========================================
// Llama Sidecar Commands
// ==========================================

#[tauri::command]
async fn start_sidecar(
    app: AppHandle,
    state: State<'_, AppState>,
    model_id: String,
    context_length: Option<u32>,
    threads: Option<u32>,
) -> Result<SidecarInfo, String> {
    let model_path = state
        .downloader
        .get_model_path(&model_id)
        .ok_or_else(|| format!("Model {} is not installed on disk", model_id))?;

    let ctx = context_length.unwrap_or(2048);
    let th = threads.unwrap_or_else(|| {
        let p = state.models_dir.read().unwrap();
        let hw = detect_hardware(&p);
        (hw.cpu_cores / 2).max(2) as u32
    });

    state.sidecar.start(&app, model_path, ctx, th).await
}

#[tauri::command]
async fn stop_sidecar(state: State<'_, AppState>) -> Result<(), String> {
    state.sidecar.stop().await
}

#[tauri::command]
async fn get_sidecar_info(state: State<'_, AppState>) -> Result<SidecarInfo, String> {
    Ok(state.sidecar.get_info().await)
}

#[tauri::command]
async fn touch_sidecar_activity(state: State<'_, AppState>) -> Result<(), String> {
    state.sidecar.touch_activity().await;
    Ok(())
}

#[tauri::command]
async fn ensure_sidecar_running(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SidecarInfo, String> {
    state.sidecar.ensure_running(&app).await
}

// ==========================================
// Context & OCR Commands
// ==========================================

#[tauri::command]
fn get_active_window() -> Result<context::ActiveWindowInfo, String> {
    Ok(context::get_active_window_info())
}

#[tauri::command]
fn capture_context() -> Result<context::CapturedContext, String> {
    let app_info = context::get_active_window_info();
    if app_info.is_blocked {
        return Ok(context::CapturedContext {
            text: None,
            image_base64: None,
            app_info,
        });
    }

    let text_res = context::capture_selected_text().unwrap_or_default();
    let text = if text_res.trim().is_empty() {
        None
    } else {
        Some(text_res.trim().to_string())
    };

    Ok(context::CapturedContext {
        text,
        image_base64: None,
        app_info,
    })
}

#[tauri::command]
fn capture_region_and_ocr(
    x: i32,
    y: i32,
    width: i32,
    height: i32,
) -> Result<context::CapturedContext, String> {
    context::capture_region_and_ocr(x, y, width, height)
}

#[tauri::command]
fn open_region_capture(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("capture") {
        if let Ok(Some(monitor)) = win.primary_monitor() {
            let mon_pos = monitor.position();
            let mon_size = monitor.size();
            let _ = win.set_position(PhysicalPosition::new(mon_pos.x, mon_pos.y));
            let _ = win.set_size(PhysicalSize::new(mon_size.width, mon_size.height));
            let _ = win.set_always_on_top(true);
        }
        let _ = win.show();
        let _ = win.set_focus();
    } else {
        let win = tauri::WebviewWindowBuilder::new(
            &app,
            "capture",
            tauri::WebviewUrl::App("capture.html".into()),
        )
        .title("Mintu Region Capture")
        .transparent(true)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .shadow(false)
        .build();

        if let Ok(win) = win {
            if let Ok(Some(monitor)) = win.primary_monitor() {
                let mon_pos = monitor.position();
                let mon_size = monitor.size();
                let _ = win.set_position(PhysicalPosition::new(mon_pos.x, mon_pos.y));
                let _ = win.set_size(PhysicalSize::new(mon_size.width, mon_size.height));
            }
            let _ = win.show();
            let _ = win.set_focus();
        }
    }
    Ok(())
}

#[tauri::command]
fn close_region_capture(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("capture") {
        let _ = win.hide();
    }
    Ok(())
}

#[tauri::command]
fn set_privacy_blocklist(blocklist: Vec<String>) -> Result<(), String> {
    context::set_custom_blocklist(blocklist);
    Ok(())
}

// ==========================================
// Media SMTC Commands
// ==========================================

#[tauri::command]
fn media_get_state(state: State<'_, AppState>) -> Result<media::MediaState, String> {
    Ok(state.media.get_state())
}

#[tauri::command]
async fn media_toggle_play_pause(app: tauri::AppHandle, state: State<'_, AppState>) -> Result<bool, String> {
    let res = state.media.toggle_play_pause().await;
    let cur = state.media.get_state();
    let _ = app.emit("media-state-changed", cur);

    let media_clone = state.media.clone();
    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(150)).await;
        if let Ok(fresh) = media_clone.provider.query_state() {
            {
                let mut lock = media_clone.last_state.lock().unwrap();
                *lock = fresh.clone();
            }
            let _ = app_clone.emit("media-state-changed", fresh);
        }
    });

    res
}

#[tauri::command]
async fn media_next(state: State<'_, AppState>) -> Result<bool, String> {
    state.media.next_track().await
}

#[tauri::command]
async fn media_previous(state: State<'_, AppState>) -> Result<bool, String> {
    state.media.previous_track().await
}

// ==========================================
// Notification Commands
// ==========================================

#[tauri::command]
fn push_notification(
    app: AppHandle,
    state: State<'_, AppState>,
    notif: notifications::AppNotification,
) -> Result<(), String> {
    state.notifications.push_notification(notif, &app);
    Ok(())
}

#[tauri::command]
fn pop_notification(
    state: State<'_, AppState>,
) -> Result<Option<notifications::AppNotification>, String> {
    Ok(state.notifications.pop_notification())
}

#[tauri::command]
fn focus_app_window(app_name: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    unsafe {
        use windows_sys::Win32::Foundation::{BOOL, HWND, LPARAM};
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            BringWindowToTop, EnumWindows, FlashWindowEx,
            GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId,
            IsIconic, IsWindowVisible, SetForegroundWindow, ShowWindow,
            FLASHWINFO, FLASHW_TIMERNOFG, FLASHW_TRAY, SW_RESTORE, SW_SHOW,
        };
        use windows_sys::Win32::System::Threading::{
            GetCurrentThreadId, OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
        };

        #[link(name = "user32")]
        extern "system" {
            fn AttachThreadInput(idattach: u32, idattachto: u32, fattach: BOOL) -> BOOL;
        }

        struct SearchContext {
            target: String,
            found_hwnd: Option<HWND>,
        }

        unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
            let ctx = &mut *(lparam as *mut SearchContext);
            if IsWindowVisible(hwnd) == 0 {
                return 1;
            }

            let mut title_buf = [0u16; 512];
            let len = GetWindowTextW(hwnd, title_buf.as_mut_ptr(), 512);
            let title = String::from_utf16_lossy(&title_buf[..len as usize]).to_lowercase();

            let mut pid = 0u32;
            GetWindowThreadProcessId(hwnd, &mut pid);
            let mut proc_name = String::new();
            if pid != 0 {
                let h_proc = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
                if !h_proc.is_null() {
                    let mut path_buf = [0u16; 1024];
                    let mut path_len = 1024u32;
                    if QueryFullProcessImageNameW(h_proc, 0, path_buf.as_mut_ptr(), &mut path_len) != 0 {
                        let full = String::from_utf16_lossy(&path_buf[..path_len as usize]);
                        if let Some(f) = std::path::Path::new(&full).file_name().and_then(|n| n.to_str()) {
                            proc_name = f.to_lowercase();
                        }
                    }
                    windows_sys::Win32::Foundation::CloseHandle(h_proc);
                }
            }

            let proc_stem = proc_name.strip_suffix(".exe").unwrap_or(&proc_name).trim();
            let target_lower = ctx.target.to_lowercase();
            let target_stem = target_lower.strip_suffix(".exe").unwrap_or(&target_lower).trim();

            let target_words: Vec<&str> = target_stem
                .split(|c: char| !c.is_alphanumeric())
                .filter(|w| w.len() >= 3)
                .collect();

            let matches = proc_stem == target_stem
                || (!proc_stem.is_empty() && target_stem.contains(proc_stem))
                || (!target_stem.is_empty() && proc_stem.contains(target_stem))
                || target_words.iter().any(|w| proc_stem.contains(w) || title.contains(w))
                || (target_lower.contains("discord") && (proc_stem.contains("discord") || title.contains("discord")))
                || (target_lower.contains("telegram") && (proc_stem.contains("telegram") || title.contains("telegram")))
                || (target_lower.contains("chrome") && (proc_stem.contains("chrome") || title.contains("chrome")))
                || (target_lower.contains("edge") && (proc_stem.contains("msedge") || title.contains("edge")))
                || (target_lower.contains("powershell") && (proc_stem.contains("powershell") || title.contains("powershell")))
                || (target_lower.contains("code") && (proc_stem.contains("code") || title.contains("visual studio code")))
                || (target_lower.contains("slack") && (proc_stem.contains("slack") || title.contains("slack")))
                || (target_lower.contains("spotify") && (proc_stem.contains("spotify") || title.contains("spotify")))
                || (target_lower.contains("mail") && (proc_stem.contains("outlook") || proc_stem.contains("hxoutlook") || title.contains("mail") || title.contains("outlook")))
                || (target_lower.contains("calendar") && (proc_stem.contains("hxcalendar") || title.contains("calendar")));

            if matches {
                ctx.found_hwnd = Some(hwnd);
                return 0; // Stop enumeration
            }

            1
        }

        let mut ctx = SearchContext {
            target: app_name.clone(),
            found_hwnd: None,
        };

        EnumWindows(Some(enum_proc), &mut ctx as *mut _ as LPARAM);

        if let Some(hwnd) = ctx.found_hwnd {
            if IsIconic(hwnd) != 0 {
                ShowWindow(hwnd, SW_RESTORE);
            } else {
                ShowWindow(hwnd, SW_SHOW);
            }

            let fg_hwnd = GetForegroundWindow();
            let fg_thread = GetWindowThreadProcessId(fg_hwnd, std::ptr::null_mut());
            let target_thread = GetWindowThreadProcessId(hwnd, std::ptr::null_mut());
            let current_thread = GetCurrentThreadId();

            if fg_thread != 0 && fg_thread != target_thread {
                AttachThreadInput(current_thread, fg_thread, 1);
            }
            if target_thread != 0 && current_thread != target_thread {
                AttachThreadInput(current_thread, target_thread, 1);
            }

            BringWindowToTop(hwnd);
            let success = SetForegroundWindow(hwnd) != 0;

            if fg_thread != 0 && fg_thread != target_thread {
                AttachThreadInput(current_thread, fg_thread, 0);
            }
            if target_thread != 0 && current_thread != target_thread {
                AttachThreadInput(current_thread, target_thread, 0);
            }

            if !success {
                // Flash taskbar as fallback if Windows foreground lock prevented direct focus
                let mut fwi = FLASHWINFO {
                    cbSize: std::mem::size_of::<FLASHWINFO>() as u32,
                    hwnd,
                    dwFlags: FLASHW_TRAY | FLASHW_TIMERNOFG,
                    uCount: 4,
                    dwTimeout: 0,
                };
                FlashWindowEx(&mut fwi);
            }

            return Ok(());
        }

        // Window not open: check if executable can be launched
        if let Some(exe_path) = notifications::find_app_executable("", &app_name) {
            if let Ok(_) = std::process::Command::new(exe_path).spawn() {
                return Ok(());
            }
        }

        Err(format!("Couldn't open {}", app_name))
    }

    #[cfg(not(target_os = "windows"))]
    Err(format!("Couldn't open {}", app_name))
}

#[tauri::command]
fn get_walkable_windows() -> Result<Vec<window_walker::WalkableWindow>, String> {
    Ok(window_walker::get_walkable_windows())
}

#[tauri::command]
fn set_window_ignore_list(list: Vec<String>) -> Result<(), String> {
    window_walker::set_window_ignore_list(list);
    Ok(())
}

// ==========================================
// Credential Commands (Windows Credential Manager)
// ==========================================

#[tauri::command]
fn store_api_key(provider: String, key: String) -> Result<(), String> {
    credentials::store_api_key(&provider, &key)
}

#[tauri::command]
fn get_key_status(provider: String) -> Result<credentials::KeyStatus, String> {
    Ok(credentials::get_key_status(&provider))
}

#[tauri::command]
fn delete_api_key(provider: String) -> Result<bool, String> {
    credentials::delete_api_key(&provider)
}

#[tauri::command]
fn get_api_key(provider: String) -> Result<Option<String>, String> {
    credentials::get_api_key(&provider)
}

// ==========================================
// Tool Primitive Commands
// ==========================================

#[tauri::command]
fn tools_move_to_recycle_bin(
    path: String,
    allowed_dirs: Option<Vec<String>>,
) -> Result<String, String> {
    let dirs = allowed_dirs.unwrap_or_else(tools::get_default_allowed_dirs);
    tools::move_file_to_recycle_bin(&path, &dirs)
}

#[tauri::command]
fn tools_search_files(
    query: String,
    subfolder: Option<String>,
    allowed_dirs: Option<Vec<String>>,
    max_results: Option<usize>,
) -> Result<Vec<tools::FileSearchResult>, String> {
    let dirs = allowed_dirs.unwrap_or_else(tools::get_default_allowed_dirs);
    tools::search_files_in_allowed_dirs(&query, subfolder.as_deref(), &dirs, max_results.unwrap_or(20))
}

#[tauri::command]
fn tools_list_installed_apps() -> Result<Vec<tools::InstalledAppInfo>, String> {
    Ok(tools::list_installed_apps())
}

#[tauri::command]
fn tools_open_app(name: String) -> Result<String, String> {
    tools::open_app_by_name(&name)
}

#[tauri::command]
fn tools_open_url(url: String) -> Result<String, String> {
    tools::open_browser_url(&url)
}

#[tauri::command]
fn tools_read_clipboard() -> Result<String, String> {
    tools::read_clipboard_text_safe()
}

#[tauri::command]
fn tools_get_default_allowed_dirs() -> Result<Vec<String>, String> {
    Ok(tools::get_default_allowed_dirs())
}

// ==========================================
// Storage - Audit Logs & Reminders Commands
// ==========================================

#[tauri::command]
fn db_save_audit_log(
    state: State<'_, AppState>,
    tool_name: String,
    params_summary: String,
    status: String,
    error: Option<String>,
) -> Result<i64, String> {
    state.storage.save_audit_log(tool_name, params_summary, status, error)
}

#[tauri::command]
fn db_list_audit_logs(
    state: State<'_, AppState>,
    limit: Option<u32>,
) -> Result<Vec<storage::AuditLogEntry>, String> {
    state.storage.list_audit_logs(limit.unwrap_or(50))
}

#[tauri::command]
fn db_clear_audit_logs(state: State<'_, AppState>) -> Result<(), String> {
    state.storage.clear_audit_logs()
}

#[tauri::command]
fn db_create_reminder(
    state: State<'_, AppState>,
    text: String,
    due_time: i64,
) -> Result<storage::ReminderEntry, String> {
    state.storage.create_reminder(text, due_time)
}

#[tauri::command]
fn db_list_reminders(
    state: State<'_, AppState>,
) -> Result<Vec<storage::ReminderEntry>, String> {
    state.storage.list_reminders()
}

#[tauri::command]
fn db_check_due_reminders(
    state: State<'_, AppState>,
) -> Result<Vec<storage::ReminderEntry>, String> {
    state.storage.get_due_reminders()
}

#[tauri::command]
fn db_update_reminder(
    state: State<'_, AppState>,
    id: i64,
    status: String,
) -> Result<(), String> {
    state.storage.update_reminder_status(id, status)
}

#[tauri::command]
fn db_delete_reminder(
    state: State<'_, AppState>,
    id: i64,
) -> Result<(), String> {
    state.storage.delete_reminder(id)
}

#[tauri::command]
fn get_autostart() -> bool {
    #[cfg(target_os = "windows")]
    {
        let output = std::process::Command::new("reg")
            .args(&["query", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run", "/v", "Mintu"])
            .output();
        match output {
            Ok(out) => out.status.success(),
            Err(_) => false,
        }
    }
    #[cfg(not(target_os = "windows"))]
    false
}

#[tauri::command]
fn set_autostart(enable: bool) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        if enable {
            let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
            let exe_str = exe_path.to_string_lossy().to_string();
            let val = format!("\"{}\"", exe_str);
            let status = std::process::Command::new("reg")
                .args(&["add", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run", "/v", "Mintu", "/t", "REG_SZ", "/d", &val, "/f"])
                .status()
                .map_err(|e| e.to_string())?;
            if status.success() {
                Ok(true)
            } else {
                Err("Failed to set autostart registry entry".to_string())
            }
        } else {
            let _ = std::process::Command::new("reg")
                .args(&["delete", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run", "/v", "Mintu", "/f"])
                .status();
            Ok(false)
        }
    }
    #[cfg(not(target_os = "windows"))]
    Ok(false)
}

// ==========================================
// Application Entrypoint
// ==========================================

pub fn run() {
    let hit_regions = Arc::new(Mutex::new(HashMap::<String, Vec<HitRect>>::new()));
    let app_mode = Arc::new(Mutex::new("island".to_string()));

    let hit_regions_clone = Arc::clone(&hit_regions);

    let builder = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            set_hit_regions,
            set_app_mode,
            get_work_area,
            emit_bus_event,
            get_hardware_info,
            get_system_status_info,
            db_list_conversations,
            db_create_conversation,
            db_rename_conversation,
            db_delete_conversation,
            db_get_messages,
            db_save_message,
            db_export_markdown,
            db_pin_conversation,
            db_save_draft,
            db_duplicate_conversation,
            db_clear_messages,
            db_search_chats,
            db_save_memory,
            db_list_memories,
            db_search_memories,
            db_pin_memory,
            db_delete_memory,
            db_forget_all_memories,
            db_export_memories_markdown,
            get_installed_models,
            start_model_download,
            pause_model_download,
            cancel_model_download,
            delete_model,
            get_models_dir,
            set_models_dir,
            get_available_disks,
            browse_models_dir,
            start_sidecar,
            stop_sidecar,
            get_sidecar_info,
            touch_sidecar_activity,
            ensure_sidecar_running,
            get_active_window,
            capture_context,
            capture_region_and_ocr,
            media_get_state,
            media_toggle_play_pause,
            media_next,
            media_previous,
            push_notification,
            pop_notification,
            open_region_capture,
            close_region_capture,
            focus_main_window,
            set_privacy_blocklist,
            focus_app_window,
            get_walkable_windows,
            set_window_ignore_list,
            store_api_key,
            get_key_status,
            delete_api_key,
            get_api_key,
            tools_move_to_recycle_bin,
            tools_search_files,
            tools_list_installed_apps,
            tools_open_app,
            tools_open_url,
            tools_read_clipboard,
            tools_get_default_allowed_dirs,
            db_save_audit_log,
            db_list_audit_logs,
            db_clear_audit_logs,
            db_create_reminder,
            db_list_reminders,
            db_check_due_reminders,
            db_update_reminder,
            db_delete_reminder,
            get_autostart,
            set_autostart
        ])
        .setup(move |app| {
            crate::log_step("=== SETUP STARTED ===");
            let handle = app.handle().clone();

            let app_data = app
                .path()
                .app_local_data_dir()
                .or_else(|_| app.path().app_data_dir())
                .unwrap_or_else(|_| {
                    if let Some(local) = std::env::var_os("LOCALAPPDATA") {
                        PathBuf::from(local).join("com.mintu.desktop")
                    } else {
                        PathBuf::from("./mintu_data")
                    }
                });
            crate::log_step(&format!("app_data: {:?}", app_data));
            let _ = std::fs::create_dir_all(&app_data);
            let db_path = app_data.join("mintu.db");
            crate::log_step(&format!("db_path: {:?}", db_path));

            let storage_mgr = Arc::new(
                StorageManager::new(db_path)
                    .expect("Failed to initialize SQLite storage manager"),
            );

            // Determine models directory: saved setting -> smart low-space fallback -> default AppData/models
            let saved_dir = storage_mgr.get_setting("models_dir").ok().flatten();
            let initial_models_dir = if let Some(saved) = saved_dir {
                let p = PathBuf::from(saved);
                if p.exists() || std::fs::create_dir_all(&p).is_ok() {
                    p
                } else {
                    app_data.join("models")
                }
            } else {
                let default_dir = app_data.join("models");
                let c_hw = detect_hardware(&default_dir);
                let d_drive = PathBuf::from("D:\\Mintu-Models");
                // If C: drive has less than 3 GB free and D: drive exists, automatically default to D:\Mintu-Models!
                if c_hw.free_disk_mb < 3000 && PathBuf::from("D:\\").exists() {
                    let _ = std::fs::create_dir_all(&d_drive);
                    let _ = storage_mgr.set_setting("models_dir", &d_drive.to_string_lossy());
                    d_drive
                } else {
                    let _ = std::fs::create_dir_all(&default_dir);
                    default_dir
                }
            };
            let _ = std::fs::create_dir_all(&initial_models_dir);
            let models_dir_lock = Arc::new(std::sync::RwLock::new(initial_models_dir));

            let download_mgr = Arc::new(DownloadManager::new(models_dir_lock.clone()));
            let sidecar_mgr = SidecarManager::new();
            let media_mgr = Arc::new(media::MediaManager::new());
            let notif_mgr = Arc::new(notifications::NotificationManager::new());

            // Start background listeners
            media_mgr.start_polling(handle.clone());
            notif_mgr.start_listener(handle.clone());
            hotkeys::start_hotkey_listener(handle.clone());
            window_walker::start_window_tracker(handle.clone());

            // Start background reminder worker
            let rem_storage = Arc::clone(&storage_mgr);
            let rem_notif = Arc::clone(&notif_mgr);
            let rem_handle = handle.clone();
            std::thread::spawn(move || {
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(3));
                    if let Ok(due) = rem_storage.get_due_reminders() {
                        for r in due {
                            let _ = rem_storage.update_reminder_status(r.id, "triggered".to_string());
                            let now_ms = std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_millis() as u64;
                            let notif = notifications::AppNotification {
                                id: format!("reminder-{}", r.id),
                                title: "Reminder".to_string(),
                                text: r.text.clone(),
                                app_name: Some("Mintu Reminder".to_string()),
                                app_icon: None,
                                aumid: None,
                                target: None,
                                priority: "urgent".to_string(),
                                actions: None,
                                timestamp: now_ms,
                            };
                            rem_notif.push_notification(notif.clone(), &rem_handle);
                            let _ = rem_handle.emit("reminder:triggered", r);
                        }
                    }
                }
            });

            app.manage(AppState {
                hit_regions,
                mode: app_mode,
                storage: storage_mgr,
                downloader: download_mgr,
                sidecar: sidecar_mgr,
                models_dir: models_dir_lock,
                media: media_mgr,
                notifications: notif_mgr,
            });

            // Set up System Tray
            let tray_setup = (|| -> Result<(), Box<dyn std::error::Error>> {
                let toggle_show = MenuItemBuilder::with_id("toggle_show", "Show / Hide").build(app)?;
                let pomodoro_25 = MenuItemBuilder::with_id("pomodoro_25", "Start 25m Pomodoro").build(app)?;
                let stop_timer = MenuItemBuilder::with_id("stop_timer", "Stop Active Timer").build(app)?;
                let mode_island = MenuItemBuilder::with_id("mode_island", "Mode: Island").build(app)?;
                let mode_free = MenuItemBuilder::with_id("mode_free", "Mode: Free Desktop").build(app)?;
                let quiet_mode = MenuItemBuilder::with_id("quiet_mode", "Toggle Quiet Mode").build(app)?;
                let settings = MenuItemBuilder::with_id("settings", "Settings").build(app)?;
                let quit = MenuItemBuilder::with_id("quit", "Quit Mintu").build(app)?;

                let tray_menu = MenuBuilder::new(app)
                    .item(&toggle_show)
                    .separator()
                    .item(&pomodoro_25)
                    .item(&stop_timer)
                    .separator()
                    .item(&mode_island)
                    .item(&mode_free)
                    .separator()
                    .item(&quiet_mode)
                    .item(&settings)
                    .separator()
                    .item(&quit)
                    .build()?;

                let mut tray_builder = TrayIconBuilder::new()
                    .tooltip("Mintu — Living Companion")
                    .menu(&tray_menu);

                let icon = app.default_window_icon().cloned().or_else(|| {
                    tauri::image::Image::from_app_icon_resource(32).ok()
                });

                if let Some(ic) = icon {
                    tray_builder = tray_builder.icon(ic);
                }

                let tray = tray_builder
                    .on_menu_event(|app, event| {
                        match event.id().as_ref() {
                            "toggle_show" => {
                                if let Some(main_win) = app.get_webview_window("main") {
                                    if main_win.is_visible().unwrap_or(true) {
                                        let _ = main_win.hide();
                                    } else {
                                        let _ = main_win.show();
                                    }
                                }
                            }
                            "pomodoro_25" => {
                                let _ = app.emit("tray-action", "start-pomodoro");
                            }
                            "stop_timer" => {
                                let _ = app.emit("tray-action", "stop-timer");
                            }
                            "mode_island" => {
                                let _ = app.emit("request-mode", "island");
                            }
                            "mode_free" => {
                                let _ = app.emit("request-mode", "free");
                            }
                            "quiet_mode" => {
                                let _ = app.emit("tray-action", "toggle-quiet");
                            }
                            "settings" => {
                                let _ = app.emit("open-settings", ());
                            }
                            "quit" => {
                                let state = app.state::<AppState>();
                                let sidecar = state.sidecar.clone();
                                tauri::async_runtime::spawn(async move {
                                    let _ = sidecar.stop().await;
                                });
                                app.exit(0);
                            }
                            _ => {}
                        }
                    })
                    .build(app)?;
                std::mem::forget(tray);
                Ok(())
            })();
            if let Err(e) = tray_setup {
                crate::log_step(&format!("Tray setup warning: {e}"));
            } else {
                crate::log_step("Tray setup success");
            }

            // Position Main Window across primary monitor (unified overlay)
            crate::log_step("Configuring main window...");
            if let Some(main_win) = app.get_webview_window("main") {
                crate::log_step("Main window found, querying primary monitor...");
                if let Ok(Some(monitor)) = main_win.primary_monitor() {
                    let mon_pos = monitor.position();
                    let mon_size = monitor.size();
                    crate::log_step(&format!("Primary monitor: pos={:?}, size={:?}", mon_pos, mon_size));

                    let _ = main_win.set_position(PhysicalPosition::new(mon_pos.x, mon_pos.y));
                    let _ = main_win.set_size(PhysicalSize::new(mon_size.width, mon_size.height));
                    let _ = main_win.set_always_on_top(true);
                    let _ = main_win.set_ignore_cursor_events(true);
                    let _ = main_win.show();
                    let _ = main_win.set_focus();
                    crate::log_step("Main window show() called.");
                } else {
                    crate::log_step("Primary monitor not found, showing directly");
                    let _ = main_win.show();
                    let _ = main_win.set_focus();
                }
            } else {
                crate::log_step("WARNING: main window NOT found in app!");
            }

            // Background cursor hit-testing thread
            let poller_regions = hit_regions_clone;
            std::thread::spawn(move || {
                let mut last_ignored = true;

                loop {
                    std::thread::sleep(std::time::Duration::from_millis(20));

                    #[cfg(target_os = "windows")]
                    let cursor_pt = unsafe {
                        let mut pt = windows_sys::Win32::Foundation::POINT { x: 0, y: 0 };
                        if windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos(&mut pt) != 0 {
                            Some((pt.x, pt.y))
                        } else {
                            None
                        }
                    };

                    #[cfg(not(target_os = "windows"))]
                    let cursor_pt: Option<(i32, i32)> = None;

                    if let Some((cur_x, cur_y)) = cursor_pt {
                        if let Some(win) = handle.get_webview_window("main") {
                            if !win.is_visible().unwrap_or(false) {
                                continue;
                            }

                            let Ok(win_pos) = win.outer_position() else { continue };
                            let Ok(scale) = win.scale_factor() else { continue };

                            let local_x = (cur_x - win_pos.x) as f64 / scale;
                            let local_y = (cur_y - win_pos.y) as f64 / scale;

                            let is_inside = {
                                if let Ok(regions) = poller_regions.lock() {
                                    if let Some(rects) = regions.get("main") {
                                        rects.iter().any(|r| {
                                            local_x >= r.x
                                                && local_x <= (r.x + r.width)
                                                && local_y >= r.y
                                                && local_y <= (r.y + r.height)
                                        })
                                    } else {
                                        false
                                    }
                                } else {
                                    false
                                }
                            };

                            let should_ignore = !is_inside;
                            if should_ignore != last_ignored {
                                let _ = win.set_ignore_cursor_events(should_ignore);
                                last_ignored = should_ignore;
                            }
                        }
                    }
                }
            });

            crate::log_step("=== SETUP RETURNING OK ===");
            Ok(())
        })
        .on_window_event(|window, event| {
            crate::log_step(&format!("Window event on {:?}: {:?}", window.label(), event));
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed = event {
                    let app = window.app_handle().clone();
                    std::thread::spawn(move || {
                        app.exit(0);
                    });
                }
            }
        });

    crate::log_step("Calling builder.run()...");
    if let Err(e) = builder.run(tauri::generate_context!()) {
        let log_path = std::env::temp_dir().join("mintu_startup.log");
        let _ = std::fs::write(log_path, format!("RUN ERROR: {e}\n"));
        panic!("error while running mintu application: {e}");
    }
    crate::log_step("builder.run() returned cleanly.");
}
