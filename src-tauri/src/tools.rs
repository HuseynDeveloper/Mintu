use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use windows_sys::Win32::Foundation::HWND;
use windows_sys::Win32::System::DataExchange::{
    CloseClipboard, GetClipboardData, IsClipboardFormatAvailable, OpenClipboard,
};
use windows_sys::Win32::System::Memory::GlobalLock;
use windows_sys::Win32::System::Memory::GlobalUnlock;
use windows_sys::Win32::UI::Shell::{
    ShellExecuteW, SHFileOperationW, FOF_ALLOWUNDO, FOF_NOCONFIRMATION, FOF_SILENT, FO_DELETE,
    SHFILEOPSTRUCTW,
};

const CF_UNICODETEXT: u32 = 13;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileSearchResult {
    pub path: String,
    pub filename: String,
    pub size_bytes: u64,
    pub modified_ms: u64,
    pub snippet: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledAppInfo {
    pub name: String,
    pub path: String,
}

pub fn get_default_allowed_dirs() -> Vec<String> {
    let mut dirs = Vec::new();
    if let Ok(userprofile) = std::env::var("USERPROFILE") {
        let p = PathBuf::from(userprofile);
        let downloads = p.join("Downloads");
        let desktop = p.join("Desktop");
        let documents = p.join("Documents");
        if downloads.exists() {
            dirs.push(downloads.to_string_lossy().to_string());
        }
        if desktop.exists() {
            dirs.push(desktop.to_string_lossy().to_string());
        }
        if documents.exists() {
            dirs.push(documents.to_string_lossy().to_string());
        }
    }
    dirs
}

pub fn is_path_in_allowed_dirs<P: AsRef<Path>>(path: P, allowed_dirs: &[String]) -> bool {
    let Ok(canonical_path) = fs::canonicalize(path.as_ref()) else {
        return false;
    };

    for allowed in allowed_dirs {
        if let Ok(canonical_allowed) = fs::canonicalize(Path::new(allowed)) {
            if canonical_path.starts_with(&canonical_allowed) {
                return true;
            }
        }
    }
    false
}

pub fn move_file_to_recycle_bin(file_path: &str, allowed_dirs: &[String]) -> Result<String, String> {
    let path = PathBuf::from(file_path);
    if !path.exists() {
        return Err("File does not exist".to_string());
    }
    if !path.is_file() {
        return Err("Target is a directory. Mintu can only recycle individual files, never entire folders.".to_string());
    }

    if !is_path_in_allowed_dirs(&path, allowed_dirs) {
        return Err("Security check failed: file is outside of your allowed folders (Downloads/Desktop)".to_string());
    }

    let abs_path = fs::canonicalize(&path).map_err(|e| e.to_string())?;
    let path_str = abs_path.to_string_lossy().to_string();

    // SHFileOperationW requires a double-null-terminated wide string
    let mut wide_path: Vec<u16> = path_str.encode_utf16().collect();
    wide_path.push(0);
    wide_path.push(0);

    let mut op = SHFILEOPSTRUCTW {
        hwnd: 0 as HWND,
        wFunc: FO_DELETE,
        pFrom: wide_path.as_ptr(),
        pTo: std::ptr::null(),
        fFlags: (FOF_ALLOWUNDO | FOF_NOCONFIRMATION | FOF_SILENT) as u16,
        fAnyOperationsAborted: 0,
        hNameMappings: std::ptr::null_mut(),
        lpszProgressTitle: std::ptr::null(),
    };

    let ret = unsafe { SHFileOperationW(&mut op) };
    if ret == 0 && op.fAnyOperationsAborted == 0 {
        Ok(format!("Moved {} to Recycle Bin (reversible)", path.file_name().unwrap_or_default().to_string_lossy()))
    } else {
        Err(format!("Windows Recycle Bin error code: {}", ret))
    }
}

pub fn search_files_in_allowed_dirs(
    query: &str,
    subfolder: Option<&str>,
    allowed_dirs: &[String],
    max_results: usize,
) -> Result<Vec<FileSearchResult>, String> {
    let q = query.trim().to_lowercase();
    let max = max_results.min(20);
    let mut results = Vec::new();

    let allowed_extensions = [
        "txt", "md", "json", "csv", "log", "rs", "ts", "py", "js", "html", "css",
        "yaml", "yml", "toml", "xml", "ini", "cfg", "sql", "bat", "ps1"
    ];

    let search_roots: Vec<PathBuf> = if let Some(sub) = subfolder {
        let sub_p = PathBuf::from(sub);
        if is_path_in_allowed_dirs(&sub_p, allowed_dirs) && sub_p.is_dir() {
            vec![sub_p]
        } else {
            allowed_dirs.iter().map(PathBuf::from).collect()
        }
    } else {
        allowed_dirs.iter().map(PathBuf::from).collect()
    };

    for root in search_roots {
        if !root.exists() || !root.is_dir() {
            continue;
        }
        search_recursive(&root, &q, &allowed_extensions, max, &mut results);
        if results.len() >= max {
            break;
        }
    }

    Ok(results)
}

fn search_recursive(
    dir: &Path,
    query: &str,
    allowed_exts: &[&str],
    max: usize,
    results: &mut Vec<FileSearchResult>,
) {
    if results.len() >= max {
        return;
    }
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };

    for entry in entries.flatten() {
        if results.len() >= max {
            break;
        }
        let path = entry.path();
        if path.is_dir() {
            // Skip hidden or massive system folders
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if name.starts_with('.') || name == "node_modules" || name == "target" || name == "AppData" {
                    continue;
                }
            }
            search_recursive(&path, query, allowed_exts, max, results);
        } else if path.is_file() {
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            if !allowed_exts.contains(&ext.as_str()) {
                continue;
            }

            let Ok(meta) = path.metadata() else {
                continue;
            };
            // 1MB file limit
            if meta.len() > 1_048_576 {
                continue;
            }

            let filename = path.file_name().unwrap_or_default().to_string_lossy().to_string();
            let name_matches = query.is_empty() || filename.to_lowercase().contains(query);

            let mut matched_snippet = None;
            let mut matches = name_matches;

            if !matches {
                // Check contents for small text files (< 200KB)
                if meta.len() < 204_800 {
                    if let Ok(content) = fs::read_to_string(&path) {
                        if let Some(pos) = content.to_lowercase().find(query) {
                            matches = true;
                            let start = pos.saturating_sub(40);
                            let end = (pos + query.len() + 40).min(content.len());
                            let mut snip = content[start..end].replace('\n', " ").replace('\r', "");
                            if start > 0 {
                                snip = format!("...{}", snip);
                            }
                            if end < content.len() {
                                snip.push_str("...");
                            }
                            matched_snippet = Some(snip);
                        }
                    }
                }
            }

            if matches {
                let modified_ms = meta
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0);

                results.push(FileSearchResult {
                    path: path.to_string_lossy().to_string(),
                    filename,
                    size_bytes: meta.len(),
                    modified_ms,
                    snippet: matched_snippet,
                });
            }
        }
    }
}

pub fn list_installed_apps() -> Vec<InstalledAppInfo> {
    let mut apps = Vec::new();
    let mut search_paths = Vec::new();

    if let Ok(progdata) = std::env::var("ProgramData") {
        search_paths.push(PathBuf::from(progdata).join("Microsoft\\Windows\\Start Menu\\Programs"));
    }
    if let Ok(appdata) = std::env::var("APPDATA") {
        search_paths.push(PathBuf::from(appdata).join("Microsoft\\Windows\\Start Menu\\Programs"));
    }

    for dir in search_paths {
        if dir.exists() {
            scan_shortcuts(&dir, &mut apps);
        }
    }

    // Common built-in tools
    let system_apps = [
        ("Calculator", "calc.exe"),
        ("Notepad", "notepad.exe"),
        ("Paint", "mspaint.exe"),
        ("Task Manager", "taskmgr.exe"),
        ("File Explorer", "explorer.exe"),
    ];

    for (name, path) in system_apps {
        if !apps.iter().any(|a| a.name.eq_ignore_ascii_case(name)) {
            apps.push(InstalledAppInfo {
                name: name.to_string(),
                path: path.to_string(),
            });
        }
    }

    apps.sort_by(|a, b| a.name.cmp(&b.name));
    apps.dedup_by(|a, b| a.name.eq_ignore_ascii_case(&b.name));
    apps
}

fn scan_shortcuts(dir: &Path, out: &mut Vec<InstalledAppInfo>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            scan_shortcuts(&path, out);
        } else if path.is_file() {
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                if ext.eq_ignore_ascii_case("lnk") {
                    if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                        let name = stem.trim().to_string();
                        if !name.is_empty()
                            && !name.to_lowercase().contains("uninstall")
                            && !name.to_lowercase().contains("help")
                            && !name.to_lowercase().contains("readme")
                        {
                            out.push(InstalledAppInfo {
                                name,
                                path: path.to_string_lossy().to_string(),
                            });
                        }
                    }
                }
            }
        }
    }
}

pub fn open_app_by_name(name: &str) -> Result<String, String> {
    let q = name.trim().to_lowercase();
    let apps = list_installed_apps();

    // Direct exact match
    if let Some(found) = apps.iter().find(|a| a.name.to_lowercase() == q) {
        return launch_path(&found.path, &found.name);
    }

    // Partial contains match
    if let Some(found) = apps.iter().find(|a| a.name.to_lowercase().contains(&q)) {
        return launch_path(&found.path, &found.name);
    }

    // Common system exes
    if q == "calc" || q == "calculator" {
        return launch_path("calc.exe", "Calculator");
    }
    if q == "notepad" {
        return launch_path("notepad.exe", "Notepad");
    }

    Err(format!("Could not find an installed application matching '{}'", name))
}

fn launch_path(target: &str, display_name: &str) -> Result<String, String> {
    let wide_open: Vec<u16> = "open\0".encode_utf16().collect();
    let wide_target: Vec<u16> = target.encode_utf16().chain(std::iter::once(0)).collect();

    let res = unsafe {
        ShellExecuteW(
            0 as HWND,
            wide_open.as_ptr(),
            wide_target.as_ptr(),
            std::ptr::null(),
            std::ptr::null(),
            1, // SW_SHOWNORMAL
        )
    };

    if (res as isize) > 32 {
        Ok(format!("Opened {}", display_name))
    } else {
        Err(format!("Failed to launch {} (error code {})", display_name, res as isize))
    }
}

pub fn open_browser_url(url: &str) -> Result<String, String> {
    let trimmed = url.trim();
    if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
        return Err("Security restriction: Mintu can only open http:// and https:// URLs.".to_string());
    }

    let wide_open: Vec<u16> = "open\0".encode_utf16().collect();
    let wide_url: Vec<u16> = trimmed.encode_utf16().chain(std::iter::once(0)).collect();

    let res = unsafe {
        ShellExecuteW(
            0 as HWND,
            wide_open.as_ptr(),
            wide_url.as_ptr(),
            std::ptr::null(),
            std::ptr::null(),
            1, // SW_SHOWNORMAL
        )
    };

    if (res as isize) > 32 {
        Ok(format!("Opened {}", trimmed))
    } else {
        Err(format!("Failed to open URL in browser (code {})", res as isize))
    }
}

pub fn read_clipboard_text_safe() -> Result<String, String> {
    unsafe {
        if OpenClipboard(0 as HWND) == 0 {
            return Err("Unable to access clipboard".to_string());
        }

        if IsClipboardFormatAvailable(CF_UNICODETEXT) == 0 {
            CloseClipboard();
            return Ok("".to_string()); // No text available
        }

        let handle = GetClipboardData(CF_UNICODETEXT);
        if handle.is_null() {
            CloseClipboard();
            return Ok("".to_string());
        }

        let ptr = GlobalLock(handle) as *const u16;
        if ptr.is_null() {
            CloseClipboard();
            return Ok("".to_string());
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
