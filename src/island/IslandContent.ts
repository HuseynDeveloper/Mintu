/**
 * Dynamic Island Content Slots
 * Renders cross-fading slot views:
 * - Collapsed: Peeking sleepy Mintu + glowing green status dot
 * - Idle: Awake Mintu + live clock (e.g. 10:42)
 * - Notification: App icon + title + subtitle (+ optional actions variant)
 * - Expanded AI Chat: Mintu think pose + greeting + placeholder input & chips
 * - Timer Demo: Mintu with headphones + animated progress ring + 24:30
 * - Music Demo: Dancing Mintu + album art + animated waveform + controls
 */

export interface NotificationPayload {
  icon?: string;
  title: string;
  text: string;
  actions?: Array<{ id: string; label: string; primary?: boolean }>;
}

export class IslandContentRenderer {
  public readonly container: HTMLElement;

  // Slot containers for smooth cross-fading
  private slotCollapsed!: HTMLElement;
  private slotIdle!: HTMLElement;
  private slotNotification!: HTMLElement;
  private slotExpanded!: HTMLElement;
  private slotTimer!: HTMLElement;
  private slotMusic!: HTMLElement;

  private clockEl!: HTMLElement;
  private clockInterval: number | null = null;
  private waveformAnimId: number | null = null;

  constructor() {
    this.container = document.createElement("div");
    this.container.className = "island-content-container";
    this.initSlots();
    this.startClock();
  }

  private initSlots(): void {
    this.container.innerHTML = `
      <!-- SLOT 1: COLLAPSED -->
      <div class="island-slot slot-collapsed active">
        <div class="slot-left-pet-anchor"></div>
        <div class="collapsed-status-dot"></div>
      </div>

      <!-- SLOT 2: IDLE -->
      <div class="island-slot slot-idle">
        <div class="slot-left-pet-anchor"></div>
        <div class="idle-clock">10:42</div>
      </div>

      <!-- SLOT 3: NOTIFICATION -->
      <div class="island-slot slot-notification">
        <div class="slot-left-pet-anchor"></div>
        <div class="notif-body">
          <div class="notif-header">
            <div class="notif-app-icon">
              <svg viewBox="0 0 24 24" width="20" height="20">
                <rect width="24" height="24" rx="5" fill="#EA4335" />
                <path d="M4 6l8 6 8-6v12H4z" fill="#ffffff" />
              </svg>
            </div>
            <div class="notif-text-col">
              <div class="notif-title">New message</div>
              <div class="notif-subtitle">From: Sarah "Hey there!"</div>
            </div>
            <div class="notif-dot"></div>
          </div>
          <div class="notif-actions" style="display: none;">
            <button class="notif-btn secondary" data-action="explain">Explain</button>
            <button class="notif-btn primary" data-action="fix">Fix it</button>
          </div>
        </div>
      </div>

      <!-- SLOT 4: EXPANDED (AI CHAT SHELL) -->
      <div class="island-slot slot-expanded">
        <div class="expanded-top-row">
          <div class="slot-left-pet-anchor expanded-pet"></div>
          <div class="expanded-greeting">
            <div class="greeting-heading">How can I<br/>help you?</div>
          </div>
        </div>

        <div class="expanded-input-row">
          <div class="chat-input-pill">
            <input type="text" placeholder="Type a message..." class="chat-text-input" readonly />
            <span class="ai-milestone-tag">AI M2</span>
          </div>
        </div>

        <div class="expanded-chips-row">
          <button class="chip-btn" data-chip="tasks">Check Tasks</button>
          <button class="chip-btn" data-chip="ask">Ask AI</button>
        </div>
      </div>

      <!-- SLOT 5: TIMER (STATIC DEMO) -->
      <div class="island-slot slot-timer">
        <div class="slot-left-pet-anchor"></div>
        <div class="timer-center">
          <div class="circular-progress">
            <svg viewBox="0 0 36 36" class="circular-chart">
              <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path class="circle" stroke-dasharray="75, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            </svg>
          </div>
          <div class="timer-digits">24:30</div>
        </div>
      </div>

      <!-- SLOT 6: MUSIC (STATIC DEMO) -->
      <div class="island-slot slot-music">
        <div class="slot-left-pet-anchor"></div>
        <div class="music-art-thumb">
          <div class="music-art-gradient"></div>
        </div>
        <div class="music-info-col">
          <div class="music-track-title">Chill Beats</div>
          <div class="music-waveform">
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
          </div>
        </div>
        <div class="music-controls">
          <button class="music-btn" title="Previous">⏮</button>
          <button class="music-btn play-pause" title="Pause">⏸</button>
          <button class="music-btn" title="Next">⏭</button>
        </div>
      </div>
    `;

    this.slotCollapsed = this.container.querySelector(".slot-collapsed")!;
    this.slotIdle = this.container.querySelector(".slot-idle")!;
    this.slotNotification = this.container.querySelector(".slot-notification")!;
    this.slotExpanded = this.container.querySelector(".slot-expanded")!;
    this.slotTimer = this.container.querySelector(".slot-timer")!;
    this.slotMusic = this.container.querySelector(".slot-music")!;

    this.clockEl = this.container.querySelector(".idle-clock")!;

    this.startWaveformAnimation();
  }

  getPetAnchor(slotName: string): HTMLElement | null {
    switch (slotName) {
      case "collapsed":
        return this.slotCollapsed.querySelector(".slot-left-pet-anchor");
      case "idle":
      case "peek":
        return this.slotIdle.querySelector(".slot-left-pet-anchor");
      case "notification":
        return this.slotNotification.querySelector(".slot-left-pet-anchor");
      case "expanded":
        return this.slotExpanded.querySelector(".slot-left-pet-anchor");
      case "timer":
        return this.slotTimer.querySelector(".slot-left-pet-anchor");
      case "music":
        return this.slotMusic.querySelector(".slot-left-pet-anchor");
      default:
        return null;
    }
  }

  showSlot(name: string): void {
    const slots = [
      this.slotCollapsed,
      this.slotIdle,
      this.slotNotification,
      this.slotExpanded,
      this.slotTimer,
      this.slotMusic,
    ];

    let target: HTMLElement;
    switch (name) {
      case "collapsed":
        target = this.slotCollapsed;
        break;
      case "idle":
      case "peek":
        target = this.slotIdle;
        break;
      case "notification":
        target = this.slotNotification;
        break;
      case "expanded":
        target = this.slotExpanded;
        break;
      case "timer":
        target = this.slotTimer;
        break;
      case "music":
        target = this.slotMusic;
        break;
      default:
        target = this.slotIdle;
    }

    slots.forEach((s) => {
      if (s === target) {
        s.classList.add("active");
        s.classList.remove("fade-out");
      } else {
        s.classList.remove("active");
        s.classList.add("fade-out");
      }
    });
  }

  setNotification(payload: NotificationPayload): void {
    const titleEl = this.slotNotification.querySelector(".notif-title");
    const textEl = this.slotNotification.querySelector(".notif-subtitle");
    const actionsRow = this.slotNotification.querySelector(".notif-actions") as HTMLElement;

    if (titleEl) titleEl.textContent = payload.title;
    if (textEl) textEl.textContent = payload.text;

    if (payload.actions && payload.actions.length > 0) {
      actionsRow.style.display = "flex";
      actionsRow.innerHTML = "";
      payload.actions.forEach((act) => {
        const btn = document.createElement("button");
        btn.className = `notif-btn ${act.primary ? "primary" : "secondary"}`;
        btn.textContent = act.label;
        btn.dataset.actionId = act.id;
        actionsRow.appendChild(btn);
      });
    } else {
      actionsRow.style.display = "none";
    }
  }

  private startClock(): void {
    const update = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, "0");
      const mins = now.getMinutes().toString().padStart(2, "0");
      this.clockEl.textContent = `${hours}:${mins}`;
    };
    update();
    this.clockInterval = window.setInterval(update, 10000);
  }

  private startWaveformAnimation(): void {
    const bars = this.container.querySelectorAll(".wave-bar");
    const animate = () => {
      const t = performance.now() / 150;
      bars.forEach((bar, idx) => {
        const h = Math.abs(Math.sin(t + idx * 0.7)) * 14 + 3;
        (bar as HTMLElement).style.height = `${h}px`;
      });
      this.waveformAnimId = requestAnimationFrame(animate);
    };
    this.waveformAnimId = requestAnimationFrame(animate);
  }

  destroy(): void {
    if (this.clockInterval) clearInterval(this.clockInterval);
    if (this.waveformAnimId) cancelAnimationFrame(this.waveformAnimId);
  }
}
