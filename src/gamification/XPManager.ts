/**
 * Mintu Gamification & XP Engine (Milestone 8)
 * Manages experience points (XP), pet leveling, focus streak tracking,
 * and unlocks accessories for Pomodoro study and productive work.
 */

import { eventBus } from "../core/EventBus.ts";

export interface PetStats {
  totalXP: number;
  level: number;
  pomodorosCompleted: number;
  focusMinutes: number;
  streakDays: number;
  lastActiveDate: string; // YYYY-MM-DD
  unlockedAccessories: string[];
  equippedAccessory: string;
}

export interface LevelProgress {
  level: number;
  totalXP: number;
  xpInLevel: number;
  xpNeededForLevel: number;
  progressPercent: number;
}

export class XPManager {
  private stats: PetStats;

  constructor() {
    this.stats = this.loadStats();
    this.checkDailyStreak();
    this.initListeners();
  }

  private loadStats(): PetStats {
    try {
      const raw = localStorage.getItem("mintu_pet_stats");
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          totalXP: parsed.totalXP || 0,
          level: parsed.level || this.calcLevel(parsed.totalXP || 0),
          pomodorosCompleted: parsed.pomodorosCompleted || 0,
          focusMinutes: parsed.focusMinutes || 0,
          streakDays: parsed.streakDays || 1,
          lastActiveDate: parsed.lastActiveDate || this.getTodayDateString(),
          unlockedAccessories: Array.isArray(parsed.unlockedAccessories)
            ? parsed.unlockedAccessories
            : ["none", "glasses"],
          equippedAccessory: parsed.equippedAccessory || "none",
        };
      }
    } catch {}

    return {
      totalXP: 0,
      level: 1,
      pomodorosCompleted: 0,
      focusMinutes: 0,
      streakDays: 1,
      lastActiveDate: this.getTodayDateString(),
      unlockedAccessories: ["none", "glasses"],
      equippedAccessory: "none",
    };
  }

  public saveStats(): void {
    try {
      localStorage.setItem("mintu_pet_stats", JSON.stringify(this.stats));
      eventBus.emit("gamification:stats-updated", this.getStats());
    } catch {}
  }

  private getTodayDateString(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  private checkDailyStreak(): void {
    const today = this.getTodayDateString();
    if (this.stats.lastActiveDate === today) return;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

    if (this.stats.lastActiveDate === yStr) {
      this.stats.streakDays += 1;
      this.addXP(25, "Daily focus streak bonus");
    } else {
      this.stats.streakDays = 1;
      this.addXP(10, "Daily active check-in");
    }

    this.stats.lastActiveDate = today;
    this.saveStats();
  }

  public calcLevel(xp: number): number {
    // Level 1: 0..99
    // Level 2: 100..399
    // Level 3: 400..899
    // Level 4: 900..1599
    // Level N: (N-1)^2 * 100
    return Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
  }

  public xpForLevel(lvl: number): number {
    if (lvl <= 1) return 0;
    return Math.pow(lvl - 1, 2) * 100;
  }

  public getProgress(): LevelProgress {
    const currentLvl = this.calcLevel(this.stats.totalXP);
    const baseXP = this.xpForLevel(currentLvl);
    const nextXP = this.xpForLevel(currentLvl + 1);
    const needed = Math.max(1, nextXP - baseXP);
    const inLvl = Math.max(0, this.stats.totalXP - baseXP);
    const pct = Math.min(100, Math.floor((inLvl / needed) * 100));

    return {
      level: currentLvl,
      totalXP: this.stats.totalXP,
      xpInLevel: inLvl,
      xpNeededForLevel: needed,
      progressPercent: pct,
    };
  }

  public addXP(amount: number, reason: string): { gained: number; totalXP: number; level: number; leveledUp: boolean } {
    if (amount <= 0) {
      return { gained: 0, totalXP: this.stats.totalXP, level: this.stats.level, leveledUp: false };
    }

    const prevLevel = this.stats.level;
    this.stats.totalXP += amount;
    const newLevel = this.calcLevel(this.stats.totalXP);
    this.stats.level = newLevel;

    const leveledUp = newLevel > prevLevel;

    // Check unlocks
    if (newLevel >= 2 && !this.stats.unlockedAccessories.includes("coffee_cup")) {
      this.stats.unlockedAccessories.push("coffee_cup");
    }
    if (newLevel >= 3 && !this.stats.unlockedAccessories.includes("winter_hat")) {
      this.stats.unlockedAccessories.push("winter_hat");
    }
    if (newLevel >= 4 && !this.stats.unlockedAccessories.includes("headphones")) {
      this.stats.unlockedAccessories.push("headphones");
    }

    this.saveStats();

    eventBus.emit("gamification:xp-gained", {
      amount,
      reason,
      totalXP: this.stats.totalXP,
      level: newLevel,
      leveledUp,
    });

    if (leveledUp) {
      eventBus.emit("pet:action", { type: "state", payload: "happy" });
      eventBus.emit("pet:say", { text: `Təbriklər! Səviyyə ${newLevel} oldun!` });
    }

    return { gained: amount, totalXP: this.stats.totalXP, level: newLevel, leveledUp };
  }

  public recordPomodoro(minutes: number): void {
    const mins = Math.max(1, Math.round(minutes));
    this.stats.pomodorosCompleted += 1;
    this.stats.focusMinutes += mins;

    // 10 XP per minute completed (e.g. 250 XP for a 25m Pomodoro)
    const gained = mins * 10;
    this.addXP(gained, `${mins} dəqiqəlik Pomodoro tamamlandı`);
  }

  public getStats(): PetStats {
    return { ...this.stats, unlockedAccessories: [...this.stats.unlockedAccessories] };
  }

  public equipAccessory(id: string): boolean {
    if (!this.stats.unlockedAccessories.includes(id) && id !== "none") {
      return false;
    }
    this.stats.equippedAccessory = id;
    this.saveStats();
    eventBus.emit("pet:accessory-changed", id);
    return true;
  }

  public getEquippedAccessory(): string {
    return this.stats.equippedAccessory || "none";
  }

  private initListeners(): void {
    eventBus.on("timer:focus-completed", (data: any) => {
      const durationSec = data?.durationSec || 1500;
      const mins = Math.max(1, Math.round(durationSec / 60));
      this.recordPomodoro(mins);
    });

    eventBus.on("chat:message-sent", () => {
      this.addXP(5, "Aktiv söhbət");
    });
  }
}

export const xpManager = new XPManager();
