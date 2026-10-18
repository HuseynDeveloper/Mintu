# Mintu — Project Roadmap

Mintu is an open-source (MIT) desktop companion living in a Dynamic Island with local and cloud AI inference, ambient context, memory, tools, and widgets.

## Milestone Status Overview

- **Milestone 1: Shell + Island + Animation Engine** (Completed)
- **Milestone 2: Local AI Chat** (Completed)
- **Milestone 3: Context Engine & System Integrations** (Completed)
- **Milestone 4: Native System Tools** (Completed)
- **Milestone 5: Real Local Chat, Memory & Mood** (Completed)
- **Milestone 6: Island Modules, Focus & Status Widgets, Storage Selector** (Completed)
- **Milestone 7: Voice, Vision & System Convenience** (In Progress)
- **Milestone 8: Gamification, Living Pet & Productivity** (Planned)
- **Milestone 9: Community & Open Plugin Ecosystem** (Planned)

---

## Milestone 7: Voice, Vision & System Convenience (Current)

### 7.1 System Convenience
- [ ] **Windows Auto-Start**: Configure Windows Registry (`HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run`) with a clean toggle in Island settings.
- [ ] **Enriched System Tray Menu**: Quick-action menu items ("Start 25m Pomodoro", "Toggle Free/Island Mode", "Mute/Silent Mode", "Open Settings", "Quit").

### 7.2 Multimodal Live Screen Vision
- [ ] **Direct Multimodal Ingestion**: Send screen captures and region selections directly to Multimodal AI models (cloud Gemini 2.5 Flash / GPT-4o, or local vision sidecars).
- [ ] **One-Click "Explain Screen" / "Solve This"**: Quick action pill on captured regions without needing manual chat typing.

### 7.3 Text-to-Speech (TTS) — Mintu's Voice
- [ ] **Character Voice Engine**: Lightweight dual-engine TTS (Web Speech API / Edge-TTS and offline fallback).
- [ ] **Animated Speech Synchronization**: Sync TTS audio playback with Mintu's `talk` pose micro-expressions and mouth movement.
- [ ] **Voice Pitch & Speed Tuning**: Configurable in settings to match Mintu's friendly, cheerful companion personality.

### 7.4 Speech-to-Text (STT) & Hands-Free
- [ ] **Dual-Engine Voice Commands**: Local offline Whisper alongside cloud STT fallback for multilingual accuracy (Azerbaijani, English, Russian, etc.).
- [ ] **Push-to-Talk & Hotkey Activation**: Hold hotkey or click microphone pill to speak without opening the chat window.

---

## Milestone 8: Gamification, Living Pet & Productivity (Planned)

### 8.1 Focus & Productivity Gamification (XP)
- [ ] **XP Engine**: Calculate experience points from completed Pomodoro and focus sessions ($10 \text{ XP / min}$).
- [ ] **Pet Leveling & Stats**: SQLite persistence (`pet_stats`), visual level badge in island header, level-up celebration animations.

### 8.2 Accessories Wardrobe
- [ ] **Layered SVG Accessories**: Dynamic accessory layer system (glasses, winter beanie, coffee mug, headphones).
- [ ] **Wardrobe Customizer**: In-app wardrobe drawer to equip unlocked items.

### 8.3 Active Window Physical Interaction (Free Mode)
- [ ] **Window Snapping**: Mintu magnetically perches on top edge of active foreground window using Win32 window bounds.
- [ ] **Fall & Jump Kinematics**: Natural gravity and bounce when the parent window is closed or moved.

### 8.4 Smart Clipboard Assistant
- [ ] **Clipboard Listener**: Detect `WM_CLIPBOARDUPDATE` for structured data (code snippets, JSON, foreign languages).
- [ ] **Contextual Action Pill**: Non-intrusive 4-second island pill ("Translate to Azerbaijani", "Explain Code", "Format JSON").

### 8.5 GitHub Releases Auto-Updater
- [ ] **Release Checker**: Check latest GitHub Releases against local app version.
- [ ] **Update Notification Pill**: Clean notification with single-click download.

---

## Milestone 9: Community & Open Plugin Ecosystem (Planned)

### 9.1 Open Plugin Framework
- [ ] **Plugin Manifest Specification**: Standard `plugin.json` schema defining widgets, tool calls, and permissions.
- [ ] **Sandboxed Module Loader**: Secure runtime module execution for community-created widgets.

### 9.2 Custom Skins
- [ ] **Skin Packaging**: Support dragging and dropping `.mintu-skin` bundles.
- [ ] **Documentation & Templates**: Developer guide and SVG sprite sheets for skin creators.
