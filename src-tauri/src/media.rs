use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MediaState {
    pub is_playing: bool,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub thumbnail_base64: Option<String>,
    pub position_ms: u64,
    pub duration_ms: u64,
    pub has_session: bool,
}

pub trait MediaProvider: Send + Sync {
    fn query_state(&self) -> Result<MediaState, String>;
    fn control(&self, action: MediaAction) -> Result<bool, String>;
}

pub struct WindowsSMTCProvider;

impl MediaProvider for WindowsSMTCProvider {
    fn query_state(&self) -> Result<MediaState, String> {
        #[cfg(target_os = "windows")]
        {
            query_windows_smtc().map_err(|e| e.to_string())
        }
        #[cfg(not(target_os = "windows"))]
        {
            Ok(MediaState::default())
        }
    }

    fn control(&self, action: MediaAction) -> Result<bool, String> {
        #[cfg(target_os = "windows")]
        {
            control_windows_smtc(action)
        }
        #[cfg(not(target_os = "windows"))]
        {
            Ok(false)
        }
    }
}

pub struct MediaManager {
    pub provider: Arc<dyn MediaProvider>,
    pub last_state: Arc<Mutex<MediaState>>,
}

impl MediaManager {
    pub fn new() -> Self {
        Self {
            provider: Arc::new(WindowsSMTCProvider),
            last_state: Arc::new(Mutex::new(MediaState::default())),
        }
    }

    pub fn with_provider(provider: Arc<dyn MediaProvider>) -> Self {
        Self {
            provider,
            last_state: Arc::new(Mutex::new(MediaState::default())),
        }
    }

    pub fn get_state(&self) -> MediaState {
        self.last_state.lock().unwrap().clone()
    }

    pub fn start_polling(&self, app: AppHandle) {
        let last_state_clone = self.last_state.clone();
        let provider_clone = self.provider.clone();

        tauri::async_runtime::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_millis(400)).await;

                if let Ok(state) = provider_clone.query_state() {
                    let changed = {
                        let mut lock = last_state_clone.lock().unwrap();
                        let prev = lock.clone();
                        *lock = state.clone();
                        prev.is_playing != state.is_playing
                            || prev.title != state.title
                            || prev.artist != state.artist
                            || prev.has_session != state.has_session
                    };

                    if changed {
                        let _ = app.emit("media-state-changed", state);
                    }
                }
            }
        });
    }

    pub async fn toggle_play_pause(&self) -> Result<bool, String> {
        let res = self.provider.control(MediaAction::PlayPause)?;
        {
            let mut lock = self.last_state.lock().unwrap();
            lock.is_playing = !lock.is_playing;
        }
        Ok(res)
    }

    pub async fn next_track(&self) -> Result<bool, String> {
        self.provider.control(MediaAction::Next)
    }

    pub async fn previous_track(&self) -> Result<bool, String> {
        self.provider.control(MediaAction::Previous)
    }
}

#[derive(Debug, Clone, Copy)]
pub enum MediaAction {
    PlayPause,
    Next,
    Previous,
}

#[cfg(target_os = "windows")]
fn query_windows_smtc() -> Result<MediaState, Box<dyn std::error::Error>> {
    use windows::Media::Control::{
        GlobalSystemMediaTransportControlsSessionManager,
        GlobalSystemMediaTransportControlsSessionPlaybackStatus,
    };
    use windows::Storage::Streams::DataReader;

    let manager_op = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()?;
    let manager = manager_op.get()?;

    let session = match manager.GetCurrentSession() {
        Ok(s) => s,
        Err(_) => {
            let mut found = None;
            if let Ok(sessions) = manager.GetSessions() {
                if let Ok(count) = sessions.Size() {
                    for i in 0..count {
                        if let Ok(s) = sessions.GetAt(i) {
                            found = Some(s);
                            break;
                        }
                    }
                }
            }
            match found {
                Some(s) => s,
                None => {
                    return Ok(MediaState {
                        has_session: false,
                        ..Default::default()
                    });
                }
            }
        }
    };

    let playback_info = session.GetPlaybackInfo().ok();
    let is_playing = playback_info
        .and_then(|info| info.PlaybackStatus().ok())
        .map(|status| status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing)
        .unwrap_or(false);

    let mut title = String::new();
    let mut artist = String::new();
    let mut album = String::new();
    let mut thumbnail_base64: Option<String> = None;

    if let Ok(media_props_op) = session.TryGetMediaPropertiesAsync() {
        if let Ok(media_props) = media_props_op.get() {
            title = media_props.Title().map(|s| s.to_string()).unwrap_or_default();
            artist = media_props.Artist().map(|s| s.to_string()).unwrap_or_default();
            album = media_props.AlbumTitle().map(|s| s.to_string()).unwrap_or_default();

            if let Ok(thumb_ref) = media_props.Thumbnail() {
                if let Ok(stream_op) = thumb_ref.OpenReadAsync() {
                    if let Ok(stream) = stream_op.get() {
                        if let Ok(size) = stream.Size() {
                            if size > 0 && size < 5_000_000 {
                                if let Ok(reader) = DataReader::CreateDataReader(&stream) {
                                    if let Ok(load_op) = reader.LoadAsync(size as u32) {
                                        if load_op.get().is_ok() {
                                            let mut buffer = vec![0u8; size as usize];
                                            if reader.ReadBytes(&mut buffer).is_ok() {
                                                use base64::Engine;
                                                let encoded = base64::engine::general_purpose::STANDARD
                                                    .encode(&buffer);
                                                thumbnail_base64 = Some(format!("data:image/jpeg;base64,{}", encoded));
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    let mut position_ms = 0;
    let mut duration_ms = 0;

    if let Ok(timeline) = session.GetTimelineProperties() {
        if let Ok(pos) = timeline.Position() {
            position_ms = (pos.Duration / 10_000) as u64; // 100ns units to ms
        }
        if let Ok(end) = timeline.EndTime() {
            duration_ms = (end.Duration / 10_000) as u64;
        }
    }

    Ok(MediaState {
        is_playing,
        title,
        artist,
        album,
        thumbnail_base64,
        position_ms,
        duration_ms,
        has_session: true,
    })
}

#[cfg(target_os = "windows")]
fn control_windows_smtc(action: MediaAction) -> Result<bool, String> {
    use windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager;

    let manager_op = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
        .map_err(|e| e.to_string())?;
    let manager = manager_op.get().map_err(|e| e.to_string())?;

    let session = match manager.GetCurrentSession() {
        Ok(s) => s,
        Err(_) => {
            let mut found = None;
            if let Ok(sessions) = manager.GetSessions() {
                if let Ok(count) = sessions.Size() {
                    for i in 0..count {
                        if let Ok(s) = sessions.GetAt(i) {
                            found = Some(s);
                            break;
                        }
                    }
                }
            }
            found.ok_or_else(|| "No active media session".to_string())?
        }
    };

    let res = match action {
        MediaAction::PlayPause => session
            .TryTogglePlayPauseAsync()
            .map_err(|e| e.to_string())?
            .get()
            .map_err(|e| e.to_string())?,
        MediaAction::Next => session
            .TrySkipNextAsync()
            .map_err(|e| e.to_string())?
            .get()
            .map_err(|e| e.to_string())?,
        MediaAction::Previous => session
            .TrySkipPreviousAsync()
            .map_err(|e| e.to_string())?
            .get()
            .map_err(|e| e.to_string())?,
    };

    Ok(res)
}
