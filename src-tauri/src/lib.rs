use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize,
};

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

struct AppState {
    hit_regions: Arc<Mutex<HashMap<String, Vec<HitRect>>>>,
    mode: Arc<Mutex<String>>,
}

#[tauri::command]
fn set_hit_regions(
    state: tauri::State<'_, AppState>,
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
    state: tauri::State<'_, AppState>,
    mode: String,
) -> Result<(), String> {
    {
        let mut current = state.mode.lock().map_err(|e| e.to_string())?;
        *current = mode.clone();
    }

    if let Some(main_win) = app.get_webview_window("main") {
        if let Some(free_win) = app.get_webview_window("free") {
            if mode == "free" {
                let _ = free_win.show();
                let _ = free_win.set_focus();
                // Send mode-changed event to both windows
                let _ = app.emit("mode-changed", "free");
            } else {
                let _ = main_win.show();
                let _ = main_win.set_focus();
                let _ = free_win.hide();
                let _ = app.emit("mode-changed", "island");
            }
        }
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

pub fn run() {
    let hit_regions = Arc::new(Mutex::new(HashMap::<String, Vec<HitRect>>::new()));
    let app_mode = Arc::new(Mutex::new("island".to_string()));

    let hit_regions_clone = Arc::clone(&hit_regions);

    /*
     * Window Architecture Decision:
     * We use a dedicated top-center window for the Dynamic Island (520x380) and a separate
     * bottom-docked transparent window for Free mode roaming (work-area width x 260px).
     *
     * A single full-screen transparent window forces the OS compositor (DWM) to blend a massive
     * 4K/full-display surface on every frame, consuming unnecessary GPU and power even when empty.
     * Two compact, targeted transparent windows isolate rendering, allow completely hiding the
     * inactive surface (0% GPU/CPU when hidden), and prevent unintended click-through bugs
     * across unrelated desktop zones.
     */
    tauri::Builder::default()
        .manage(AppState {
            hit_regions,
            mode: app_mode,
        })
        .invoke_handler(tauri::generate_handler![
            set_hit_regions,
            set_app_mode,
            get_work_area,
            emit_bus_event
        ])
        .setup(move |app| {
            let handle = app.handle().clone();

            // Set up System Tray
            let toggle_show = MenuItemBuilder::with_id("toggle_show", "Show / Hide").build(app)?;
            let mode_island = MenuItemBuilder::with_id("mode_island", "Mode: Island").build(app)?;
            let mode_free = MenuItemBuilder::with_id("mode_free", "Mode: Free Desktop").build(app)?;
            let settings = MenuItemBuilder::with_id("settings", "Settings (Milestone 8)").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit Mintu").build(app)?;

            let tray_menu = MenuBuilder::new(app)
                .item(&toggle_show)
                .separator()
                .item(&mode_island)
                .item(&mode_free)
                .separator()
                .item(&settings)
                .separator()
                .item(&quit)
                .build()?;

            let _tray = TrayIconBuilder::new()
                .tooltip("Mintu — Living Companion")
                .menu(&tray_menu)
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "toggle_show" => {
                            if let Some(main_win) = app.get_webview_window("main") {
                                if main_win.is_visible().unwrap_or(true) {
                                    let _ = main_win.hide();
                                    if let Some(free_win) = app.get_webview_window("free") {
                                        let _ = free_win.hide();
                                    }
                                } else {
                                    let _ = main_win.show();
                                }
                            }
                        }
                        "mode_island" => {
                            let _ = app.emit("request-mode", "island");
                        }
                        "mode_free" => {
                            let _ = app.emit("request-mode", "free");
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            // Position Main Island Window at top-center
            if let Some(main_win) = app.get_webview_window("main") {
                if let Ok(Some(monitor)) = main_win.primary_monitor() {
                    let scale = monitor.scale_factor();
                    let mon_pos = monitor.position();
                    let mon_size = monitor.size();

                    let win_w_logical = 520.0;
                    let win_h_logical = 380.0;
                    let win_w_phys = (win_w_logical * scale) as i32;
                    let win_h_phys = (win_h_logical * scale) as i32;

                    let x_pos = mon_pos.x + (mon_size.width as i32 - win_w_phys) / 2;
                    let y_pos = mon_pos.y; // top-center

                    let _ = main_win.set_position(PhysicalPosition::new(x_pos, y_pos));
                    let _ = main_win.set_size(PhysicalSize::new(win_w_phys as u32, win_h_phys as u32));
                    let _ = main_win.set_always_on_top(true);
                    let _ = main_win.set_ignore_cursor_events(true);
                }
            }

            // Position Free Mode Window at screen bottom above taskbar
            if let Some(free_win) = app.get_webview_window("free") {
                if let Ok(Some(monitor)) = free_win.primary_monitor() {
                    let scale = monitor.scale_factor();
                    let mon_pos = monitor.position();
                    let mon_size = monitor.size();

                    let free_h_logical = 260.0;
                    let free_h_phys = (free_h_logical * scale) as i32;

                    let mut work_bottom = mon_pos.y + mon_size.height as i32;
                    let mut work_left = mon_pos.x;
                    let mut work_width = mon_size.width;

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
                                work_left = rect.left;
                                work_bottom = rect.bottom;
                                work_width = (rect.right - rect.left) as u32;
                            }
                        }
                    }

                    let y_pos = work_bottom - free_h_phys;
                    let _ = free_win.set_position(PhysicalPosition::new(work_left, y_pos));
                    let _ = free_win.set_size(PhysicalSize::new(work_width, free_h_phys as u32));
                    let _ = free_win.set_always_on_top(true);
                    let _ = free_win.set_ignore_cursor_events(true);
                }
            }

            // Background cursor hit-testing thread
            let poller_regions = hit_regions_clone;
            std::thread::spawn(move || {
                let mut last_ignored: HashMap<String, bool> = HashMap::new();

                loop {
                    std::thread::sleep(std::time::Duration::from_millis(25));

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
                        for label in ["main", "free"] {
                            if let Some(win) = handle.get_webview_window(label) {
                                if !win.is_visible().unwrap_or(false) {
                                    continue;
                                }

                                let Ok(win_pos) = win.outer_position() else { continue };
                                let Ok(scale) = win.scale_factor() else { continue };

                                let local_x = (cur_x - win_pos.x) as f64 / scale;
                                let local_y = (cur_y - win_pos.y) as f64 / scale;

                                let is_inside = {
                                    if let Ok(regions) = poller_regions.lock() {
                                        if let Some(rects) = regions.get(label) {
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
                                let prev = last_ignored.get(label).copied().unwrap_or(true);
                                if should_ignore != prev {
                                    let _ = win.set_ignore_cursor_events(should_ignore);
                                    last_ignored.insert(label.to_string(), should_ignore);
                                }
                            }
                        }
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running mintu application");
}
