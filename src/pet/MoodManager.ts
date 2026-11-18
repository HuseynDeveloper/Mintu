/**
 * Mintu Pet Mood Manager
 * Pure event-driven desktop pet mood state (music, focus timer, notifications, idle).
 */

import { eventBus } from "../core/EventBus";

export type PetMood =
  | "calm"
  | "cheerful"
  | "sleepy"
  | "curious"
  | "focused"
  | "worried"
  | "proud";

export interface MoodState {
  mood: PetMood;
  reason: string;
  updatedAt: number;
}

export class MoodManager {
  private currentMood: PetMood = "calm";
  private lastReason: string = "Initialized in calm state";
  private lastUpdated: number = Date.now();
  private moodEnabled: boolean = true;
  private quietMode: boolean = false;

  private lastActiveTimestamp: number = Date.now();
  private lastHappyHopTimestamp: number = 0;
  private isMusicPlaying: boolean = false;
  private idleCheckTimer: number | null = null;

  constructor() {
    this.loadSettings();
    this.setupEventListeners();
    this.startIdleMonitor();
  }

  private loadSettings(): void {
    const savedEnabled = localStorage.getItem("mintu_mood_enabled");
    if (savedEnabled !== null) {
      this.moodEnabled = savedEnabled === "true";
    }
    const savedQuiet = localStorage.getItem("mintu_quiet_mode");
    if (savedQuiet !== null) {
      this.quietMode = savedQuiet === "true";
    }
  }

  public isMoodEnabled(): boolean {
    return this.moodEnabled;
  }

  public setMoodEnabled(enabled: boolean): void {
    this.moodEnabled = enabled;
    localStorage.setItem("mintu_mood_enabled", String(enabled));
    if (!enabled) {
      this.setMood("calm", "Mood system disabled by user", true);
    }
  }

  public isQuietMode(): boolean {
    return this.quietMode;
  }

  public setQuietMode(quiet: boolean): void {
    this.quietMode = quiet;
    localStorage.setItem("mintu_quiet_mode", String(quiet));
  }

  public getMoodState(): MoodState {
    return {
      mood: this.currentMood,
      reason: this.lastReason,
      updatedAt: this.lastUpdated,
    };
  }

  public setMood(mood: PetMood, reason: string, force: boolean = false): void {
    if (!this.moodEnabled && !force) return;
    this.currentMood = mood;
    this.lastReason = reason;
    this.lastUpdated = Date.now();
    this.applyMoodAnimation(mood);
  }

  private applyMoodAnimation(mood: PetMood): void {
    if (!this.moodEnabled) return;
    let targetPose = "idle";
    switch (mood) {
      case "calm": targetPose = "idle"; break;
      case "cheerful": targetPose = "happy"; break;
      case "sleepy": targetPose = "sleep"; break;
      case "curious": targetPose = "curious"; break;
      case "focused": targetPose = "headphones-focus"; break;
      case "worried": targetPose = "alert"; break;
      case "proud": targetPose = "dance"; break;
    }
    eventBus.emit("pet:action", { type: "state", payload: targetPose });
  }

  public triggerHappyHop(reason: string = "Happy reaction"): void {
    if (!this.moodEnabled) return;
    const now = Date.now();
    if (now - this.lastHappyHopTimestamp < 25000) return;
    this.lastHappyHopTimestamp = now;
    this.setMood("cheerful", reason);
    eventBus.emit("pet:action", { type: "state", payload: "happy" });
    setTimeout(() => {
      if (this.currentMood === "cheerful") {
        this.setMood("calm", "Returned to calm idle state");
      }
    }, 3200);
  }

  public recordActivity(): void {
    const wasSleepy = this.currentMood === "sleepy";
    this.lastActiveTimestamp = Date.now();
    if (wasSleepy) {
      this.setMood("calm", "User returned from idle");
      eventBus.emit("pet:action", { type: "state", payload: "wake" });
      setTimeout(() => {
        if (this.currentMood === "calm") {
          eventBus.emit("pet:action", { type: "state", payload: "idle" });
        }
      }, 1800);
    }
  }

  private setupEventListeners(): void {
    const syncMusic = (state: any) => {
      const playing = Boolean(state && state.is_playing);
      this.isMusicPlaying = playing;
      if (playing) {
        this.lastActiveTimestamp = Date.now();
        this.setMood("proud", "Dancing to music");
      } else if (this.currentMood === "proud" || this.currentMood === "cheerful") {
        this.setMood("calm", "Music paused");
      }
    };

    eventBus.on("media-state-changed", syncMusic);
    eventBus.on("music:ambient-update", syncMusic);

    eventBus.on("island:notification-appeared", () => {
      this.recordActivity();
      this.setMood("curious", "Notification arrived");
    });

    eventBus.on("gamification:xp-gained", () => {
      this.recordActivity();
      this.triggerHappyHop("XP earned");
    });
  }

  private startIdleMonitor(): void {
    if (this.idleCheckTimer) clearInterval(this.idleCheckTimer);
    this.idleCheckTimer = window.setInterval(() => {
      if (!this.moodEnabled || this.isMusicPlaying) return;
      const idleMs = Date.now() - this.lastActiveTimestamp;
      if (idleMs > 10 * 60 * 1000 && this.currentMood !== "sleepy") {
        this.setMood("sleepy", "Idle for 10+ minutes");
      }
    }, 30000);
  }
}

export const moodManager = new MoodManager();
