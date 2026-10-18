import { PetPose, PetState, StateContext } from "../types";
import { createDefaultPose } from "./basePose";

export class NotifyReactState implements PetState {
  name = "notify-react";
  private startTime = 0;

  enter(timeSec: number): void {
    this.startTime = timeSec;
  }

  update(timeSec: number, _dtSec: number, _context: StateContext): PetPose {
    const t = timeSec - this.startTime;
    const pose = createDefaultPose();

    // Startled perk-up hop
    const bounce = Math.sin(t * 12.0) * Math.exp(-t * 3.0);
    pose.bodyOffsetY = -bounce * 6;
    pose.bodyScaleY = 1.0 + bounce * 0.08;

    // Both hands up to cheeks
    pose.leftArmRotate = -70;
    pose.rightArmRotate = 70;
    pose.leftArmOffsetY = -10;
    pose.rightArmOffsetY = -10;

    // Alert wide eyes and small round mouth
    pose.eyeType = "alert";
    pose.mouthType = "o";

    return pose;
  }

  exit(): void {}
}
