// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(target_os = "windows")]
fn kill_stale_mintu_processes() {
    use windows_sys::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
    };
    use windows_sys::Win32::System::Threading::{
        OpenProcess, TerminateProcess, WaitForSingleObject, PROCESS_SYNCHRONIZE, PROCESS_TERMINATE,
    };
    use windows_sys::Win32::Foundation::CloseHandle;

    let my_pid = std::process::id();
    unsafe {
        let snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snap.is_null() || snap == -1 as _ {
            return;
        }

        let mut entry: PROCESSENTRY32W = std::mem::zeroed();
        entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;

        if Process32FirstW(snap, &mut entry) != 0 {
            loop {
                let len = entry.szExeFile.iter().position(|&c| c == 0).unwrap_or(entry.szExeFile.len());
                let name = String::from_utf16_lossy(&entry.szExeFile[..len]).to_lowercase();
                if (name == "mintu.exe" || name == "mintu") && entry.th32ProcessID != my_pid {
                    let h_proc = OpenProcess(PROCESS_TERMINATE | PROCESS_SYNCHRONIZE, 0, entry.th32ProcessID);
                    if !h_proc.is_null() {
                        TerminateProcess(h_proc, 1);
                        WaitForSingleObject(h_proc, 1500);
                        CloseHandle(h_proc);
                    }
                }
                if Process32NextW(snap, &mut entry) == 0 {
                    break;
                }
            }
        }
        CloseHandle(snap);
    }
}

fn main() {
    #[cfg(target_os = "windows")]
    {
        let args: Vec<String> = std::env::args().collect();
        if args.len() == 1 {
            kill_stale_mintu_processes();
        }
    }

    std::panic::set_hook(Box::new(|info| {
        let log_msg = format!("PANIC: {:?}\nLocation: {:?}\nBacktrace: {:?}", 
            info.to_string(),
            info.location(),
            std::backtrace::Backtrace::capture()
        );
        let log_path = std::env::temp_dir().join("mintu_startup.log");
        let _ = std::fs::write(log_path, log_msg);
    }));

    mintu_lib::run();
}
