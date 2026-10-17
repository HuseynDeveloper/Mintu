/**
 * Mintu Mood Manager (Milestone 5 Part 3)
 * Derived ONLY from app events. Never changes answers, never stored as a trait,
 * never sent to AI providers or written to memory.
 */

import { PetMood, MoodState } from "./types";
import { eventBus } from "../core/EventBus";

export class MoodManager {
  private currentMood: PetMood = "calm";
  private lastReason: string = "App initialized in calm state";
  private lastUpdated: number = Date.now();
  private moodEnabled: boolean = true;
  private quietMode: boolean = false;

  private lastActiveTimestamp: number = Date.now();
  private lastHappyHopTimestamp: number = 0;
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

    // Trigger pet animation mapping through event bus
    this.applyMoodAnimation(mood);
  }

  private applyMoodAnimation(mood: PetMood): void {
    if (!this.moodEnabled) return;

    let targetPose = "idle";
    switch (mood) {
      case "calm":
        targetPose = "idle";
        break;
      case "cheerful":
        targetPose = "happy";
        break;
      case "sleepy":
        targetPose = "sleep";
        break;
      case "curious":
        targetPose = "curious";
        break;
      case "focused":
        targetPose = "think";
        break;
      case "worried":
        targetPose = "alert";
        break;
      case "proud":
        targetPose = "dance";
        break;
    }

    eventBus.emit("pet:action", { type: "state", payload: targetPose });

    // In non-quiet mode, small occasional speech bubble (never interrupting active tasks)
    if (!this.quietMode && mood === "worried") {
      eventBus.emit("pet:say", { text: "Something went wrong... let's check it!" });
    }
  }

  /**
   * Small happy hop after successful actions (randomized, rate-limited: max once per 30 seconds).
   */
  public triggerHappyHop(reason: string = "Task completed successfully"): void {
    if (!this.moodEnabled) return;

    const now = Date.now();
    if (now - this.lastHappyHopTimestamp < 30000) {
      return; // Rate limit hops
    }

    // 60% probability for hop
    if (Math.random() < 0.6) {
      this.lastHappyHopTimestamp = now;
      this.setMood("cheerful", reason);
      eventBus.emit("pet:action", { type: "state", payload: "happy" });
      setTimeout(() => {
        if (this.currentMood === "cheerful") {
          this.setMood("calm", "Returned to calm idle state");
        }
      }, 3500);
    }
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
      }, 2000);
    }
  }

  private setupEventListeners(): void {
    // Media play/pause events
    eventBus.on("media-state-changed", (state: any) => {
      this.recordActivity();
      if (state && state.status === "playing") {
        this.setMood("cheerful", "Listening to music");
      }
    });

    // Model download events
    eventBus.on("model-download-progress", (p: any) => {
      if (p.status === "completed") {
        this.setMood("proud", `Model ${p.model_id} downloaded and verified`);
      } else if (p.status === "error") {
        this.setMood("worried", `Model download failed: ${p.error || "Unknown error"}`);
      }
    });

    // Window activity
    if (typeof window !== "undefined") {
      window.addEventListener("mousemove", () => this.recordActivity(), { passive: true });
      window.addEventListener("keydown", () => this.recordActivity(), { passive: true });
    }
  }

  private startIdleMonitor(): void {
    if (this.idleCheckTimer) clearInterval(this.idleCheckTimer);

    // Check idle every 30 seconds
    this.idleCheckTimer = window.setInterval(() => {
      if (!this.moodEnabled) return;

      const idleDuration = Date.now() - this.lastActiveTimestamp;
      // 10 minutes (600,000 ms) idle -> sleepy
      if (idleDuration > 600000 && this.currentMood !== "sleepy") {
        this.setMood("sleepy", "Pet took a peaceful nap after 10m of quiet idle time");
      }
    }, 30000);
  }
}

export const moodManager = new MoodManager();
