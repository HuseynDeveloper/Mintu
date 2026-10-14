import { PetPose, PetState, StateContext } from "../types";
import { createDefaultPose } from "./basePose";

export class AlertState implements PetState {
  name = "alert";
  private startTime = 0;

  enter(timeSec: number): void {
    this.startTime = timeSec;
  }

  update(timeSec: number, _dtSec: number, _context: StateContext): PetPose {
    const t = timeSec - this.startTime;
    const pose = createDefaultPose();

    // Sudden initial startled hop and slight shiver
    const shiver = t < 0.6 ? Math.sin(t * 36) * 1.5 : Math.sin(t * 3.0) * 0.5;

    // Body stretched tall with shock
    pose.bodyScaleX = 0.94;
    pose.bodyScaleY = 1.08;
    pose.bodyOffsetY = -6 + shiver;

    // Startled paws brought up to cheeks (:O Home Alone pose)
    pose.leftArmRotate = -75;
    pose.leftArmOffsetX = 10;
    pose.leftArmOffsetY = -16;

    pose.rightArmRotate = 75;
    pose.rightArmOffsetX = -10;
    pose.rightArmOffsetY = -16;

    // Ears flared wide
    pose.leftEarRotate = -24;
    pose.rightEarRotate = 24;

    // Tail frozen or vibrating
    pose.tailRotate = shiver * 4;

    // Shocked expression: wide white eyes with tiny pupils & round "o" mouth
    pose.eyeType = "alert";
    pose.mouthType = "o";
    pose.pupilOffsetX = 0;
    pose.pupilOffsetY = 0;

    return pose;
  }

  exit(): void {}
}
