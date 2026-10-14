/**
 * Mintu Main Window Entry Point (Dynamic Island Mode)
 */

import { PetRenderer } from "./pet/PetRenderer";
import { AnimationController } from "./pet/AnimationController";
import { IslandController } from "./island/IslandController";
import { BehaviorScheduler } from "./pet/behavior/BehaviorScheduler";
import { HitTester } from "./core/HitTester";
import { appBridge } from "./core/AppBridge";
import { DebugPanel } from "./ui/DebugPanel";
import { skinLoader } from "./pet/skins/SkinLoader";

class MintuIslandApp {
  private petRenderer: PetRenderer;
  private animController: AnimationController;
  private islandController: IslandController;
  private behaviorScheduler: BehaviorScheduler;
  private hitTester: HitTester;
  private debugPanel: DebugPanel;

  private lastTimeSec: number = 0;
  private isRunning: boolean = true;
  private currentMode: "island" | "free" = "island";

  constructor() {
    // 1. Initialize Pet & Controllers (Pill scale for island)
    this.petRenderer = new PetRenderer(true);
    this.animController = new AnimationController();
    this.islandController = new IslandController(this.petRenderer, this.animController);
    this.behaviorScheduler = new BehaviorScheduler(this.animController, false);

    // 2. Mount Island to viewport
    const viewport = document.getElementById("island-viewport")!;
    viewport.appendChild(this.islandController.el);

    // 3. Setup Hit-Testing for click-through
    this.hitTester = new HitTester("main");
    this.hitTester.register(this.islandController.el);

    // 4. Setup Debug Matrix Panel
    this.debugPanel = new DebugPanel({
      onSetPetState: (st) => this.animController.setState(st),
      onSetIslandState: (st) => this.islandController.setState(st),
      onNotify: (hasActions) => {
        if (hasActions) {
          this.islandController.notify({
            title: "Build Succeeded",
            text: "All 18 unit tests passed cleanly.",
            actions: [
              { id: "explain", label: "Explain" },
              { id: "fix", label: "Fix it", primary: true },
            ],
          });
        } else {
          this.islandController.notify({
            title: "New message",
            text: "From: Sarah 'Hey there!'",
          });
        }
      },
      onSay: (text) => {
        // Broadcast speech bubble to free window
        appBridge.broadcastEvent("pet-say", text);
      },
      onToggleMode: (mode) => this.setMode(mode),
      onSetAccessory: (acc) => this.animController.setAccessory(acc as any),
    });

    document.body.appendChild(this.debugPanel.el);
    this.hitTester.register(this.debugPanel.el);

    const hintBtn = document.getElementById("debug-hint");
    if (hintBtn) {
      hintBtn.addEventListener("click", () => this.debugPanel.toggle());
      this.hitTester.register(hintBtn);
    }

    // 5. Setup Mouse & Double-Click interactions
    this.setupInteractions();

    // 6. Setup Tauri Event Listeners
    this.setupBridge();

    // 7. Expose Public API on window
    this.exposePublicApi();

    // 8. Start Animation Loop
    this.lastTimeSec = performance.now() / 1000;
    requestAnimationFrame((t) => this.animationLoop(t / 1000));
  }

  private setupInteractions(): void {
    // Double click to hop out of island into Free mode!
    this.islandController.el.addEventListener("dblclick", () => {
      this.hopOutToFreeMode();
    });

    // Cursor tracking
    window.addEventListener("mousemove", (e) => {
      this.behaviorScheduler.notifyUserActivity();

      const b = this.islandController.el.getBoundingClientRect();
      const centerX = b.left + b.width / 2;
      const centerY = b.top + b.height / 2;

      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      this.animController.cursorDistance = dist;
      this.animController.lookAt(dx / Math.max(1, b.width / 2), dy / Math.max(1, b.height / 2));
    });

    window.addEventListener("mouseleave", () => {
      this.animController.cursorDistance = 9999;
      this.animController.lookAt(0, 0);
    });
  }

  private setupBridge(): void {
    appBridge.listenToEvent<string>("mode-changed", (mode) => {
      this.currentMode = mode === "free" ? "free" : "island";
      if (this.currentMode === "free") {
        this.islandController.setState("collapsed");
      } else {
        this.islandController.setState("idle");
      }
    });

    appBridge.listenToEvent<string>("request-mode", (mode) => {
      this.setMode(mode === "free" ? "free" : "island");
    });
  }

  private hopOutToFreeMode(): void {
    // Jump animation out of island
    this.animController.setState("happy", 0.18);
    this.islandController.el.classList.add("wiggling");

    setTimeout(() => {
      this.islandController.el.classList.remove("wiggling");
      this.setMode("free");
    }, 380);
  }

  async setMode(mode: "island" | "free"): Promise<void> {
    this.currentMode = mode;
    this.behaviorScheduler.setFreeMode(mode === "free");
    await appBridge.setAppMode(mode);

    if (mode === "free") {
      this.islandController.setState("collapsed");
    } else {
      this.islandController.setState("idle");
    }
  }

  private exposePublicApi(): void {
    (window as any).mintu = {
      pet: {
        setState: (name: string) => this.animController.setState(name),
        getState: () => this.animController.getStateName(),
        say: (text: string) => appBridge.broadcastEvent("pet-say", text),
        react: (emotion: string) => this.animController.react(emotion),
        lookAt: (x: number, y: number) => this.animController.lookAt(x, y),
        setAccessory: (name: any) => this.animController.setAccessory(name),
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

  private animationLoop(nowSec: number): void {
    if (!this.isRunning) return;

    const dtSec = Math.min(0.1, nowSec - this.lastTimeSec);
    this.lastTimeSec = nowSec;

    // 1. Update island liquid spring morphing
    this.islandController.update(dtSec);

    // 2. Update autonomous behavior scheduler
    this.behaviorScheduler.update();

    // 3. Update pet state & micro-animations
    const pose = this.animController.update(nowSec, dtSec);

    // 4. Render layered SVG transforms
    this.petRenderer.render(pose);

    requestAnimationFrame((t) => this.animationLoop(t / 1000));
  }
}

// Bootstrap
window.addEventListener("DOMContentLoaded", () => {
  new MintuIslandApp();
});
