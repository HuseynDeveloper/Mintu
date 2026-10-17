import { IslandModule, ModuleContext } from "../types";
import { timerEngine, PomodoroPhase } from "./TimerEngine";

export class TimerModule implements IslandModule {
  public id = "timer";
  public name = "Timer & Focus";
  public icon = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
  `;
  public priority = 40;
  public updateRateHz = 1;

  private context: ModuleContext | null = null;
  private unsubscribeTimer?: () => void;

  public start(context: ModuleContext): void {
    this.context = context;

    this.unsubscribeTimer = timerEngine.subscribe(() => {
      this.syncActivityState();
    });

    timerEngine.setOnPhaseEnd((prevPhase, nextPhase) => {
      this.handlePhaseEnd(prevPhase, nextPhase);
    });

    this.syncActivityState();
  }

  public stop(): void {
    if (this.unsubscribeTimer) {
      this.unsubscribeTimer();
      this.unsubscribeTimer = undefined;
    }
    if (this.context) {
      this.context.activityManager.remove("module_timer_running");
    }
  }

  public isActive(): boolean {
    const s = timerEngine.getState();
    return s === "running" || s === "paused";
  }

  public onTick(): void {
    timerEngine.tick();
  }

  private syncActivityState(): void {
    if (!this.context) return;
    const state = timerEngine.getState();
    const phase = timerEngine.getPhase();

    if (state === "running" || state === "paused") {
      this.context.activityManager.push({
        id: "module_timer_running",
        type: "running_timer",
        priority: 40,
        islandState: "timer",
        petState: phase === "focus" ? "headphones-focus" : "happy",
        payload: {
          remaining: timerEngine.getRemainingSec(),
          formatted: timerEngine.getFormattedTime(),
          phase,
        },
      });

      if (phase === "focus") {
        this.context.eventBus.emit("pet:action", { type: "state", payload: "headphones-focus" });
      } else {
        this.context.eventBus.emit("pet:action", { type: "state", payload: "happy" });
      }
    } else {
      this.context.activityManager.remove("module_timer_running");
    }
  }

  private handlePhaseEnd(prevPhase: PomodoroPhase, _nextPhase: PomodoroPhase): void {
    if (!this.context) return;

    const isBreak = prevPhase === "focus";
    const title = isBreak ? "Focus session complete!" : "Break finished!";
    const text = isBreak ? "Time for a short break. Stretch and relax." : "Ready to focus again?";

    const actions = isBreak
      ? [
          { id: "start_break", label: "Start break", primary: true },
          { id: "add_5", label: "+5 min" },
          { id: "skip", label: "Skip" },
        ]
      : [
          { id: "start_focus", label: "Start focus", primary: true },
          { id: "add_5", label: "+5 min" },
          { id: "skip", label: "Skip" },
        ];

    // Surface through ActivityManager via normal_notif
    this.context.activityManager.push({
      id: "timer_end_notif",
      type: "normal_notif",
      priority: 50,
      islandState: "notification",
      petState: isBreak ? "happy" : "alert",
      payload: {
        title,
        text,
        appName: "MINTU",
        appIcon: "internal",
        actions,
      },
      autoDismissMs: 15000,
    });

    // Handle notification button clicks
    this.context.eventBus.once?.("timer:action", (actionId: string) => {
      this.handleActionClick(actionId);
    });
  }

  public handleActionClick(actionId: string): void {
    if (actionId === "start_break") {
      timerEngine.startPomodoro(undefined, timerEngine.getLabel(), true);
    } else if (actionId === "start_focus") {
      timerEngine.startPomodoro(undefined, timerEngine.getLabel(), true);
    } else if (actionId === "add_5") {
      timerEngine.addTime(300);
    } else if (actionId === "skip") {
      timerEngine.skipPhase();
    }
    this.context?.activityManager.remove("timer_end_notif");
  }

  // ==========================================
  // Compact View (Image B "Timer")
  // ==========================================

  public renderCompact(container: HTMLElement, options: { mintuInside: boolean }): void {
    const progress = timerEngine.getProgressPercent();
    const timeStr = timerEngine.getFormattedTime();
    const phase = timerEngine.getPhase();
    const state = timerEngine.getState();

    const ringCircumference = 69.11; // 2 * PI * 11
    const ringOffset = ringCircumference * (1 - progress);
    const ringColor = phase === "focus" ? "#10B981" : "#38BDF8";

    container.innerHTML = `
      <div class="island-timer-compact" style="display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 0 4px; box-sizing: border-box;">
        <div class="timer-left-slot" style="display: flex; align-items: center; gap: 8px;">
          ${options.mintuInside ? '<div class="slot-left-pet-anchor"></div>' : ""}
          <div class="timer-progress-ring-wrap" style="position: relative; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;">
            <svg width="26" height="26" viewBox="0 0 28 28">
              <circle cx="14" cy="14" r="11" stroke="rgba(255,255,255,0.15)" stroke-width="2.5" fill="none" />
              <circle cx="14" cy="14" r="11" stroke="${ringColor}" stroke-width="2.5" fill="none"
                stroke-dasharray="${ringCircumference}" stroke-dashoffset="${ringOffset}"
                stroke-linecap="round" transform="rotate(-90 14 14)"
                style="transition: stroke-dashoffset 0.4s ease, stroke 0.3s ease;" />
            </svg>
            <div style="position: absolute; width: 5px; height: 5px; border-radius: 50%; background: ${state === 'running' ? ringColor : '#9ca3af'};"></div>
          </div>
        </div>
        <div class="timer-time-display" style="font-size: 15px; font-weight: 700; font-family: ui-monospace, monospace; color: #ffffff; letter-spacing: -0.5px;">
          ${timeStr}
        </div>
      </div>
    `;

    container.onclick = () => {
      this.context?.requestExpand?.();
    };
  }

  // ==========================================
  // Expanded View
  // ==========================================

  public renderExpanded(container: HTMLElement): void {
    const progress = timerEngine.getProgressPercent();
    const timeStr = timerEngine.getFormattedTime();
    const phase = timerEngine.getPhase();
    const state = timerEngine.getState();
    const mode = timerEngine.getMode();
    const label = timerEngine.getLabel();
    const pomodoroCount = timerEngine.getPomodoroCount();
    const isFocusActive = timerEngine.isFocusModeActive();

    const ringCircumference = 314.16; // 2 * PI * 50
    const ringOffset = ringCircumference * (1 - progress);
    const ringColor = phase === "focus" ? "#10B981" : "#38BDF8";

    const phaseTitle =
      mode === "stopwatch"
        ? "Stopwatch"
        : phase === "focus"
        ? "Focus Session"
        : phase === "short_break"
        ? "Short Break"
        : "Long Break";

    // Pomodoro session indicators (dots)
    let sessionDotsHtml = "";
    if (mode === "pomodoro") {
      const dots = [];
      for (let i = 1; i <= 4; i++) {
        const active = i <= pomodoroCount;
        dots.push(
          `<span style="width: 7px; height: 7px; border-radius: 50%; background: ${
            active ? "#10B981" : "rgba(255,255,255,0.2)"
          }; display: inline-block;"></span>`
        );
      }
      sessionDotsHtml = `
        <div style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
          <span style="font-size: 11px; color: #9ca3af;">Session ${pomodoroCount} of 4</span>
          <div style="display: flex; gap: 4px;">${dots.join("")}</div>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="timer-expanded-card" style="display: flex; flex-direction: column; align-items: center; gap: 14px; width: 100%; padding: 12px 16px; box-sizing: border-box;">
        <!-- Header row -->
        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 14px; font-weight: 700; color: #ffffff;">${phaseTitle}</span>
            <span style="font-size: 10px; padding: 2px 6px; border-radius: 10px; background: rgba(255,255,255,0.08); color: #9ca3af; text-transform: uppercase;">${mode}</span>
          </div>
          <button class="timer-close-btn icon-btn" id="btn-timer-collapse" title="Collapse" style="background: transparent; border: none; color: #9ca3af; cursor: pointer;">✕</button>
        </div>

        ${sessionDotsHtml}

        <!-- Center big circle -->
        <div class="timer-big-ring-wrap" style="position: relative; width: 120px; height: 120px; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 4px 0;">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="50" stroke="rgba(255,255,255,0.12)" stroke-width="6" fill="none" />
            <circle cx="60" cy="60" r="50" stroke="${ringColor}" stroke-width="6" fill="none"
              stroke-dasharray="${ringCircumference}" stroke-dashoffset="${ringOffset}"
              stroke-linecap="round" transform="rotate(-90 60 60)"
              style="transition: stroke-dashoffset 0.3s ease, stroke 0.3s ease;" />
          </svg>
          <div style="position: absolute; display: flex; flex-direction: column; align-items: center;">
            <div style="font-size: 26px; font-weight: 800; font-family: ui-monospace, monospace; color: #ffffff; letter-spacing: -1px;">
              ${timeStr}
            </div>
            <span style="font-size: 10px; color: #9ca3af; text-transform: uppercase; font-weight: 600;">${state}</span>
          </div>
        </div>

        <!-- Task label input -->
        <div style="width: 100%; max-width: 280px;">
          <input type="text" id="timer-task-label" class="timer-input-label" placeholder="What are you working on?" value="${label || ""}"
            style="width: 100%; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 6px 10px; color: #ffffff; font-size: 12px; outline: none; box-sizing: border-box; text-align: center;" />
        </div>

        <!-- Control buttons row -->
        <div class="timer-controls-row" style="display: flex; align-items: center; gap: 8px;">
          ${
            state === "running"
              ? '<button class="timer-btn primary" id="btn-timer-pause" style="padding: 7px 18px; border-radius: 20px; background: #10B981; color: #042F2E; font-weight: 700; border: none; cursor: pointer;">Pause</button>'
              : '<button class="timer-btn primary" id="btn-timer-resume" style="padding: 7px 18px; border-radius: 20px; background: #10B981; color: #042F2E; font-weight: 700; border: none; cursor: pointer;">Start</button>'
          }
          <button class="timer-btn secondary" id="btn-timer-add5" style="padding: 7px 14px; border-radius: 20px; background: rgba(255,255,255,0.1); color: #ffffff; border: 1px solid rgba(255,255,255,0.15); font-size: 12px; cursor: pointer;">+5m</button>
          <button class="timer-btn secondary" id="btn-timer-skip" style="padding: 7px 14px; border-radius: 20px; background: rgba(255,255,255,0.1); color: #ffffff; border: 1px solid rgba(255,255,255,0.15); font-size: 12px; cursor: pointer;">Skip</button>
          <button class="timer-btn secondary" id="btn-timer-reset" style="padding: 7px 14px; border-radius: 20px; background: rgba(255,255,255,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.25); font-size: 12px; cursor: pointer;">Reset</button>
        </div>

        <!-- Presets row -->
        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: center;">
          <span style="font-size: 11px; color: #71717a; margin-right: 2px;">Presets:</span>
          ${[5, 15, 25, 45, 60]
            .map(
              (m) =>
                `<button class="preset-chip" data-mins="${m}" style="padding: 2px 8px; border-radius: 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #d1d5db; font-size: 11px; cursor: pointer;">${m}m</button>`
            )
            .join("")}
          <button class="preset-chip" data-mode="stopwatch" style="padding: 2px 8px; border-radius: 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #d1d5db; font-size: 11px; cursor: pointer;">Stopwatch</button>
        </div>

        <!-- Focus mode toggle -->
        <label style="display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: #9ca3af; cursor: pointer; user-select: none;">
          <input type="checkbox" id="chk-focus-mode" ${isFocusActive ? "checked" : ""} />
          <span>Focus mode (quiet pet, queue notifications)</span>
        </label>
      </div>
    `;

    // Event wiring
    container.querySelector("#btn-timer-collapse")?.addEventListener("click", () => {
      this.context?.requestCollapse?.();
    });

    container.querySelector("#btn-timer-pause")?.addEventListener("click", () => {
      timerEngine.pause();
      this.renderExpanded(container);
    });

    container.querySelector("#btn-timer-resume")?.addEventListener("click", () => {
      if (state === "idle" || state === "finished") {
        timerEngine.startPomodoro(undefined, (container.querySelector("#timer-task-label") as HTMLInputElement)?.value);
      } else {
        timerEngine.resume();
      }
      this.renderExpanded(container);
    });

    container.querySelector("#btn-timer-add5")?.addEventListener("click", () => {
      timerEngine.addTime(300);
      this.renderExpanded(container);
    });

    container.querySelector("#btn-timer-skip")?.addEventListener("click", () => {
      timerEngine.skipPhase();
      this.renderExpanded(container);
    });

    container.querySelector("#btn-timer-reset")?.addEventListener("click", () => {
      timerEngine.reset();
      this.renderExpanded(container);
    });

    container.querySelectorAll(".preset-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mins = (btn as HTMLElement).dataset.mins;
        const modeAttr = (btn as HTMLElement).dataset.mode;
        const taskVal = (container.querySelector("#timer-task-label") as HTMLInputElement)?.value || "";

        if (modeAttr === "stopwatch") {
          timerEngine.startStopwatch(taskVal);
        } else if (mins) {
          const num = parseInt(mins, 10);
          if (num === 25) {
            timerEngine.startPomodoro(undefined, taskVal);
          } else {
            timerEngine.startCountdown(num * 60, taskVal);
          }
        }
        this.renderExpanded(container);
      });
    });

    const labelInput = container.querySelector("#timer-task-label") as HTMLInputElement;
    labelInput?.addEventListener("change", () => {
      timerEngine.setLabel(labelInput.value);
    });

    const chkFocus = container.querySelector("#chk-focus-mode") as HTMLInputElement;
    chkFocus?.addEventListener("change", () => {
      timerEngine.setFocusModeEnabled(chkFocus.checked);
    });
  }

  // ==========================================
  // Settings View
  // ==========================================

  public renderSettings(container: HTMLElement): void {
    const config = timerEngine.getPomodoroConfig();
    const historyToday = timerEngine.getFocusHistory("today");
    const historyWeek = timerEngine.getFocusHistory("week");

    const totalTodayMins = Math.round(historyToday.reduce((acc, h) => acc + h.durationSec, 0) / 60);
    const totalWeekMins = Math.round(historyWeek.reduce((acc, h) => acc + h.durationSec, 0) / 60);

    container.innerHTML = `
      <div class="timer-settings-view" style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
        <div style="font-size: 13px; font-weight: 700; color: #ffffff;">Pomodoro Configuration</div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <div>
            <label style="font-size: 11px; color: #9ca3af;">Focus (minutes)</label>
            <input type="number" id="cfg-focus-mins" value="${Math.round(config.focusDurationSec / 60)}" min="1" max="120"
              style="width: 100%; background: #27272a; border: 1px solid #3f3f46; border-radius: 6px; padding: 4px 8px; color: #fff; font-size: 12px;" />
          </div>
          <div>
            <label style="font-size: 11px; color: #9ca3af;">Short Break (minutes)</label>
            <input type="number" id="cfg-break-mins" value="${Math.round(config.shortBreakSec / 60)}" min="1" max="60"
              style="width: 100%; background: #27272a; border: 1px solid #3f3f46; border-radius: 6px; padding: 4px 8px; color: #fff; font-size: 12px;" />
          </div>
          <div>
            <label style="font-size: 11px; color: #9ca3af;">Long Break (minutes)</label>
            <input type="number" id="cfg-longbreak-mins" value="${Math.round(config.longBreakSec / 60)}" min="1" max="60"
              style="width: 100%; background: #27272a; border: 1px solid #3f3f46; border-radius: 6px; padding: 4px 8px; color: #fff; font-size: 12px;" />
          </div>
          <div>
            <label style="font-size: 11px; color: #9ca3af;">Sessions before long break</label>
            <input type="number" id="cfg-sessions-count" value="${config.sessionsBeforeLongBreak}" min="1" max="10"
              style="width: 100%; background: #27272a; border: 1px solid #3f3f46; border-radius: 6px; padding: 4px 8px; color: #fff; font-size: 12px;" />
          </div>
        </div>

        <button id="btn-save-timer-config" style="padding: 6px 12px; border-radius: 6px; background: #10b981; color: #042f2e; font-weight: 600; font-size: 12px; border: none; cursor: pointer; align-self: flex-start;">
          Save Durations
        </button>

        <div style="border-top: 1px solid #27272a; margin: 8px 0;"></div>

        <div style="font-size: 13px; font-weight: 700; color: #ffffff;">Focus History (Local only)</div>
        <div style="display: flex; gap: 14px; font-size: 12px; color: #a1a1aa;">
          <div>Today: <strong style="color: #10b981;">${totalTodayMins}m</strong> (${historyToday.length} sessions)</div>
          <div>This Week: <strong style="color: #10b981;">${totalWeekMins}m</strong> (${historyWeek.length} sessions)</div>
        </div>

        <button id="btn-delete-focus-history" style="padding: 5px 10px; border-radius: 6px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; font-size: 11px; cursor: pointer; align-self: flex-start;">
          Delete Focus History
        </button>
      </div>
    `;

    container.querySelector("#btn-save-timer-config")?.addEventListener("click", () => {
      const f = parseInt((container.querySelector("#cfg-focus-mins") as HTMLInputElement).value, 10) || 25;
      const b = parseInt((container.querySelector("#cfg-break-mins") as HTMLInputElement).value, 10) || 5;
      const l = parseInt((container.querySelector("#cfg-longbreak-mins") as HTMLInputElement).value, 10) || 15;
      const s = parseInt((container.querySelector("#cfg-sessions-count") as HTMLInputElement).value, 10) || 4;

      timerEngine.startPomodoro({
        focusDurationSec: f * 60,
        shortBreakSec: b * 60,
        longBreakSec: l * 60,
        sessionsBeforeLongBreak: s,
      });

      const btn = container.querySelector("#btn-save-timer-config") as HTMLElement;
      btn.textContent = "Saved ✓";
      setTimeout(() => (btn.textContent = "Save Durations"), 2000);
    });

    container.querySelector("#btn-delete-focus-history")?.addEventListener("click", () => {
      if (confirm("Delete all local focus history?")) {
        timerEngine.deleteFocusHistory();
        this.renderSettings(container);
      }
    });
  }
}

export const timerModule = new TimerModule();
