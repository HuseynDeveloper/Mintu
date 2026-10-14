import { PetPose, PetState, StateContext } from "../types";
import { createDefaultPose } from "./basePose";

export class IdleState implements PetState {
  name = "idle";
  private startTime = 0;

  enter(timeSec: number): void {
    this.startTime = timeSec;
  }

  update(timeSec: number, _dtSec: number, context: StateContext): PetPose {
    const t = timeSec - this.startTime;
    const pose = createDefaultPose();

    // Rhythmic breathing cycle (~3.2 seconds)
    const breath = Math.sin(t * 1.9);
    pose.bodyScaleY = 1.0 + breath * 0.025;
    pose.bodyScaleX = 1.0 - breath * 0.015;
    pose.bodyOffsetY = -breath * 1.5;

    // Belly expansion with breath
    pose.bellyScaleX = 1.0 + breath * 0.03;
    pose.bellyScaleY = 1.0 + breath * 0.02;

    // Subtle gentle ear float
    pose.leftEarRotate = Math.sin(t * 1.5) * 3;
    pose.rightEarRotate = -Math.sin(t * 1.5) * 3;

    // Gentle tail wag
    pose.tailRotate = Math.sin(t * 2.2) * 8;

    // Hands resting softly on belly with slight weight shift
    pose.leftArmRotate = -Math.sin(t * 1.2) * 2;
    pose.rightArmRotate = Math.sin(t * 1.2) * 2;

    // Eye gaze: tracks cursor slightly if cursor is close, else slow random glance
    if (context.cursorDistance < 250) {
      pose.pupilOffsetX = context.cursorNormX * 0.55;
      pose.pupilOffsetY = context.cursorNormY * 0.45;
    } else {
      pose.pupilOffsetX = Math.sin(t * 0.4) * 0.25;
      pose.pupilOffsetY = Math.cos(t * 0.3) * 0.15;
    }

    pose.eyeType = "normal";
    pose.mouthType = "smile";
    pose.accessory = "none";

    return pose;
  }

  exit(): void {}
}
