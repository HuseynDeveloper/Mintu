use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardwareInfo {
    pub total_ram_mb: u64,
    pub available_ram_mb: u64,
    pub cpu_cores: usize,
    pub free_disk_mb: u64,
    pub gpu_name: Option<String>,
    pub recommended_tier: String,
}

pub fn detect_hardware(models_dir: &std::path::Path) -> HardwareInfo {
    let cpu_cores = std::thread::available_parallelism()
        .map(|p| p.get())
        .unwrap_or(4);

    let mut total_ram_mb: u64 = 8192;
    let mut available_ram_mb: u64 = 4096;
    let mut free_disk_mb: u64 = 10240;
    let gpu_name: Option<String> = None;

    #[cfg(target_os = "windows")]
    unsafe {
        use std::mem::zeroed;
        use windows_sys::Win32::System::SystemInformation::{GlobalMemoryStatusEx, MEMORYSTATUSEX};
        use windows_sys::Win32::Storage::FileSystem::GetDiskFreeSpaceExW;

        // 1. RAM detection
        let mut mem_status: MEMORYSTATUSEX = zeroed();
        mem_status.dwLength = std::mem::size_of::<MEMORYSTATUSEX>() as u32;
        if GlobalMemoryStatusEx(&mut mem_status) != 0 {
            total_ram_mb = mem_status.ullTotalPhys / (1024 * 1024);
            available_ram_mb = mem_status.ullAvailPhys / (1024 * 1024);
        }

        // 2. Disk space detection
        let path_str = models_dir.to_string_lossy();
        let mut wide_path: Vec<u16> = path_str.encode_utf16().collect();
        wide_path.push(0);

        let mut free_bytes_avail: u64 = 0;
        let mut total_bytes: u64 = 0;
        let mut total_free_bytes: u64 = 0;

        if GetDiskFreeSpaceExW(
            wide_path.as_ptr(),
            &mut free_bytes_avail,
            &mut total_bytes,
            &mut total_free_bytes,
        ) != 0
        {
            free_disk_mb = free_bytes_avail / (1024 * 1024);
        } else {
            // Fallback to drive root if models dir doesn't exist yet
            let drive_root: Vec<u16> = "C:\\\0".encode_utf16().collect();
            if GetDiskFreeSpaceExW(
                drive_root.as_ptr(),
                &mut free_bytes_avail,
                &mut total_bytes,
                &mut total_free_bytes,
            ) != 0
            {
                free_disk_mb = free_bytes_avail / (1024 * 1024);
            }
        }
    }

    // Determine recommended tier based on RAM
    let recommended_tier = if total_ram_mb < 5000 {
        "very-low".to_string() // e.g. 4GB devices -> Qwen 0.5B
    } else if total_ram_mb < 9000 {
        "low".to_string()      // e.g. 8GB devices -> Qwen 1.5B
    } else if total_ram_mb < 17000 {
        "medium".to_string()   // e.g. 16GB devices -> Qwen 3B
    } else {
        "high".to_string()     // e.g. 32GB+ devices -> Qwen 7B
    };

    HardwareInfo {
        total_ram_mb,
        available_ram_mb,
        cpu_cores,
        free_disk_mb,
        gpu_name,
        recommended_tier,
    }
}

use std::sync::Mutex;
use std::time::Instant;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemStatus {
    pub battery_percent: Option<u8>,
    pub is_charging: Option<bool>,
    pub has_battery: bool,
    pub cpu_percent: u8,
    pub ram_percent: u8,
    pub ram_free_mb: u64,
    pub ram_total_mb: u64,
    pub disk_free_gb: f64,
    pub disk_total_gb: f64,
    pub network_connected: bool,
    pub network_down_kbps: f64,
    pub network_up_kbps: f64,
}

#[derive(Copy, Clone)]
struct PrevCpuSample {
    idle: u64,
    kernel: u64,
    user: u64,
}

static PREV_CPU: Mutex<Option<PrevCpuSample>> = Mutex::new(None);

#[derive(Copy, Clone)]
struct PrevNetSample {
    in_bytes: u64,
    out_bytes: u64,
    timestamp: Instant,
}

static PREV_NET: Mutex<Option<PrevNetSample>> = Mutex::new(None);

#[cfg(target_os = "windows")]
#[repr(C)]
struct SYSTEM_POWER_STATUS {
    ac_line_status: u8,
    battery_flag: u8,
    battery_life_percent: u8,
    system_status_flag: u8,
    battery_life_time: u32,
    battery_full_life_time: u32,
}

#[cfg(target_os = "windows")]
#[repr(C)]
#[derive(Copy, Clone, Default)]
struct FILETIME {
    dw_low_date_time: u32,
    dw_high_date_time: u32,
}

#[cfg(target_os = "windows")]
extern "system" {
    fn GetSystemPowerStatus(lpSystemPowerStatus: *mut SYSTEM_POWER_STATUS) -> i32;
    fn GetSystemTimes(
        lpIdleTime: *mut FILETIME,
        lpKernelTime: *mut FILETIME,
        lpUserTime: *mut FILETIME,
    ) -> i32;
    fn GetIfTable(pIfTable: *mut u8, pdwSize: *mut u32, bOrder: i32) -> u32;
}

#[cfg(target_os = "windows")]
fn filetime_to_u64(ft: FILETIME) -> u64 {
    ((ft.dw_high_date_time as u64) << 32) | (ft.dw_low_date_time as u64)
}

pub fn get_system_status() -> SystemStatus {
    let mut battery_percent: Option<u8> = None;
    let mut is_charging: Option<bool> = None;
    let mut has_battery = false;
    let mut cpu_percent = 0u8;
    let mut ram_percent = 0u8;
    let mut ram_free_mb = 0u64;
    let mut ram_total_mb = 0u64;
    let mut disk_free_gb = 0.0;
    let mut disk_total_gb = 0.0;
    let mut network_connected = true;
    let mut network_down_kbps = 0.0;
    let mut network_up_kbps = 0.0;

    #[cfg(target_os = "windows")]
    unsafe {
        use std::mem::zeroed;
        use windows_sys::Win32::Storage::FileSystem::GetDiskFreeSpaceExW;
        use windows_sys::Win32::System::SystemInformation::{GlobalMemoryStatusEx, MEMORYSTATUSEX};

        // 1. Battery via GetSystemPowerStatus
        let mut pwr: SYSTEM_POWER_STATUS = zeroed();
        if GetSystemPowerStatus(&mut pwr) != 0 {
            if pwr.battery_flag != 128 && pwr.battery_flag != 255 && pwr.battery_life_percent <= 100 {
                has_battery = true;
                battery_percent = Some(pwr.battery_life_percent);
                is_charging = Some(pwr.ac_line_status == 1);
            }
        }

        // 2. CPU load via GetSystemTimes delta
        let mut idle_ft = FILETIME::default();
        let mut kernel_ft = FILETIME::default();
        let mut user_ft = FILETIME::default();
        if GetSystemTimes(&mut idle_ft, &mut kernel_ft, &mut user_ft) != 0 {
            let idle = filetime_to_u64(idle_ft);
            let kernel = filetime_to_u64(kernel_ft);
            let user = filetime_to_u64(user_ft);

            if let Ok(mut lock) = PREV_CPU.lock() {
                if let Some(prev) = *lock {
                    let kernel_delta = kernel.saturating_sub(prev.kernel);
                    let user_delta = user.saturating_sub(prev.user);
                    let idle_delta = idle.saturating_sub(prev.idle);
                    let total = kernel_delta + user_delta;
                    if total > 0 {
                        let used = total.saturating_sub(idle_delta);
                        cpu_percent = ((used as f64 / total as f64) * 100.0).round().clamp(0.0, 100.0) as u8;
                    }
                }
                *lock = Some(PrevCpuSample { idle, kernel, user });
            }
        }

        // 3. RAM via GlobalMemoryStatusEx
        let mut mem: MEMORYSTATUSEX = zeroed();
        mem.dwLength = std::mem::size_of::<MEMORYSTATUSEX>() as u32;
        if GlobalMemoryStatusEx(&mut mem) != 0 {
            ram_percent = mem.dwMemoryLoad.min(100) as u8;
            ram_total_mb = mem.ullTotalPhys / (1024 * 1024);
            ram_free_mb = mem.ullAvailPhys / (1024 * 1024);
        }

        // 4. Disk (C:\ drive)
        let drive: Vec<u16> = "C:\\\0".encode_utf16().collect();
        let mut free_avail: u64 = 0;
        let mut total_bytes: u64 = 0;
        let mut total_free: u64 = 0;
        if GetDiskFreeSpaceExW(drive.as_ptr(), &mut free_avail, &mut total_bytes, &mut total_free) != 0 {
            disk_free_gb = (free_avail as f64) / (1024.0 * 1024.0 * 1024.0);
            disk_total_gb = (total_bytes as f64) / (1024.0 * 1024.0 * 1024.0);
        }

        // 5. Network throughput via GetIfTable (pure local interface counters, no network requests)
        let mut buf_size: u32 = 0;
        let _ = GetIfTable(std::ptr::null_mut(), &mut buf_size, 0);
        if buf_size > 0 {
            let mut buf: Vec<u8> = vec![0; buf_size as usize];
            if GetIfTable(buf.as_mut_ptr(), &mut buf_size, 0) == 0 && buf.len() >= 4 {
                let num_entries = *(buf.as_ptr() as *const u32);
                let mut total_in = 0u64;
                let mut total_out = 0u64;
                let mut any_connected = false;

                let row_size = 860; // sizeof(MIB_IFROW) on 64-bit windows
                let table_start = 4;
                for i in 0..num_entries {
                    let offset = table_start + (i as usize) * row_size;
                    if offset + row_size <= buf.len() {
                        let row_ptr = buf.as_ptr().add(offset);
                        // dwOperStatus is at offset 528 (MIB_IF_OPER_STATUS_OPERATIONAL = 1)
                        // dwInOctets is at offset 552
                        // dwOutOctets is at offset 576
                        let oper_status = *(row_ptr.add(528) as *const u32);
                        let in_octets = *(row_ptr.add(552) as *const u32);
                        let out_octets = *(row_ptr.add(576) as *const u32);
                        if oper_status == 1 {
                            any_connected = true;
                            total_in += in_octets as u64;
                            total_out += out_octets as u64;
                        }
                    }
                }
                network_connected = any_connected;

                let now = Instant::now();
                if let Ok(mut lock) = PREV_NET.lock() {
                    if let Some(prev) = *lock {
                        let elapsed_sec = now.duration_since(prev.timestamp).as_secs_f64();
                        if elapsed_sec > 0.1 {
                            let in_delta = total_in.saturating_sub(prev.in_bytes);
                            let out_delta = total_out.saturating_sub(prev.out_bytes);
                            network_down_kbps = ((in_delta as f64) / 1024.0 / elapsed_sec).max(0.0);
                            network_up_kbps = ((out_delta as f64) / 1024.0 / elapsed_sec).max(0.0);
                        }
                    }
                    *lock = Some(PrevNetSample {
                        in_bytes: total_in,
                        out_bytes: total_out,
                        timestamp: now,
                    });
                }
            }
        }
    }

    SystemStatus {
        battery_percent,
        is_charging,
        has_battery,
        cpu_percent,
        ram_percent,
        ram_free_mb,
        ram_total_mb,
        disk_free_gb,
        disk_total_gb,
        network_connected,
        network_down_kbps,
        network_up_kbps,
    }
}

