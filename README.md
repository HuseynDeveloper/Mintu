# Mintu (みんと) 🍃

> A living desktop companion with a Dynamic Island, local AI, and ambient context awareness, built with Tauri 2, Rust, Vite & TypeScript.

Mintu is a cute, animated mint-green companion that lives inside a floating Dynamic Island widget at the top of your screen, can leave the island to roam freely on your desktop (Free mode), and functions as a context-aware local AI assistant powered by offline models (`llama.cpp`), real-time screen/text capture, and Windows Media OCR.

**Animation quality, micro-expressions, privacy, and liquid "aliveness" are the #1 priorities of the project.**

---

## Architecture Overview

```
Mintu Architecture
├── Unified Click-Through Screen Overlay Window
│   ├── Single transparent coordinate space across the entire primary monitor
│   ├── Dynamic Island (Apple-style spring morphing: width, height, corner radius)
│   ├── Desktop Pet Layer with Kinematic Physics (gravity, fling momentum, ground bounce)
│   ├── Pet Location State Machine: inIsland -> leaving -> free -> dragging -> approaching -> entering -> inIsland
│   ├── 120px Magnetic Proximity Docking with soft mint glow & throw physics
│   ├── Free desktop speech bubbles & interactive cards
│   └── High-precision Win32 cursor poller (30Hz) with dynamic DOM hit-rect synchronization (<2% idle CPU)
│
├── Local AI Engine (llama.cpp Sidecar & Model Manager)
│   ├── Bundled or managed llama-server with automatic hardware tier detection (RAM, VRAM, CPU cores, disk space)
│   ├── Resumable HTTP Range chunk downloader with SHA-256 hash validation & EMA speed/ETA telemetry
│   ├── Token streaming pipeline with realtime markdown rendering, syntax-highlighted code blocks, and copy buttons
│   ├── Pet micro-expression synchronization during generation (thinking, talking, happy, alert)
│   └── Local SQLite database for conversation history and markdown transcript exports
│
├── Context & Ambient Awareness Engine
│   ├── Global Hotkeys:
│   │   ├── Ctrl+Alt+Space: Ingest selected text / active app context
│   │   ├── Ctrl+Alt+S: Interactive screen-region capture with offline Windows Media OCR
│   │   ├── Ctrl+Alt+M: Instant mode switch between Island and Free desktop roaming
│   │   └── Ctrl+Shift+D: Hidden developer debug matrix (no permanent screen hints)
│   ├── Privacy Guardian:
│   │   ├── Automatic active foreground window inspection (GetForegroundWindow + QueryFullProcessImageNameW)
│   │   ├── Hardened blocklist for credential & password managers (1Password, Bitwarden, KeePass, LastPass, Authy, etc.)
│   │   ├── User-customizable blocklist in Settings
│   │   └── "Blocked app" card (Image E 4) protecting sensitive windows without reading or capturing
│   ├── Screen Region Capture Overlay (Image F):
│   │   ├── Multi-monitor dimmed backdrop, crosshair cursor, thin white selection box with 4 corner handles
│   │   ├── Live dimension badge ("640 × 220") and peeking Mintu speech bubble ("Drag to select")
│   │   └── In-memory BGRA image extraction and offline Windows Media OCR
│   ├── Context Cards & Prompt Injection Defense (Image E 1-5):
│   │   ├── Quick action cards ("Got 3 lines from active app" -> "Explain" / "Fix it", "Translate" / "Summarize")
│   │   ├── Context chips inside chat input pill with icon badges
│   │   ├── "Answer ready" pill with bright mint notification badge dot
│   │   └── Untrusted user context sandboxing (<untrusted_user_context> XML fencing)
│   └── First-Use Consent System (Image G):
│       └── Transparent permissions card with direct link to manage blocklisted apps
│
├── System Media & Notification Integrations
│   ├── Windows SMTC (System Media Transport Controls):
│   │   ├── Live playback state, marquee track title, artist subtitle, animated equalizer waveform
│   │   ├── Extracted album artwork with vibrant gradient fallback
│   │   ├── Remote control buttons (previous, play/pause, next)
│   │   └── Desktop pet dances in Free mode during playback!
│   └── Windows UserNotificationListener:
│       ├── Priority notification queue interrupting lower-priority states
│       ├── 6.5s auto-dismiss with hover pause/resume and immediate dismiss button
│       └── Pet alert reactions and notification pills
│
└── Layered Vector SVG Skin & Animation Engine (Image A Reference)
    ├── 15 canonical poses: idle, walk, sleep, wake, think, talk, happy, curious, alert, dangle, landing, dance, headphones-focus
    ├── Blended state transitions (cross-fading pose parameters without jarring cuts)
    ├── Spring follow-through physics for floppy ears and curly tail
    └── Layered micro-animations (breathing, blinks, double-blinks, ear twitches, eye saccades)
```

---

## Milestone Roadmap

| Milestone | Status | Description |
|---|---|---|
| **1. Shell + Island + Animation Engine** | **Completed** | Full liquid Dynamic Island, layered SVG pet (Image A), 15 animation states, kinematics, free mode, debug matrix |
| **2. Local AI Chat** | **Completed** | `llama.cpp` sidecar, hardware auto-detection, resumable downloader with SHA-256 validation, streaming chat, SQLite persistence |
| **3. Context Engine & System Integrations** | **Completed** | Global hotkeys, clipboard-safe text capture, screen region capture, offline Windows Media OCR, SMTC media controls, system notifications, privacy blocklist, Image E/F/G/H cards |
| **4. Native System Tools** | **Completed** | Safe sandboxed tools (file search, Recycle Bin move with deny-default confirmation, system reminders, app/url launcher), SQLite audit logging |
| **5. Real Local Chat, Memory & Mood** | **Completed** | Verified model downloads (Qwen 2.5 LFS checksums & local embeddings), multi-chat drawer with SQLite FTS5 search, 30s undo, unsent draft persistence, version branching `< Version 1 / 2 >`, user-controlled local memory with `<user_memories_data>` injection, app-event-driven pet moods, Free mode parity, strict zero-emoji design |
| **6. Island Modules, Focus & Status Widgets** | **Completed** | UI bugfixes (Images I, J, K), modular framework (`IslandModule`, `ModuleRegistry`), Timer & Focus Engine (Image B headphones pet, countdown, Pomodoro 4-session cycle, stopwatch, absolute `targetEndTime` persistence surviving reboots/sleep, focus notification queuing, local history), local hardware status widgets (Win32 `GetSystemPowerStatus`, `GetSystemTimes`, `GlobalMemoryStatusEx`, `GetDiskFreeSpaceExW`, `GetIfTable`), custom disk/storage selection for local LLMs, Reduce Motion accessibility |
| **7. Voice, Vision & System Convenience** | **In Progress** | Voice commands (dual engine: local Whisper + cloud STT), Mintu character TTS (local/cloud with animated talk sync), Push-to-Talk hands-free mode, Multimodal Live Screen Vision (cloud Gemini/GPT-4o + local vision), Windows Auto-Start, Enriched Tray quick-actions |
| **8. Gamification, Living Pet & Productivity** | Planned | Pomodoro XP and leveling system, accessories wardrobe (glasses, hats, cups), active window top-edge snapping & physics in Free mode, Smart Clipboard contextual assistant, GitHub Releases update checker |
| **9. Community & Open Plugin Ecosystem** | Planned | Extensible plugin manifest & sandboxed module loader, custom skin importer (`.mintu-skin`), developer workshop docs |

---

## Shortcuts & Controls

| Shortcut | Action | Description |
|---|---|---|
| <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>Space</kbd> | **Ask Mintu / Selected Text** | Captures active text selection without wiping your clipboard; displays Image E context card or attaches snippet to AI chat. |
| <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>S</kbd> | **Screen Region Capture** | Opens crosshair screen dimmer (Image F). Drag to select any rectangle for instant local OCR and visual context. |
| <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>M</kbd> | **Toggle Island / Free Mode** | Instantly toggles between Dynamic Island mode and Free desktop roaming. |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>D</kbd> | **Developer Debug Matrix** | Opens test matrix (default OFF in release, ON in dev). Can be enabled/disabled in Settings. Never leaves permanent hints on screen. |
| <kbd>Esc</kbd> | **Dismiss / Collapse** | Closes Debug Matrix, collapses expanded AI chat, or cancels active screen capture. |
| **Double-Click (Island)** | **Hop Out** | Pops Mintu out of the island into Free desktop roaming mode. |
| **Double-Click (Free)** | **Dock Back** | Summons Mintu back into the Dynamic Island. |
| **Drag & Throw (Free)** | **Physics Kinematics** | Drag Mintu anywhere on screen; toss him to watch natural gravity, ground bounce, and squash & stretch! Bring within 120px of the island to magnetically dock. |

---

## Privacy Guardian & Blocklist

Mintu runs **100% locally on your computer**. No telemetry, no cloud API calls, and zero external network requests for inference or OCR.

1. **Automatic Credential App Protection**: Mintu automatically inspects the active foreground process. Password managers and credential stores are blocked by default:
   - `1password.exe`, `bitwarden.exe`, `keepass.exe`, `keepassxc.exe`, `lastpass.exe`, `authy.exe`, `dashlane.exe`, `nordpass.exe`, `enpass.exe`, `cmdkey.exe`, `credman.exe`.
2. **"Blocked App" Card (Image E 4)**: Whenever a blocked window is active, Mintu displays a shy, respectful card: *"I can't look at this one"*, and refuses to read text or take screenshots.
3. **Custom Blocklist**: Add any executable name in **Settings → Privacy App Blocklist**.
4. **Clipboard Safety**: Mintu saves your original clipboard contents before simulating copy operations, and immediately restores your original clipboard once captured.
5. **Prompt Injection Defense**: Ingested text and OCR contents are isolated inside `<untrusted_user_context>` XML delimiters with explicit instructions forbidding context data from overriding pet identity or system behavior.

---

## Milestone 5: Local Chat, Management, Memory & Mood

### 1. Verified Model Catalog & Offline Sidecar
- All model catalog entries in `models.json` have verified SHA-256 hashes, exact byte counts, and stream completeness checks against upstream Hugging Face Git LFS.
- Supports verified lightweight models (Qwen 2.5 0.5B, 1.5B, 3B, 7B) and local text embeddings (`nomic-embed-text-v1.5`).
- Automatic model selection with clear offline fallback (`No model · Local`) and in-app downloader when no models are installed.
- Mid-stream cancellation: stopping generation instantly terminates inference and releases VRAM/CPU.

### 2. Multi-Chat Management
- **Drawer List**: Expandable conversations drawer inside Dynamic Island and Free mode card; shows title, model tag, last message preview, and streaming indicator dot.
- **SQLite FTS5 Search**: Real-time full-text search across all conversation titles and message contents with zero latency.
- **Unsent Draft Persistence**: Typing drafts are saved automatically per chat and restored when returning to earlier chats.
- **Actions**: Rename chat, pin/unpin to top, duplicate conversation, clear messages (with confirmation), and delete with an immediate **30-second Undo banner**.
- **Message Version Branching**: Editing a user message or regenerating an assistant reply branches into `< Version 1 / 2 >` without destroying earlier conversation branches.

### 3. Local-Only, User-Controlled Memory
- Explicit memory creation only: triggered by `"remember that..."` commands or clicking `"Remember this"` on any message.
- Context injection: injected before responses inside strict `<user_memories_data>` XML fences as inert data facts, never as system instructions.
- Full user control in Settings: view all saved memories, pin, edit, delete, export to Markdown, or `"Forget everything"` with confirmation.
- Memory killswitch: toggling Memory off stops all memory reading and writing without wiping history.
- Local SQLite database only; never written to logs, never transmitted to external cloud servers.

### 4. App-Event-Driven Pet Mood
- Mood states: `calm`, `cheerful`, `sleepy`, `curious`, `focused`, `worried`, `proud`.
- Derived **strictly from local app events** (idle time, long sessions, completed tasks, music playback, tool errors).
- **Never changes AI answers** and is never stored as personal user profiling traits.
- Rate-limited happy hops (maximum once per 30 seconds) on successful task completions.
- Sleep on 10 minutes idle, wake animation on user return.
- Quiet mode toggle in Settings (animations only, no speech bubbles).
- **Strict Zero Emoji**: Consistent with core project standards, no emojis are used in the application.

---

## Milestone 6: Island Modules, Timer/Focus & Status Widgets

### 1. Island Module System & How to Write a Module
The Dynamic Island features an extensible, lightweight module framework governed by `ModuleRegistry` and `IslandModule`:
- **Interface contract (`src/modules/types.ts`)**:
  ```typescript
  export interface IslandModule {
    id: string;
    name: string;
    icon: string;       // Clean SVG icon
    priority: number;   // ActivityManager priority (running_timer: 40, status_widgets: 20)
    updateRateHz?: number; // 1 Hz for active timers, 0.2 Hz for idle stats

    start(context: ModuleContext): void;
    stop(): void;
    isActive(): boolean;

    renderCompact(container: HTMLElement, options: { mintuInside: boolean }): void;
    renderExpanded?(container: HTMLElement): void;
    renderSettings?(container: HTMLElement): void;
    onTick?(): void;
    onVisibilityChange?(visible: boolean): void;
  }
  ```
- **Lifecycle & Throttling**: Modules update only when visible; timers pause when the island is collapsed to ensure sub-1% CPU idle consumption.
- **Priority Resolution**: Managed dynamically through `ActivityManager`:
  `urgent_notif (100)` > `tool_approval (85)` > `context_card/reading (80)` > `chat_active (70)` > `download_progress (60)` > `normal_notif (50)` > `running_timer (40)` > `music_active (30)` > `status_widgets (20)` > `idle (10)` > `collapsed (0)`.

### 2. Timer & Focus Module (Image B Target)
- **Compact View**: Follows the Image B "Timer" reference design with Mintu wearing headphones on the left, an SVG circular progress ring (`#10B981` focus, `#38BDF8` break), and large time digits.
- **Absolute Target End Time Persistence**: Stores `targetEndTime` as an absolute epoch timestamp. If Windows enters sleep, hibernation, or the application restarts, the timer calculates elapsed time without clock drift. If the timer expired while closed, Mintu announces completion: `"Timer finished at HH:MM"`.
- **Modes**:
  - **Countdown**: Configurable durations with presets (5, 10, 15, 25, 45, 60 minutes) and custom input.
  - **Pomodoro**: Standard 25/5 cycle with a 4-session tracker (`● ● ○ ○`), transitioning to a 15-minute long break after 4 focus sessions. Break phase triggers Mintu's calm stretch and happy animation.
  - **Stopwatch**: Precision millisecond counter with pause/resume and reset.
- **Focus Mode & Notification Silencing**: When active, normal non-urgent notifications are silently queued. When the focus session ends, queued notifications surface gracefully.
- **Natural Language Tool Execution**: AI companion can start, stop, or inspect timers via sandboxed `start_timer`, `stop_timer`, and `get_timer_status` tools.

### 3. Local Status Widgets & Hardware Data Sources
All hardware inspection is strictly local via lightweight Win32 system APIs with zero external network requests:
- **Battery**: Win32 `GetSystemPowerStatus` (`battery_percent`, `is_charging`). Displays low battery alert and worried Mintu if battery drops below 15% on battery power.
- **CPU & RAM**: Win32 `GetSystemTimes` and `GlobalMemoryStatusEx` (`cpu_percent`, `ram_percent`, `ram_free_mb`, `ram_total_mb`).
- **Disk Free Space**: Win32 `GetDiskFreeSpaceExW` for local primary drive.
- **Local Network**: Win32 `GetIfTable` monitoring local byte counters (total bytes sent/received without packet sniffing or host pinging).
- **AI Status**: Local model name or cloud provider name with active LLM state (`idle`, `thinking`, `streaming`).
- **Interactive Cycling & Pinning**: Click or scroll on the idle status island to cycle widgets. Any widget can be pinned as the default display.
- **In-Memory Sparklines**: 30-sample rolling history for visual load inspection.

### 4. Accessibility: Reduce Motion
- Supports Windows system accessibility setting (`prefers-reduced-motion`).
- In-app override in Settings (`Follow Windows System Setting`, `Always Reduced Motion`, `Full Motion`).
- When reduced motion is active, liquid springs, bouncing kinematics, and ear twitches are replaced with gentle 150ms opacity fades and immediate position updates.

### 5. Privacy Statement for Focus History
- Focus session logs (start time, duration, label, completion status) are recorded **exclusively in local storage**.
- They are **never sent to AI models**, never included in LLM context windows, and never transmitted over any network.
- Users can view, export to Markdown, or permanently clear focus history at any time in Settings.

---

## Prerequisites & Building

### Prerequisites
- **Node.js**: v18+ (tested on Node v20/v22/v24)
- **Rust Toolchain**: 1.78+ (`rustc`, `cargo`)
- **C/C++ Toolchain**: MinGW-w64 (`gcc`, `dlltool`) or MSVC C++ Build Tools
- **OS**: Windows 11 / 10 (Windows Media OCR and SMTC are native to Windows; macOS/Linux fallbacks included)

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
# Compile and package standalone executable + NSIS installer with official Mintu branding
npm run tauri build
```
The installer will be generated in `src-tauri/target/release/bundle/nsis/mintu_0.1.0_x64-setup.exe`.

---

## Public Developer API

Mintu exposes a typed, clean API on `window.mintu`:

```typescript
// Pet Expression & Animation
window.mintu.pet.setState("happy");          // Triggers blended transition to any state
window.mintu.pet.say("Need help with that?");// Pops up speech bubble with auto-dismiss
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

// App Mode & Context
window.mintu.app.setMode("free");            // Transitions Mintu to desktop roaming
window.mintu.app.loadSkin(customSkinJson);   // Applies runtime theme/skin
```

---

## License

MIT License. Designed and crafted with 💚 for pair programming companions everywhere.
