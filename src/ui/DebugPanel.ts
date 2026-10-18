/**
 * Hidden Debug Panel (Ctrl+Shift+D)
 * Allows testing and verifying EVERY pet state, island state, content slot,
 * free mode drag/drop, speech bubbles, and notifications against Images A-H.
 */

import { eventBus } from "../core/EventBus";
import { appBridge } from "../core/AppBridge";
import { timerEngine } from "../modules/timer/TimerEngine";
import { statusModule } from "../modules/status/StatusModule";
import { activityManager } from "../core/ActivityManager";

export interface DebugPanelDelegate {
  onSetPetState: (state: string) => void;
  onSetIslandState: (state: string) => void;
  onNotify: (type: string | boolean) => void;
  onSay: (text: string) => void;
  onToggleMode: (mode: "island" | "free") => void;
  onSetAccessory: (acc: string) => void;
  onToggleHitOverlay?: () => void;
  onForceLeaveIsland?: () => void;
  onForceEnterIsland?: () => void;
  onSimulateContext?: (type: "code" | "translate" | "image" | "blocked") => void;
}

export class DebugPanel {
  public readonly el: HTMLElement;
  private delegate: DebugPanelDelegate;
  private isVisible: boolean = false;
  private fpsBadgeEl!: HTMLElement;

  private frameCount = 0;
  private lastFpsTime = performance.now();

  public onVisibilityChange?: (visible: boolean) => void;

  constructor(delegate: DebugPanelDelegate) {
    this.delegate = delegate;
    this.el = document.createElement("div");
    this.el.className = "mintu-debug-panel";
    this.initUi();
    this.setupShortcuts();
  }

  public isDevPanelEnabled(): boolean {
    const saved = localStorage.getItem("mintu_dev_panel");
    if (saved !== null) return saved === "true";
    return (import.meta as any).env?.DEV ?? false;
  }

  public setDevPanelEnabled(enabled: boolean): void {
    localStorage.setItem("mintu_dev_panel", enabled ? "true" : "false");
    if (!enabled && this.isVisible) {
      this.toggle(false);
    }
  }

  public recordFrame(dtSec: number): void {
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 500) {
      const fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
      const ms = (dtSec * 1000).toFixed(1);
      if (this.fpsBadgeEl) {
        this.fpsBadgeEl.textContent = `${fps} FPS (${ms}ms)`;
      }
      this.frameCount = 0;
      this.lastFpsTime = now;
    }
  }

  private initUi(): void {
    this.el.innerHTML = `
      <div class="debug-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="debug-title">Mintu Debug Matrix</span>
          <span class="debug-fps-badge" id="debug-fps-badge">60 FPS (16.6ms)</span>
        </div>
        <button class="debug-close-btn" title="Close (Esc or Ctrl+Shift+D)">✕</button>
      </div>

      <div class="debug-body">
        <!-- Section 1: Image E Context States -->
        <div class="debug-section">
          <div class="debug-section-title">Context Awareness (Image E)</div>
          <div class="debug-btn-grid">
            <button data-ctx="e1">E1: Context Captured</button>
            <button data-ctx="e2">E2: Translate Card</button>
            <button data-ctx="e3">E3: Chips in Chat</button>
            <button data-ctx="e4">E4: Blocked App</button>
            <button data-ctx="e5">E5: Answer Ready</button>
            <button data-ctx="consent">Image G: Consent Card</button>
          </div>
        </div>

        <!-- Section 2: Image F Region Capture -->
        <div class="debug-section">
          <div class="debug-section-title">Screen Capture (Image F)</div>
          <div class="debug-btn-grid">
            <button data-cap="open">Open Region Overlay</button>
            <button data-cap="fake-ocr">Simulate OCR Error</button>
          </div>
        </div>

        <!-- Section 3: Island States & Slots -->
        <div class="debug-section">
          <div class="debug-section-title">Island States & Slots</div>
          <div class="debug-btn-grid">
            <button data-island="collapsed">Collapsed</button>
            <button data-island="idle">Idle</button>
            <button data-island="peek">Peek (Hover)</button>
            <button data-island="expanded">Expanded (AI)</button>
            <button data-island="music">Music Slot</button>
            <button data-island="timer">Timer Slot</button>
          </div>
        </div>

        <!-- Section 4: Hand-off & Physics -->
        <div class="debug-section">
          <div class="debug-section-title">Free Mode & Docking (0.3)</div>
          <div class="debug-btn-grid">
            <button data-handoff="leave">Hop Out (Leave)</button>
            <button data-handoff="enter">Dock In (Enter)</button>
            <button data-mode="free">Switch Free Mode</button>
            <button data-mode="island">Switch Island Mode</button>
          </div>
        </div>

        <!-- Section 5: Notifications & Media -->
        <div class="debug-section">
          <div class="debug-section-title">Notifications (Source & Click)</div>
          <div class="debug-btn-grid">
            <button data-notif="powershell">PowerShell Toast</button>
            <button data-notif="discord">Discord Toast</button>
            <button data-notif="chrome">Chrome Toast</button>
            <button data-notif="unknown">No-Icon Toast</button>
            <button data-notif="actions">Actionable Notif</button>
            <button data-media="play">Fake Media: Play</button>
            <button data-media="pause">Fake Media: Pause</button>
          </div>
        </div>

        <!-- Section 6: Pet Key Poses (Image A) -->
        <div class="debug-section">
          <div class="debug-section-title">Pet Poses & Reactions (Image A)</div>
          <div class="debug-btn-grid">
            <button data-pet="idle">1. Idle</button>
            <button data-pet="walk">2. Walk</button>
            <button data-pet="sleep">3. Sleep</button>
            <button data-pet="happy">4. Happy Jump</button>
            <button data-pet="think">5. Think (?)</button>
            <button data-pet="talk">6. Talk</button>
            <button data-pet="alert">7. Alert (:O)</button>
            <button data-pet="curious">8. Curious</button>
            <button data-pet="dragged">Dragged (Dangle)</button>
            <button data-pet="landing">Landing Squash</button>
            <button data-pet="dance">Dance (Music)</button>
            <button data-pet="headphones-focus">Headphones</button>
          </div>
        </div>

        <!-- Section 7: Diagnostics & Mock DL -->
        <div class="debug-section">
          <div class="debug-section-title">Diagnostics & Mock Server</div>
          <div class="debug-btn-grid">
            <button data-diag="hit-overlay">Toggle Hit Overlay</button>
            <button data-diag="mock-download">Mock DL Server</button>
            <button data-diag="clear-cache">Reset Consent</button>
            <button data-diag="force-ai-msg">Test AI Prompt</button>
          </div>
        </div>

        <!-- Section 8: Milestone 4 Tools & Security -->
        <div class="debug-section">
          <div class="debug-section-title">Milestone 4: Tools & Approvals</div>
          <div class="debug-btn-grid">
            <button data-toolsim="time">Tool: Get Time</button>
            <button data-toolsim="clipboard">Tool: Read Clipboard</button>
            <button data-toolsim="search">Tool: Search Files</button>
            <button data-toolsim="reminder">Tool: Set Reminder (5s)</button>
            <button data-toolsim="open-app">Tool: Open App (Approval)</button>
            <button data-toolsim="open-url">Tool: Open URL (Approval)</button>
            <button data-toolsim="recycle">Tool: Recycle Bin (Modify)</button>
            <button data-toolsim="cloud-consent">Test Cloud Consent</button>
          </div>
        </div>

        <!-- Section 9: Milestone 5 Real Chat, Memory & Mood -->
        <div class="debug-section">
          <div class="debug-section-title">Milestone 5: Chat, Memory & Mood</div>
          <div style="font-size: 11px; margin-bottom: 8px; padding: 6px 8px; background: rgba(0,0,0,0.3); border-radius: 6px; line-height: 1.4;">
            <div><strong>Provider:</strong> <span id="debug-active-provider" style="color: #A8E8D5;">local</span></div>
            <div><strong>Mood:</strong> <span id="debug-current-mood" style="color: #FCD34D;">calm</span></div>
            <div style="color: #9CA3AF; font-size: 10px;" id="debug-mood-reason">Baseline calm state</div>
            <div style="margin-top: 4px;"><strong>Retrieved Memories:</strong></div>
            <div id="debug-last-memories" style="color: #9CA3AF; font-size: 10px; max-height: 54px; overflow-y: auto;">None yet</div>
          </div>
          <div class="debug-btn-grid" style="margin-bottom: 6px;">
            <button data-m5="toggle-mock">Toggle Dev Mock</button>
            <button data-m5="test-memory">Add Test Memory</button>
            <button data-m5="10-chats">Create 10 Test Chats</button>
            <button data-m5="refresh-m5">Refresh Info</button>
          </div>
          <div class="debug-section-title" style="margin-top: 8px;">Force Pet Mood</div>
          <div class="debug-btn-grid">
            <button data-forcemood="calm">Calm</button>
            <button data-forcemood="cheerful">Cheerful</button>
            <button data-forcemood="sleepy">Sleepy</button>
            <button data-forcemood="curious">Curious</button>
            <button data-forcemood="focused">Focused</button>
            <button data-forcemood="worried">Worried</button>
            <button data-forcemood="proud">Proud</button>
          </div>
        </div>

        <!-- Section 10: Milestone 6 (Timer, Hardware, Stress Mode, Notifications) -->
        <div class="debug-section">
          <div class="debug-section-title">Milestone 6: Timer &amp; Focus Engine</div>
          <div class="debug-btn-grid" style="margin-bottom: 6px;">
            <button data-m6="timer-10x">10x Speed</button>
            <button data-m6="timer-60x">60x Speed</button>
            <button data-m6="timer-end">Trigger End Now</button>
            <button data-m6="phase-focus">Force Focus</button>
            <button data-m6="phase-short">Force Short Break</button>
            <button data-m6="phase-long">Force Long Break</button>
          </div>

          <div class="debug-section-title" style="margin-top: 8px;">Hardware Polling &amp; Alerts</div>
          <div class="debug-btn-grid" style="margin-bottom: 6px;">
            <button data-m6="battery-low">Fake Battery: 14% Alert</button>
            <button data-m6="battery-full">Fake Battery: 100% Chg</button>
            <button data-m6="cpu-spike">Fake CPU: 95% Spike</button>
            <button data-m6="hw-reset">Reset Real Hardware</button>
          </div>

          <div class="debug-section-title" style="margin-top: 8px;">UI Stress &amp; Layout Audit</div>
          <div class="debug-btn-grid" style="margin-bottom: 6px;">
            <button data-m6="stress-toggle">Toggle UI Stress Strings</button>
            <button data-m6="width-260">Width 260px</button>
            <button data-m6="width-320">Width 320px</button>
            <button data-m6="width-400">Width 400px</button>
            <button data-m6="zoom-100">Zoom 100%</button>
            <button data-m6="zoom-125">Zoom 125%</button>
            <button data-m6="zoom-150">Zoom 150%</button>
            <button data-m6="zoom-200">Zoom 200%</button>
          </div>

          <div class="debug-section-title" style="margin-top: 8px;">Fake Notification Generator (Image K Fix)</div>
          <div class="debug-btn-grid">
            <button data-m6="notif-ps">PowerShell Toast</button>
            <button data-m6="notif-discord">Discord Mention</button>
            <button data-m6="notif-telegram">Telegram Message</button>
            <button data-m6="notif-chrome">Chrome Download</button>
            <button data-m6="notif-model">Mintu Model Ready</button>
          </div>
        </div>
      </div>
    `;

    this.fpsBadgeEl = this.el.querySelector("#debug-fps-badge")!;

    // Button event listeners
    this.el.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest("button") as HTMLButtonElement;
      if (!btn) return;

      if (btn.classList.contains("debug-close-btn")) {
        this.toggle(false);
        return;
      }

      if (btn.dataset.ctx) {
        const c = btn.dataset.ctx;
        if (c === "e1") {
          this.delegate.onSetIslandState("context");
          eventBus.emit("context:set-summary", {
            summary: "Got 3 lines from VS Code",
            actions: [
              { id: "explain", label: "Explain" },
              { id: "fix", label: "Fix it", primary: true },
            ],
            type: "code",
          });
        } else if (c === "e2") {
          this.delegate.onSetIslandState("context");
          eventBus.emit("context:set-summary", {
            summary: "Got a paragraph in German",
            actions: [
              { id: "translate", label: "Translate", primary: true },
              { id: "summarize", label: "Summarize" },
            ],
            type: "text",
          });
        } else if (c === "e3") {
          this.delegate.onSetIslandState("expanded");
          eventBus.emit("context:attach-chip", {
            id: "code-test",
            type: "code",
            label: "Code snippet",
            data: "const mintu = 'living companion';",
          });
          eventBus.emit("context:attach-chip", {
            id: "img-test",
            type: "image",
            label: "Screenshot (OCR)",
            data: "Error: Failed to fetch model",
          });
        } else if (c === "e4") {
          this.delegate.onSetIslandState("blocked");
        } else if (c === "e5") {
          this.delegate.onSetIslandState("answer-ready");
        } else if (c === "consent") {
          this.delegate.onSetIslandState("consent");
        }
      } else if (btn.dataset.cap === "open") {
        appBridge.openRegionCapture();
      } else if (btn.dataset.cap === "fake-ocr") {
        this.delegate.onSetIslandState("context");
        eventBus.emit("context:set-summary", {
          summary: "Could not read text clearly from screenshot",
          actions: [{ id: "retry", label: "Try Again", primary: true }],
          type: "image",
        });
      } else if (btn.dataset.island) {
        this.delegate.onSetIslandState(btn.dataset.island);
      } else if (btn.dataset.handoff === "leave") {
        if (this.delegate.onForceLeaveIsland) this.delegate.onForceLeaveIsland();
      } else if (btn.dataset.handoff === "enter") {
        if (this.delegate.onForceEnterIsland) this.delegate.onForceEnterIsland();
      } else if (btn.dataset.pet) {
        this.delegate.onSetPetState(btn.dataset.pet);
      } else if (btn.dataset.notif) {
        this.delegate.onNotify(btn.dataset.notif);
      } else if (btn.dataset.media === "play") {
        eventBus.emit("media:simulate-state", {
          is_playing: true,
          title: "Levitating",
          artist: "Dua Lipa",
          album: "Future Nostalgia",
          has_session: true,
        });
      } else if (btn.dataset.media === "pause") {
        eventBus.emit("media:simulate-state", {
          is_playing: false,
          title: "Levitating",
          artist: "Dua Lipa",
          album: "Future Nostalgia",
          has_session: true,
        });
      } else if (btn.dataset.mode) {
        this.delegate.onToggleMode(btn.dataset.mode as "island" | "free");
      } else if (btn.dataset.diag === "hit-overlay") {
        if (this.delegate.onToggleHitOverlay) {
          this.delegate.onToggleHitOverlay();
        }
      } else if (btn.dataset.diag === "mock-download") {
        import("../ai/ModelManager").then(({ modelManager }) => {
          modelManager.simulateMockDownload("qwen2.5-0.5b-instruct");
        });
      } else if (btn.dataset.diag === "clear-cache") {
        localStorage.removeItem("mintu_context_consent");
        alert("Context consent reset! Next capture will show consent card.");
      } else if (btn.dataset.diag === "force-ai-msg") {
        this.delegate.onSetIslandState("expanded");
        import("../ai/ChatManager").then(({ chatManager }) => {
          chatManager.sendMessage("Tell me about yourself, Mintu!");
        });
      } else if (btn.dataset.toolsim) {
        const sim = btn.dataset.toolsim;
        import("../ai/tools/ToolExecutor").then(async ({ toolExecutor }) => {
          if (sim === "time") {
            const res = await toolExecutor.executeToolCall("get_time_and_date", {});
            eventBus.emit("pet:say", { text: res.result.summary });
          } else if (sim === "clipboard") {
            const res = await toolExecutor.executeToolCall("read_clipboard_text", {});
            eventBus.emit("pet:say", { text: res.result.summary });
          } else if (sim === "search") {
            const res = await toolExecutor.executeToolCall("search_files", { query: "mintu" });
            eventBus.emit("pet:say", { text: res.result.summary });
          } else if (sim === "reminder") {
            const res = await toolExecutor.executeToolCall("set_reminder", { text: "Drink a cup of mint tea!", in_seconds: 5 });
            eventBus.emit("pet:say", { text: res.result.summary });
          } else if (sim === "open-app") {
            toolExecutor.executeToolCall("open_app", { name: "Calculator" });
          } else if (sim === "open-url") {
            toolExecutor.executeToolCall("open_url", { url: "https://github.com" });
          } else if (sim === "recycle") {
            toolExecutor.executeToolCall("move_to_recycle_bin", { path: "scratch_test.txt" });
          } else if (sim === "cloud-consent") {
            eventBus.emit("island:request-state", "cloud-consent");
          }
        });
      } else if (btn.dataset.m5) {
        const action = btn.dataset.m5;
        if (action === "toggle-mock") {
          import("../ai/ChatManager").then(({ chatManager }) => {
            chatManager.setDevForceMock(!chatManager.isDevMockActive());
            this.refreshMilestone5Info();
          });
        } else if (action === "test-memory") {
          import("../ai/MemoryManager").then(async ({ memoryManager }) => {
            await memoryManager.addMemory("fact", "User prefers concise code examples and clean markdown", "debug_panel");
            eventBus.emit("pet:say", { text: "Saved test memory: 'User prefers concise code examples'!" });
            this.refreshMilestone5Info();
          });
        } else if (action === "10-chats") {
          import("../ai/ChatManager").then(async ({ chatManager }) => {
            const testTitles = [
              "Rust Async Runtime & Tokio",
              "Python Data Cleaning with Pandas",
              "Azerbaijani Poetry and Literature",
              "Vite Configuration and Rollup Options",
              "Dynamic Island CSS Micro-interactions",
              "SQLite FTS5 Full Text Indexing",
              "Local LLM Benchmarking & VRAM",
              "Desktop Pet Spring Physics 60fps",
              "Windows Notification Center Manager",
              "Milestone 5 QA Verification Suite",
            ];
            for (const t of testTitles) {
              const c = await chatManager.startNewChat();
              await chatManager.renameConversation(c.id, t);
              await chatManager.sendMessage(`This is an automated test message for "${t}".`);
            }
            eventBus.emit("pet:say", { text: "Created 10 test chats successfully!" });
            this.refreshMilestone5Info();
          });
        } else if (action === "refresh-m5") {
          this.refreshMilestone5Info();
        }
      } else if (btn.dataset.forcemood) {
        const mood = btn.dataset.forcemood;
        import("../ai/MoodManager").then(({ moodManager }) => {
          moodManager.setMood(mood as any, "Forced via developer panel", true);
          this.refreshMilestone5Info();
        });
      } else if (btn.dataset.m6) {
        const action = btn.dataset.m6;
        if (action === "timer-10x") {
          timerEngine.fastForward(10);
          eventBus.emit("pet:say", { text: "Timer fast-forwarded 10x" });
        } else if (action === "timer-60x") {
          timerEngine.fastForward(60);
          eventBus.emit("pet:say", { text: "Timer fast-forwarded 60x" });
        } else if (action === "timer-end") {
          timerEngine.triggerEndNow();
          eventBus.emit("pet:say", { text: "Triggered timer end" });
        } else if (action === "phase-focus") {
          timerEngine.forcePhase("focus");
          eventBus.emit("island:request-state", "timer");
        } else if (action === "phase-short") {
          timerEngine.forcePhase("short_break");
          eventBus.emit("island:request-state", "timer");
        } else if (action === "phase-long") {
          timerEngine.forcePhase("long_break");
          eventBus.emit("island:request-state", "timer");
        } else if (action === "battery-low") {
          statusModule.fakeBatteryPercent = 14;
          statusModule.fakeIsCharging = false;
          statusModule.onTick();
          eventBus.emit("pet:say", { text: "Simulating 14% low battery" });
        } else if (action === "battery-full") {
          statusModule.fakeBatteryPercent = 100;
          statusModule.fakeIsCharging = true;
          statusModule.onTick();
          eventBus.emit("pet:say", { text: "Simulating 100% charging battery" });
        } else if (action === "cpu-spike") {
          statusModule.fakeCpuPercent = 95;
          statusModule.onTick();
          eventBus.emit("pet:say", { text: "Simulating 95% CPU spike" });
        } else if (action === "hw-reset") {
          statusModule.fakeBatteryPercent = null;
          statusModule.fakeIsCharging = null;
          statusModule.fakeCpuPercent = null;
          statusModule.onTick();
          eventBus.emit("pet:say", { text: "Reset to live hardware telemetry" });
        } else if (action === "stress-toggle") {
          document.body.classList.toggle("ui-stress-mode");
          const isStress = document.body.classList.contains("ui-stress-mode");
          eventBus.emit("pet:say", { text: isStress ? "UI Stress Strings Enabled" : "UI Stress Strings Disabled" });
          if (isStress) {
            const badge = document.querySelector("#mintu-model-tag");
            if (badge) (badge as HTMLElement).title = "Google Gemini (gemini-2.0-flash-thinking-exp-01-21-supercalifragilisticexpialidocious)";
          }
        } else if (action === "width-260") {
          const island = document.querySelector(".mintu-island") as HTMLElement;
          if (island) island.style.width = "260px";
        } else if (action === "width-320") {
          const island = document.querySelector(".mintu-island") as HTMLElement;
          if (island) island.style.width = "320px";
        } else if (action === "width-400") {
          const island = document.querySelector(".mintu-island") as HTMLElement;
          if (island) island.style.width = "400px";
        } else if (action === "zoom-100") {
          (document.body.style as any).zoom = "100%";
        } else if (action === "zoom-125") {
          (document.body.style as any).zoom = "125%";
        } else if (action === "zoom-150") {
          (document.body.style as any).zoom = "150%";
        } else if (action === "zoom-200") {
          (document.body.style as any).zoom = "200%";
        } else if (action === "notif-ps") {
          activityManager.push({
            id: "notif_ps_" + Date.now(),
            type: "urgent_notif",
            islandState: "notification",
            petState: "alert",
            payload: {
              appName: "PowerShell",
              title: "Requesting your permission:",
              text: 'curl.exe -L "https://dl.google.com/chrome/install/setup.exe" -o setup.exe',
              appIcon: "powershell",
            },
            autoDismissMs: 8000,
          });
        } else if (action === "notif-discord") {
          activityManager.push({
            id: "notif_dc_" + Date.now(),
            type: "normal_notif",
            islandState: "notification",
            petState: "alert",
            payload: {
              appName: "Discord",
              title: "Elena in #general",
              text: "Are we still meeting for the code review at 3pm?",
              appIcon: "discord",
            },
            autoDismissMs: 7000,
          });
        } else if (action === "notif-telegram") {
          activityManager.push({
            id: "notif_tg_" + Date.now(),
            type: "normal_notif",
            islandState: "notification",
            petState: "alert",
            payload: {
              appName: "Telegram",
              title: "Farid",
              text: "Salam, faylları göndərdim, baxa bilərsən?",
              appIcon: "telegram",
            },
            autoDismissMs: 7000,
          });
        } else if (action === "notif-chrome") {
          activityManager.push({
            id: "notif_cr_" + Date.now(),
            type: "normal_notif",
            islandState: "notification",
            petState: "alert",
            payload: {
              appName: "Google Chrome",
              title: "Download complete",
              text: "qwen2.5-1.5b-instruct-q4_k_m.gguf (986 MB)",
              appIcon: "chrome",
            },
            autoDismissMs: 7000,
          });
        } else if (action === "notif-model") {
          activityManager.push({
            id: "notif_mintu_" + Date.now(),
            type: "normal_notif",
            islandState: "notification",
            petState: "happy",
            payload: {
              appName: "Mintu AI",
              title: "Local model verified and ready",
              text: "Qwen 2.5 1.5B Instruct is active and listening.",
              appIcon: "internal",
            },
            autoDismissMs: 7000,
          });
        }
      }
    });
  }

  public refreshMilestone5Info(): void {
    import("../ai/ChatManager").then(({ chatManager }) => {
      const provEl = this.el.querySelector("#debug-active-provider");
      if (provEl) {
        provEl.textContent = `${chatManager.getActiveProviderId()}${chatManager.isDevMockActive() ? " (Forced Mock)" : ""}`;
      }
    });

    import("../ai/MoodManager").then(({ moodManager }) => {
      const moodState = moodManager.getMoodState();
      const moodEl = this.el.querySelector("#debug-current-mood");
      const reasonEl = this.el.querySelector("#debug-mood-reason");
      if (moodEl) moodEl.textContent = moodState.mood;
      if (reasonEl) reasonEl.textContent = moodState.reason;
    });

    import("../ai/MemoryManager").then(({ memoryManager }) => {
      const memEl = this.el.querySelector("#debug-last-memories");
      if (memEl) {
        const last = memoryManager.lastRetrievedMemories;
        if (!last || last.length === 0) {
          memEl.textContent = "None retrieved yet";
        } else {
          memEl.innerHTML = last
            .map((item) => `<div>[${(item.score * 100).toFixed(0)}%] ${item.memory.text}</div>`)
            .join("");
        }
      }
    });
  }

  private setupShortcuts(): void {
    window.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        this.toggle();
      } else if (e.key === "Escape" && this.isVisible) {
        e.preventDefault();
        this.toggle(false);
      }
    });

    appBridge.listenToEvent<string>("hotkey-triggered", (action) => {
      if (action === "toggle-debug") {
        this.toggle();
      }
    });

    eventBus.on("debug:toggle", (data) => {
      this.toggle(data.open);
    });
  }

  toggle(open?: boolean): void {
    const next = open !== undefined ? open : !this.isVisible;
    if (next && !this.isDevPanelEnabled()) {
      return;
    }
    this.isVisible = next;
    if (this.isVisible) {
      this.el.classList.add("visible");
      this.refreshMilestone5Info();
      appBridge.invoke("focus_main_window").catch(() => {});
    } else {
      this.el.classList.remove("visible");
    }
    if (this.onVisibilityChange) {
      this.onVisibilityChange(this.isVisible);
    }
  }

  isOpen(): boolean {
    return this.isVisible;
  }
}
