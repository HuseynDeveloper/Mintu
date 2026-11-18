use tauri::{AppHandle, Emitter};

pub fn start_hotkey_listener(app: AppHandle) {
    #[cfg(target_os = "windows")]
    {
        std::thread::spawn(move || unsafe {
            use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
                RegisterHotKey, MOD_ALT, MOD_CONTROL, MOD_SHIFT,
            };
            use windows_sys::Win32::UI::WindowsAndMessaging::{
                GetMessageW, MSG, WM_HOTKEY,
            };

            const HOTKEY_MODE: i32 = 1003;
            const HOTKEY_DEBUG: i32 = 1004;
            const HOTKEY_NOTE: i32 = 1007;
            const HOTKEY_SETTINGS: i32 = 1009;
            const HOTKEY_HUB: i32 = 1010;
            const HOTKEY_CLIPBOARD: i32 = 1011;
            const HOTKEY_COLOR: i32 = 1012;

            let null_hwnd = std::ptr::null_mut();

            // Ctrl + Alt + M: Toggle Dynamic Island <-> Free Desktop Mode
            if RegisterHotKey(null_hwnd, HOTKEY_MODE, MOD_CONTROL | MOD_ALT, 0x4D) == 0 {
                let _ = app.emit("hotkey-conflict", "Ctrl+Alt+M");
            }
            // Ctrl + Alt + S: Open Mintu Settings directly
            if RegisterHotKey(null_hwnd, HOTKEY_SETTINGS, MOD_CONTROL | MOD_ALT, 0x53) == 0 {
                let _ = app.emit("hotkey-conflict", "Ctrl+Alt+S");
            }
            // Ctrl + Shift + M: Toggle Mintu Pet Hub
            if RegisterHotKey(null_hwnd, HOTKEY_HUB, MOD_CONTROL | MOD_SHIFT, 0x4D) == 0 {
                let _ = app.emit("hotkey-conflict", "Ctrl+Shift+M");
            }
            // Ctrl + Shift + N: Quick Local Scratchpad / Note
            if RegisterHotKey(null_hwnd, HOTKEY_NOTE, MOD_CONTROL | MOD_SHIFT, 0x4E) == 0 {
                let _ = app.emit("hotkey-conflict", "Ctrl+Shift+N");
            }
            // Ctrl + Shift + V: Clipboard History (Last 15)
            if RegisterHotKey(null_hwnd, HOTKEY_CLIPBOARD, MOD_CONTROL | MOD_SHIFT, 0x56) == 0 {
                let _ = app.emit("hotkey-conflict", "Ctrl+Shift+V");
            }
            // Ctrl + Alt + C: Screen Color Picker (HEX Eyedropper)
            if RegisterHotKey(null_hwnd, HOTKEY_COLOR, MOD_CONTROL | MOD_ALT, 0x43) == 0 {
                let _ = app.emit("hotkey-conflict", "Ctrl+Alt+C");
            }
            // Ctrl + Shift + D: Developer Debug Panel Toggle
            if RegisterHotKey(null_hwnd, HOTKEY_DEBUG, MOD_CONTROL | MOD_SHIFT, 0x44) == 0 {
                let _ = app.emit("hotkey-conflict", "Ctrl+Shift+D");
            }

            let mut msg: MSG = std::mem::zeroed();
            while GetMessageW(&mut msg, null_hwnd, 0, 0) > 0 {
                if msg.message == WM_HOTKEY {
                    match msg.wParam as i32 {
                        HOTKEY_MODE => {
                            let _ = app.emit("hotkey-triggered", "toggle-mode");
                        }
                        HOTKEY_SETTINGS => {
                            let _ = app.emit("hotkey-triggered", "open-settings");
                        }
                        HOTKEY_HUB => {
                            let _ = app.emit("hotkey-triggered", "toggle-hub");
                        }
                        HOTKEY_NOTE => {
                            let _ = app.emit("hotkey-triggered", "quick-note");
                        }
                        HOTKEY_CLIPBOARD => {
                            let _ = app.emit("hotkey-triggered", "clipboard-history");
                        }
                        HOTKEY_COLOR => {
                            let _ = app.emit("hotkey-triggered", "color-picker");
                        }
                        HOTKEY_DEBUG => {
                            let _ = app.emit("hotkey-triggered", "toggle-debug");
                        }
                        _ => {}
                    }
                }
            }
        });
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
    }
}
