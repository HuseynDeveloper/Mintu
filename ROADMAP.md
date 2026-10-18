# Mintu — Project Roadmap

Mintu is an open-source (MIT) desktop companion living in a Dynamic Island with local and cloud AI inference, ambient context, memory, tools, and widgets.

## Milestone Status Overview

- **Milestone 1: Shell + Island + Animation Engine** (Completed)
- **Milestone 2: Local AI Chat** (Completed)
- **Milestone 3: Context Engine & System Integrations** (Completed)
- **Milestone 4: Native System Tools** (Completed)
- **Milestone 5: Real Local Chat, Memory & Mood** (Completed)
- **Milestone 6: Island Modules, Focus & Status Widgets, Storage Selector** (Completed)
- **Milestone 7: Voice, Vision & System Convenience** (Completed)
- **Milestone 8: Gamification, Living Pet & Productivity** (Completed)
- **Milestone 9: Community & Open Plugin Ecosystem** (Planned)

---

## Milestone 7: Voice, Vision & System Convenience (Completed)

### 7.1 System Convenience
- [x] **Windows Auto-Start**: Configure Windows Registry (`HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run`) with a clean toggle in Island settings.
- [x] **Enriched System Tray Menu**: Quick-action menu items ("Start 25m Pomodoro", "Toggle Free/Island Mode", "Mute/Silent Mode", "Open Settings", "Quit").

### 7.2 Multimodal Live Screen Vision
- [x] **Direct Multimodal Ingestion**: Send screen captures and region selections directly to Multimodal AI models (cloud Gemini 2.5 Flash / GPT-4o, or local vision sidecars).
- [x] **One-Click "Explain Screen" / "Solve This"**: Quick action pill on captured regions without needing manual chat typing.

### 7.3 Text-to-Speech (TTS) — Mintu's Voice
- [x] **Character Voice Engine**: Lightweight dual-engine TTS (Web Speech API / Edge-TTS and offline fallback).
- [x] **Animated Speech Synchronization**: Sync TTS audio playback with Mintu's `talk` pose micro-expressions and mouth movement.
- [x] **Voice Pitch & Speed Tuning**: Configurable in settings to match Mintu's friendly, cheerful companion personality.

### 7.4 Speech-to-Text (STT) & Hands-Free
- [x] **Multi-Provider Voice Commands**: MediaRecorder audio capture with automatic multi-provider fallback (Groq Whisper `whisper-large-v3-turbo`, OpenAI Whisper `whisper-1`, Gemini Multimodal audio, and Custom OpenAI endpoints) for instant Azerbaijani and multilingual transcription without external dependencies.
- [x] **Push-to-Talk & Hotkey Activation**: Hold hotkey or click microphone pill to speak without opening the chat window.

---

## Milestone 8: Gamification, Living Pet & Productivity (Completed)

### 8.1 Focus & Productivity Gamification (XP)
- [x] **XP Engine**: Calculate experience points from completed Pomodoro and focus sessions ($10 \text{ XP / min}$), daily focus streak bonuses, and active conversation XP.
- [x] **Pet Leveling & Stats**: Local storage persistence (`mintu_pet_stats`), visual level badge in island top bar (`Lv. X`), progress bar, level-up celebration animations, and speech bubbles.

### 8.2 Accessories Wardrobe
- [x] **Layered SVG Accessories**: Dynamic accessory layer system (spectacles glasses, winter beanie with pompom, mint coffee mug with steam, and DJ headphones).
- [x] **Wardrobe Customizer**: In-app wardrobe grid in Settings to equip unlocked accessories based on pet level.

### 8.3 Active Window Physical Interaction (Free Mode)
- [x] **Window Snapping & Hover Physics**: Mintu magnetically perches on desktop surfaces, with responsive mouse hover animations (curious gaze, happy nod, talk banter) and kinematic floor bounce.

### 8.4 Smart Clipboard Assistant
- [x] **Clipboard Listener**: Background Rust polling thread (safe Win32 clipboard reader) emitting `clipboard-copied`.
- [x] **Contextual Action Pill**: Non-intrusive 6-second dynamic island pill classifying copied content ("Koddakı xətanı yoxla", "Formatla və səliqəyə sal", "Azərbaycan dilinə tərcümə et") with direct one-click AI action dispatch.

### 8.5 GitHub Releases Auto-Updater
- [x] **Release Checker**: Automated SemVer check against latest GitHub Releases (`TalibliTural/Mintu`).
- [x] **Update Notification Banner**: Clean notification pill in island top bar and Settings with direct GitHub release link.

---

## Milestone 9: Community & Open Plugin Ecosystem (Planned)

### 9.1 Open Plugin Framework
- [ ] **Plugin Manifest Specification**: Standard `plugin.json` schema defining widgets, tool calls, and permissions.
- [ ] **Sandboxed Module Loader**: Secure runtime module execution for community-created widgets.

### 9.2 Custom Skins
- [ ] **Skin Packaging**: Support dragging and dropping `.mintu-skin` bundles.
- [ ] **Documentation & Templates**: Developer guide and SVG sprite sheets for skin creators.
