# Mintu (みんと) 🍃

> A living desktop companion with a Dynamic Island, built with Tauri 2, Rust, Vite & TypeScript.

Mintu is a cute, animated mint-green companion that lives inside a floating Dynamic Island widget at the top of your screen, can leave the island to roam freely on your desktop (Free mode), and in future milestones expands into a context-aware local AI assistant.

**Animation quality, micro-expressions, and liquid "aliveness" are the #1 priority of the project.**

---

## Architecture Overview

```
Mintu Architecture
├── Dynamic Island Window (Top-Center: 520x380)
│   ├── Apple-style liquid spring morphing (width, height, radius)
│   ├── Responsive slot rendering (Collapsed, Idle, Notification, AI Chat, Timer, Music)
│   └── Compact peeking PetRenderer (crisp at 32-48px)
│
├── Free Desktop Roaming Window (Bottom Screen: Full Width x 260px)
│   ├── Kinematic Physics Body (gravity, fling momentum, ground bounce)
│   ├── Squash & Stretch landing impact recovery
│   └── White speech bubble with auto-dismiss (Image C)
│
├── Layered SVG Animation Engine (Image A Reference)
│   ├── 15 distinct state poses (idle, walk, sleep, wake, think, talk, happy, curious, alert...)
│   ├── Blended state transitions (cross-fading pose parameters, no hard cuts)
│   ├── Spring follow-through physics for floppy ears and curly tail
│   └── Layered micro-animations (breathing, blinks, double-blinks, ear twitches, eye saccades)
│
└── Click-Through & Hit-Testing Subsystem
    ├── Rust 30Hz cursor poller (Win32 GetCursorPos)
    ├── Dynamic hit-rect synchronization from Webview DOM
    └── Zero-jitter transparent windows with sub-2% idle CPU
```

### Window Architecture & Compositor Optimization
Mintu uses a dual-window architecture:
1. **Island Window (`main`)**: Compact 520x380 transparent window anchored top-center of the primary monitor work area.
2. **Desktop Roaming Window (`free`)**: Anchored along the bottom above the taskbar.

*Why not a single full-screen window?*
A single full-screen transparent window forces the OS Desktop Window Manager (DWM) to blend a massive 4K/full-display surface on every frame, consuming unnecessary GPU and power even when idle. Two compact, targeted transparent windows isolate rendering, allow completely hiding the inactive surface (0% GPU/CPU when hidden), and eliminate click-through artifacts across unrelated desktop zones.

---

## Roadmap

| Milestone | Status | Description |
|---|---|---|
| **1. Shell + Island + Animation Engine** | **Completed** | Full liquid Dynamic Island, layered SVG pet (Image A), 15 animation states, physics, free mode, debug matrix |
| **2. Local AI Chat** | Planned | Bundled `llama.cpp` sidecar, automated hardware model selection, streaming token reaction |
| **3. Context Engine** | Planned | Global hotkey, screen-region capture, selected text context ingestion |
| **4. Native Tools** | Planned | File system, app launcher, clipboard, system reminders with safety confirmations |
| **5. Memory & Personality** | Planned | SQLite + local vector embeddings, pet mood reacting to user activity |
| **6. Island Modules** | Planned | Live focus timer, Spotify/system media controls, OS notifications |
| **7. Local Voice** | Planned | Embedded offline speech-to-text (Whisper) and text-to-speech |
| **8. Community Ecosystem** | Planned | Skin/plugin registry, GitHub Releases, skin creator workshop |

---

## Prerequisites & Building

### Prerequisites
- **Node.js**: v18+ (tested on Node v24)
- **Rust Toolchain**: 1.78+ (`rustc`, `cargo`)
- **C/C++ Toolchain**: MinGW-w64 (`gcc`, `dlltool`) or MSVC C++ Build Tools
- **OS**: Windows 11 / 10 (macOS and Linux cross-platform ready)

### Development
```bash
# Clone the repository
git clone https://github.com/your-username/mintu.git
cd mintu

# Install frontend dependencies
npm install

# Run in live development mode (Hot Module Replacement + Rust backend)
npm run tauri dev
```

### Production Build
```bash
# Build optimized standalone executable and NSIS installer
npm run tauri build
```
The installer will be generated in `src-tauri/target/release/bundle/nsis/mintu_0.1.0_x64-setup.exe`.

---

## Controls & Hidden Debug Matrix

- **Toggle Debug Matrix**: Press <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>D</kbd> or click the `Ctrl+Shift+D` pill at the bottom-right.
- **Switch to Free Desktop Mode**: Double-click on Mintu inside the Dynamic Island, or select "Switch to Free Mode" in the Debug Matrix or System Tray.
- **Return to Island**: Double-click on Mintu while roaming on the desktop.
- **Drag & Throw (Free Mode)**: Click and drag Mintu with the mouse; fling him into the air to see natural gravity drop, bounce, and landing squash & stretch!

---

## How to Create a Skin

Mintu supports modular skins via simple JSON files located in `public/skins/<skin-id>/skin.json`.

### 1. Vector SVG Skin (`type: "svg"`)
SVG skins recolor Mintu's layered character parts using CSS variables:

```json
{
  "id": "strawberry-mintu",
  "name": "Strawberry Mintu",
  "author": "Community Artist",
  "version": "1.0.0",
  "type": "svg",
  "colors": {
    "petBody": "#FFCCD5",
    "petBodyShadow": "#FFB3C1",
    "petBelly": "#FFF0F3",
    "petBellyShadow": "#FFE5EC",
    "petOutline": "#4A282E",
    "petEye": "#3A1A20",
    "petEyeHighlight": "#FFFFFF",
    "petBlush": "#FF758F",
    "petNose": "#3A1A20",
    "petMouth": "#4A282E",
    "petTongue": "#FF4D6D",
    "petEarInner": "#FFB3C1",
    "petGroundShadow": "rgba(74, 40, 46, 0.18)",
    "accessoryHeadphones": "#590D22",
    "accessoryAccent": "#FF4D6D"
  }
}
```

### 2. Spritesheet Skin (`type: "spritesheet"`)
Spritesheet skins provide custom frame-by-frame pixel art or raster animations matching Mintu's canonical state names:

```json
{
  "id": "pixel-mintu",
  "name": "Pixel Mintu 8-Bit",
  "author": "Pixel Wizard",
  "version": "1.0.0",
  "type": "spritesheet",
  "colors": {
    "petBody": "#8FE0C8",
    "petBelly": "#FFF6E8",
    "petOutline": "#1E2923"
  },
  "spritesheet": {
    "frameWidth": 64,
    "frameHeight": 64,
    "states": {
      "idle": { "x": 0, "y": 0, "frames": 4 },
      "walk": { "x": 0, "y": 64, "frames": 4 },
      "sleep": { "x": 0, "y": 128, "frames": 2 },
      "happy": { "x": 0, "y": 192, "frames": 4 },
      "think": { "x": 0, "y": 256, "frames": 2 },
      "talk": { "x": 0, "y": 320, "frames": 3 },
      "alert": { "x": 0, "y": 384, "frames": 2 },
      "curious": { "x": 0, "y": 448, "frames": 2 }
    }
  }
}
```

---

## Public Developer API

Mintu exposes a typed, clean API on `window.mintu` for Milestones 2–8:

```typescript
// Pet Expression & Animation
window.mintu.pet.setState("happy");          // Triggers blended transition to any state
window.mintu.pet.say("Need help with that?");// Pops up cute speech bubble with auto-dismiss
window.mintu.pet.react("curious");           // Emotion shortcut
window.mintu.pet.lookAt(0.5, -0.2);          // Directs pupil & head focus
window.mintu.pet.setAccessory("headphones"); // Equips accessory overlay

// Dynamic Island
window.mintu.island.setState("expanded");    // Morphs island to AI chat shell
window.mintu.island.notify({                 // Posts interactive notification
  title: "Build Succeeded",
  text: "All 18 tests passed.",
  actions: [
    { id: "explain", label: "Explain" },
    { id: "fix", label: "Fix it", primary: true }
  ]
});

// App Mode
window.mintu.app.setMode("free");            // Transitions Mintu to desktop roaming
window.mintu.app.loadSkin(customSkinJson);   // Applies runtime theme/skin
```

---

## License

MIT License. Designed and crafted with 💚 for pair programming companions everywhere.
