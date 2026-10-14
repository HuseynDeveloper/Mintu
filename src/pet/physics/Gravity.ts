/**
 * Gravity & Drag Physics for Free Desktop Mode
 * Simulates real-time kinematic drop, drag fling inertia, ground bouncing,
 * and triggers squash & stretch upon landing impact.
 */

export interface PhysicsBodyOptions {
  groundY: number;
  gravity?: number;      // px/s^2
  bounce?: number;       // Elasticity [0..1]
  dragFriction?: number;
  onLand?: (impactVelocity: number) => void;
}

export class PhysicsBody {
  x: number = 0;
  y: number = 0;
  vx: number = 0;
  vy: number = 0;
  groundY: number;
  gravity: number;
  bounce: number;
  dragFriction: number;
  isGrounded: boolean = true;
  isDragging: boolean = false;
  onLand?: (impactVelocity: number) => void;

  private lastDragX: number = 0;
  private lastDragY: number = 0;
  private dragVelocities: Array<{ vx: number; vy: number }> = [];

  constructor(initX: number, initY: number, options: PhysicsBodyOptions) {
    this.x = initX;
    this.y = initY;
    this.groundY = options.groundY;
    this.gravity = options.gravity ?? 1800; // Snappy cartoon gravity
    this.bounce = options.bounce ?? 0.35;
    this.dragFriction = options.dragFriction ?? 0.92;
    this.onLand = options.onLand;
  }

  setGroundY(groundY: number): void {
    this.groundY = groundY;
    if (this.isGrounded) {
      this.y = groundY;
    }
  }

  startDrag(pointerX: number, pointerY: number): void {
    this.isDragging = true;
    this.isGrounded = false;
    this.lastDragX = pointerX;
    this.lastDragY = pointerY;
    this.dragVelocities = [];
    this.vx = 0;
    this.vy = 0;
  }

  updateDrag(pointerX: number, pointerY: number, dtSec: number): void {
    if (!this.isDragging) return;

    const dx = pointerX - this.lastDragX;
    const dy = pointerY - this.lastDragY;
    this.x += dx;
    this.y += dy;

    if (dtSec > 0.001) {
      const curVx = dx / dtSec;
      const curVy = dy / dtSec;
      this.dragVelocities.push({ vx: curVx, vy: curVy });
      if (this.dragVelocities.length > 5) {
        this.dragVelocities.shift();
      }
    }

    this.lastDragX = pointerX;
    this.lastDragY = pointerY;
  }

  endDrag(): { vx: number; vy: number } {
    this.isDragging = false;
    // Calculate averaged fling velocity
    if (this.dragVelocities.length > 0) {
      const avgVx = this.dragVelocities.reduce((s, v) => s + v.vx, 0) / this.dragVelocities.length;
      const avgVy = this.dragVelocities.reduce((s, v) => s + v.vy, 0) / this.dragVelocities.length;
      // Clamp velocity to reasonable bounds
      this.vx = Math.max(-1200, Math.min(1200, avgVx));
      this.vy = Math.max(-1400, Math.min(1200, avgVy));
    } else {
      this.vx = 0;
      this.vy = 0;
    }
    return { vx: this.vx, vy: this.vy };
  }

  update(dtSec: number): void {
    if (this.isDragging) return;

    if (!this.isGrounded) {
      // Apply gravity
      this.vy += this.gravity * dtSec;
      this.x += this.vx * dtSec;
      this.y += this.vy * dtSec;

      // Air resistance on horizontal velocity
      this.vx *= Math.pow(this.dragFriction, dtSec * 60);

      // Check ground collision
      if (this.y >= this.groundY) {
        const impact = this.vy;
        this.y = this.groundY;

        if (impact > 180) {
          // Bounce
          this.vy = -impact * this.bounce;
          if (this.onLand) {
            this.onLand(impact);
          }
        } else {
          // Settle
          this.vy = 0;
          this.vx = 0;
          this.isGrounded = true;
          if (this.onLand && impact > 40) {
            this.onLand(impact);
          }
        }
      }
    }
  }
}
