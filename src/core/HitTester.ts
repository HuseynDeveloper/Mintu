/**
 * HitTester
 * Tracks interactive elements on screen and reports their bounding boxes
 * to the Rust backend so transparent windows can ignore mouse clicks
 * everywhere except on interactive components.
 */

import { appBridge, HitRect } from "./AppBridge";

export class HitTester {
  private windowLabel: string;
  private elements: Set<HTMLElement> = new Set();
  private lastRectsJson: string = "";
  private rafId: number | null = null;

  private overlayEl: HTMLElement | null = null;
  private isDebugOverlayVisible: boolean = false;

  constructor(windowLabel: string) {
    this.windowLabel = windowLabel;
    this.startTracking();
  }

  setDebugOverlay(enable: boolean): void {
    this.isDebugOverlayVisible = enable;
    if (!enable && this.overlayEl) {
      this.overlayEl.remove();
      this.overlayEl = null;
    }
    this.update();
  }

  toggleDebugOverlay(): boolean {
    this.setDebugOverlay(!this.isDebugOverlayVisible);
    return this.isDebugOverlayVisible;
  }

  register(el: HTMLElement): void {
    this.elements.add(el);
    this.update();
  }

  unregister(el: HTMLElement): void {
    this.elements.delete(el);
    this.update();
  }

  private startTracking(): void {
    const loop = () => {
      this.update();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);

    window.addEventListener("resize", () => this.update(true));
  }

  private lastIpcTime = 0;
  private pendingTimeout: any = null;

  update(force: boolean = false): void {
    const rects: HitRect[] = [];
    const padding = 6; // Extra padding margin for smooth edge interaction

    for (const el of this.elements) {
      if (!el.isConnected) {
        this.elements.delete(el);
        continue;
      }

      // Check if visible
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity) < 0.05) {
        continue;
      }

      const b = el.getBoundingClientRect();
      if (b.width > 0 && b.height > 0) {
        rects.push({
          x: Math.max(0, Math.floor(b.left - padding)),
          y: Math.max(0, Math.floor(b.top - padding)),
          width: Math.ceil(b.width + padding * 2),
          height: Math.ceil(b.height + padding * 2),
        });
      }
    }

    const json = JSON.stringify(rects);
    if (json !== this.lastRectsJson) {
      this.lastRectsJson = json;
      const now = performance.now();
      const elapsed = now - this.lastIpcTime;

      if (force || elapsed >= 50) {
        if (this.pendingTimeout) {
          clearTimeout(this.pendingTimeout);
          this.pendingTimeout = null;
        }
        this.lastIpcTime = now;
        appBridge.setHitRegions(this.windowLabel, rects);
      } else if (!this.pendingTimeout) {
        this.pendingTimeout = setTimeout(() => {
          this.pendingTimeout = null;
          this.lastIpcTime = performance.now();
          appBridge.setHitRegions(this.windowLabel, rects);
        }, 50 - elapsed);
      }
    }

    if (this.isDebugOverlayVisible) {
      this.renderDebugOverlay(rects);
    }
  }

  private renderDebugOverlay(rects: HitRect[]): void {
    if (!this.overlayEl) {
      this.overlayEl = document.createElement("div");
      this.overlayEl.id = "hit-test-debug-overlay";
      this.overlayEl.style.cssText = `
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 999999;
      `;
      document.body.appendChild(this.overlayEl);
    }

    this.overlayEl.innerHTML = rects
      .map(
        (r, idx) => `
        <div style="
          position: absolute;
          left: ${r.x}px;
          top: ${r.y}px;
          width: ${r.width}px;
          height: ${r.height}px;
          border: 1.5px dashed #10b981;
          background: rgba(16, 185, 129, 0.12);
          border-radius: 8px;
          box-sizing: border-box;
          pointer-events: none;
          display: flex;
          align-items: flex-start;
          justify-content: flex-end;
          padding: 2px 4px;
        ">
          <span style="
            background: #10b981;
            color: #000;
            font-size: 9px;
            font-weight: 700;
            border-radius: 3px;
            padding: 1px 3px;
            font-family: monospace;
          ">#${idx + 1} ${Math.round(r.width)}×${Math.round(r.height)}</span>
        </div>
      `
      )
      .join("");
  }

  destroy(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.overlayEl) {
      this.overlayEl.remove();
      this.overlayEl = null;
    }
    this.elements.clear();
  }
}
