import { PetPose, PetState, StateContext } from "../types";
import { createDefaultPose } from "./basePose";

export class WakeState implements PetState {
  name = "wake";
  private startTime = 0;
  private duration = 2.4;

  enter(timeSec: number): void {
    this.startTime = timeSec;
  }

  isFinished(): boolean {
    return false; // Handled by animation controller duration
  }

  update(timeSec: number, _dtSec: number, _context: StateContext): PetPose {
    const t = Math.min(this.duration, timeSec - this.startTime);
    const progress = t / this.duration; // 0 to 1
    const pose = createDefaultPose();

    if (progress < 0.6) {
      // Yawn and full body upward stretch
      const p = progress / 0.6;
      const stretch = Math.sin(p * Math.PI);

      pose.bodyScaleY = 1.0 + stretch * 0.18;
      pose.bodyScaleX = 1.0 - stretch * 0.12;
      pose.bodyOffsetY = -stretch * 8;

      pose.leftArmRotate = -stretch * 80;
      pose.rightArmRotate = stretch * 80;
      pose.leftArmOffsetY = -stretch * 6;
      pose.rightArmOffsetY = -stretch * 6;

      pose.leftEarRotate = -stretch * 16;
      pose.rightEarRotate = stretch * 16;

      pose.mouthType = stretch > 0.4 ? "o" : "sleep";
      pose.eyeType = stretch > 0.5 ? "happy" : "sleep";
    } else {
      // Relax back into normal posture
      const p = (progress - 0.6) / 0.4;
      const ease = 1 - Math.cos(p * Math.PI * 0.5);

      pose.bodyScaleY = 1.18 - ease * 0.18;
      pose.bodyScaleX = 0.88 + ease * 0.12;
      pose.bodyOffsetY = -8 + ease * 8;

      pose.leftArmRotate = -80 + ease * 80;
      pose.rightArmRotate = 80 - ease * 80;

      pose.mouthType = "smile";
      pose.eyeType = "normal";
    }

    return pose;
  }

  exit(): void {}
}
