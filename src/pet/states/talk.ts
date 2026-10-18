import { PetPose, PetState, StateContext } from "../types";
import { createDefaultPose } from "./basePose";

export class TalkState implements PetState {
  name = "talk";
  private startTime = 0;

  enter(timeSec: number): void {
    this.startTime = timeSec;
  }

  update(timeSec: number, _dtSec: number, context: StateContext): PetPose {
    const t = timeSec - this.startTime;
    const pose = createDefaultPose();

    // Head and body gesturing with speech syllables (~4.5 Hz)
    const syllable = Math.sin(t * 9.0);
    const gesture = Math.sin(t * 3.5);

    pose.bodyOffsetY = -Math.abs(syllable) * 2;
    pose.headTilt = gesture * 4;

    // Right arm gesturing upwards
    pose.rightArmRotate = 45 + gesture * 15;
    pose.rightArmOffsetX = 2;
    pose.rightArmOffsetY = -4 + syllable * 2;

    // Left arm resting comfortably
    pose.leftArmRotate = -5;

    // Ears reacting to speech
    pose.leftEarRotate = -syllable * 4;
    pose.rightEarRotate = syllable * 4;

    // Tail wagging happily
    pose.tailRotate = Math.sin(t * 4.0) * 12;

    // Mouth syllables cycling open / smile
    pose.mouthType = syllable > 0 ? "open" : "smile";
    pose.eyeType = "normal";

    // Looking towards cursor or user
    if (context.cursorDistance < 300) {
      pose.pupilOffsetX = context.cursorNormX * 0.6;
      pose.pupilOffsetY = context.cursorNormY * 0.4;
    } else {
      pose.pupilOffsetX = 0.2;
      pose.pupilOffsetY = -0.1;
    }

    return pose;
  }

  exit(): void {}
}
