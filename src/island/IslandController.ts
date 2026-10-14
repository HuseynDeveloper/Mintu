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

export interface IslandDimensions {
  width: number;
  height: number;
  radius: number;
}

export const IslandDimensionsPresets: Record<string, IslandDimensions> = {
  collapsed: { width: 126, height: 38, radius: 19 },
  idle: { width: 172, height: 44, radius: 22 },
  peek: { width: 184, height: 48, radius: 24 },
  notification: { width: 340, height: 54, radius: 27 },
  "notification-actions": { width: 360, height: 114, radius: 28 },
  expanded: { width: 350, height: 280, radius: 32 },
  timer: { width: 340, height: 54, radius: 27 },
  music: { width: 348, height: 54, radius: 27 },
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
    this.content = new IslandContentRenderer();
    this.el.appendChild(this.content.container);

    // Mount pill pet renderer
    this.petRenderer.container.classList.add("island-pet");
    this.el.appendChild(this.petRenderer.container);

    this.setupInteractions();
    this.setState("idle");
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
      // Don't expand if clicking specific action or music buttons
      if (target.closest(".notif-btn") || target.closest(".music-btn") || target.closest(".chip-btn")) {
        return;
      }

      if (this.currentState === "idle" || this.currentState === "peek") {
        this.setState("expanded");
      } else if (this.currentState === "expanded") {
        // Clicking header area collapses back
        if (target.closest(".expanded-top-row") || target === this.el) {
          this.setState("idle");
        }
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
      default:
        this.animController.setState("idle");
    }
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
