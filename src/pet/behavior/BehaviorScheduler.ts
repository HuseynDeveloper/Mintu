/**
 * Autonomous Behavior Scheduler
 * Endows Mintu with living personality:
 * - Weighted autonomous state decisions (wander, sit, look around, stretch)
 * - Inactivity sleep timer (curls up to sleep when idle for a while)
 * - Perk-up on user activity return (stretches awake)
 */

import { AnimationController } from "../AnimationController";

export class BehaviorScheduler {
  private controller: AnimationController;
  private isEnabled: boolean = true;
  private lastActivityTime: number = Date.now();
  private nextDecisionTime: number = 0;
  private isFreeMode: boolean = false;

  // Inactivity timeout: falls asleep after 35 seconds of quiet
  private sleepTimeoutMs: number = 35000;
  private isNotificationActive: boolean = false;
  private stateBeforeNotification: string | null = null;
  private notificationDismissTimer: any = null;

  constructor(controller: AnimationController, isFreeMode: boolean = false) {
    this.controller = controller;
    this.isFreeMode = isFreeMode;
    this.scheduleNextDecision(4000);
  }

  setFreeMode(free: boolean): void {
    this.isFreeMode = free;
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Wake reaction when an island notification appears.
   * Priority above sleep behavior: wakes sleeping Mintu immediately, removes z particles,
   * shows alert/surprised pose (or calm idle in focus mode), and prevents sleeping while visible.
   */
  public onNotificationAppeared(isFocusMode: boolean = false): void {
    if (this.notificationDismissTimer) {
      clearTimeout(this.notificationDismissTimer);
      this.notificationDismissTimer = null;
    }

    const currentState = this.controller.getStateName();
    if (currentState === "sleep" || currentState === "wake") {
      this.stateBeforeNotification = "sleep";
    } else {
      this.stateBeforeNotification = currentState;
    }

    this.isNotificationActive = true;
    this.lastActivityTime = Date.now();

    if (isFocusMode) {
      this.controller.setState("idle");
    } else {
      this.controller.setState("alert");
    }
  }

  /**
   * Restore state after notification is dismissed or times out.
   */
  public onNotificationDismissed(): void {
    this.isNotificationActive = false;
    this.lastActivityTime = Date.now();

    if (this.notificationDismissTimer) {
      clearTimeout(this.notificationDismissTimer);
    }

    this.notificationDismissTimer = setTimeout(() => {
      this.notificationDismissTimer = null;
      if (this.stateBeforeNotification === "sleep") {
        this.controller.setState("sleep", 0.6);
      } else {
        this.controller.setState("idle");
      }
      this.stateBeforeNotification = null;
    }, 1500);
  }

  notifyUserActivity(): void {
    const now = Date.now();
    const wasSleeping = this.controller.getStateName() === "sleep";
    this.lastActivityTime = now;

    // Perk-up if sleeping
    if (wasSleeping && this.isEnabled && !this.isNotificationActive) {
      this.controller.setState("wake");
      setTimeout(() => {
        if (this.controller.getStateName() === "wake") {
          this.controller.setState("idle");
        }
      }, 2200);
    }
  }

  update(): void {
    if (!this.isEnabled) return;
    if (this.isNotificationActive) return;

    const now = Date.now();
    const currentState = this.controller.getStateName();

    // 1. Check inactivity sleep
    if (now - this.lastActivityTime > this.sleepTimeoutMs && currentState !== "sleep" && currentState !== "dragged") {
      this.controller.setState("sleep", 0.6);
      return;
    }

    // 2. If asleep or dragged, don't trigger random wanderings
    if (currentState === "sleep" || currentState === "dragged" || currentState === "wake") {
      return;
    }

    // 3. Autonomous decisions at decision intervals
    if (now >= this.nextDecisionTime) {
      this.makeDecision();
    }
  }

  private makeDecision(): void {
    const rand = Math.random();

    if (this.isFreeMode) {
      // In Free desktop mode, Mintu can wander, look around, or sit
      if (rand < 0.40) {
        // Idle breathing
        this.controller.setState("idle");
        this.scheduleNextDecision(4000 + Math.random() * 4000);
      } else if (rand < 0.70) {
        // Walk for a brief spell
        this.controller.setState("walk");
        this.scheduleNextDecision(2500 + Math.random() * 2500);
      } else if (rand < 0.85) {
        // Curious head tilt
        this.controller.setState("curious");
        this.scheduleNextDecision(2000 + Math.random() * 2000);
      } else {
        // Happy little hop
        this.controller.setState("happy");
        this.scheduleNextDecision(1800 + Math.random() * 1500);
      }
    } else {
      // In Island mode: stays in subtle cute poses
      if (rand < 0.65) {
        this.controller.setState("idle");
        this.scheduleNextDecision(5000 + Math.random() * 5000);
      } else if (rand < 0.85) {
        this.controller.setState("curious");
        this.scheduleNextDecision(2500 + Math.random() * 2500);
      } else {
        this.controller.setState("think");
        this.scheduleNextDecision(3000 + Math.random() * 2000);
      }
    }
  }

  private scheduleNextDecision(delayMs: number): void {
    this.nextDecisionTime = Date.now() + delayMs;
  }
}
