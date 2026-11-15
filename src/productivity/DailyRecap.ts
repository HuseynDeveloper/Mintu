/**
 * DailyRecap.ts
 * Tracks daily developer productivity and generates zero-emoji progress summaries
 * suitable for sharing on LinkedIn, Bluesky, Twitter/X, and Telegram.
 */

export interface DailyStats {
  date: string; // YYYY-MM-DD
  messagesSent: number;
  focusMinutes: number;
  filesProcessed: number;
  xpEarned: number;
}

export class DailyRecapManager {
  private static readonly STORAGE_KEY = "mintu_daily_productivity";
  private memoryCache: DailyStats | null = null;

  private getTodayKey(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  public getTodayStats(): DailyStats {
    const today = this.getTodayKey();
    if (this.memoryCache && this.memoryCache.date === today) {
      return this.memoryCache;
    }

    try {
      if (typeof localStorage !== "undefined") {
        const raw = localStorage.getItem(DailyRecapManager.STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.date === today) {
            this.memoryCache = parsed;
            return parsed;
          }
        }
      }
    } catch {
      // Fallback
    }

    const initial: DailyStats = {
      date: today,
      messagesSent: 0,
      focusMinutes: 0,
      filesProcessed: 0,
      xpEarned: 0,
    };
    this.saveStats(initial);
    return initial;
  }

  private saveStats(stats: DailyStats): void {
    this.memoryCache = stats;
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(DailyRecapManager.STORAGE_KEY, JSON.stringify(stats));
      }
    } catch {
      // Ignore
    }
  }

  public recordMessage(): void {
    const stats = this.getTodayStats();
    stats.messagesSent += 1;
    this.saveStats(stats);
  }

  public recordFocus(minutes: number): void {
    const stats = this.getTodayStats();
    stats.focusMinutes += minutes;
    this.saveStats(stats);
  }

  public recordFileProcessed(): void {
    const stats = this.getTodayStats();
    stats.filesProcessed += 1;
    this.saveStats(stats);
  }

  public recordXP(amount: number): void {
    const stats = this.getTodayStats();
    stats.xpEarned += amount;
    this.saveStats(stats);
  }

  public generateRecapMarkdown(petLevel: number = 1): string {
    const s = this.getTodayStats();
    return [
      `### Mintu Gunluk Inkisaf Hesabati (${s.date})`,
      "",
      `* Fokus vaxti: ${s.focusMinutes} deqiqe`,
      `* Mesajlar ve analiz sorgulari: ${s.messagesSent}`,
      `* Emal olunan fayllar (NotchDrop): ${s.filesProcessed}`,
      `* Qazanilan XP: +${s.xpEarned} XP (Seviyye: Lvl ${petLevel})`,
      `* Masadustu komekcisi: Mintu v0.2.3.1`,
      "",
      `Layihe haqqinda: https://github.com/HuseynDeveloper/Mintu`,
    ].join("\n");
  }
}

export const dailyRecapManager = new DailyRecapManager();
