use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveWindowInfo {
    pub title: String,
    pub process_name: String,
    pub is_blocked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapturedContext {
    pub text: Option<String>,
    pub image_base64: Option<String>,
    pub app_info: ActiveWindowInfo,
}

const PRIVACY_BLOCKLIST: &[&str] = &[
    "1password.exe",
    "bitwarden.exe",
    "keepass.exe",
    "keepassxc.exe",
    "lastpass.exe",
    "authy.exe",
    "dashlane.exe",
    "nordpass.exe",
    "enpass.exe",
    "cmdkey.exe",
    "credman.exe",
];

static CUSTOM_BLOCKLIST: std::sync::RwLock<Vec<String>> = std::sync::RwLock::new(Vec::new());

pub fn set_custom_blocklist(items: Vec<String>) {
    if let Ok(mut list) = CUSTOM_BLOCKLIST.write() {
        *list = items
            .into_iter()
            .map(|s| s.trim().to_lowercase())
            .filter(|s| !s.is_empty())
            .collect();
    }
}

pub fn get_active_window_info() -> ActiveWindowInfo {
    #[cfg(target_os = "windows")]
    unsafe {
        use windows_sys::Win32::Foundation::{CloseHandle, HWND};
        use windows_sys::Win32::System::Threading::{
            OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
        };
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId,
        };

        let hwnd: HWND = GetForegroundWindow();
        if hwnd.is_null() {
            return ActiveWindowInfo {
                title: String::new(),
                process_name: String::new(),
                is_blocked: false,
            };
        }

        // 1. Get window title
        let mut title_buf = [0u16; 512];
        let len = GetWindowTextW(hwnd, title_buf.as_mut_ptr(), 512);
        let title = String::from_utf16_lossy(&title_buf[..len as usize]);

        // 2. Get process name
        let mut process_id: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut process_id);

        let mut process_name = String::new();
        if process_id != 0 {
            let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, process_id);
            if !handle.is_null() {
                let mut path_buf = [0u16; 1024];
                let mut path_len = 1024u32;
                if QueryFullProcessImageNameW(handle, 0, path_buf.as_mut_ptr(), &mut path_len) != 0 {
                    let full_path = String::from_utf16_lossy(&path_buf[..path_len as usize]);
                    if let Some(name) = std::path::Path::new(&full_path).file_name().and_then(|n| n.to_str()) {
                        process_name = name.to_string();
                    }
                }
                CloseHandle(handle);
            }
        }

        let proc_lower = process_name.to_lowercase();
        let is_default_blocked = PRIVACY_BLOCKLIST.iter().any(|b| proc_lower.contains(b));
        let is_custom_blocked = CUSTOM_BLOCKLIST
            .read()
            .map(|list| list.iter().any(|b| proc_lower.contains(b)))
            .unwrap_or(false);
        let is_blocked = is_default_blocked || is_custom_blocked;

        ActiveWindowInfo {
            title,
            process_name,
            is_blocked,
        }
    }

    #[cfg(not(target_os = "windows"))]
    ActiveWindowInfo {
        title: "Desktop".to_string(),
        process_name: "app".to_string(),
        is_blocked: false,
    }
}

pub fn capture_selected_text() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    unsafe {
        use windows_sys::Win32::System::DataExchange::{
            CloseClipboard, GetClipboardData, OpenClipboard, SetClipboardData,
        };
        use windows_sys::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GHND};
        use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
            keybd_event, KEYEVENTF_KEYUP, VK_CONTROL,
        };

        let mut saved_clipboard: Option<Vec<u16>> = None;

        // Try reading existing clipboard to restore after capture
        if OpenClipboard(std::ptr::null_mut()) != 0 {
            const CF_UNICODETEXT: u32 = 13;
            let h_data = GetClipboardData(CF_UNICODETEXT);
            if !h_data.is_null() {
                let ptr = GlobalLock(h_data) as *const u16;
                if !ptr.is_null() {
                    let mut len = 0;
                    while *ptr.add(len) != 0 {
                        len += 1;
                    }
                    let slice = std::slice::from_raw_parts(ptr, len);
                    saved_clipboard = Some(slice.to_vec());
                    GlobalUnlock(h_data);
                }
            }
            CloseClipboard();
        }

        // Simulate Ctrl+C
        keybd_event(VK_CONTROL as u8, 0, 0, 0);
        keybd_event(0x43, 0, 0, 0); // 'C'
        keybd_event(0x43, 0, KEYEVENTF_KEYUP, 0);
        keybd_event(VK_CONTROL as u8, 0, KEYEVENTF_KEYUP, 0);

        // Sleep briefly for target app to populate clipboard
        std::thread::sleep(std::time::Duration::from_millis(80));

        let mut captured = String::new();
        if OpenClipboard(std::ptr::null_mut()) != 0 {
            const CF_UNICODETEXT: u32 = 13;
            let h_data = GetClipboardData(CF_UNICODETEXT);
            if !h_data.is_null() {
                let ptr = GlobalLock(h_data) as *const u16;
                if !ptr.is_null() {
                    let mut len = 0;
                    while *ptr.add(len) != 0 {
                        len += 1;
                    }
                    let slice = std::slice::from_raw_parts(ptr, len);
                    captured = String::from_utf16_lossy(slice);
                    GlobalUnlock(h_data);
                }
            }

            // Restore original clipboard if we had text
            if let Some(orig) = saved_clipboard {
                let bytes_len = (orig.len() + 1) * 2;
                let h_mem = GlobalAlloc(GHND, bytes_len);
                if !h_mem.is_null() {
                    let dest = GlobalLock(h_mem) as *mut u16;
                    if !dest.is_null() {
                        std::ptr::copy_nonoverlapping(orig.as_ptr(), dest, orig.len());
                        *dest.add(orig.len()) = 0;
                        GlobalUnlock(h_mem);
                        SetClipboardData(CF_UNICODETEXT, h_mem);
                    }
                }
            }

            CloseClipboard();
        }

        Ok(captured)
    }

    #[cfg(not(target_os = "windows"))]
    Ok(String::new())
}

pub fn capture_screen_region(x: i32, y: i32, width: i32, height: i32) -> Result<Vec<u8>, String> {
    #[cfg(target_os = "windows")]
    unsafe {
        use windows_sys::Win32::Graphics::Gdi::{
            BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDC,
            GetDIBits, ReleaseDC, SelectObject, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS,
            SRCCOPY,
        };

        if width <= 0 || height <= 0 {
            return Err("Invalid width or height".to_string());
        }

        let hdc_screen = GetDC(std::ptr::null_mut());
        let hdc_mem = CreateCompatibleDC(hdc_screen);
        let h_bitmap = CreateCompatibleBitmap(hdc_screen, width, height);
        let old_bitmap = SelectObject(hdc_mem, h_bitmap);

        BitBlt(hdc_mem, 0, 0, width, height, hdc_screen, x, y, SRCCOPY);

        let mut bi: BITMAPINFO = std::mem::zeroed();
        bi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
        bi.bmiHeader.biWidth = width;
        bi.bmiHeader.biHeight = -height; // Top-down
        bi.bmiHeader.biPlanes = 1;
        bi.bmiHeader.biBitCount = 32;
        bi.bmiHeader.biCompression = BI_RGB;

        let row_bytes = width as usize * 4;
        let mut raw_pixels = vec![0u8; row_bytes * height as usize];

        GetDIBits(
            hdc_mem,
            h_bitmap,
            0,
            height as u32,
            raw_pixels.as_mut_ptr() as *mut _,
            &mut bi,
            DIB_RGB_COLORS,
        );

        SelectObject(hdc_mem, old_bitmap);
        DeleteObject(h_bitmap);
        DeleteDC(hdc_mem);
        ReleaseDC(std::ptr::null_mut(), hdc_screen);

        Ok(raw_pixels)
    }

    #[cfg(not(target_os = "windows"))]
    Err("Screen capture only implemented for Windows".to_string())
}

pub fn raw_pixels_to_bmp_base64(bgra_pixels: &[u8], width: i32, height: i32) -> String {
    let file_header_size = 14u32;
    let info_header_size = 40u32;
    let image_size = (width as u32) * (height as u32) * 4;
    let file_size = file_header_size + info_header_size + image_size;

    let mut bmp_data = Vec::with_capacity(file_size as usize);
    // BMP Header (14 bytes)
    bmp_data.extend_from_slice(b"BM");
    bmp_data.extend_from_slice(&file_size.to_le_bytes());
    bmp_data.extend_from_slice(&[0u8; 4]); // Reserved
    let offset = file_header_size + info_header_size;
    bmp_data.extend_from_slice(&offset.to_le_bytes());

    // DIB Header (BITMAPINFOHEADER - 40 bytes)
    bmp_data.extend_from_slice(&info_header_size.to_le_bytes());
    bmp_data.extend_from_slice(&width.to_le_bytes());
    // Negative height for top-down bitmap
    bmp_data.extend_from_slice(&(-height).to_le_bytes());
    bmp_data.extend_from_slice(&1u16.to_le_bytes()); // Color planes
    bmp_data.extend_from_slice(&32u16.to_le_bytes()); // Bits per pixel
    bmp_data.extend_from_slice(&0u32.to_le_bytes()); // Compression (BI_RGB)
    bmp_data.extend_from_slice(&image_size.to_le_bytes());
    bmp_data.extend_from_slice(&0u32.to_le_bytes()); // X pixels per meter
    bmp_data.extend_from_slice(&0u32.to_le_bytes()); // Y pixels per meter
    bmp_data.extend_from_slice(&0u32.to_le_bytes()); // Colors in palette
    bmp_data.extend_from_slice(&0u32.to_le_bytes()); // Important colors

    // Pixel data (BGRA)
    bmp_data.extend_from_slice(bgra_pixels);

    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bmp_data);
    format!("data:image/bmp;base64,{}", b64)
}

pub fn capture_region_and_ocr(
    x: i32,
    y: i32,
    width: i32,
    height: i32,
) -> Result<CapturedContext, String> {
    let app_info = get_active_window_info();
    if app_info.is_blocked {
        return Ok(CapturedContext {
            text: None,
            image_base64: None,
            app_info,
        });
    }

    let raw_pixels = capture_screen_region(x, y, width, height)?;
    let img_b64 = raw_pixels_to_bmp_base64(&raw_pixels, width, height);

    let ocr_text = perform_ocr_on_pixels(&raw_pixels, width as u32, height as u32)
        .unwrap_or_default();

    Ok(CapturedContext {
        text: if ocr_text.trim().is_empty() {
            None
        } else {
            Some(ocr_text.trim().to_string())
        },
        image_base64: Some(img_b64),
        app_info,
    })
}

pub fn perform_ocr_on_pixels(
    pixels_bgra: &[u8],
    width: u32,
    height: u32,
) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use windows::Graphics::Imaging::{BitmapPixelFormat, SoftwareBitmap};
        use windows::Media::Ocr::OcrEngine;
        use windows::Storage::Streams::DataWriter;

        let engine = OcrEngine::TryCreateFromUserProfileLanguages()
            .map_err(|e| format!("Failed to initialize Windows OCR Engine: {}", e))?;

        let writer = DataWriter::new().map_err(|e| e.to_string())?;
        writer.WriteBytes(pixels_bgra).map_err(|e| e.to_string())?;
        let ibuffer = writer.DetachBuffer().map_err(|e| e.to_string())?;

        let software_bitmap = SoftwareBitmap::CreateCopyFromBuffer(
            &ibuffer,
            BitmapPixelFormat::Bgra8,
            width as i32,
            height as i32,
        )
        .map_err(|e| format!("Failed to create SoftwareBitmap: {}", e))?;

        let ocr_result_op = engine
            .RecognizeAsync(&software_bitmap)
            .map_err(|e| format!("RecognizeAsync call failed: {}", e))?;

        let ocr_result = ocr_result_op
            .get()
            .map_err(|e| format!("OCR recognition execution failed: {}", e))?;

        let text = ocr_result
            .Text()
            .map(|t| t.to_string())
            .unwrap_or_default();

        Ok(text)
    }

    #[cfg(not(target_os = "windows"))]
    Err("OCR only supported on Windows".to_string())
}
