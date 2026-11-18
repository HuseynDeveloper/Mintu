pub mod context;
pub mod hardware;
pub mod hotkeys;
pub mod media;
pub mod notifications;
pub mod storage;
pub mod system_events;
pub mod volume;
pub mod window_walker;

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, State,
};

use hardware::{get_system_status, SystemStatus};
use storage::StorageManager;

pub fn log_step(msg: &str) {
    use std::io::Write;
    let log_path = std::env::temp_dir().join("mintu_startup.log");
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(log_path) {
        let _ = writeln!(f, "[{:?}] {}", std::time::SystemTime::now(), msg);
    }
}

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

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct MonitorInfo {
    pub name: Option<String>,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale_factor: f64,
    pub is_primary: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PowerStatus {
    pub is_battery: bool,
    pub battery_percent: u8,
    pub is_charging: bool,
}

pub struct AppState {
    pub hit_regions: Arc<Mutex<HashMap<String, Vec<HitRect>>>>,
    pub mode: Arc<Mutex<String>>,
    pub storage: Arc<StorageManager>,
    pub media: Arc<media::MediaManager>,
    pub notifications: Arc<notifications::NotificationManager>,
}

// ==========================================
// Clipboard Safe Reader (Smart Clipboard)
// ==========================================

#[cfg(target_os = "windows")]
fn read_clipboard_text_safe() -> Result<String, String> {
    use windows_sys::Win32::Foundation::HWND;
    use windows_sys::Win32::System::DataExchange::{
        CloseClipboard, GetClipboardData, IsClipboardFormatAvailable, OpenClipboard,
    };
    use windows_sys::Win32::System::Memory::{GlobalLock, GlobalUnlock};
    const CF_UNICODETEXT: u32 = 13;

    unsafe {
        if OpenClipboard(0 as HWND) == 0 {
            return Err("Unable to access clipboard".to_string());
        }
        if IsClipboardFormatAvailable(CF_UNICODETEXT) == 0 {
            CloseClipboard();
            return Ok(String::new());
        }
        let handle = GetClipboardData(CF_UNICODETEXT);
        if handle.is_null() {
            CloseClipboard();
            return Ok(String::new());
        }
        let ptr = GlobalLock(handle) as *const u16;
        if ptr.is_null() {
            CloseClipboard();
            return Ok(String::new());
        }
        let mut len = 0;
        while *ptr.add(len) != 0 {
            len += 1;
        }
        let slice = std::slice::from_raw_parts(ptr, len);
        let text = String::from_utf16_lossy(slice);
        GlobalUnlock(handle);
        CloseClipboard();
        Ok(text)
    }
}

#[cfg(not(target_os = "windows"))]
fn read_clipboard_text_safe() -> Result<String, String> {
    Ok(String::new())
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
        #[cfg(target_os = "windows")]
        {
            unsafe {
                use windows_sys::Win32::Foundation::POINT;
                use windows_sys::Win32::Graphics::Gdi::{
                    GetMonitorInfoW, MonitorFromPoint, MONITORINFO, MONITOR_DEFAULTTONEAREST,
                };
                use windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos;

                let mut pt: POINT = std::mem::zeroed();
                let _ = GetCursorPos(&mut pt);
                let hmon = MonitorFromPoint(pt, MONITOR_DEFAULTTONEAREST);
                if !hmon.is_null() {
                    let mut mi: MONITORINFO = std::mem::zeroed();
                    mi.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
                    if GetMonitorInfoW(hmon, &mut mi) != 0 {
                        let scale = window
                            .current_monitor()
                            .ok()
                            .flatten()
                            .or_else(|| window.primary_monitor().ok().flatten())
                            .map(|m| m.scale_factor())
                            .unwrap_or(1.0);

                        return Ok(ScreenWorkArea {
                            x: mi.rcWork.left,
                            y: mi.rcWork.top,
                            width: (mi.rcWork.right - mi.rcWork.left) as u32,
                            height: (mi.rcWork.bottom - mi.rcWork.top) as u32,
                            scale_factor: scale,
                        });
                    }
                }
            }
        }

        if let Ok(Some(monitor)) = window.current_monitor().or_else(|_| window.primary_monitor()) {
            let scale = monitor.scale_factor();
            let mon_pos = monitor.position();
            let mon_size = monitor.size();
            return Ok(ScreenWorkArea {
                x: mon_pos.x,
                y: mon_pos.y,
                width: mon_size.width,
                height: mon_size.height,
                scale_factor: scale,
            });
        }
    }
    Err("Could not retrieve work area".to_string())
}

#[tauri::command]
fn get_available_monitors(app: AppHandle) -> Result<Vec<MonitorInfo>, String> {
    if let Some(window) = app.get_webview_window("main") {
        if let Ok(monitors) = window.available_monitors() {
            let primary = window.primary_monitor().ok().flatten();
            let prim_pos = primary.as_ref().map(|p| p.position().clone());
            let list = monitors
                .into_iter()
                .map(|m| {
                    let pos = m.position();
                    let size = m.size();
                    let is_prim = prim_pos
                        .as_ref()
                        .map(|pp| pp.x == pos.x && pp.y == pos.y)
                        .unwrap_or(false);
                    MonitorInfo {
                        name: m.name().map(|s| s.to_string()),
                        x: pos.x,
                        y: pos.y,
                        width: size.width,
                        height: size.height,
                        scale_factor: m.scale_factor(),
                        is_primary: is_prim,
                    }
                })
                .collect();
            return Ok(list);
        }
    }
    Ok(Vec::new())
}

#[tauri::command]
fn is_store_package() -> bool {
    #[cfg(target_os = "windows")]
    {
        unsafe {
            type GetCurrentPackageFamilyNameFn = unsafe extern "system" fn(*mut u32, *mut u16) -> i32;
            let kernel32 =
                windows_sys::Win32::System::LibraryLoader::GetModuleHandleA(b"kernel32.dll\0".as_ptr());
            if !kernel32.is_null() {
                let func = windows_sys::Win32::System::LibraryLoader::GetProcAddress(
                    kernel32,
                    b"GetCurrentPackageFamilyName\0".as_ptr(),
                );
                if let Some(f) = func {
                    let get_pkg_fn: GetCurrentPackageFamilyNameFn = std::mem::transmute(f);
                    let mut length: u32 = 0;
                    let rc = get_pkg_fn(&mut length, std::ptr::null_mut());
                    return rc == 122;
                }
            }
        }
    }
    false
}

#[tauri::command]
fn purge_memory() -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        unsafe {
            use windows_sys::Win32::System::ProcessStatus::EmptyWorkingSet;
            use windows_sys::Win32::System::Threading::GetCurrentProcess;
            EmptyWorkingSet(GetCurrentProcess());
        }
    }
    Ok(true)
}

#[tauri::command]
fn get_power_status() -> Result<PowerStatus, String> {
    #[cfg(target_os = "windows")]
    {
        unsafe {
            use windows_sys::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};
            let mut status: SYSTEM_POWER_STATUS = std::mem::zeroed();
            if GetSystemPowerStatus(&mut status) != 0 {
                let is_battery = status.ACLineStatus == 0;
                let is_charging = (status.BatteryFlag & 8) != 0;
                let pct = if status.BatteryLifePercent <= 100 {
                    status.BatteryLifePercent
                } else {
                    100
                };
                return Ok(PowerStatus {
                    is_battery,
                    battery_percent: pct,
                    is_charging,
                });
            }
        }
    }
    Ok(PowerStatus {
        is_battery: false,
        battery_percent: 100,
        is_charging: true,
    })
}

#[tauri::command]
fn emit_bus_event(app: AppHandle, event: String, payload: String) -> Result<(), String> {
    app.emit(&event, payload).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_system_status_info() -> Result<SystemStatus, String> {
    Ok(get_system_status())
}

#[tauri::command]
fn get_active_window() -> Result<context::ActiveWindowInfo, String> {
    Ok(context::get_active_window_info())
}

#[tauri::command]
fn tools_read_clipboard() -> Result<String, String> {
    read_clipboard_text_safe()
}

// ==========================================
// System Volume, Notch File Shelf & Cursor
// ==========================================

#[tauri::command]
fn get_system_volume() -> Result<volume::VolumeState, String> {
    volume::get_master_volume()
}

#[tauri::command]
fn set_system_volume(percent: u8, muted: Option<bool>) -> Result<volume::VolumeState, String> {
    volume::set_master_volume(percent, muted)
}

#[tauri::command]
fn open_shelf_file(path: String) -> Result<(), String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Empty path".to_string());
    }
    let pb = PathBuf::from(trimmed);
    if !pb.exists() {
        return Err("File no longer exists".to_string());
    }
    #[cfg(target_os = "windows")]
    {
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;
        use windows_sys::Win32::UI::Shell::ShellExecuteW;
        use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

        let op: Vec<u16> = OsStr::new("open").encode_wide().chain(Some(0)).collect();
        let file: Vec<u16> = OsStr::new(trimmed).encode_wide().chain(Some(0)).collect();
        let rc = unsafe {
            ShellExecuteW(
                std::ptr::null_mut(),
                op.as_ptr(),
                file.as_ptr(),
                std::ptr::null(),
                std::ptr::null(),
                SW_SHOWNORMAL,
            )
        } as isize;
        if rc <= 32 {
            return Err(format!("Failed to open file (code {rc})"));
        }
        return Ok(());
    }
    #[cfg(not(target_os = "windows"))]
    Err("Unsupported platform".to_string())
}

#[tauri::command]
fn reveal_shelf_file(path: String) -> Result<(), String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Empty path".to_string());
    }
    let pb = PathBuf::from(trimmed);
    if !pb.exists() {
        return Err("File no longer exists".to_string());
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer.exe")
            .arg(format!("/select,{}", trimmed))
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[cfg(not(target_os = "windows"))]
    Err("Unsupported platform".to_string())
}

#[tauri::command]
fn get_cursor_pos(app: AppHandle) -> Result<(f64, f64), String> {
    #[cfg(target_os = "windows")]
    {
        unsafe {
            let mut pt = windows_sys::Win32::Foundation::POINT { x: 0, y: 0 };
            if windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos(&mut pt) != 0 {
                if let Some(win) = app.get_webview_window("main") {
                    if let (Ok(win_pos), Ok(scale)) = (win.outer_position(), win.scale_factor()) {
                        let lx = (pt.x - win_pos.x) as f64 / scale;
                        let ly = (pt.y - win_pos.y) as f64 / scale;
                        return Ok((lx, ly));
                    }
                }
                return Ok((pt.x as f64, pt.y as f64));
            }
        }
    }
    Err("Unable to read cursor position".to_string())
}

#[tauri::command]
fn pick_cursor_color() -> Result<String, String> {
    system_events::pick_cursor_color()
}

#[tauri::command]
fn set_typing_pulse_enabled(enabled: bool) {
    system_events::set_typing_pulse_enabled(enabled);
}

#[tauri::command]
fn move_to_monitor(app: AppHandle, monitor_index: usize) -> Result<(), String> {
    let win = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;
    let monitors = win.available_monitors().map_err(|e| e.to_string())?;
    let target = monitors
        .get(monitor_index)
        .ok_or_else(|| "Invalid monitor index".to_string())?;
    let pos = target.position();
    let size = target.size();
    let _ = win.set_position(PhysicalPosition::new(pos.x, pos.y));
    let _ = win.set_size(PhysicalSize::new(size.width, size.height));
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
async fn media_toggle_play_pause(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<bool, String> {
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
// Notification & Window Focus Commands
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
        use windows_sys::Win32::System::Threading::{
            GetCurrentThreadId, OpenProcess, QueryFullProcessImageNameW,
            PROCESS_QUERY_LIMITED_INFORMATION,
        };
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            BringWindowToTop, EnumWindows, FlashWindowEx, GetForegroundWindow, GetWindowTextW,
            GetWindowThreadProcessId, IsIconic, IsWindowVisible, SetForegroundWindow, ShowWindow,
            FLASHWINFO, FLASHW_TIMERNOFG, FLASHW_TRAY, SW_RESTORE, SW_SHOW,
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
                || (target_lower.contains("spotify") && (proc_stem.contains("spotify") || title.contains("spotify")));

            if matches {
                ctx.found_hwnd = Some(hwnd);
                return 0;
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

        if let Some(exe_path) = notifications::find_app_executable("", &app_name) {
            if std::process::Command::new(exe_path).spawn().is_ok() {
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
// Reminders & Autostart
// ==========================================

#[tauri::command]
fn db_create_reminder(
    state: State<'_, AppState>,
    text: String,
    due_at: i64,
) -> Result<storage::ReminderEntry, String> {
    state.storage.create_reminder(text, due_at)
}

#[tauri::command]
fn db_list_reminders(
    state: State<'_, AppState>,
) -> Result<Vec<storage::ReminderEntry>, String> {
    state.storage.list_reminders()
}

#[tauri::command]
fn db_delete_reminder(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    state.storage.delete_reminder(id)
}

#[tauri::command]
fn get_autostart() -> bool {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let output = std::process::Command::new("reg")
            .args([
                "query",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                "/v",
                "Mintu",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .output();
        matches!(output, Ok(out) if out.status.success())
    }
    #[cfg(not(target_os = "windows"))]
    false
}

#[tauri::command]
fn set_autostart(enable: bool) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        if enable {
            let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
            let val = format!("\"{}\"", exe_path.to_string_lossy());
            let status = std::process::Command::new("reg")
                .args([
                    "add",
                    r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                    "/v",
                    "Mintu",
                    "/t",
                    "REG_SZ",
                    "/d",
                    &val,
                    "/f",
                ])
                .creation_flags(CREATE_NO_WINDOW)
                .status()
                .map_err(|e| e.to_string())?;
            if status.success() {
                Ok(true)
            } else {
                Err("Failed to set autostart registry entry".to_string())
            }
        } else {
            let _ = std::process::Command::new("reg")
                .args([
                    "delete",
                    r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                    "/v",
                    "Mintu",
                    "/f",
                ])
                .creation_flags(CREATE_NO_WINDOW)
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
            focus_main_window,
            get_work_area,
            get_available_monitors,
            is_store_package,
            purge_memory,
            get_power_status,
            emit_bus_event,
            get_system_status_info,
            get_active_window,
            tools_read_clipboard,
            get_system_volume,
            set_system_volume,
            open_shelf_file,
            reveal_shelf_file,
            get_cursor_pos,
            pick_cursor_color,
            set_typing_pulse_enabled,
            move_to_monitor,
            media_get_state,
            media_toggle_play_pause,
            media_next,
            media_previous,
            push_notification,
            pop_notification,
            focus_app_window,
            get_walkable_windows,
            set_window_ignore_list,
            db_create_reminder,
            db_list_reminders,
            db_delete_reminder,
            get_autostart,
            set_autostart
        ])
        .setup(move |app| {
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
            let _ = std::fs::create_dir_all(&app_data);
            let db_path = app_data.join("mintu.db");

            let storage_mgr = Arc::new(
                StorageManager::new(db_path)
                    .expect("Failed to initialize SQLite storage manager"),
            );
            let media_mgr = Arc::new(media::MediaManager::new());
            let notif_mgr = Arc::new(notifications::NotificationManager::new());

            // Start native Pet & Dynamic Island background listeners
            media_mgr.start_polling(handle.clone());
            notif_mgr.start_listener(handle.clone());
            hotkeys::start_hotkey_listener(handle.clone());
            window_walker::start_window_tracker(handle.clone());
            volume::start_volume_monitor(handle.clone());
            system_events::start_system_monitors(handle.clone());

            // Reminder worker
            let rem_storage = Arc::clone(&storage_mgr);
            let rem_notif = Arc::clone(&notif_mgr);
            let rem_handle = handle.clone();
            std::thread::spawn(move || loop {
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
                        rem_notif.push_notification(notif, &rem_handle);
                        let _ = rem_handle.emit("reminder:triggered", r);
                    }
                }
            });

            // Smart Clipboard monitor
            let clip_handle = handle.clone();
            std::thread::spawn(move || {
                let mut last_clipboard_text = String::new();
                loop {
                    std::thread::sleep(std::time::Duration::from_millis(700));
                    if let Ok(text) = read_clipboard_text_safe() {
                        let trimmed = text.trim();
                        if !trimmed.is_empty() && trimmed.len() <= 35000 && trimmed != last_clipboard_text {
                            last_clipboard_text = trimmed.to_string();
                            let _ = clip_handle.emit("clipboard-copied", trimmed);
                        }
                    }
                }
            });

            app.manage(AppState {
                hit_regions,
                mode: app_mode,
                storage: storage_mgr,
                media: media_mgr,
                notifications: notif_mgr,
            });

            // System Tray
            let _ = (|| -> Result<(), Box<dyn std::error::Error>> {
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
                    .tooltip("Mintu — Living Desktop Pet")
                    .menu(&tray_menu);

                let icon = app
                    .default_window_icon()
                    .cloned()
                    .or_else(|| tauri::image::Image::from_app_icon_resource(32).ok());
                if let Some(ic) = icon {
                    tray_builder = tray_builder.icon(ic);
                }

                let tray = tray_builder
                    .on_menu_event(|app, event| match event.id().as_ref() {
                        "toggle_show" => {
                            if let Some(main_win) = app.get_webview_window("main") {
                                if main_win.is_visible().unwrap_or(true) {
                                    let _ = main_win.hide();
                                } else {
                                    let _ = main_win.show();
                                }
                            }
                        }
                        "pomodoro_25" => { let _ = app.emit("tray-action", "start-pomodoro"); }
                        "stop_timer" => { let _ = app.emit("tray-action", "stop-timer"); }
                        "mode_island" => { let _ = app.emit("request-mode", "island"); }
                        "mode_free" => { let _ = app.emit("request-mode", "free"); }
                        "quiet_mode" => { let _ = app.emit("tray-action", "toggle-quiet"); }
                        "settings" => { let _ = app.emit("open-settings", ()); }
                        "quit" => { app.exit(0); }
                        _ => {}
                    })
                    .build(app)?;
                std::mem::forget(tray);
                Ok(())
            })();

            // Position unified overlay across primary monitor
            if let Some(main_win) = app.get_webview_window("main") {
                if let Ok(Some(monitor)) = main_win.primary_monitor() {
                    let mon_pos = monitor.position();
                    let mon_size = monitor.size();
                    let _ = main_win.set_position(PhysicalPosition::new(mon_pos.x, mon_pos.y));
                    let _ = main_win.set_size(PhysicalSize::new(mon_size.width, mon_size.height));
                    let _ = main_win.set_always_on_top(true);
                    let _ = main_win.set_ignore_cursor_events(true);
                    let _ = main_win.show();
                } else {
                    let _ = main_win.show();
                }
            }

            // Click-through cursor hit-testing thread
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

                            let is_inside = poller_regions
                                .lock()
                                .ok()
                                .and_then(|regions| {
                                    regions.get("main").map(|rects| {
                                        rects.iter().any(|r| {
                                            local_x >= r.x
                                                && local_x <= (r.x + r.width)
                                                && local_y >= r.y
                                                && local_y <= (r.y + r.height)
                                        })
                                    })
                                })
                                .unwrap_or(false);

                            // If dragging files with left mouse button near top-center notch,
                            // allow OLE DragDrop events to reach the Dynamic Island Shelf!
                            #[cfg(target_os = "windows")]
                            let is_notch_drag_zone = unsafe {
                                use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
                                    GetAsyncKeyState, VK_LBUTTON,
                                };
                                let lbtn_down = (GetAsyncKeyState(VK_LBUTTON as i32) as u16 & 0x8000) != 0;
                                if lbtn_down && local_y >= 0.0 && local_y <= 110.0 {
                                    if let Ok(win_size) = win.outer_size() {
                                        let logical_w = win_size.width as f64 / scale;
                                        let center_x = logical_w / 2.0;
                                        (local_x - center_x).abs() <= 230.0
                                    } else {
                                        false
                                    }
                                } else {
                                    false
                                }
                            };
                            #[cfg(not(target_os = "windows"))]
                            let is_notch_drag_zone = false;

                            let should_ignore = !(is_inside || is_notch_drag_zone);
                            if should_ignore != last_ignored {
                                let _ = win.set_ignore_cursor_events(should_ignore);
                                last_ignored = should_ignore;
                            }
                        }
                    }
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                match event {
                    tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed => {
                        let app = window.app_handle().clone();
                        std::thread::spawn(move || {
                            app.exit(0);
                        });
                    }
                    tauri::WindowEvent::DragDrop(dd_ev) => {
                        let app = window.app_handle();
                        match dd_ev {
                            tauri::DragDropEvent::Enter { paths, .. } => {
                                let list: Vec<String> = paths
                                    .iter()
                                    .map(|p| p.to_string_lossy().to_string())
                                    .collect();
                                let _ = app.emit("notch-drag-enter", list);
                            }
                            tauri::DragDropEvent::Leave => {
                                let _ = app.emit("notch-drag-leave", ());
                            }
                            tauri::DragDropEvent::Drop { paths, .. } => {
                                let list: Vec<String> = paths
                                    .iter()
                                    .map(|p| p.to_string_lossy().to_string())
                                    .collect();
                                let _ = app.emit("notch-files-dropped", list);
                            }
                            _ => {}
                        }
                    }
                    _ => {}
                }
            }
        });

    if let Err(e) = builder.run(tauri::generate_context!()) {
        let log_path = std::env::temp_dir().join("mintu_startup.log");
        let _ = std::fs::write(log_path, format!("RUN ERROR: {e}\n"));
        panic!("error while running mintu application: {e}");
    }
}
