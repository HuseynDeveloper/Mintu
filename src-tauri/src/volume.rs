use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct VolumeState {
    pub percent: u8,
    pub muted: bool,
}

impl Default for VolumeState {
    fn default() -> Self {
        Self {
            percent: 50,
            muted: false,
        }
    }
}

#[cfg(target_os = "windows")]
mod win_audio {
    use super::VolumeState;
    use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
    use windows::Win32::Media::Audio::{eConsole, eRender, IMMDeviceEnumerator, MMDeviceEnumerator};
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED,
    };

    fn get_endpoint_volume() -> Result<IAudioEndpointVolume, String> {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            let enumerator: IMMDeviceEnumerator =
                CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
                    .map_err(|e| format!("MMDeviceEnumerator failed: {e}"))?;
            let device = enumerator
                .GetDefaultAudioEndpoint(eRender, eConsole)
                .map_err(|e| format!("GetDefaultAudioEndpoint failed: {e}"))?;
            let endpoint: IAudioEndpointVolume = device
                .Activate(CLSCTX_ALL, None)
                .map_err(|e| format!("Activate IAudioEndpointVolume failed: {e}"))?;
            Ok(endpoint)
        }
    }

    pub fn read_volume() -> Result<VolumeState, String> {
        let ep = get_endpoint_volume()?;
        unsafe {
            let scalar = ep
                .GetMasterVolumeLevelScalar()
                .map_err(|e| format!("GetMasterVolumeLevelScalar failed: {e}"))?;
            let muted = ep
                .GetMute()
                .map_err(|e| format!("GetMute failed: {e}"))?
                .as_bool();
            let pct = (scalar.clamp(0.0, 1.0) * 100.0).round() as u8;
            Ok(VolumeState {
                percent: pct,
                muted,
            })
        }
    }

    pub fn write_volume(percent: u8, muted: Option<bool>) -> Result<VolumeState, String> {
        let ep = get_endpoint_volume()?;
        unsafe {
            let clamped = percent.min(100);
            let scalar = (clamped as f32) / 100.0;
            ep.SetMasterVolumeLevelScalar(scalar, std::ptr::null())
                .map_err(|e| format!("SetMasterVolumeLevelScalar failed: {e}"))?;
            if let Some(m) = muted {
                ep.SetMute(m, std::ptr::null())
                    .map_err(|e| format!("SetMute failed: {e}"))?;
            }
            let current_muted = ep
                .GetMute()
                .map(|b| b.as_bool())
                .unwrap_or(muted.unwrap_or(false));
            Ok(VolumeState {
                percent: clamped,
                muted: current_muted,
            })
        }
    }
}

pub fn get_master_volume() -> Result<VolumeState, String> {
    #[cfg(target_os = "windows")]
    {
        win_audio::read_volume()
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(VolumeState::default())
    }
}

pub fn set_master_volume(percent: u8, muted: Option<bool>) -> Result<VolumeState, String> {
    #[cfg(target_os = "windows")]
    {
        win_audio::write_volume(percent, muted)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(VolumeState {
            percent: percent.min(100),
            muted: muted.unwrap_or(false),
        })
    }
}

pub fn start_volume_monitor(app: AppHandle) {
    #[cfg(target_os = "windows")]
    {
        std::thread::spawn(move || {
            let mut last = get_master_volume().ok();
            loop {
                std::thread::sleep(std::time::Duration::from_millis(140));
                if let Ok(current) = get_master_volume() {
                    if let Some(prev) = last {
                        if prev != current {
                            last = Some(current);
                            let _ = app.emit("volume-changed", current);
                        }
                    } else {
                        last = Some(current);
                    }
                }
            }
        });
    }
}
