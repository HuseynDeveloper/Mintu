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

  constructor(windowLabel: string) {
    this.windowLabel = windowLabel;
    this.startTracking();
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

    window.addEventListener("resize", () => this.update());
  }

  update(): void {
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
          x: Math.max(0, b.left - padding),
          y: Math.max(0, b.top - padding),
          width: b.width + padding * 2,
          height: b.height + padding * 2,
        });
      }
    }

    const json = JSON.stringify(rects);
    if (json !== this.lastRectsJson) {
      this.lastRectsJson = json;
      appBridge.setHitRegions(this.windowLabel, rects);
    }
  }

  destroy(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.elements.clear();
  }
}
