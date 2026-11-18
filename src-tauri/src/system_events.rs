use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter};

static TYPING_PULSE_ENABLED: AtomicBool = AtomicBool::new(false);

pub fn set_typing_pulse_enabled(enabled: bool) {
    TYPING_PULSE_ENABLED.store(enabled, Ordering::Relaxed);
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceEventPayload {
    pub kind: String,     // "connected" | "disconnected"
    pub name: String,
    pub category: String, // "audio" | "usb"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrightnessPayload {
    pub percent: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LockKeyPayload {
    pub key: String, // "CAPS" | "NUM"
    pub enabled: bool,
}

/// Reads the RGB pixel directly under the current Windows mouse cursor as `#RRGGBB`.
pub fn pick_cursor_color() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        unsafe {
            use windows_sys::Win32::Foundation::POINT;
            use windows_sys::Win32::Graphics::Gdi::{GetDC, GetPixel, ReleaseDC};
            use windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos;

            let mut pt = POINT { x: 0, y: 0 };
            if GetCursorPos(&mut pt) == 0 {
                return Err("GetCursorPos failed".to_string());
            }
            let hdc = GetDC(std::ptr::null_mut());
            if hdc.is_null() {
                return Err("GetDC failed".to_string());
            }
            let color = GetPixel(hdc, pt.x, pt.y);
            ReleaseDC(std::ptr::null_mut(), hdc);
            if color == u32::MAX {
                return Err("GetPixel failed".to_string());
            }
            let r = (color & 0xFF) as u8;
            let g = ((color >> 8) & 0xFF) as u8;
            let b = ((color >> 16) & 0xFF) as u8;
            return Ok(format!("#{:02X}{:02X}{:02X}", r, g, b));
        }
    }
    #[cfg(not(target_os = "windows"))]
    Err("Unsupported platform".to_string())
}

#[cfg(target_os = "windows")]
fn read_laptop_brightness() -> Option<u8> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Foundation::{CloseHandle, GENERIC_READ, HANDLE, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::Storage::FileSystem::{
        FILE_SHARE_READ, FILE_SHARE_WRITE, OPEN_EXISTING,
    };
    use windows_sys::Win32::System::IO::DeviceIoControl;

    #[link(name = "kernel32")]
    extern "system" {
        fn CreateFileW(
            lpfilename: *const u16,
            dwdesiredaccess: u32,
            dwsharemode: u32,
            lpsecurityattributes: *const std::ffi::c_void,
            dwcreationdisposition: u32,
            dwflagsandattributes: u32,
            htemplatefile: HANDLE,
        ) -> HANDLE;
    }

    #[repr(C)]
    struct DisplayBrightness {
        policy: u8,
        ac_brightness: u8,
        dc_brightness: u8,
    }

    const IOCTL_VIDEO_QUERY_DISPLAY_BRIGHTNESS: u32 = 0x0023_0498;
    let wide: Vec<u16> = OsStr::new(r"\\.\LCD")
        .encode_wide()
        .chain(Some(0))
        .collect();

    unsafe {
        let handle = CreateFileW(
            wide.as_ptr(),
            GENERIC_READ,
            FILE_SHARE_READ | FILE_SHARE_WRITE,
            std::ptr::null(),
            OPEN_EXISTING,
            0,
            std::ptr::null_mut(),
        );
        if handle == INVALID_HANDLE_VALUE || handle.is_null() {
            return None;
        }
        let mut out = DisplayBrightness {
            policy: 0,
            ac_brightness: 0,
            dc_brightness: 0,
        };
        let mut bytes_ret: u32 = 0;
        let ok = DeviceIoControl(
            handle,
            IOCTL_VIDEO_QUERY_DISPLAY_BRIGHTNESS,
            std::ptr::null(),
            0,
            &mut out as *mut _ as *mut _,
            std::mem::size_of::<DisplayBrightness>() as u32,
            &mut bytes_ret,
            std::ptr::null_mut(),
        );
        CloseHandle(handle);
        if ok != 0 {
            // Policy 1 = AC, 2 = DC; both values are usually synced to current level
            let level = if out.policy == 2 {
                out.dc_brightness
            } else {
                out.ac_brightness
            };
            Some(level.min(100))
        } else {
            None
        }
    }
}

#[cfg(target_os = "windows")]
fn query_audio_endpoint_count() -> Option<u32> {
    use windows::Win32::Media::Audio::{
        eRender, IMMDeviceEnumerator, MMDeviceEnumerator, DEVICE_STATE_ACTIVE,
    };
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED,
    };

    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).ok()?;
        let collection = enumerator
            .EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE)
            .ok()?;
        collection.GetCount().ok()
    }
}

#[cfg(target_os = "windows")]
fn query_raw_input_device_count() -> u32 {
    #[repr(C)]
    struct RawInputDeviceList {
        hdevice: *mut std::ffi::c_void,
        dwtype: u32,
    }

    #[link(name = "user32")]
    extern "system" {
        fn GetRawInputDeviceList(
            prawinputdevicelist: *mut RawInputDeviceList,
            puinumdevices: *mut u32,
            cbsize: u32,
        ) -> u32;
    }

    unsafe {
        let mut count: u32 = 0;
        let _ = GetRawInputDeviceList(
            std::ptr::null_mut(),
            &mut count,
            std::mem::size_of::<RawInputDeviceList>() as u32,
        );
        count
    }
}

#[cfg(target_os = "windows")]
fn is_fullscreen_app_active() -> bool {
    use windows_sys::Win32::UI::Shell::{
        SHQueryUserNotificationState, QUNS_BUSY, QUNS_RUNNING_D3D_FULL_SCREEN,
    };
    unsafe {
        let mut state: i32 = 0;
        if SHQueryUserNotificationState(&mut state) == 0 {
            return state == QUNS_RUNNING_D3D_FULL_SCREEN || state == QUNS_BUSY;
        }
    }
    false
}

pub fn start_system_monitors(app: AppHandle) {
    #[cfg(target_os = "windows")]
    {
        // Thread 1: Fast keyboard lock keys (Caps/Num) + Brightness + Bongo-Cat Typing Pulse
        let fast_app = app.clone();
        std::thread::spawn(move || unsafe {
            use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
                GetAsyncKeyState, GetKeyState, VK_CAPITAL, VK_NUMLOCK,
            };

            let mut last_caps = (GetKeyState(VK_CAPITAL as i32) & 1) != 0;
            let mut last_num = (GetKeyState(VK_NUMLOCK as i32) & 1) != 0;
            let mut last_brightness = read_laptop_brightness();
            let mut brightness_supported = last_brightness.is_some();
            let mut tick_count: u32 = 0;
            let mut last_pulse_ms: u128 = 0;

            loop {
                std::thread::sleep(std::time::Duration::from_millis(90));
                tick_count = tick_count.wrapping_add(1);

                // Caps Lock & Num Lock detection
                let caps = (GetKeyState(VK_CAPITAL as i32) & 1) != 0;
                if caps != last_caps {
                    last_caps = caps;
                    let _ = fast_app.emit(
                        "lock-key-changed",
                        LockKeyPayload {
                            key: "CAPS".to_string(),
                            enabled: caps,
                        },
                    );
                }
                let num = (GetKeyState(VK_NUMLOCK as i32) & 1) != 0;
                if num != last_num {
                    last_num = num;
                    let _ = fast_app.emit(
                        "lock-key-changed",
                        LockKeyPayload {
                            key: "NUM".to_string(),
                            enabled: num,
                        },
                    );
                }

                // Laptop Screen Brightness check (~every 270ms)
                if brightness_supported && tick_count % 3 == 0 {
                    if let Some(cur_b) = read_laptop_brightness() {
                        if let Some(prev_b) = last_brightness {
                            if cur_b != prev_b {
                                last_brightness = Some(cur_b);
                                let _ = fast_app.emit(
                                    "brightness-changed",
                                    BrightnessPayload { percent: cur_b },
                                );
                            }
                        } else {
                            last_brightness = Some(cur_b);
                        }
                    } else {
                        brightness_supported = false;
                    }
                }

                // Privacy-safe Bongo-Cat typing pulse (ONLY detects activity, never key identity)
                if TYPING_PULSE_ENABLED.load(Ordering::Relaxed) {
                    let mut any_pressed = false;
                    // Check A-Z (0x41..=0x5A), 0-9 (0x30..=0x39), Space (0x20), Enter (0x0D)
                    for vk in [0x20i32, 0x0Di32]
                        .into_iter()
                        .chain(0x30..=0x39)
                        .chain(0x41..=0x5A)
                    {
                        if (GetAsyncKeyState(vk) as u16 & 0x0001) != 0 {
                            any_pressed = true;
                        }
                    }
                    if any_pressed {
                        let now_ms = std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_millis();
                        if now_ms.saturating_sub(last_pulse_ms) >= 160 {
                            last_pulse_ms = now_ms;
                            let _ = fast_app.emit("typing-pulse", ());
                        }
                    }
                }
            }
        });

        // Thread 2: Audio/USB Device Plug-in + Fullscreen Auto-Hide (~every 1.2s)
        let slow_app = app;
        std::thread::spawn(move || {
            let mut last_audio_count = query_audio_endpoint_count();
            let mut last_usb_count = query_raw_input_device_count();
            let mut last_fullscreen = is_fullscreen_app_active();

            loop {
                std::thread::sleep(std::time::Duration::from_millis(1200));

                // Audio endpoint connect/disconnect (headphones, speakers, Bluetooth audio)
                if let Some(cur_audio) = query_audio_endpoint_count() {
                    if let Some(prev_audio) = last_audio_count {
                        if cur_audio != prev_audio {
                            let kind = if cur_audio > prev_audio {
                                "connected"
                            } else {
                                "disconnected"
                            };
                            let _ = slow_app.emit(
                                "device-event",
                                DeviceEventPayload {
                                    kind: kind.to_string(),
                                    name: "Audio Device".to_string(),
                                    category: "audio".to_string(),
                                },
                            );
                        }
                    }
                    last_audio_count = Some(cur_audio);
                }

                // USB / HID peripheral connect/disconnect
                let cur_usb = query_raw_input_device_count();
                if cur_usb != last_usb_count && last_usb_count > 0 {
                    let kind = if cur_usb > last_usb_count {
                        "connected"
                    } else {
                        "disconnected"
                    };
                    let _ = slow_app.emit(
                        "device-event",
                        DeviceEventPayload {
                            kind: kind.to_string(),
                            name: "USB Device".to_string(),
                            category: "usb".to_string(),
                        },
                    );
                }
                last_usb_count = cur_usb;

                // Fullscreen app detection
                let fs = is_fullscreen_app_active();
                if fs != last_fullscreen {
                    last_fullscreen = fs;
                    let _ = slow_app.emit("fullscreen-changed", fs);
                }
            }
        });
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
    }
}
