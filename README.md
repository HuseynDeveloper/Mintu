# Mintu (みんと)

> A lightweight living desktop pet and Dynamic Island companion for Windows and macOS, built with Tauri 2, Rust, and TypeScript. Pure pet companion, zero AI, 100% private, and sub-1% idle CPU.

[![Version](https://img.shields.io/badge/version-0.2.4-10B981.svg)](https://github.com/HuseynDeveloper/Mintu/releases/tag/v0.2.4)
[![Tauri](https://img.shields.io/badge/Tauri-v2-24C8DB.svg)](https://tauri.app)
[![Rust](https://img.shields.io/badge/Rust-2021-DEA584.svg)](https://www.rust-lang.org)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-blue.svg)](https://github.com/HuseynDeveloper/Mintu/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![AI Status](https://img.shields.io/badge/AI-None%20(Pure%20Pet)-blueviolet.svg)](https://github.com/HuseynDeveloper/Mintu)

Mintu is a cute, animated mint-green companion living inside a fluid Dynamic Island widget at the top of your screen. Mintu can leave the island to roam freely on your desktop with realistic gravity and momentum physics, dance continuously while you listen to music, help you stay hydrated and focused, keep quick notes and clipboard history, and monitor your system hardware in real time.

Animation quality, micro-expressions, lightweight performance, and privacy are the core priorities of the project.

---

## Key Features

### 1. Living Desktop Pet
1. **Fluid Dynamic Island & Free Roaming**: Lives in a sleek notch island at the top of your screen or roams freely across your desktop with natural kinematics, gravity, ground bounce, and drag momentum.
2. **Micro-Expressions & Dynamic Moods**: 15 canonical vector animation states (idle, walk, happy, sleep, wake, curious, alert, dance, dangle, and more) with spring follow-through physics on floppy ears and tail.
3. **Pet Care & Wellness**: Feed cookies, serve warm tea, pet with gentle head pats, track your daily water intake, collect falling stars, and manage daily to-dos.
4. **Continuous Music Dance**: Synchronizes with Windows SMTC and media sessions; when your favorite songs play, Mintu dances until the track finishes.
5. **Customizable Pet Wardrobe & Skins**: 6 curated themes (Mint Classic, Sakura Pink, Midnight Blue, Lavender Purple, Golden Honey, Matcha Green) with customizable pet names.

### 2. Multi-Functional Dynamic Island
1. **3-Tab Pet Hub**: Clean tabbed drawer separating Pet Care, Productivity Tools, and System Settings.
2. **Full-Width Quick Note**: Auto-saved local scratchpad for instant thoughts, memos, and snippets without opening heavy text editors.
3. **Clipboard History**: Tracks your last 15 clipboard items with one-click pin to top and instant copy.
4. **Live Hardware HUD**: Real-time inspection of Battery status, CPU load, RAM usage, primary Disk space, Network transfer rates, and system Master Volume slider.
5. **Pomodoro & Focus Timer**: Circular progress ring timer with countdown, Pomodoro 25/5 cycles, stopwatch, and target end-time persistence surviving system sleep and restarts.
6. **Screen Color Picker**: Global eyedropper hotkey to instantly sample any pixel under the mouse cursor as a HEX color code.
7. **Local Weather Widget**: Live weather telemetry powered by WMO codes with temperature and condition badges.
8. **Strict Zero-Emoji Design**: Clean typography, monochrome vector icons, and dark-mode native interface.

---

## Global Shortcuts

| Shortcut | Action | Description |
|---|---|---|
| Ctrl + Shift + M | Toggle Pet Hub | Opens or closes the 3-tab Mintu Pet Hub. |
| Ctrl + Alt + M | Toggle Island / Free Mode | Pops Mintu out into free desktop roaming or docks back into the island. |
| Ctrl + Shift + N | Quick Note | Opens the full-width auto-saved scratchpad. |
| Ctrl + Shift + V | Clipboard History | Opens the last 15 clipboard entries with pin support. |
| Ctrl + Alt + C | Screen Color Picker | Samples the exact HEX color under the cursor to the clipboard. |
| Ctrl + Alt + S | Mintu Settings | Opens the Settings tab directly (skins, pet name, language). |
| Ctrl + Shift + D | Developer Debug Panel | Toggles runtime diagnostic tools and animation tester. |
| Double-Click Pet | Hop Out / Dock Back | Double-click Mintu in the island to roam, or double-click on desktop to dock. |
| Drag & Toss Pet | Kinematic Physics | Toss Mintu across the screen to watch gravity and ground bounce. |

---

## Architecture & Tech Stack

```
Mintu Architecture (Zero AI, Ultra-Lightweight)
├── Transparent Screen Overlay (Tauri v2 + Webview2 / WebKit)
│   ├── Unified click-through transparent canvas
│   ├── Dynamic Island with Apple-style spring animations
│   ├── Vector SVG Pet Animation Engine with layered micro-expressions
│   └── 30Hz precision cursor poller for instant click-through (<1% CPU)
│
├── Native Core (Rust 2021)
│   ├── Win32 & macOS hardware telemetry (Battery, CPU, RAM, Disk, Network)
│   ├── SMTC media playback detection & track metadata
│   ├── Global system hotkeys listener
│   ├── Core Audio / Windows WASAPI master volume controller
│   └── Multi-platform cross-compilation pipeline (Windows NSIS + macOS DMG)
│
└── Frontend Engine (TypeScript + Vite)
    ├── Modular Dynamic Island component system
    ├── Pet Care & Wellness state managers (LocalStorage persistence)
    ├── Smart Clipboard & Quick Note auto-save engine
    └── Multi-language i18n dictionary (Azərbaycan, English, Türkçe, Русский)
```

---

## Installation & Downloads

Pre-compiled binary releases are available on the [GitHub Releases page](https://github.com/HuseynDeveloper/Mintu/releases/tag/v0.2.4):

| Platform | Installer | Architecture | Notes |
|---|---|---|---|
| Windows | `Mintu_0.2.4_x64-setup.exe` | 64-bit Windows 10 / 11 | Complete NSIS installer with desktop & start menu shortcuts |
| Windows Portable | `mintu.exe` | 64-bit Windows 10 / 11 | Single standalone executable (no installation required) |
| macOS (Apple Silicon) | `Mintu_0.2.4_aarch64.dmg` | macOS 11.0+ (M1, M2, M3, M4) | Standard drag-and-drop DMG for modern Mac |
| macOS (Intel) | `Mintu_0.2.4_x64.dmg` | macOS 10.15+ (Intel Core) | Standard drag-and-drop DMG for Intel Mac |
| macOS Application | `Mintu.app.tar.gz` | Universal macOS | Standalone compressed application bundle |

---

## Building from Source

### Prerequisites
1. Node.js (v18, v20, or v22)
2. Rust toolchain (stable 1.78+)
3. Platform-specific build tools:
   - Windows: Microsoft Visual Studio C++ Build Tools
   - macOS: Xcode Command Line Tools (`xcode-select --install`)

### Build Steps
```bash
# 1. Clone the repository
git clone https://github.com/HuseynDeveloper/Mintu.git
cd Mintu

# 2. Install dependencies
npm install

# 3. Run in live development mode (Hot Module Reloading)
npm run tauri dev

# 4. Compile production package
npm run tauri build
```

---

## Privacy & Resource Efficiency

1. **100% Local & Offline**: Mintu contains zero telemetry, zero analytics, zero external tracking, and zero artificial intelligence API calls.
2. **Resource Footprint**: Consumes under 30 MB of disk space and under 1% CPU utilization during normal idle operation.
3. **Strict Zero-Emoji Policy**: Built with a clean, distraction-free aesthetic using geometric typography and minimalist vector graphics.

---

## License

Mintu is licensed under the [MIT License](LICENSE). Copyright 2026 Mintu Contributors.
