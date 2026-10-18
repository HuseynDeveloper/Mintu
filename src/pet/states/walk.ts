import { PetPose, PetState, StateContext } from "../types";
import { createDefaultPose } from "./basePose";

export class WalkState implements PetState {
  name = "walk";
  private startTime = 0;
  public direction: 1 | -1 = 1; // 1 = right, -1 = left

  enter(timeSec: number): void {
    this.startTime = timeSec;
  }

  update(timeSec: number, _dtSec: number, _context: StateContext): PetPose {
    const t = timeSec - this.startTime;
    const pose = createDefaultPose();
    const walkFreq = 7.0; // steps per second cadence

    // Walking stride bob
    const step = Math.sin(t * walkFreq);
    const stepAbs = Math.abs(Math.sin(t * walkFreq * 0.5));

    // Vertical bobbing (up on push-off, down on land)
    pose.bodyOffsetY = -stepAbs * 4;
    pose.bodyRotation = this.direction * (Math.sin(t * walkFreq) * 4 + 2); // leaning forward

    // Squash on step down
    pose.bodyScaleX = 1.0 + stepAbs * 0.04;
    pose.bodyScaleY = 1.0 - stepAbs * 0.04;

    // Feet alternating stride
    pose.leftFootOffsetY = Math.max(0, -step * 5);
    pose.leftFootOffsetX = this.direction * step * 4;
    pose.rightFootOffsetY = Math.max(0, step * 5);
    pose.rightFootOffsetX = -this.direction * step * 4;

    // Arm swing
    pose.leftArmRotate = -this.direction * step * 25;
    pose.rightArmRotate = this.direction * step * 25;

    // Ears bouncing with inertia lag
    const earBob = Math.sin(t * walkFreq - 0.5) * 8;
    pose.leftEarRotate = -earBob;
    pose.rightEarRotate = earBob;

    // Energetic tail wag
    pose.tailRotate = Math.sin(t * walkFreq * 1.5) * 16;

    // Happy open mouth and forward gaze
    pose.eyeType = "normal";
    pose.mouthType = "open";
    pose.pupilOffsetX = this.direction * 0.6;
    pose.pupilOffsetY = -0.1;

    return pose;
  }

  exit(): void {}
}
