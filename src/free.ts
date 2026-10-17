/**
 * Mintu Free Mode Entry Point (Desktop Roaming Mode)
 * Full body pet with physics (gravity, drag, fling, ground bounce, squash & stretch),
 * roaming behavior scheduler, and speech bubble (Image C Reference).
 */

import { PetRenderer } from "./pet/PetRenderer";
import { AnimationController } from "./pet/AnimationController";
import { PhysicsBody } from "./pet/physics/Gravity";
import { BehaviorScheduler } from "./pet/behavior/BehaviorScheduler";
import { SpeechBubble } from "./ui/SpeechBubble";
import { FreeChatCard } from "./ui/FreeChatCard";
import { HitTester } from "./core/HitTester";
import { appBridge } from "./core/AppBridge";
import { skinLoader } from "./pet/skins/SkinLoader";
import { eventBus } from "./core/EventBus";

class MintuFreeApp {
  private petRenderer: PetRenderer;
  private animController: AnimationController;
  private physics: PhysicsBody;
  private scheduler: BehaviorScheduler;
  private speechBubble: SpeechBubble;
  private freeChatCard: FreeChatCard;
  private hitTester: HitTester;

  private lastTimeSec: number = 0;
  private isPointerDown: boolean = false;
  private walkDirection: 1 | -1 = 1;

  constructor() {
    // 1. Full body pet renderer
    this.petRenderer = new PetRenderer(false);
    this.animController = new AnimationController();

    const viewport = document.getElementById("free-viewport")!;
    viewport.appendChild(this.petRenderer.container);

    // 2. Speech Bubble (Image C reference)
    this.speechBubble = new SpeechBubble();
    viewport.appendChild(this.speechBubble.el);

    // 3. Physics Body: Default parking spot at bottom-right (Image C)
    const initX = Math.max(100, window.innerWidth - 180);
    const groundY = Math.max(50, window.innerHeight - 150);

    this.physics = new PhysicsBody(initX, groundY, {
      groundY,
      gravity: 1900,
      bounce: 0.3,
      onLand: (impact) => {
        if (impact > 120) {
          this.animController.impactVelocity = impact;
          this.animController.setState("landing", 0.12);
          setTimeout(() => {
            if (this.animController.getStateName() === "landing") {
              this.animController.setState("idle", 0.25);
            }
          }, 550);
        }
      },
    });

    // 4. Free Mode Floating Chat Card
    this.freeChatCard = new FreeChatCard();
    viewport.appendChild(this.freeChatCard.el);

    // 5. Hit-Testing for click-through
    this.hitTester = new HitTester("free");
    this.hitTester.register(this.petRenderer.container);
    this.hitTester.register(this.speechBubble.el);
    this.hitTester.register(this.freeChatCard.el);

    // 6. Autonomous roaming scheduler
    this.scheduler = new BehaviorScheduler(this.animController, true);

    // 7. Setup Drag, Fling, and Click interactions
    this.setupInteractions();

    // 8. Setup Tauri IPC listeners
    this.setupBridge();

    // 9. Expose Public API
    this.exposePublicApi();

    // Initial greeting speech bubble matching Image C!
    setTimeout(() => {
      this.speechBubble.say("Need help with that error?", 4800);
    }, 800);

    // 10. Start Physics & Animation Loop
    this.lastTimeSec = performance.now() / 1000;
    requestAnimationFrame((t) => this.animationLoop(t / 1000));
  }

  private pointerDownPos: { x: number; y: number } = { x: 0, y: 0 };
  private pointerDownTime: number = 0;

  private setupInteractions(): void {
    const el = this.petRenderer.container;

    // Pointer down: initiate drag
    el.addEventListener("pointerdown", (e: PointerEvent) => {
      this.isPointerDown = true;
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
      this.pointerDownTime = performance.now();

      el.setPointerCapture(e.pointerId);
      el.classList.add("dragging");

      this.physics.startDrag(e.clientX, e.clientY);
      this.animController.setState("dragged", 0.15);
      this.scheduler.setEnabled(false);
    });

    // Pointer move: update drag
    window.addEventListener("pointermove", (e: PointerEvent) => {
      const nowSec = performance.now() / 1000;
      const dtSec = Math.max(0.001, nowSec - this.lastTimeSec);

      this.scheduler.notifyUserActivity();

      if (this.isPointerDown) {
        this.physics.updateDrag(e.clientX, e.clientY, dtSec);
        this.animController.dragVelocityX = this.physics.vx;
        this.animController.dragVelocityY = this.physics.vy;
      } else {
        // Cursor tracking
        const b = el.getBoundingClientRect();
        const centerX = b.left + b.width / 2;
        const centerY = b.top + b.height / 2;
        const dx = e.clientX - centerX;
        const dy = e.clientY - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        this.animController.cursorDistance = dist;
        this.animController.lookAt(dx / 120, dy / 120);
      }
    });

    // Pointer up: release with fling momentum or open chat on quick click
    el.addEventListener("pointerup", (e: PointerEvent) => {
      if (!this.isPointerDown) return;
      this.isPointerDown = false;
      el.releasePointerCapture(e.pointerId);
      el.classList.remove("dragging");

      this.physics.endDrag();
      this.scheduler.setEnabled(true);

      const dist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
      const dur = performance.now() - this.pointerDownTime;
      if (dist < 8 && dur < 300) {
        this.freeChatCard.toggle();
      }
    });

    // Clicking speech bubble opens chat card
    this.speechBubble.el.addEventListener("click", () => {
      this.freeChatCard.show();
    });

    // Double click to jump back up into Island mode
    el.addEventListener("dblclick", () => {
      this.jumpBackToIsland();
    });

    // Resize handler to update groundY
    window.addEventListener("resize", () => {
      const groundY = Math.max(50, window.innerHeight - 150);
      this.physics.setGroundY(groundY);
    });
  }

  private jumpBackToIsland(): void {
    // Jump animation
    this.animController.setState("happy", 0.15);
    this.speechBubble.hide();

    // Fly upward
    this.physics.vy = -800;
    this.physics.isGrounded = false;

    setTimeout(() => {
      appBridge.setAppMode("island");
    }, 400);
  }

  private setupBridge(): void {
    appBridge.listenToEvent<string>("pet-say", (text) => {
      this.speechBubble.say(text, 4500);
    });

    eventBus.on("pet:action", (act) => {
      if (act.type === "state" && typeof act.payload === "string") {
        this.animController.setState(act.payload);
      }
    });

    appBridge.listenToEvent<string>("mode-changed", (mode) => {
      if (mode === "free") {
        this.animController.setState("idle");
        this.physics.y = this.physics.groundY;
        this.physics.isGrounded = true;
      }
    });

    // Hotkey triggers
    appBridge.listenToEvent<string>("hotkey-triggered", (action) => {
      if (action === "toggle-mode") {
        this.jumpBackToIsland();
      } else if (action === "ask") {
        appBridge.captureContext();
      } else if (action === "capture") {
        appBridge.openRegionCapture();
      }
    });

    // Context captured speech bubble reaction (Image C)
    appBridge.listenToEvent<any>("context-captured", (data) => {
      if (!data) return;
      if (data.app_info?.is_blocked) {
        this.speechBubble.say("I can't look at this app (privacy blocklist)", 4500);
        this.animController.setState("alert", 0.3);
      } else if (data.text) {
        const lineCount = data.text.split("\n").length;
        const appName = data.app_info?.process_name || "VS Code";
        this.speechBubble.say(`Got ${lineCount} ${lineCount === 1 ? "line" : "lines"} from ${appName} — Need help?`, 6000);
        this.animController.setState("think", 0.3);
      } else if (data.image_base64) {
        this.speechBubble.say("Captured screen region — Need help?", 6000);
        this.animController.setState("curious", 0.3);
      }
    });
  }

  private exposePublicApi(): void {
    (window as any).mintu = {
      pet: {
        setState: (name: string) => this.animController.setState(name),
        getState: () => this.animController.getStateName(),
        say: (text: string) => this.speechBubble.say(text),
        react: (emotion: string) => this.animController.react(emotion),
        lookAt: (x: number, y: number) => this.animController.lookAt(x, y),
        setAccessory: (name: any) => this.animController.setAccessory(name),
      },
      app: {
        setMode: (mode: "island" | "free") => appBridge.setAppMode(mode),
        loadSkin: (json: any) => skinLoader.loadFromJson(json),
      },
    };
  }

  private animationLoop(nowSec: number): void {
    const dtSec = Math.min(0.06, nowSec - this.lastTimeSec);
    this.lastTimeSec = nowSec;

    // 1. Update Physics (Gravity & Drag)
    this.physics.update(dtSec);

    // Clamp horizontal position to window bounds
    const minX = 10;
    const maxX = Math.max(minX, window.innerWidth - 150);
    this.physics.x = Math.max(minX, Math.min(maxX, this.physics.x));

    // 2. Update autonomous scheduler
    this.scheduler.update();

    // If walking state is active, move horizontally
    const curState = this.animController.getStateName();
    if (curState === "walk" && this.physics.isGrounded) {
      this.physics.x += this.walkDirection * 40 * dtSec;
      if (this.physics.x >= maxX - 10) {
        this.walkDirection = -1;
      } else if (this.physics.x <= minX + 10) {
        this.walkDirection = 1;
      }
    }

    // 3. Position the Pet DOM element
    const petEl = this.petRenderer.container;
    petEl.style.left = `${this.physics.x.toFixed(1)}px`;
    petEl.style.top = `${this.physics.y.toFixed(1)}px`;

    // 4. Position the Speech Bubble directly above pet
    const bubbleEl = this.speechBubble.el;
    bubbleEl.style.left = `${Math.max(10, this.physics.x - 70).toFixed(1)}px`;
    bubbleEl.style.top = `${(this.physics.y - 75).toFixed(1)}px`;

    // 5. Position the Free Chat Card if visible
    if (this.freeChatCard.getIsOpen()) {
      const cardW = 320;
      const cardH = 220;
      const targetX = Math.max(10, Math.min(window.innerWidth - cardW - 10, this.physics.x - cardW / 2 + 50));
      const targetY = Math.max(10, this.physics.y - cardH - 20);
      this.freeChatCard.el.style.left = `${targetX.toFixed(1)}px`;
      this.freeChatCard.el.style.top = `${targetY.toFixed(1)}px`;
    }

    // 6. Update animation controller
    const pose = this.animController.update(nowSec, dtSec);

    // 7. Render SVG
    this.petRenderer.render(pose);

    requestAnimationFrame((t) => this.animationLoop(t / 1000));
  }
}

// Bootstrap
window.addEventListener("DOMContentLoaded", () => {
  new MintuFreeApp();
});
