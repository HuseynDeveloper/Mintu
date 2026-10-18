import { PetPose, PetState, StateContext } from "../types";
import { createDefaultPose } from "./basePose";

export class HeadphonesFocusState implements PetState {
  name = "headphones-focus";
  private startTime = 0;

  enter(timeSec: number): void {
    this.startTime = timeSec;
  }

  update(timeSec: number, _dtSec: number, _context: StateContext): PetPose {
    const t = timeSec - this.startTime;
    const pose = createDefaultPose();

    // Relaxed focus head bob (~68 BPM lo-fi beat)
    const loFiBob = Math.sin(t * 3.5);
    pose.headTilt = loFiBob * 3;
    pose.headOffsetY = Math.abs(loFiBob) * 2;
    pose.bodyOffsetY = Math.abs(loFiBob) * 1.2;

    // Peaceful closed smile
    pose.eyeType = "normal";
    pose.mouthType = "smile";
    pose.pupilOffsetY = 0.15; // Focused downward/calm

    // Relaxed arms on belly
    pose.leftArmRotate = -2;
    pose.rightArmRotate = 2;

    // Gentle slow tail sway
    pose.tailRotate = Math.sin(t * 1.5) * 6;

    // Enable headphones accessory!
    pose.accessory = "headphones";

    return pose;
  }

  exit(): void {}
}
