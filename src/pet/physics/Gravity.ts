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

export interface WalkablePlatform {
  hwnd: number;
  title: string;
  process_name: string;
  x: number;
  y: number;
  width: number;
  height: number;
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

  // Window walking platforms
  public walkOnWindows: boolean = true;
  private platforms: WalkablePlatform[] = [];
  public attachedPlatform: WalkablePlatform | null = null;
  public platformOffsetX: number = 60;
  public walkDirection: 1 | -1 = 1;

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

  setPlatforms(platforms: WalkablePlatform[]): void {
    this.platforms = platforms;
    if (this.attachedPlatform) {
      const current = platforms.find((p) => p.hwnd === this.attachedPlatform!.hwnd);
      if (current) {
        // Window moved or resized: keep following
        this.attachedPlatform = current;
      } else {
        // Window was closed, minimized, or cloaked: detach and fall smoothly with gravity!
        this.attachedPlatform = null;
        this.isGrounded = false;
        this.vy = 40;
      }
    }
  }

  setWalkOnWindows(enabled: boolean): void {
    this.walkOnWindows = enabled;
    if (!enabled && this.attachedPlatform) {
      this.attachedPlatform = null;
      this.isGrounded = false;
    }
  }

  setGroundY(groundY: number): void {
    const maxGround = Math.max(100, (typeof window !== "undefined" ? window.innerHeight : 800) - 160);
    this.groundY = Math.min(groundY, maxGround);
    if (this.isGrounded) {
      this.y = this.groundY;
    }
  }

  startDrag(pointerX: number, pointerY: number): void {
    this.isDragging = true;
    this.isGrounded = false;
    this.attachedPlatform = null;
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

    // 1. Attached to a walkable window platform
    if (this.attachedPlatform) {
      this.isGrounded = true;
      const targetY = this.attachedPlatform.y - 120;
      this.y = targetY;

      // Update position along window title bar
      const minOffset = 20;
      const maxOffset = Math.max(minOffset + 30, this.attachedPlatform.width - 130);

      if (this.vx !== 0) {
        this.platformOffsetX += this.vx * dtSec;
      }

      if (this.platformOffsetX <= minOffset) {
        this.platformOffsetX = minOffset;
        this.walkDirection = 1;
        if (this.vx < 0) this.vx = -this.vx;
      } else if (this.platformOffsetX >= maxOffset) {
        this.platformOffsetX = maxOffset;
        this.walkDirection = -1;
        if (this.vx > 0) this.vx = -this.vx;
      }

      this.x = this.attachedPlatform.x + this.platformOffsetX;
      return;
    }

    // 2. In free fall / airborne
    if (!this.isGrounded) {
      const prevY = this.y;
      this.vy += this.gravity * dtSec;
      this.x += this.vx * dtSec;
      this.y += this.vy * dtSec;

      // Air resistance on horizontal velocity
      this.vx *= Math.pow(this.dragFriction, dtSec * 60);

      // Check window platform collisions
      let landedOnPlatform = false;
      if (this.walkOnWindows && this.vy > 0) {
        for (const plat of this.platforms) {
          const topY = plat.y - 120;
          const leftBound = plat.x - 20;
          const rightBound = plat.x + plat.width - 80;

          if (
            prevY <= topY + 20 &&
            this.y >= topY &&
            this.x >= leftBound &&
            this.x <= rightBound
          ) {
            const impact = this.vy;
            this.y = topY;
            this.attachedPlatform = plat;
            this.platformOffsetX = Math.max(20, Math.min(plat.width - 130, this.x - plat.x));
            this.isGrounded = true;
            this.vy = 0;
            this.vx = 0;
            if (this.onLand && impact > 40) {
              this.onLand(impact);
            }
            landedOnPlatform = true;
            break;
          }
        }
      }

      if (!landedOnPlatform) {
        // Check desktop ground collision - strictly clamped to visible viewport
        const maxGround = Math.max(100, (typeof window !== "undefined" ? window.innerHeight : 800) - 160);
        const effectiveGround = Math.min(this.groundY, maxGround);

        if (this.y >= effectiveGround) {
          const impact = this.vy;
          this.y = effectiveGround;

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

      // Keep horizontal position on-screen
      if (typeof window !== "undefined") {
        const maxW = Math.max(200, window.innerWidth - 160);
        this.x = Math.max(20, Math.min(maxW, this.x));
      }
    } else {
      // Grounded on desktop bottom
      if (this.vx !== 0) {
        this.x += this.vx * dtSec;
      }
      if (typeof window !== "undefined") {
        const maxGround = Math.max(100, window.innerHeight - 160);
        this.y = Math.min(this.y, maxGround);
        const maxW = Math.max(200, window.innerWidth - 160);
        this.x = Math.max(20, Math.min(maxW, this.x));
      }
    }
  }
}
