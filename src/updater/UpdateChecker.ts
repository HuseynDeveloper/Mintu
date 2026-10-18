/**
 * Mintu Auto-Update Checker (Milestone 8)
 * Checks GitHub Releases for new Mintu versions and notifies the user gently.
 */

import { eventBus } from "../core/EventBus.ts";

export interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  releaseNotes?: string;
  publishedAt?: string;
}

export class UpdateChecker {
  public static readonly CURRENT_VERSION = "0.1.2";
  public static readonly GITHUB_REPO = "HuseynDeveloper/Mintu";

  private lastCheckTime: number = 0;
  private cachedUpdate: UpdateInfo | null = null;

  constructor() {
    // Check for updates on startup (after 5 seconds delay)
    if (typeof window !== "undefined") {
      setTimeout(() => {
        this.checkSilently();
      }, 5000);
    }
  }

  public async checkSilently(): Promise<UpdateInfo | null> {
    try {
      const update = await this.checkForUpdates();
      if (update.available) {
        eventBus.emit("app:update-available", update);
      }
      return update;
    } catch {
      return null;
    }
  }

  public async checkForUpdates(): Promise<UpdateInfo> {
    this.lastCheckTime = Date.now();

    const url = `https://api.github.com/repos/${UpdateChecker.GITHUB_REPO}/releases/latest`;
    const resp = await fetch(url, {
      headers: {
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (resp.status === 404) {
      const current = UpdateChecker.CURRENT_VERSION;
      const result: UpdateInfo = {
        available: false,
        currentVersion: current,
        latestVersion: current,
        releaseUrl: `https://github.com/${UpdateChecker.GITHUB_REPO}/releases`,
        releaseNotes: "Mintu ən son versiyadadır.",
      };
      this.cachedUpdate = result;
      return result;
    }

    if (!resp.ok) {
      throw new Error(`GitHub API returned status ${resp.status}`);
    }

    const data = await resp.json();
    const tagName: string = data.tag_name || "";
    const cleanLatest = tagName.replace(/^v/i, "").trim();
    const cleanCurrent = UpdateChecker.CURRENT_VERSION.replace(/^v/i, "").trim();

    const isNewer = this.compareSemver(cleanLatest, cleanCurrent) > 0;

    const result: UpdateInfo = {
      available: isNewer,
      currentVersion: UpdateChecker.CURRENT_VERSION,
      latestVersion: cleanLatest,
      releaseUrl: data.html_url || `https://github.com/${UpdateChecker.GITHUB_REPO}/releases`,
      releaseNotes: data.body || "",
      publishedAt: data.published_at || "",
    };

    this.cachedUpdate = result;
    return result;
  }

  public getCachedUpdate(): UpdateInfo | null {
    return this.cachedUpdate;
  }

  public getLastCheckTime(): number {
    return this.lastCheckTime;
  }

  public compareSemver(v1: string, v2: string): number {
    const p1 = v1.split(".").map((x) => parseInt(x, 10) || 0);
    const p2 = v2.split(".").map((x) => parseInt(x, 10) || 0);

    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const num1 = p1[i] || 0;
      const num2 = p2[i] || 0;
      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }
    return 0;
  }
}

export const updateChecker = new UpdateChecker();
