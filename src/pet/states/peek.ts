import { PetPose, PetState, StateContext } from "../types";
import { createDefaultPose } from "./basePose";

export class PeekState implements PetState {
  name = "peek";

  enter(_timeSec: number): void {}

  update(_timeSec: number, _dtSec: number, context: StateContext): PetPose {
    const pose = createDefaultPose();

    // Peeking posture
    pose.bodyScaleY = 1.05;
    pose.headOffsetY = -2;

    // Ears attentively perked
    pose.leftEarRotate = -8;
    pose.rightEarRotate = 8;

    // Attentive eyes tracking cursor directly
    pose.eyeType = "normal";
    pose.mouthType = "smile";
    pose.pupilOffsetX = Math.max(-0.8, Math.min(0.8, context.cursorNormX * 0.8));
    pose.pupilOffsetY = Math.max(-0.8, Math.min(0.8, context.cursorNormY * 0.8));

    return pose;
  }

  exit(): void {}
}
