/**
 * Mintu Timer & Focus Engine (Milestone 6)
 * Uses absolute timestamps (targetEndTime) for robust survival across sleep,
 * hibernation, clock shifts, and app restarts.
 */

export type TimerMode = "countdown" | "pomodoro" | "stopwatch";
export type TimerState = "idle" | "running" | "paused" | "finished";
export type PomodoroPhase = "focus" | "short_break" | "long_break";

export interface PomodoroConfig {
  focusDurationSec: number; // default 25 * 60
  shortBreakSec: number;    // default 5 * 60
  longBreakSec: number;     // default 15 * 60
  sessionsBeforeLongBreak: number; // default 4
}

export interface FocusSessionRecord {
  id: string;
  timestamp: number;
  durationSec: number;
  label?: string;
  phase: string;
}

export interface PersistedTimerData {
  mode: TimerMode;
  state: TimerState;
  phase: PomodoroPhase;
  totalDurationSec: number;
  targetEndTime: number; // absolute epoch ms
  remainingSecWhenPaused?: number;
  stopwatchElapsedSec?: number;
  stopwatchStartTime?: number;
  label?: string;
  pomodoroCount: number; // 1-indexed
  focusModeEnabled: boolean;
  config: PomodoroConfig;
  finishedAtTimeStr?: string;
}

export class TimerEngine {
  private static instance: TimerEngine;

  private mode: TimerMode = "countdown";
  private state: TimerState = "idle";
  private phase: PomodoroPhase = "focus";
  private totalDurationSec: number = 25 * 60;
  private targetEndTime: number = 0;
  private remainingSecWhenPaused: number = 0;

  private stopwatchElapsedSec: number = 0;
  private stopwatchStartTime: number = 0;

  private label: string = "";
  private pomodoroCount: number = 1;
  private focusModeEnabled: boolean = true;
  private config: PomodoroConfig = {
    focusDurationSec: 25 * 60,
    shortBreakSec: 5 * 60,
    longBreakSec: 15 * 60,
    sessionsBeforeLongBreak: 4,
  };

  private finishedAtTimeStr: string | null = null;
  private queuedNotifications: any[] = [];
  private listeners: Set<() => void> = new Set();
  private onPhaseEndCallback?: (phase: PomodoroPhase, nextPhase: PomodoroPhase) => void;

  private constructor() {
    this.loadState();
  }

  public static getInstance(): TimerEngine {
    if (!TimerEngine.instance) {
      TimerEngine.instance = new TimerEngine();
    }
    return TimerEngine.instance;
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify(): void {
    this.saveState();
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (e) {
        console.error("TimerEngine listener error:", e);
      }
    });
  }

  public setOnPhaseEnd(cb: (phase: PomodoroPhase, nextPhase: PomodoroPhase) => void): void {
    this.onPhaseEndCallback = cb;
  }

  // ==========================================
  // Timer Controls
  // ==========================================

  public startCountdown(durationSec: number, label: string = "", focusMode: boolean = true): void {
    this.mode = "countdown";
    this.phase = "focus";
    this.totalDurationSec = Math.max(1, durationSec);
    this.targetEndTime = Date.now() + this.totalDurationSec * 1000;
    this.remainingSecWhenPaused = 0;
    this.state = "running";
    this.label = label;
    this.focusModeEnabled = focusMode;
    this.finishedAtTimeStr = null;
    this.notify();
  }

  public startPomodoro(configOverride?: Partial<PomodoroConfig>, label: string = "", focusMode: boolean = true): void {
    this.mode = "pomodoro";
    this.phase = "focus";
    if (configOverride) {
      this.config = { ...this.config, ...configOverride };
    }
    this.totalDurationSec = this.config.focusDurationSec;
    this.targetEndTime = Date.now() + this.totalDurationSec * 1000;
    this.remainingSecWhenPaused = 0;
    this.state = "running";
    this.label = label;
    this.focusModeEnabled = focusMode;
    this.pomodoroCount = 1;
    this.finishedAtTimeStr = null;
    this.notify();
  }

  public startStopwatch(label: string = ""): void {
    this.mode = "stopwatch";
    this.phase = "focus";
    this.state = "running";
    this.label = label;
    this.stopwatchStartTime = Date.now();
    this.stopwatchElapsedSec = 0;
    this.finishedAtTimeStr = null;
    this.notify();
  }

  public pause(): void {
    if (this.state !== "running") return;
    this.state = "paused";
    if (this.mode === "stopwatch") {
      this.stopwatchElapsedSec += Math.floor((Date.now() - this.stopwatchStartTime) / 1000);
    } else {
      this.remainingSecWhenPaused = this.getRemainingSec();
    }
    this.notify();
  }

  public resume(): void {
    if (this.state !== "paused") return;
    this.state = "running";
    if (this.mode === "stopwatch") {
      this.stopwatchStartTime = Date.now();
    } else {
      this.targetEndTime = Date.now() + Math.max(1, this.remainingSecWhenPaused) * 1000;
    }
    this.notify();
  }

  public reset(): void {
    this.state = "idle";
    this.targetEndTime = 0;
    this.remainingSecWhenPaused = 0;
    this.stopwatchElapsedSec = 0;
    this.stopwatchStartTime = 0;
    this.finishedAtTimeStr = null;
    this.notify();
  }

  public addTime(secondsToAdd: number): void {
    if (this.state === "running") {
      this.targetEndTime += secondsToAdd * 1000;
      this.totalDurationSec += secondsToAdd;
    } else if (this.state === "paused") {
      this.remainingSecWhenPaused += secondsToAdd;
      this.totalDurationSec += secondsToAdd;
    } else if (this.state === "finished" || this.state === "idle") {
      this.startCountdown(secondsToAdd, this.label, this.focusModeEnabled);
      return;
    }
    this.notify();
  }

  public skipPhase(): void {
    if (this.mode === "pomodoro") {
      this.advancePomodoroPhase();
    } else {
      this.handleTimerFinished();
    }
  }

  // ==========================================
  // Tick & Expiry Check
  // ==========================================

  public tick(): void {
    if (this.state !== "running") return;

    if (this.mode === "stopwatch") {
      this.notify();
      return;
    }

    const now = Date.now();
    if (now >= this.targetEndTime) {
      if (this.mode === "pomodoro") {
        this.advancePomodoroPhase();
      } else {
        this.handleTimerFinished();
      }
    } else {
      this.notify();
    }
  }

  private handleTimerFinished(): void {
    this.state = "finished";
    const date = new Date(this.targetEndTime || Date.now());
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    this.finishedAtTimeStr = `Timer finished at ${hh}:${mm}`;

    if (this.phase === "focus") {
      this.recordFocusSession(this.totalDurationSec, this.label);
    }

    this.flushQueuedNotifications();
    this.onPhaseEndCallback?.(this.phase, "focus");
    this.notify();
  }

  private advancePomodoroPhase(): void {
    const prevPhase = this.phase;
    let nextPhase: PomodoroPhase = "short_break";

    if (prevPhase === "focus") {
      this.recordFocusSession(this.totalDurationSec, this.label);
      if (this.pomodoroCount % this.config.sessionsBeforeLongBreak === 0) {
        nextPhase = "long_break";
        this.totalDurationSec = this.config.longBreakSec;
      } else {
        nextPhase = "short_break";
        this.totalDurationSec = this.config.shortBreakSec;
      }
    } else {
      // Coming back from break to focus
      nextPhase = "focus";
      this.pomodoroCount++;
      this.totalDurationSec = this.config.focusDurationSec;
    }

    this.phase = nextPhase;
    this.targetEndTime = Date.now() + this.totalDurationSec * 1000;
    this.state = "running";

    if (prevPhase === "focus") {
      this.flushQueuedNotifications();
    }

    this.onPhaseEndCallback?.(prevPhase, nextPhase);
    this.notify();
  }

  // ==========================================
  // Getters & Status
  // ==========================================

  public getMode(): TimerMode {
    return this.mode;
  }

  public getState(): TimerState {
    return this.state;
  }

  public getPhase(): PomodoroPhase {
    return this.phase;
  }

  public getLabel(): string {
    return this.label;
  }

  public setLabel(val: string): void {
    this.label = val;
    this.saveState();
  }

  public getPomodoroCount(): number {
    return this.pomodoroCount;
  }

  public configurePomodoro(config: Partial<PomodoroConfig>): void {
    this.config = { ...this.config, ...config };
    this.saveState();
  }

  public getPomodoroConfig(): PomodoroConfig {
    return { ...this.config };
  }

  public isFocusModeActive(): boolean {
    return this.state === "running" && this.phase === "focus" && this.focusModeEnabled;
  }

  public setFocusModeEnabled(val: boolean): void {
    this.focusModeEnabled = val;
    this.saveState();
  }

  public getRemainingSec(): number {
    if (this.state === "paused") {
      return Math.max(0, this.remainingSecWhenPaused);
    }
    if (this.state === "idle" || this.state === "finished") {
      return 0;
    }
    if (this.mode === "stopwatch") {
      return this.stopwatchElapsedSec + Math.floor((Date.now() - this.stopwatchStartTime) / 1000);
    }
    const remMs = this.targetEndTime - Date.now();
    return Math.max(0, Math.ceil(remMs / 1000));
  }

  public getProgressPercent(): number {
    if (this.mode === "stopwatch") return 1;
    if (this.state === "idle") return 0;
    if (this.state === "finished") return 1;
    const rem = this.getRemainingSec();
    const elapsed = this.totalDurationSec - rem;
    return Math.min(1, Math.max(0, elapsed / Math.max(1, this.totalDurationSec)));
  }

  public getFormattedTime(): string {
    const sec = this.getRemainingSec();
    const mm = Math.floor(sec / 60);
    const ss = sec % 60;
    const mmStr = String(mm).padStart(2, "0");
    const ssStr = String(ss).padStart(2, "0");
    return `${mmStr}:${ssStr}`;
  }

  public getFinishedAtString(): string | null {
    return this.finishedAtTimeStr;
  }

  // ==========================================
  // Focus Notification Queuing
  // ==========================================

  public queueNotification(notif: any): void {
    this.queuedNotifications.push(notif);
  }

  public flushQueuedNotifications(): any[] {
    const list = [...this.queuedNotifications];
    this.queuedNotifications = [];
    return list;
  }

  // ==========================================
  // Focus History (Private local storage only)
  // ==========================================

  public recordFocusSession(durationSec: number, label: string = ""): void {
    if (localStorage.getItem("mintu_focus_history_enabled") === "false") {
      return;
    }
    try {
      const history = this.getFocusHistory("all");
      history.unshift({
        id: "focus-" + Date.now(),
        timestamp: Date.now(),
        durationSec,
        label: label || undefined,
        phase: this.phase,
      });
      // Keep up to 200 sessions locally
      const trimmed = history.slice(0, 200);
      localStorage.setItem("mintu_focus_history", JSON.stringify(trimmed));
    } catch {}
  }

  public getFocusHistory(range: "today" | "week" | "all"): FocusSessionRecord[] {
    try {
      const raw = localStorage.getItem("mintu_focus_history");
      const list: FocusSessionRecord[] = raw ? JSON.parse(raw) : [];
      const now = new Date();

      if (range === "today") {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        return list.filter((item) => item.timestamp >= startOfDay);
      }

      if (range === "week") {
        const dayOfWeek = now.getDay() || 7; // Monday = 1
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 1).getTime();
        return list.filter((item) => item.timestamp >= startOfWeek);
      }

      return list;
    } catch {
      return [];
    }
  }

  public deleteFocusHistory(): void {
    localStorage.removeItem("mintu_focus_history");
    this.notify();
  }

  // ==========================================
  // Persistence (LocalStorage)
  // ==========================================

  private saveState(): void {
    try {
      const data: PersistedTimerData = {
        mode: this.mode,
        state: this.state,
        phase: this.phase,
        totalDurationSec: this.totalDurationSec,
        targetEndTime: this.targetEndTime,
        remainingSecWhenPaused: this.remainingSecWhenPaused,
        stopwatchElapsedSec: this.stopwatchElapsedSec,
        stopwatchStartTime: this.stopwatchStartTime,
        label: this.label,
        pomodoroCount: this.pomodoroCount,
        focusModeEnabled: this.focusModeEnabled,
        config: this.config,
        finishedAtTimeStr: this.finishedAtTimeStr || undefined,
      };
      localStorage.setItem("mintu_active_timer", JSON.stringify(data));
    } catch {}
  }

  public loadState(): void {
    try {
      const raw = localStorage.getItem("mintu_active_timer");
      if (!raw) return;
      const data: PersistedTimerData = JSON.parse(raw);
      this.mode = data.mode || "countdown";
      this.phase = data.phase || "focus";
      this.totalDurationSec = data.totalDurationSec || 25 * 60;
      this.remainingSecWhenPaused = data.remainingSecWhenPaused || 0;
      this.label = data.label || "";
      this.pomodoroCount = data.pomodoroCount || 1;
      this.focusModeEnabled = data.focusModeEnabled !== false;
      if (data.config) this.config = { ...this.config, ...data.config };

      if (data.state === "running") {
        if (this.mode === "stopwatch") {
          this.state = "running";
          this.stopwatchElapsedSec = data.stopwatchElapsedSec || 0;
          this.stopwatchStartTime = data.stopwatchStartTime || Date.now();
        } else {
          const now = Date.now();
          if (now >= data.targetEndTime) {
            // End passed while closed/sleeping
            this.state = "finished";
            const date = new Date(data.targetEndTime);
            const hh = String(date.getHours()).padStart(2, "0");
            const mm = String(date.getMinutes()).padStart(2, "0");
            this.finishedAtTimeStr = `Timer finished at ${hh}:${mm}`;
          } else {
            this.state = "running";
            this.targetEndTime = data.targetEndTime;
          }
        }
      } else {
        this.state = data.state;
        this.finishedAtTimeStr = data.finishedAtTimeStr || null;
      }
    } catch {}
  }

  // ==========================================
  // Developer Panel Helpers
  // ==========================================

  public fastForward(scaleFactor: number): void {
    if (this.state === "running" && this.targetEndTime > 0) {
      const rem = (this.targetEndTime - Date.now()) / scaleFactor;
      this.targetEndTime = Date.now() + rem;
      this.notify();
    }
  }

  public triggerEndNow(): void {
    if (this.state === "running" || this.state === "paused") {
      this.targetEndTime = Date.now() - 1000;
      this.tick();
    }
  }

  public forcePhase(phase: PomodoroPhase): void {
    this.phase = phase;
    if (phase === "focus") {
      this.totalDurationSec = this.config.focusDurationSec;
    } else if (phase === "short_break") {
      this.totalDurationSec = this.config.shortBreakSec;
    } else {
      this.totalDurationSec = this.config.longBreakSec;
    }
    this.targetEndTime = Date.now() + this.totalDurationSec * 1000;
    this.state = "running";
    this.notify();
  }
}

export const timerEngine = TimerEngine.getInstance();
