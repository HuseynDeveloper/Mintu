import { PetPose, PetState, StateContext } from "../types";
import { createDefaultPose } from "./basePose";

export class ThinkState implements PetState {
  name = "think";
  private startTime = 0;

  enter(timeSec: number): void {
    this.startTime = timeSec;
  }

  update(timeSec: number, _dtSec: number, _context: StateContext): PetPose {
    const t = timeSec - this.startTime;
    const pose = createDefaultPose();

    // Subtle pondering weight shift
    const sway = Math.sin(t * 1.6);
    pose.bodyRotation = sway * 1.5;
    pose.headTilt = 8 + sway * 1.5;

    // Left arm on chin (pondering hand)
    pose.leftArmRotate = -70;
    pose.leftArmOffsetX = 6;
    pose.leftArmOffsetY = -12;

    // Right arm resting on belly
    pose.rightArmRotate = 8;
    pose.rightArmOffsetY = 2;

    // Head slightly raised looking up
    pose.headOffsetY = -2;

    // Looking upward and to the side
    pose.pupilOffsetX = 0.45 + Math.sin(t * 0.8) * 0.15;
    pose.pupilOffsetY = -0.65;

    // Ears slightly perked
    pose.leftEarRotate = -6;
    pose.rightEarRotate = 10;

    pose.eyeType = "normal";
    pose.mouthType = "flat";

    // Three floating think dots "..." above head
    pose.accessory = "think-dots";

    return pose;
  }

  exit(): void {}
}
