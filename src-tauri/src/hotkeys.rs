use tauri::{AppHandle, Emitter};

pub fn start_hotkey_listener(app: AppHandle) {
    #[cfg(target_os = "windows")]
    {
        std::thread::spawn(move || unsafe {
            use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
                RegisterHotKey, MOD_ALT, MOD_CONTROL, MOD_SHIFT, VK_SPACE,
            };
            use windows_sys::Win32::UI::WindowsAndMessaging::{
                GetMessageW, MSG, WM_HOTKEY,
            };

            const HOTKEY_ASK: i32 = 1001;
            const HOTKEY_CAPTURE: i32 = 1002;
            const HOTKEY_MODE: i32 = 1003;
            const HOTKEY_DEBUG: i32 = 1004;
            const HOTKEY_TRANSLATE_AREA: i32 = 1005;
            const HOTKEY_TRANSLATE_SELECTION: i32 = 1006;

            let null_hwnd = std::ptr::null_mut();

            // Ctrl + Alt + Space: Ask Mintu context
            if RegisterHotKey(null_hwnd, HOTKEY_ASK, MOD_CONTROL | MOD_ALT, VK_SPACE as u32) == 0 {
                let _ = app.emit("hotkey-conflict", "Ctrl+Alt+Space");
            }
            // Ctrl + Alt + S: Screen Region Capture
            if RegisterHotKey(null_hwnd, HOTKEY_CAPTURE, MOD_CONTROL | MOD_ALT, 0x53) == 0 {
                let _ = app.emit("hotkey-conflict", "Ctrl+Alt+S");
            }
            // Ctrl + Alt + M: Toggle Island / Free Mode
            if RegisterHotKey(null_hwnd, HOTKEY_MODE, MOD_CONTROL | MOD_ALT, 0x4D) == 0 {
                let _ = app.emit("hotkey-conflict", "Ctrl+Alt+M");
            }
            // Ctrl + Shift + D: Developer Panel Toggle
            if RegisterHotKey(null_hwnd, HOTKEY_DEBUG, MOD_CONTROL | MOD_SHIFT, 0x44) == 0 {
                let _ = app.emit("hotkey-conflict", "Ctrl+Shift+D");
            }
            // Ctrl + Alt + T: Translate this area (Image E / F flow)
            if RegisterHotKey(null_hwnd, HOTKEY_TRANSLATE_AREA, MOD_CONTROL | MOD_ALT, 0x54) == 0 {
                let _ = app.emit("hotkey-conflict", "Ctrl+Alt+T");
            }
            // Ctrl + Alt + Shift + T: Translate selected text
            if RegisterHotKey(null_hwnd, HOTKEY_TRANSLATE_SELECTION, MOD_CONTROL | MOD_ALT | MOD_SHIFT, 0x54) == 0 {
                let _ = app.emit("hotkey-conflict", "Ctrl+Alt+Shift+T");
            }

            let mut msg: MSG = std::mem::zeroed();
            while GetMessageW(&mut msg, null_hwnd, 0, 0) > 0 {
                if msg.message == WM_HOTKEY {
                    match msg.wParam as i32 {
                        HOTKEY_ASK => {
                            let _ = app.emit("hotkey-triggered", "ask");
                        }
                        HOTKEY_CAPTURE => {
                            let _ = app.emit("hotkey-triggered", "capture");
                        }
                        HOTKEY_MODE => {
                            let _ = app.emit("hotkey-triggered", "toggle-mode");
                        }
                        HOTKEY_DEBUG => {
                            let _ = app.emit("hotkey-triggered", "toggle-debug");
                        }
                        HOTKEY_TRANSLATE_AREA => {
                            let _ = app.emit("hotkey-triggered", "translate-area");
                        }
                        HOTKEY_TRANSLATE_SELECTION => {
                            let _ = app.emit("hotkey-triggered", "translate-selection");
                        }
                        _ => {}
                    }
                }
            }
        });
    }
}
