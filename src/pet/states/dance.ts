import { PetPose, PetState, StateContext } from "../types";
import { createDefaultPose } from "./basePose";

export class DanceState implements PetState {
  name = "dance";
  private startTime = 0;

  enter(timeSec: number): void {
    this.startTime = timeSec;
  }

  update(timeSec: number, _dtSec: number, _context: StateContext): PetPose {
    const t = timeSec - this.startTime;
    const pose = createDefaultPose();
    const bpm = 120; // 2 beats per second
    const beatFreq = (bpm / 60) * Math.PI;

    // Side-to-side body groove
    const beat = Math.sin(t * beatFreq);
    const bounce = Math.abs(Math.cos(t * beatFreq));

    pose.bodyRotation = beat * 12;
    pose.bodyOffsetY = -bounce * 5;
    pose.bodyScaleY = 1.0 + bounce * 0.05;

    // Alternating waving arms
    pose.leftArmRotate = -70 + beat * 35;
    pose.rightArmRotate = 70 + beat * 35;
    pose.leftArmOffsetY = -bounce * 4;
    pose.rightArmOffsetY = -bounce * 4;

    // Ears bouncing with groove
    pose.leftEarRotate = -beat * 18;
    pose.rightEarRotate = beat * 18;

    // Tail wagging to beat
    pose.tailRotate = beat * 20;

    // Happy smiling face
    pose.eyeType = "happy";
    pose.mouthType = "open";

    // Floating music notes
    pose.accessory = "music-notes";

    return pose;
  }

  exit(): void {}
}
