use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct WalkableWindow {
    pub hwnd: usize,
    pub title: String,
    pub process_name: String,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

static IGNORE_LIST: std::sync::RwLock<Vec<String>> = std::sync::RwLock::new(Vec::new());
static TRACKER_ACTIVE: AtomicBool = AtomicBool::new(false);

pub fn set_window_ignore_list(list: Vec<String>) {
    if let Ok(mut lock) = IGNORE_LIST.write() {
        *lock = list
            .into_iter()
            .map(|s| s.trim().to_lowercase())
            .filter(|s| !s.is_empty())
            .collect();
    }
}

pub fn start_window_tracker(app: AppHandle) {
    if TRACKER_ACTIVE.swap(true, Ordering::SeqCst) {
        return; // Already running
    }

    tauri::async_runtime::spawn(async move {
        let mut last_windows_hash: u64 = 0;

        loop {
            // Throttled to 25 Hz (40ms)
            tokio::time::sleep(Duration::from_millis(40)).await;

            let windows = get_walkable_windows();
            
            // Fast change detection via content hashing
            use std::collections::hash_map::DefaultHasher;
            use std::hash::{Hash, Hasher};
            let mut hasher = DefaultHasher::new();
            for w in &windows {
                w.hwnd.hash(&mut hasher);
                w.x.hash(&mut hasher);
                w.y.hash(&mut hasher);
                w.width.hash(&mut hasher);
                w.height.hash(&mut hasher);
            }
            let current_hash = hasher.finish();

            if current_hash != last_windows_hash {
                last_windows_hash = current_hash;
                let _ = app.emit("walkable-windows-updated", &windows);
            }
        }
    });
}

pub fn get_walkable_windows() -> Vec<WalkableWindow> {
    #[cfg(target_os = "windows")]
    unsafe {
        use windows_sys::Win32::Foundation::{BOOL, HWND, LPARAM, RECT};
        use windows_sys::Win32::Graphics::Dwm::{
            DwmGetWindowAttribute, DWMWA_CLOAKED, DWMWA_EXTENDED_FRAME_BOUNDS,
        };
        use windows_sys::Win32::System::Threading::{
            GetCurrentProcessId, OpenProcess, QueryFullProcessImageNameW,
            PROCESS_QUERY_LIMITED_INFORMATION,
        };
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            EnumWindows, GetClassNameW, GetSystemMetrics, GetWindowTextW,
            GetWindowThreadProcessId, IsIconic, IsWindowVisible, SM_CXSCREEN, SM_CYSCREEN,
        };

        struct WindowCollector {
            current_pid: u32,
            screen_width: i32,
            screen_height: i32,
            ignore_list: Vec<String>,
            windows: Vec<WalkableWindow>,
        }

        unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
            let col = &mut *(lparam as *mut WindowCollector);

            // 1. Must be visible and not minimized
            if IsWindowVisible(hwnd) == 0 || IsIconic(hwnd) != 0 {
                return 1;
            }

            // 2. Check cloaked (virtual desktops / UWP suspended)
            let mut cloaked: u32 = 0;
            let dwm_res = DwmGetWindowAttribute(
                hwnd,
                DWMWA_CLOAKED as u32,
                &mut cloaked as *mut _ as *mut _,
                std::mem::size_of::<u32>() as u32,
            );
            if dwm_res == 0 && cloaked != 0 {
                return 1;
            }

            // 3. Process check: skip Mintu's own windows
            let mut pid = 0u32;
            GetWindowThreadProcessId(hwnd, &mut pid);
            if pid == 0 || pid == col.current_pid {
                return 1;
            }

            // 4. Class name check: skip desktop, shell, taskbar
            let mut class_buf = [0u16; 256];
            let class_len = GetClassNameW(hwnd, class_buf.as_mut_ptr(), 256);
            let class_name = String::from_utf16_lossy(&class_buf[..class_len as usize]).to_lowercase();
            if class_name.contains("progman")
                || class_name.contains("workerw")
                || class_name.contains("shell_traywnd")
                || class_name.contains("shell_secondarytraywnd")
                || class_name.contains("cortana")
                || class_name.contains("windows.ui.core.corewindow")
            {
                return 1;
            }

            // 5. Extended frame bounds (excluding drop shadows)
            let mut rect: RECT = std::mem::zeroed();
            let rect_res = DwmGetWindowAttribute(
                hwnd,
                DWMWA_EXTENDED_FRAME_BOUNDS as u32,
                &mut rect as *mut _ as *mut _,
                std::mem::size_of::<RECT>() as u32,
            );
            if rect_res != 0 {
                return 1;
            }

            let width = rect.right - rect.left;
            let height = rect.bottom - rect.top;

            // Skip tiny tooltips or popups
            if width < 220 || height < 160 {
                return 1;
            }

            // Skip fullscreen windows covering the entire display
            if width >= col.screen_width - 8 && height >= col.screen_height - 8 {
                return 1;
            }

            // 6. Get Process Name
            let mut process_name = String::new();
            let h_proc = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if !h_proc.is_null() {
                let mut path_buf = [0u16; 1024];
                let mut path_len = 1024u32;
                if QueryFullProcessImageNameW(h_proc, 0, path_buf.as_mut_ptr(), &mut path_len) != 0 {
                    let full = String::from_utf16_lossy(&path_buf[..path_len as usize]);
                    if let Some(f) = std::path::Path::new(&full).file_name().and_then(|n| n.to_str()) {
                        process_name = f.to_string();
                    }
                }
                windows_sys::Win32::Foundation::CloseHandle(h_proc);
            }

            // Check ignore list
            let proc_lower = process_name.to_lowercase();
            if col.ignore_list.iter().any(|ig| proc_lower.contains(ig)) {
                return 1;
            }

            // 7. Get Title
            let mut title_buf = [0u16; 512];
            let title_len = GetWindowTextW(hwnd, title_buf.as_mut_ptr(), 512);
            let title = String::from_utf16_lossy(&title_buf[..title_len as usize]);

            col.windows.push(WalkableWindow {
                hwnd: hwnd as usize,
                title,
                process_name,
                x: rect.left,
                y: rect.top,
                width,
                height,
            });

            1 // Continue enumeration
        }

        let ignore = IGNORE_LIST.read().map(|l| l.clone()).unwrap_or_default();
        let mut collector = WindowCollector {
            current_pid: GetCurrentProcessId(),
            screen_width: GetSystemMetrics(SM_CXSCREEN),
            screen_height: GetSystemMetrics(SM_CYSCREEN),
            ignore_list: ignore,
            windows: Vec::new(),
        };

        EnumWindows(Some(enum_proc), &mut collector as *mut _ as LPARAM);

        collector.windows
    }

    #[cfg(not(target_os = "windows"))]
    Vec::new()
}
