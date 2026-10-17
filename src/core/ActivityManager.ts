/**
 * ActivityManager
 * Central state orchestration stack for Mintu Dynamic Island.
 * Priority order:
 *  - urgent_notif (100)
 *  - consent_or_context (80)
 *  - chat_active (60)
 *  - download_progress (50)
 *  - normal_notif (40)
 *  - music_active (30)
 *  - idle (10)
 *  - collapsed (0)
 */

export type ActivityType =
  | "urgent_notif"
  | "tool_approval"
  | "context_card"
  | "consent_card"
  | "reading"
  | "translate_card"
  | "chat_active"
  | "download_progress"
  | "normal_notif"
  | "running_timer"
  | "music_active"
  | "status_widgets"
  | "idle"
  | "collapsed";

export interface ActivityItem {
  id: string;
  type: ActivityType;
  priority: number;
  islandState: string;
  petState?: string;
  payload?: any;
  autoDismissMs?: number;
}

const ACTIVITY_PRIORITIES: Record<ActivityType, number> = {
  urgent_notif: 100,
  tool_approval: 85,
  context_card: 80,
  consent_card: 80,
  reading: 80,
  translate_card: 80,
  chat_active: 70,
  download_progress: 60,
  normal_notif: 50,
  running_timer: 40,
  music_active: 30,
  status_widgets: 20,
  idle: 10,
  collapsed: 0,
};

export class ActivityManager {
  private stack: ActivityItem[] = [];
  private activeItem: ActivityItem | null = null;
  private autoDismissTimer: number | null = null;

  public onStateTransition?: (item: ActivityItem) => void;

  constructor() {
    // Default base activity is idle
    this.push({
      id: "base_idle",
      type: "idle",
      priority: ACTIVITY_PRIORITIES.idle,
      islandState: "idle",
      petState: "idle",
    });
  }

  push(item: Omit<ActivityItem, "priority"> & { priority?: number }): void {
    const fullItem: ActivityItem = {
      ...item,
      priority: item.priority ?? ACTIVITY_PRIORITIES[item.type] ?? 10,
    };

    // Remove existing item with same id
    this.stack = this.stack.filter((i) => i.id !== fullItem.id);
    this.stack.push(fullItem);
    this.stack.sort((a, b) => b.priority - a.priority);

    this.evaluateTop();
  }

  remove(id: string): void {
    this.stack = this.stack.filter((i) => i.id !== id);
    if (this.activeItem?.id === id) {
      if (this.autoDismissTimer) {
        clearTimeout(this.autoDismissTimer);
        this.autoDismissTimer = null;
      }
    }
    this.evaluateTop();
  }

  removeByType(type: ActivityType): void {
    this.stack = this.stack.filter((i) => i.type !== type);
    this.evaluateTop();
  }

  dismissCurrent(): void {
    if (this.activeItem && this.activeItem.id !== "base_idle") {
      this.remove(this.activeItem.id);
    }
  }

  getCurrent(): ActivityItem | null {
    return this.activeItem;
  }

  private isMintuOutside: boolean = false;
  private dismissRemainingMs: number = 0;
  private dismissStartTime: number = 0;

  public setMintuOutside(outside: boolean): void {
    this.isMintuOutside = outside;
    this.evaluateTop();
  }

  public getMintuOutside(): boolean {
    return this.isMintuOutside;
  }

  public pauseAutoDismiss(): void {
    if (this.autoDismissTimer && this.activeItem?.autoDismissMs) {
      clearTimeout(this.autoDismissTimer);
      this.autoDismissTimer = null;
      const elapsed = Date.now() - this.dismissStartTime;
      this.dismissRemainingMs = Math.max(1000, this.activeItem.autoDismissMs - elapsed);
    }
  }

  public resumeAutoDismiss(): void {
    if (!this.autoDismissTimer && this.activeItem && this.dismissRemainingMs > 0) {
      const topId = this.activeItem.id;
      this.dismissStartTime = Date.now();
      this.autoDismissTimer = window.setTimeout(() => {
        this.remove(topId);
      }, this.dismissRemainingMs);
    }
  }

  private evaluateTop(): void {
    const top = this.stack[0] || {
      id: "fallback_idle",
      type: "idle",
      priority: 10,
      islandState: "idle",
      petState: "idle",
    };

    let targetIslandState = top.islandState;
    if (this.isMintuOutside && (top.type === "idle" || top.type === "collapsed")) {
      targetIslandState = "empty-pill";
    }

    const effectiveItem: ActivityItem = {
      ...top,
      islandState: targetIslandState,
    };

    if (this.activeItem?.id !== top.id || this.activeItem?.islandState !== targetIslandState) {
      this.activeItem = effectiveItem;

      if (this.autoDismissTimer) {
        clearTimeout(this.autoDismissTimer);
        this.autoDismissTimer = null;
      }

      if (top.autoDismissMs && top.autoDismissMs > 0) {
        this.dismissStartTime = Date.now();
        this.dismissRemainingMs = top.autoDismissMs;
        this.autoDismissTimer = window.setTimeout(() => {
          this.remove(top.id);
        }, top.autoDismissMs);
      }

      if (this.onStateTransition) {
        this.onStateTransition(effectiveItem);
      }
    }
  }
}

export const activityManager = new ActivityManager();
