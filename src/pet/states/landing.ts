import { PetPose, PetState, StateContext } from "../types";
import { createDefaultPose } from "./basePose";

export class LandingState implements PetState {
  name = "landing";
  private startTime = 0;
  private duration = 0.55;

  enter(timeSec: number): void {
    this.startTime = timeSec;
  }

  isFinished(): boolean {
    return false; // Handled by controller duration
  }

  update(timeSec: number, _dtSec: number, _context: StateContext): PetPose {
    const t = Math.min(this.duration, timeSec - this.startTime);
    const progress = t / this.duration; // 0..1
    const pose = createDefaultPose();

    // Damped harmonic oscillation for cartoon squash and recovery
    // f(p) = e^(-4p) * cos(6 * pi * p)
    const decay = Math.exp(-progress * 4.5);
    const wave = Math.cos(progress * Math.PI * 4.0);
    const factor = decay * wave; // Starts at 1.0, dips to -0.3, settles to 0

    // Squash on impact (factor > 0: squashed wide, factor < 0: stretched tall)
    const squashAmount = 0.28 * factor;
    pose.bodyScaleX = 1.0 + squashAmount;
    pose.bodyScaleY = 1.0 - squashAmount;
    pose.bodyOffsetY = squashAmount * 12;

    // Ears flap outward with impact
    pose.leftEarRotate = -28 * factor;
    pose.rightEarRotate = 28 * factor;

    // Arms spread out with impact
    pose.leftArmRotate = -45 * factor;
    pose.rightArmRotate = 45 * factor;

    // Wide shadow on ground impact
    pose.shadowScale = 1.0 + squashAmount * 0.8;

    pose.eyeType = progress < 0.35 ? "alert" : "normal";
    pose.mouthType = progress < 0.35 ? "o" : "smile";

    return pose;
  }

  exit(): void {}
}
