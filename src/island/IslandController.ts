/**
 * Dynamic Island Controller
 * Liquid spring physics morphing of width, height, corner radius.
 * Coordinates slot transitions and pet synchronization.
 */

import { Spring1D, SpringPresets } from "../pet/physics/Spring";
import { PetRenderer } from "../pet/PetRenderer";
import { AnimationController } from "../pet/AnimationController";
import { IslandContentRenderer, NotificationPayload } from "./IslandContent";
import { eventBus } from "../core/EventBus";
import { appBridge } from "../core/AppBridge";

export interface IslandDimensions {
  width: number;
  height: number;
  radius: number;
}

export const IslandDimensionsPresets: Record<string, IslandDimensions> = {
  collapsed: { width: 126, height: 38, radius: 19 },
  idle: { width: 172, height: 44, radius: 22 },
  peek: { width: 184, height: 48, radius: 24 },
  docking: { width: 180, height: 48, radius: 24 },
  "empty-pill": { width: 88, height: 26, radius: 13 },
  notification: { width: 376, height: 58, radius: 29 },
  "notification-actions": { width: 376, height: 114, radius: 28 },
  expanded: { width: 360, height: 260, radius: 28 },
  "expanded-large": { width: 440, height: 440, radius: 26 },
  timer: { width: 340, height: 54, radius: 27 },
  music: { width: 348, height: 58, radius: 28 },
  consent: { width: 380, height: 290, radius: 28 },
  context: { width: 370, height: 114, radius: 28 },
  blocked: { width: 320, height: 76, radius: 26 },
  "answer-ready": { width: 190, height: 44, radius: 22 },
  reading: { width: 280, height: 48, radius: 24 },
  translate: { width: 400, height: 260, radius: 28 },
  "tool-approval": { width: 380, height: 114, radius: 28 },
  "cloud-consent": { width: 380, height: 260, radius: 28 },
};

export class IslandController {
  public readonly el: HTMLElement;
  public readonly content: IslandContentRenderer;
  private petRenderer: PetRenderer;
  private animController: AnimationController;

  private currentState: string = "idle";
  private springWidth = new Spring1D(172, SpringPresets.liquid);
  private springHeight = new Spring1D(44, SpringPresets.liquid);
  private springRadius = new Spring1D(22, SpringPresets.liquid);

  private notifTimeout: number | null = null;
  public isHovered: boolean = false;

  constructor(petRenderer: PetRenderer, animController: AnimationController) {
    this.petRenderer = petRenderer;
    this.animController = animController;

    this.el = document.createElement("div");
    this.el.className = "mintu-island";
    this.el.style.width = "172px";
    this.el.style.height = "44px";
    this.el.style.borderRadius = "22px";
    this.content = new IslandContentRenderer();
    this.el.appendChild(this.content.container);

    // Wire content dynamic resize & collapse
    this.content.onRequestResize = (w: number, h: number) => {
      if (this.currentState.startsWith("expanded") || this.currentState === "translate") {
        this.springWidth.setTarget(w);
        this.springHeight.setTarget(h);
      }
    };
    this.content.onRequestCollapse = () => {
      this.setState("idle");
    };

    // Esc collapses expanded island or resets to idle
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (
          this.currentState.startsWith("expanded") ||
          this.currentState === "context" ||
          this.currentState === "notification" ||
          this.currentState === "translate" ||
          this.currentState === "reading" ||
          this.currentState === "tool-approval" ||
          this.currentState === "cloud-consent"
        ) {
          if (this.currentState === "tool-approval") {
            eventBus.emit("island:tool_approval_dismissed", {});
          }
          this.content.onRequestCollapse?.();
          this.setState("idle");
        }
      }
    });

    // Mount pill pet renderer
    this.petRenderer.container.classList.add("island-pet");
    this.el.appendChild(this.petRenderer.container);

    // Listen to state transition requests from ActivityManager or other modules
    eventBus.on("island:request-state", (state: string) => {
      this.setState(state);
    });

    eventBus.on("settings:outside-behavior-changed", () => {
      if (this.isMintuOutside) {
        this.setOutside(true);
      }
    });

    this.setupInteractions();
    this.setState("expanded");
  }

  private setupInteractions(): void {
    // Hover peek behavior
    this.el.addEventListener("mouseenter", () => {
      this.isHovered = true;
      if (this.currentState === "idle" || this.currentState === "collapsed") {
        this.setState("peek");
      }
    });

    this.el.addEventListener("mouseleave", () => {
      this.isHovered = false;
      if (this.currentState === "peek") {
        this.setState("idle");
      }
    });

    // Click on island (e.g. idle -> expand AI chat, or collapsed -> idle)
    this.el.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      // Don't expand/collapse if clicking inside interactive buttons or inputs or notification
      if (
        target.closest(".notif-btn") ||
        target.closest(".slot-notification") ||
        target.closest(".music-btn") ||
        target.closest(".chip-btn") ||
        target.closest("button") ||
        target.closest("input") ||
        target.closest("select") ||
        target.closest("textarea") ||
        target.closest(".slot-expanded")
      ) {
        return;
      }

      if (this.isMintuOutside || this.currentState === "empty-pill") {
        eventBus.emit("app:toggle-mode", {});
        return;
      }

      if (this.currentState === "idle" || this.currentState === "peek") {
        this.setState("expanded");
      } else if (this.currentState === "collapsed") {
        this.setState("idle");
      }
    });

    // Handle notification button actions
    this.el.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest(".notif-btn") as HTMLElement;
      if (btn && btn.dataset.actionId) {
        eventBus.emit("island:notification-action", { actionId: btn.dataset.actionId });
        this.setState("idle");
      }
    });
  }

  getState(): string {
    return this.currentState;
  }

  setState(name: string): void {
    const prev = this.currentState;
    this.currentState = name;

    const targetDims = IslandDimensionsPresets[name] || IslandDimensionsPresets.idle;
    this.springWidth.setTarget(targetDims.width);
    this.springHeight.setTarget(targetDims.height);
    this.springRadius.setTarget(targetDims.radius);

    // Update content slots
    const slotKey = name === "notification-actions" ? "notification" : name;
    this.content.showSlot(slotKey);

    // Sync Pet state to Island state
    this.syncPetToIslandState(name);

    if (name.startsWith("expanded")) {
      appBridge.focusMainWindow();
    }

    eventBus.emit("island:state-change", { from: prev, to: name });
  }

  notify(payload: NotificationPayload): void {
    this.content.setNotification(payload);

    if (this.notifTimeout) clearTimeout(this.notifTimeout);

    const hasActions = payload.actions && payload.actions.length > 0;
    const targetState = hasActions ? "notification-actions" : "notification";

    this.setState(targetState);

    // Auto-dismiss after 6.5s if not clicked
    this.notifTimeout = window.setTimeout(() => {
      if (this.currentState.startsWith("notification")) {
        this.setState("idle");
      }
    }, 6500);
  }

  private syncPetToIslandState(islandState: string): void {
    switch (islandState) {
      case "collapsed":
        this.animController.setState("sleep", 0.4);
        break;
      case "idle":
        this.animController.setState("idle", 0.3);
        break;
      case "peek":
        this.animController.setState("curious", 0.2);
        break;
      case "notification":
        this.animController.setState("alert", 0.2);
        break;
      case "notification-actions":
        this.animController.setState("think", 0.25);
        break;
      case "expanded":
        this.animController.setState("think", 0.3);
        break;
      case "timer":
        this.animController.setState("headphones-focus", 0.3);
        break;
      case "music":
        this.animController.setState("dance", 0.3);
        break;
      case "consent":
        this.animController.setState("curious", 0.3);
        break;
      case "context":
        this.animController.setState("think", 0.3);
        break;
      case "blocked":
        this.animController.setState("alert", 0.2);
        break;
      case "answer-ready":
        this.animController.setState("happy", 0.25);
        break;
      case "reading":
        this.animController.setState("think", 0.3);
        break;
      case "translate":
        this.animController.setState("curious", 0.3);
        break;
      case "tool-approval":
        this.animController.setState("curious", 0.3);
        break;
      case "cloud-consent":
        this.animController.setState("curious", 0.3);
        break;
      default:
        this.animController.setState("idle");
    }
  }

  private isMintuOutside: boolean = false;

  setOutside(outside: boolean): void {
    this.isMintuOutside = outside;
    const petAnchor = this.petRenderer.container;
    if (outside) {
      petAnchor.style.display = "none";
      const outsideSetting = localStorage.getItem("mintu_outside_behavior") || localStorage.getItem("mintu_island_outside_mode") || "empty-pill";
      if (outsideSetting === "hide" || outsideSetting === "hidden") {
        this.el.classList.add("hidden-outside");
      } else {
        this.el.classList.remove("hidden-outside");
        this.el.classList.add("empty-outside");
        this.setState("empty-pill");
      }
    } else {
      petAnchor.style.display = "inline-flex";
      this.el.classList.remove("hidden-outside", "empty-outside", "docking-ready");
      this.setState("idle");
    }
  }

  setDockingReady(ready: boolean): void {
    if (ready) {
      this.el.classList.add("docking-ready");
      this.setState("docking");
    } else {
      this.el.classList.remove("docking-ready");
      if (this.isMintuOutside) {
        this.setState("empty-pill");
      } else {
        this.setState("idle");
      }
    }
  }

  triggerPopRipple(): void {
    this.el.classList.remove("island-pop-ripple");
    void this.el.offsetWidth; // trigger reflow
    this.el.classList.add("island-pop-ripple");
    setTimeout(() => this.el.classList.remove("island-pop-ripple"), 450);
  }

  triggerDockEnterOvershoot(): void {
    this.springWidth.velocity = 600;
    this.springHeight.velocity = -250;
    this.triggerPopRipple();
  }

  update(dtSec: number): void {
    this.springWidth.update(dtSec);
    this.springHeight.update(dtSec);
    this.springRadius.update(dtSec);

    const w = this.springWidth.value;
    const h = this.springHeight.value;
    const r = this.springRadius.value;

    this.el.style.width = `${w.toFixed(1)}px`;
    this.el.style.height = `${h.toFixed(1)}px`;
    this.el.style.borderRadius = `${r.toFixed(1)}px`;
  }
}
