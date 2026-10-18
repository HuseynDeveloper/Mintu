/**
 * Mintu Main Window Entry Point (Unified Overlay Architecture)
 * Combines Dynamic Island at top-center and Desktop Pet layer in one shared
 * screen-space coordinate system. Eliminates window-border clipping and ghost pet duplicates.
 *
 * Pet Location State Machine:
 * inIsland -> leaving -> free -> dragging -> approaching -> entering -> inIsland
 */

import { PetRenderer } from "./pet/PetRenderer";
import { AnimationController } from "./pet/AnimationController";
import { IslandController } from "./island/IslandController";
import { BehaviorScheduler } from "./pet/behavior/BehaviorScheduler";
import { PhysicsBody } from "./pet/physics/Gravity";
import { SpeechBubble } from "./ui/SpeechBubble";
import { FreeChatCard } from "./ui/FreeChatCard";
import { HitTester } from "./core/HitTester";
import { appBridge } from "./core/AppBridge";
import { DebugPanel } from "./ui/DebugPanel";
import { skinLoader } from "./pet/skins/SkinLoader";
import { eventBus } from "./core/EventBus";
import { activityManager } from "./core/ActivityManager";
import { xpManager } from "./gamification/XPManager";

export type PetLocation =
  | "inIsland"
  | "leaving"
  | "free"
  | "dragging"
  | "approaching"
  | "entering";

class MintuApp {
  // Island Components
  private islandPetRenderer: PetRenderer;
  private islandAnimController: AnimationController;
  private islandController: IslandController;
  private islandBehaviorScheduler: BehaviorScheduler;

  // Free Desktop Components
  private freePetRenderer: PetRenderer;
  private freeAnimController: AnimationController;
  private freePhysics: PhysicsBody;
  private freeBehaviorScheduler: BehaviorScheduler;
  private speechBubble: SpeechBubble;
  private freeChatCard: FreeChatCard;

  // Core Managers
  private hitTester: HitTester;
  private debugPanel: DebugPanel;

  // Lifecycle & State
  private lastTimeSec: number = 0;
  private isRunning: boolean = true;
  private currentMode: "island" | "free" = "island";
  private petLocation: PetLocation = "inIsland";

  // Dragging & Docking Physics
  private isPointerDown: boolean = false;
  private pointerDownPos = { x: 0, y: 0 };
  private pointerDownTime: number = 0;
  private dragFollowX: number = 0;
  private dragFollowY: number = 0;

  // Suction / Arc transitions
  private transitionStartTime: number = 0;
  private transitionDuration: number = 0.28;
  private transitionStartPos = { x: 0, y: 0 };
  private transitionStartScale: number = 1.0;
  private hasShownLandingHint: boolean = false;

  private computeGroundY(areaHeight?: number, scale?: number): number {
    const vh = window.innerHeight;
    if (areaHeight && scale && scale > 0) {
      const logicalH = Math.round(areaHeight / scale);
      return Math.max(100, Math.min(vh - 160, logicalH - 160));
    }
    return Math.max(100, vh - 160);
  }

  constructor() {
    // ==========================================
    // 1. Initialize Island & Island Pet Anchor
    // ==========================================
    this.islandPetRenderer = new PetRenderer(true);
    this.islandAnimController = new AnimationController();
    this.islandController = new IslandController(this.islandPetRenderer, this.islandAnimController);
    this.islandBehaviorScheduler = new BehaviorScheduler(this.islandAnimController, false);

    const islandViewport = document.getElementById("island-viewport")!;
    islandViewport.appendChild(this.islandController.el);

    // ==========================================
    // 2. Initialize Free Desktop Pet & Physics
    // ==========================================
    this.freePetRenderer = new PetRenderer(false);
    this.freeAnimController = new AnimationController();

    const freeViewport = document.getElementById("free-viewport")!;
    const freePetEl = this.freePetRenderer.container;
    freePetEl.style.display = "none"; // Initially hidden inside island
    freeViewport.appendChild(freePetEl);

    // Speech bubble & floating chat card
    this.speechBubble = new SpeechBubble();
    freeViewport.appendChild(this.speechBubble.el);

    this.freeChatCard = new FreeChatCard();
    freeViewport.appendChild(this.freeChatCard.el);

    // Ground level just above taskbar, strictly bound to current viewport
    const initX = Math.max(100, window.innerWidth - 180);
    const initialGroundY = this.computeGroundY();

    this.freePhysics = new PhysicsBody(initX, initialGroundY, {
      groundY: initialGroundY,
      gravity: 1900,
      bounce: 0.35,
      onLand: (impact) => {
        if (impact > 120) {
          this.freeAnimController.impactVelocity = impact;
          this.freeAnimController.setState("landing", 0.12);
          setTimeout(() => {
            if (this.freeAnimController.getStateName() === "landing") {
              this.freeAnimController.setState("idle", 0.25);
            }
          }, 550);

          if (!this.hasShownLandingHint) {
            this.hasShownLandingHint = true;
            this.speechBubble.say(
              "Masaustundəyəm! Qayitmaq ucun ustumə 2 dəfə bas, bos adaya bas və ya Ctrl+Alt+M",
              5500
            );
            this.speechBubble.updatePosition(this.freePhysics.x, this.freePhysics.y);
          }
        }
      },
    });

    this.freeBehaviorScheduler = new BehaviorScheduler(this.freeAnimController, true);

    // ==========================================
    // 3. Setup Hit-Testing for Click-Through
    // ==========================================
    this.hitTester = new HitTester("main");
    this.hitTester.register(this.islandController.el);

    // ==========================================
    // 4. Setup Developer Panel
    // ==========================================
    this.debugPanel = new DebugPanel({
      onSetPetState: (st) => {
        if (this.petLocation === "inIsland") {
          this.islandAnimController.setState(st);
        } else {
          this.freeAnimController.setState(st);
        }
      },
      onSetIslandState: (st) => this.islandController.setState(st),
      onNotify: (type) => {
        if (type === "powershell") {
          this.islandController.notify({
            appName: "Windows PowerShell",
            title: "Windows PowerShell",
            text: "Script completed with exit code 0",
          });
        } else if (type === "discord") {
          this.islandController.notify({
            appName: "Discord",
            title: "Sarah Jenkins",
            text: "Hey Mintu! Did you test the notification clicks?",
          });
        } else if (type === "chrome") {
          this.islandController.notify({
            appName: "Google Chrome",
            title: "Google Chrome",
            text: "GitHub: Pull request #42 approved",
          });
        } else if (type === "unknown") {
          this.islandController.notify({
            appName: "SystemWorker",
            title: "Task Scheduler",
            text: "Background sync finished.",
          });
        } else if (type === "actions" || type === true) {
          this.islandController.notify({
            appName: "Visual Studio Code",
            title: "Build Succeeded",
            text: "All 18 unit tests passed cleanly.",
            actions: [
              { id: "explain", label: "Explain" },
              { id: "fix", label: "Fix it", primary: true },
            ],
          });
        } else {
          this.islandController.notify({
            appName: "Discord",
            title: "Discord",
            text: "From: Sarah 'Hey there!'",
          });
        }
      },
      onSay: (text) => {
        this.speechBubble.say(text, 4500);
      },
      onToggleMode: (mode) => this.setMode(mode),
      onSetAccessory: (acc) => {
        this.islandAnimController.setAccessory(acc as any);
        this.freeAnimController.setAccessory(acc as any);
      },
      onToggleHitOverlay: () => this.hitTester.toggleDebugOverlay(),
      onToggleSlotOverlay: () => this.islandController.el.classList.toggle("island-debug-slots"),
      onForceLeaveIsland: () => this.leaveIsland(),
      onForceEnterIsland: () => this.enterIslandDirectly(),
    });

    document.body.appendChild(this.debugPanel.el);
    this.debugPanel.onVisibilityChange = (visible) => {
      if (visible) {
        this.hitTester.register(this.debugPanel.el);
      } else {
        this.hitTester.unregister(this.debugPanel.el);
      }
    };

    eventBus.on("settings:dev-panel-changed", (enabled: boolean) => {
      this.debugPanel.setDevPanelEnabled(enabled);
    });

    // ==========================================
    // 5. Interactions, Bridge & Public API
    // ==========================================
    this.setupInteractions();
    this.setupBridge();
    this.exposePublicApi();

    // Query real monitor work area to set taskbar ground level (scaled for DPI)
    appBridge.getWorkArea().then((area) => {
      if (area && area.height) {
        this.freePhysics.setGroundY(this.computeGroundY(area.height, area.scale_factor));
      }
    }).catch(() => {});

    // Milestone 8: Apply equipped accessory from wardrobe
    const initialAccessory = xpManager.getEquippedAccessory();
    if (initialAccessory && initialAccessory !== "none") {
      this.islandAnimController.setAccessory(initialAccessory as any);
      this.freeAnimController.setAccessory(initialAccessory as any);
    }

    // Ensure island stays open in expanded chat mode on startup
    this.islandController.setState("expanded");

    // ==========================================
    // 6. Start Unified 60fps Animation Loop
    // ==========================================
    this.lastTimeSec = performance.now() / 1000;
    requestAnimationFrame((t) => this.animationLoop(t / 1000));
  }

  // ==========================================
  // Island & Pet Handoff State Machine (0.3)
  // ==========================================

  private getIslandDockPos(): { x: number; y: number } {
    const b = this.islandController.el.getBoundingClientRect();
    return {
      x: b.left + 24, // Left pet anchor position inside island
      y: b.top + b.height / 2,
    };
  }

  public leaveIsland(): void {
    if (this.petLocation !== "inIsland") return;

    this.petLocation = "leaving";
    activityManager.setMintuOutside(true);

    // Anticipation squash ripple on island pill
    this.islandController.triggerPopRipple();
    this.islandController.setOutside(true);

    // Position free pet at island dock position
    const dock = this.getIslandDockPos();
    this.freePhysics.x = dock.x;
    this.freePhysics.y = dock.y;
    this.freePhysics.vx = (Math.random() - 0.5) * 80;
    this.freePhysics.vy = -380; // Pop upward along arc
    this.freePhysics.isGrounded = false;

    // Show free pet container
    const el = this.freePetRenderer.container;
    el.style.display = "inline-flex";
    el.style.transform = `translate3d(${dock.x}px, ${dock.y}px, 0)`;

    this.freeAnimController.setState("happy", 0.15);

    this.hitTester.register(el);
    this.hitTester.register(this.speechBubble.el);
    this.hitTester.register(this.freeChatCard.el);

    this.currentMode = "free";
    appBridge.setAppMode("free");
  }

  public enterIslandDirectly(): void {
    if (this.petLocation === "inIsland" || this.petLocation === "entering") return;

    this.petLocation = "entering";
    this.transitionStartTime = performance.now() / 1000;
    this.transitionDuration = 0.28;
    this.transitionStartPos = { x: this.freePhysics.x, y: this.freePhysics.y };
    this.transitionStartScale = 1.0;

    this.freeAnimController.setState("curious", 0.1);
    this.speechBubble.hide();
    this.freeChatCard.hide();

    // Island opens magnetic docking slot
    this.islandController.setDockingReady(true);
  }

  private finishEnteringIsland(): void {
    this.petLocation = "inIsland";
    activityManager.setMintuOutside(false);

    // Hide free pet container
    const el = this.freePetRenderer.container;
    el.style.display = "none";
    this.hitTester.unregister(el);
    this.hitTester.unregister(this.speechBubble.el);
    this.hitTester.unregister(this.freeChatCard.el);

    // Island settles with spring overshoot and happy wiggle
    this.islandController.setOutside(false);
    this.islandController.triggerDockEnterOvershoot();
    this.islandAnimController.setState("idle", 0.2);

    this.currentMode = "island";
    appBridge.setAppMode("island");
    this.hasShownLandingHint = false;
  }

  // ==========================================
  // Mouse & Drag Interactions (Smooth & Magnetic)
  // ==========================================

  private setupInteractions(): void {
    // Double click island to toggle between Island and Free mode
    this.islandController.el.addEventListener("dblclick", () => {
      this.toggleMode();
    });

    // Single click on empty island while Mintu is outside recalls him immediately
    this.islandController.el.addEventListener("click", (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(".slot-notification") || target.closest(".notif-btn")) {
        return;
      }
      if (this.petLocation !== "inIsland") {
        this.enterIslandDirectly();
      }
    });

    // Press Escape to recall Mintu back into the Island
    window.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Escape" && this.petLocation !== "inIsland") {
        this.enterIslandDirectly();
      }
    });

    const el = this.freePetRenderer.container;

    // Milestone 8: Playful hover reactions on free pet
    el.addEventListener("pointerenter", () => {
      if (this.petLocation === "free" && !this.isPointerDown) {
        const current = this.freeAnimController.getStateName();
        if (current === "idle" || current === "walk") {
          const reactions = ["curious", "happy", "talk"];
          const pick = reactions[Math.floor(Math.random() * reactions.length)];
          this.freeAnimController.setState(pick, 0.15);
        }
      }
    });

    el.addEventListener("pointerleave", () => {
      if (this.petLocation === "free" && !this.isPointerDown) {
        if (this.freeAnimController.getStateName() !== "dragged") {
          this.freeAnimController.setState("idle", 0.2);
        }
      }
    });

    // Pointer down: initiate free pet drag
    el.addEventListener("pointerdown", (e: PointerEvent) => {
      if (this.petLocation === "leaving" || this.petLocation === "entering") return;

      this.isPointerDown = true;
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
      this.pointerDownTime = performance.now();

      el.setPointerCapture(e.pointerId);
      el.classList.add("dragging");

      this.petLocation = "dragging";
      this.dragFollowX = this.freePhysics.x;
      this.dragFollowY = this.freePhysics.y;

      this.freePhysics.startDrag(e.clientX, e.clientY);
      this.freeAnimController.setState("dragged", 0.15);
      this.freeBehaviorScheduler.setEnabled(false);
    });

    // Pointer move: update drag with spring lag & check proximity
    window.addEventListener("pointermove", (e: PointerEvent) => {
      const nowSec = performance.now() / 1000;
      const dtSec = Math.max(0.001, nowSec - this.lastTimeSec);

      this.islandBehaviorScheduler.notifyUserActivity();
      this.freeBehaviorScheduler.notifyUserActivity();

      if (this.isPointerDown && (this.petLocation === "dragging" || this.petLocation === "approaching")) {
        this.freePhysics.updateDrag(e.clientX, e.clientY, dtSec);
        this.freeAnimController.dragVelocityX = this.freePhysics.vx;
        this.freeAnimController.dragVelocityY = this.freePhysics.vy;

        // Check proximity zone around Dynamic Island dock (120-130 px)
        const dock = this.getIslandDockPos();
        const dist = Math.hypot(e.clientX - dock.x, e.clientY - dock.y);

        if (dist < 130) {
          if (this.petLocation !== "approaching") {
            this.petLocation = "approaching";
            this.islandController.setDockingReady(true);
            this.freeAnimController.setState("curious", 0.1);
          }
        } else {
          if (this.petLocation === "approaching") {
            this.petLocation = "dragging";
            this.islandController.setDockingReady(false);
            this.freeAnimController.setState("dragged", 0.1);
          }
        }
      } else if (this.petLocation === "inIsland") {
        // Island cursor tracking
        const b = this.islandController.el.getBoundingClientRect();
        const centerX = b.left + b.width / 2;
        const centerY = b.top + b.height / 2;
        const dx = e.clientX - centerX;
        const dy = e.clientY - centerY;
        this.islandAnimController.lookAt(dx / Math.max(1, b.width / 2), dy / Math.max(1, b.height / 2));
      } else if (this.petLocation === "free") {
        // Free pet cursor tracking
        const dx = e.clientX - this.freePhysics.x;
        const dy = e.clientY - this.freePhysics.y;
        this.freeAnimController.lookAt(dx / 120, dy / 120);
      }
    });

    // Pointer up: release with suction into island or fling momentum
    el.addEventListener("pointerup", (e: PointerEvent) => {
      if (!this.isPointerDown) return;
      this.isPointerDown = false;
      el.releasePointerCapture(e.pointerId);
      el.classList.remove("dragging");

      const fling = this.freePhysics.endDrag();
      this.freeBehaviorScheduler.setEnabled(true);

      const dock = this.getIslandDockPos();
      const dist = Math.hypot(e.clientX - dock.x, e.clientY - dock.y);
      const isFlickTowardIsland = fling.vy < -400 && dist < 320;

      // Magnetic Docking into Island
      if (this.petLocation === "approaching" || dist < 130 || isFlickTowardIsland) {
        this.enterIslandDirectly();
        return;
      }

      // Quick click opens Free mode chat card
      const clickDist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
      const clickDur = performance.now() - this.pointerDownTime;
      if (clickDist < 8 && clickDur < 300) {
        this.freeChatCard.toggle();
        this.freeChatCard.updatePosition(this.freePhysics.x, this.freePhysics.y);
        return;
      }

      // Normal release: fall with gravity
      this.petLocation = "free";
    });

    // Speech bubble click opens chat card
    this.speechBubble.el.addEventListener("click", () => {
      this.freeChatCard.show();
      this.freeChatCard.updatePosition(this.freePhysics.x, this.freePhysics.y);
    });

    // Double-click on free pet jumps back to Island
    el.addEventListener("dblclick", () => {
      this.enterIslandDirectly();
    });

    // Resize handler to update ground
    window.addEventListener("resize", () => {
      this.freePhysics.setGroundY(this.computeGroundY());
    });
  }

  public toggleMode(): void {
    if (this.petLocation === "leaving" || this.petLocation === "entering") return;
    if (this.petLocation === "inIsland") {
      this.leaveIsland();
    } else {
      this.enterIslandDirectly();
    }
  }

  private setupBridge(): void {
    appBridge.listenToEvent<string>("mode-changed", (mode) => {
      if (mode === "free" && this.petLocation === "inIsland") {
        this.leaveIsland();
      } else if (mode === "island" && this.petLocation !== "inIsland") {
        this.enterIslandDirectly();
      }
    });

    appBridge.listenToEvent<string>("request-mode", (mode) => {
      this.setMode(mode === "free" ? "free" : "island");
    });

    appBridge.listenToEvent<string>("hotkey-triggered", (action) => {
      if (action === "toggle-mode") {
        this.toggleMode();
      } else if (action === "toggle-debug") {
        this.debugPanel.toggle();
      }
    });

    eventBus.on("app:toggle-mode", () => {
      this.toggleMode();
    });

    eventBus.on("pet:action", (act) => {
      if (act.type === "state" && typeof act.payload === "string") {
        if (this.petLocation === "inIsland") {
          this.islandAnimController.setState(act.payload);
        } else {
          this.freeAnimController.setState(act.payload);
        }
      }
    });

    eventBus.on("island:notification-appeared", (data) => {
      this.islandBehaviorScheduler.onNotificationAppeared(data.isFocusMode);
      this.freeBehaviorScheduler.onNotificationAppeared(data.isFocusMode);
    });

    eventBus.on("island:notification-dismissed", () => {
      this.islandBehaviorScheduler.onNotificationDismissed();
      this.freeBehaviorScheduler.onNotificationDismissed();
    });

    appBridge.listenToEvent<string>("pet-say", (text) => {
      this.speechBubble.say(text, 4500);
      this.speechBubble.updatePosition(this.freePhysics.x, this.freePhysics.y);
    });

    // Window walking: listen for visible walkable windows from Rust tracker
    appBridge.listenToEvent<any[]>("walkable-windows-updated", (windows) => {
      if (Array.isArray(windows)) {
        this.freePhysics.setPlatforms(windows);
      }
    });

    const savedWalk = localStorage.getItem("mintu_walk_windows");
    this.freePhysics.setWalkOnWindows(savedWalk !== "off");

    const savedIgnore = localStorage.getItem("mintu_window_ignore_list");
    if (savedIgnore) {
      const list = savedIgnore.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
      appBridge.setWindowIgnoreList(list);
    }

    eventBus.on("settings:walk-windows-changed", (val: any) => {
      this.freePhysics.setWalkOnWindows(Boolean(val));
    });

    eventBus.on("settings:window-ignore-list-changed", (list: any) => {
      if (Array.isArray(list)) {
        appBridge.setWindowIgnoreList(list);
      }
    });

    // Milestone 8: Sync accessory changes live across both renderers
    eventBus.on("pet:accessory-changed", (acc: any) => {
      this.islandAnimController.setAccessory(acc);
      this.freeAnimController.setAccessory(acc);
    });
  }

  async setMode(mode: "island" | "free"): Promise<void> {
    if (mode === "free" && this.petLocation === "inIsland") {
      this.leaveIsland();
    } else if (mode === "island" && this.petLocation !== "inIsland") {
      this.enterIslandDirectly();
    }
  }

  private exposePublicApi(): void {
    (window as any).mintu = {
      pet: {
        setState: (name: string) => {
          if (this.petLocation === "inIsland") {
            this.islandAnimController.setState(name);
          } else {
            this.freeAnimController.setState(name);
          }
        },
        getState: () => {
          return this.petLocation === "inIsland"
            ? this.islandAnimController.getStateName()
            : this.freeAnimController.getStateName();
        },
        say: (text: string) => {
          this.speechBubble.say(text);
          this.speechBubble.updatePosition(this.freePhysics.x, this.freePhysics.y);
        },
        react: (emotion: string) => {
          if (this.petLocation === "inIsland") {
            this.islandAnimController.react(emotion);
          } else {
            this.freeAnimController.react(emotion);
          }
        },
        lookAt: (x: number, y: number) => {
          if (this.petLocation === "inIsland") {
            this.islandAnimController.lookAt(x, y);
          } else {
            this.freeAnimController.lookAt(x, y);
          }
        },
        setAccessory: (name: any) => {
          this.islandAnimController.setAccessory(name);
          this.freeAnimController.setAccessory(name);
        },
        getLocation: () => this.petLocation,
      },
      island: {
        setState: (name: string) => this.islandController.setState(name),
        getState: () => this.islandController.getState(),
        notify: (payload: any) => this.islandController.notify(payload),
        setContent: (slot: string) => this.islandController.setState(slot),
      },
      app: {
        setMode: (mode: "island" | "free") => this.setMode(mode),
        getMode: () => this.currentMode,
        loadSkin: (json: any) => skinLoader.loadFromJson(json),
      },
    };
  }

  // ==========================================
  // Main Animation Loop (60+ fps display rate)
  // ==========================================

  private animationLoop(nowSec: number): void {
    if (!this.isRunning) return;

    const dtSec = Math.min(0.05, Math.max(0.001, nowSec - this.lastTimeSec));
    this.lastTimeSec = nowSec;

    // Record frame time for developer panel meter
    this.debugPanel.recordFrame(dtSec);

    // 1. Update island liquid spring morphing
    this.islandController.update(dtSec);

    const freePetEl = this.freePetRenderer.container;

    // 2. State Machine Rendering Dispatch
    if (this.petLocation === "inIsland") {
      this.islandBehaviorScheduler.update();
      const pose = this.islandAnimController.update(nowSec, dtSec);
      this.islandPetRenderer.render(pose);
    } else if (this.petLocation === "leaving") {
      this.freePhysics.update(dtSec);
      freePetEl.style.transform = `translate3d(${this.freePhysics.x.toFixed(1)}px, ${this.freePhysics.y.toFixed(1)}px, 0)`;

      const pose = this.freeAnimController.update(nowSec, dtSec);
      this.freePetRenderer.render(pose);

      if (this.freePhysics.isGrounded) {
        this.petLocation = "free";
      }
    } else if (this.petLocation === "free") {
      this.freeBehaviorScheduler.update();
      if (this.freeAnimController.getStateName() === "walk") {
        this.freePhysics.vx = this.freePhysics.walkDirection * 55;
      } else if (this.freePhysics.isGrounded) {
        this.freePhysics.vx = 0;
      }
      this.freePhysics.update(dtSec);
      const scaleX = this.freePhysics.walkDirection;
      freePetEl.style.transform = `translate3d(${this.freePhysics.x.toFixed(1)}px, ${this.freePhysics.y.toFixed(1)}px, 0) scaleX(${scaleX})`;

      const pose = this.freeAnimController.update(nowSec, dtSec);
      this.freePetRenderer.render(pose);

      // Keep speech bubble & chat card anchored to Mintu
      this.speechBubble.updatePosition(this.freePhysics.x, this.freePhysics.y);
      if (this.freeChatCard.getIsOpen()) {
        this.freeChatCard.updatePosition(this.freePhysics.x, this.freePhysics.y);
      }
    } else if (this.petLocation === "dragging" || this.petLocation === "approaching") {
      // Spring lag follower
      const springLag = 0.35;
      this.dragFollowX += (this.freePhysics.x - this.dragFollowX) * springLag;
      this.dragFollowY += (this.freePhysics.y - this.dragFollowY) * springLag;

      const scale = this.petLocation === "approaching" ? 0.75 : 1.0;
      freePetEl.style.transform = `translate3d(${this.dragFollowX.toFixed(1)}px, ${this.dragFollowY.toFixed(1)}px, 0) scale(${scale})`;

      const pose = this.freeAnimController.update(nowSec, dtSec);
      this.freePetRenderer.render(pose);
    } else if (this.petLocation === "entering") {
      const elapsed = nowSec - this.transitionStartTime;
      const t = Math.min(1.0, elapsed / this.transitionDuration);

      // Smooth easeInOutCubic suction curve into dock
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      const dock = this.getIslandDockPos();
      const curX = this.transitionStartPos.x + (dock.x - this.transitionStartPos.x) * ease;
      const curY = this.transitionStartPos.y + (dock.y - this.transitionStartPos.y) * ease;
      const scale = this.transitionStartScale + (0.4 - this.transitionStartScale) * ease; // Scale down into pill size

      freePetEl.style.transform = `translate3d(${curX.toFixed(1)}px, ${curY.toFixed(1)}px, 0) scale(${scale.toFixed(2)})`;

      const pose = this.freeAnimController.update(nowSec, dtSec);
      this.freePetRenderer.render(pose);

      if (t >= 1.0) {
        this.finishEnteringIsland();
      }
    }

    requestAnimationFrame((t) => this.animationLoop(t / 1000));
  }
}

// Bootstrap Mintu Unified Overlay App
window.addEventListener("DOMContentLoaded", () => {
  new MintuApp();
});
