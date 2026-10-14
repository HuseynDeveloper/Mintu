/**
 * Hidden Debug Panel (Ctrl+Shift+D)
 * Allows testing and verifying EVERY pet state, island state, content slot,
 * free mode drag/drop, speech bubbles, and notifications against Images A-D.
 */

import { eventBus } from "../core/EventBus";

export interface DebugPanelDelegate {
  onSetPetState: (state: string) => void;
  onSetIslandState: (state: string) => void;
  onNotify: (actions: boolean) => void;
  onSay: (text: string) => void;
  onToggleMode: (mode: "island" | "free") => void;
  onSetAccessory: (acc: string) => void;
}

export class DebugPanel {
  public readonly el: HTMLElement;
  private delegate: DebugPanelDelegate;
  private isVisible: boolean = false;

  constructor(delegate: DebugPanelDelegate) {
    this.delegate = delegate;
    this.el = document.createElement("div");
    this.el.className = "mintu-debug-panel";
    this.initUi();
    this.setupShortcuts();
  }

  private initUi(): void {
    this.el.innerHTML = `
      <div class="debug-header">
        <span class="debug-title">🧪 Mintu Debug Matrix</span>
        <button class="debug-close-btn" title="Close (Ctrl+Shift+D)">✕</button>
      </div>

      <div class="debug-body">
        <!-- Section 1: Island States & Slots -->
        <div class="debug-section">
          <div class="debug-section-title">Island States & Slots</div>
          <div class="debug-btn-grid">
            <button data-island="collapsed">Collapsed</button>
            <button data-island="idle">Idle</button>
            <button data-island="peek">Peek (Hover)</button>
            <button data-island="expanded">Expanded (AI)</button>
            <button data-island="timer">Timer Slot</button>
            <button data-island="music">Music Slot</button>
          </div>
        </div>

        <!-- Section 2: Notifications -->
        <div class="debug-section">
          <div class="debug-section-title">Notifications</div>
          <div class="debug-btn-grid">
            <button data-notif="simple">Simple Notif</button>
            <button data-notif="actions">Notif w/ Actions (Img D)</button>
          </div>
        </div>

        <!-- Section 3: Pet States (Image A Key Poses) -->
        <div class="debug-section">
          <div class="debug-section-title">Pet Poses & States (Image A)</div>
          <div class="debug-btn-grid">
            <button data-pet="idle">1. Idle</button>
            <button data-pet="walk">2. Walk</button>
            <button data-pet="sleep">3. Sleep</button>
            <button data-pet="happy">4. Happy Jump</button>
            <button data-pet="think">5. Think</button>
            <button data-pet="talk">6. Talk</button>
            <button data-pet="alert">7. Alert (:O)</button>
            <button data-pet="curious">8. Curious (?)</button>
            <button data-pet="wake">Wake (Stretch)</button>
            <button data-pet="dragged">Dragged</button>
            <button data-pet="landing">Landing Squash</button>
            <button data-pet="dance">Dance</button>
            <button data-pet="headphones-focus">Headphones</button>
          </div>
        </div>

        <!-- Section 4: Mode & Speech -->
        <div class="debug-section">
          <div class="debug-section-title">Free Mode & Speech Bubble</div>
          <div class="debug-btn-grid">
            <button data-mode="free">Switch to Free Mode</button>
            <button data-mode="island">Switch to Island</button>
            <button data-say="error">Say: "Need help with that error?"</button>
            <button data-say="hello">Say: "Hello friend! ✨"</button>
          </div>
        </div>
      </div>
    `;

    // Button event listeners
    this.el.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest("button") as HTMLButtonElement;
      if (!btn) return;

      if (btn.classList.contains("debug-close-btn")) {
        this.toggle(false);
        return;
      }

      if (btn.dataset.island) {
        this.delegate.onSetIslandState(btn.dataset.island);
      } else if (btn.dataset.pet) {
        this.delegate.onSetPetState(btn.dataset.pet);
      } else if (btn.dataset.notif === "simple") {
        this.delegate.onNotify(false);
      } else if (btn.dataset.notif === "actions") {
        this.delegate.onNotify(true);
      } else if (btn.dataset.mode) {
        this.delegate.onToggleMode(btn.dataset.mode as "island" | "free");
      } else if (btn.dataset.say === "error") {
        this.delegate.onSay("Need help with that error?");
      } else if (btn.dataset.say === "hello") {
        this.delegate.onSay("Hello friend! ✨");
      }
    });
  }

  private setupShortcuts(): void {
    window.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        this.toggle();
      }
    });

    eventBus.on("debug:toggle", (data) => {
      this.toggle(data.open);
    });
  }

  toggle(open?: boolean): void {
    this.isVisible = open !== undefined ? open : !this.isVisible;
    if (this.isVisible) {
      this.el.classList.add("visible");
    } else {
      this.el.classList.remove("visible");
    }
  }
}
