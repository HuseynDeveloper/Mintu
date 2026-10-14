import { PetPose, PetState, StateContext } from "../types";
import { createDefaultPose } from "./basePose";

export class CuriousState implements PetState {
  name = "curious";
  private startTime = 0;

  enter(timeSec: number): void {
    this.startTime = timeSec;
  }

  update(timeSec: number, _dtSec: number, context: StateContext): PetPose {
    const t = timeSec - this.startTime;
    const pose = createDefaultPose();

    // Characteristic cute puppy head tilt (~16 degrees)
    const tiltWiggle = Math.sin(t * 2.0) * 2;
    pose.headTilt = 16 + tiltWiggle;
    pose.bodyRotation = 4;

    // Asymmetric ears: right ear perked up high, left ear floppy down
    pose.rightEarRotate = -18 + tiltWiggle;
    pose.leftEarRotate = 14 + tiltWiggle;

    // Stubby arms resting slightly forward
    pose.leftArmRotate = -12;
    pose.rightArmRotate = 6;

    // Tail gentle curious twitch
    pose.tailRotate = 12 + Math.sin(t * 3.0) * 8;

    // Attentive eyes tracking cursor directly
    pose.eyeType = "normal";
    pose.mouthType = "o";

    pose.pupilOffsetX = Math.max(-0.85, Math.min(0.85, context.cursorNormX * 0.85));
    pose.pupilOffsetY = Math.max(-0.85, Math.min(0.85, context.cursorNormY * 0.85));

    // Floating question mark above tilted head
    pose.accessory = "question";

    return pose;
  }

  exit(): void {}
}
