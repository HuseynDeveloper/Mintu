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
import { HitTester } from "./core/HitTester";
import { appBridge } from "./core/AppBridge";
import { skinLoader } from "./pet/skins/SkinLoader";

class MintuFreeApp {
  private petRenderer: PetRenderer;
  private animController: AnimationController;
  private physics: PhysicsBody;
  private scheduler: BehaviorScheduler;
  private speechBubble: SpeechBubble;
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

    // 4. Hit-Testing for click-through
    this.hitTester = new HitTester("free");
    this.hitTester.register(this.petRenderer.container);
    this.hitTester.register(this.speechBubble.el);

    // 5. Autonomous roaming scheduler
    this.scheduler = new BehaviorScheduler(this.animController, true);

    // 6. Setup Drag, Fling, and Click interactions
    this.setupInteractions();

    // 7. Setup Tauri IPC listeners
    this.setupBridge();

    // 8. Expose Public API
    this.exposePublicApi();

    // Initial greeting speech bubble matching Image C!
    setTimeout(() => {
      this.speechBubble.say("Need help with that error?", 4800);
    }, 800);

    // 9. Start Physics & Animation Loop
    this.lastTimeSec = performance.now() / 1000;
    requestAnimationFrame((t) => this.animationLoop(t / 1000));
  }

  private setupInteractions(): void {
    const el = this.petRenderer.container;

    // Pointer down: initiate drag
    el.addEventListener("pointerdown", (e: PointerEvent) => {
      this.isPointerDown = true;
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

    // Pointer up: release with fling momentum
    el.addEventListener("pointerup", (e: PointerEvent) => {
      if (!this.isPointerDown) return;
      this.isPointerDown = false;
      el.releasePointerCapture(e.pointerId);
      el.classList.remove("dragging");

      this.physics.endDrag();
      this.scheduler.setEnabled(true);
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

    appBridge.listenToEvent<string>("mode-changed", (mode) => {
      if (mode === "free") {
        this.animController.setState("idle");
        this.physics.y = this.physics.groundY;
        this.physics.isGrounded = true;
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

    // 5. Update animation controller
    const pose = this.animController.update(nowSec, dtSec);

    // 6. Render SVG
    this.petRenderer.render(pose);

    requestAnimationFrame((t) => this.animationLoop(t / 1000));
  }
}

// Bootstrap
window.addEventListener("DOMContentLoaded", () => {
  new MintuFreeApp();
});
