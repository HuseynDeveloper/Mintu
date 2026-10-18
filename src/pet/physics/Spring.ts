/**
 * Spring Dynamics (2nd-Order Harmonic Oscillator)
 * High-performance, jitter-free spring solver with stiffness, damping, mass.
 * Supports Apple-style liquid morphing with overshoot and follow-through lag.
 */

export interface SpringConfig {
  stiffness: number; // Spring tension (e.g. 180 - 320)
  damping: number;   // Friction / resistance (e.g. 18 - 26)
  mass: number;      // Inertia (e.g. 1.0)
  precision?: number;// Rest threshold (e.g. 0.001)
}

export const SpringPresets: Record<string, SpringConfig> = {
  // Apple Dynamic Island liquid morph: snappy with subtle overshoot
  liquid: { stiffness: 220, damping: 20, mass: 1.0, precision: 0.005 },
  // Bouncy pet ear and tail follow-through
  bouncy: { stiffness: 260, damping: 14, mass: 0.8, precision: 0.005 },
  // Gentle breathing / weight-shift sway
  gentle: { stiffness: 120, damping: 18, mass: 1.2, precision: 0.002 },
  // Fast snappy saccade / pupil movement
  snappy: { stiffness: 380, damping: 28, mass: 0.8, precision: 0.005 },
  // Squash & stretch landing recovery
  squash: { stiffness: 320, damping: 16, mass: 0.7, precision: 0.005 },
};

export class Spring1D {
  value: number;
  target: number;
  velocity: number = 0;
  config: SpringConfig;

  constructor(initial: number, config: SpringConfig = SpringPresets.liquid) {
    this.value = initial;
    this.target = initial;
    this.config = config;
  }

  setTarget(target: number): void {
    this.target = target;
  }

  snapTo(val: number): void {
    this.value = val;
    this.target = val;
    this.velocity = 0;
  }

  update(dtSec: number): boolean {
    const k = this.config.stiffness;
    const c = this.config.damping;
    const m = this.config.mass;
    const precision = this.config.precision ?? 0.001;

    // Semi-implicit Euler integration
    // F_spring = -k * (x - target)
    // F_damp   = -c * v
    // a = (F_spring + F_damp) / m
    const displacement = this.value - this.target;
    const springForce = -k * displacement;
    const dampingForce = -c * this.velocity;
    const acceleration = (springForce + dampingForce) / m;

    this.velocity += acceleration * dtSec;
    this.value += this.velocity * dtSec;

    // Check if settled
    if (Math.abs(displacement) < precision && Math.abs(this.velocity) < precision) {
      this.value = this.target;
      this.velocity = 0;
      return true; // Settled
    }
    return false; // Still moving
  }
}

export class Spring2D {
  x: Spring1D;
  y: Spring1D;

  constructor(initX: number, initY: number, config: SpringConfig = SpringPresets.liquid) {
    this.x = new Spring1D(initX, config);
    this.y = new Spring1D(initY, config);
  }

  setTarget(targetX: number, targetY: number): void {
    this.x.setTarget(targetX);
    this.y.setTarget(targetY);
  }

  snapTo(targetX: number, targetY: number): void {
    this.x.snapTo(targetX);
    this.y.snapTo(targetY);
  }

  update(dtSec: number): boolean {
    const settledX = this.x.update(dtSec);
    const settledY = this.y.update(dtSec);
    return settledX && settledY;
  }
}
