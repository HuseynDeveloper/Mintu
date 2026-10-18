import { PetPose, PetState, StateContext } from "../types";
import { createDefaultPose } from "./basePose";

export class DraggedState implements PetState {
  name = "dragged";
  private startTime = 0;

  enter(timeSec: number): void {
    this.startTime = timeSec;
  }

  update(timeSec: number, _dtSec: number, context: StateContext): PetPose {
    const t = timeSec - this.startTime;
    const pose = createDefaultPose();

    // Body sways opposite to drag velocity (inertia)
    const velClampedX = Math.max(-400, Math.min(400, context.dragVelocityX));
    const swayAngle = (-velClampedX / 400) * 18;

    pose.bodyRotation = swayAngle + Math.sin(t * 5.0) * 3;
    pose.bodyScaleX = 0.94;
    pose.bodyScaleY = 1.08; // Stretched by gravity

    // Arms dangling helplessly
    pose.leftArmRotate = -40 + swayAngle * 0.5;
    pose.rightArmRotate = 40 + swayAngle * 0.5;
    pose.leftArmOffsetY = 4;
    pose.rightArmOffsetY = 4;

    // Legs dangling down and kicking slightly
    const legKick = Math.sin(t * 8.0) * 6;
    pose.leftFootOffsetY = 6 + legKick;
    pose.rightFootOffsetY = 6 - legKick;

    // Ears streaming with motion
    pose.leftEarRotate = -15 + swayAngle * 0.4;
    pose.rightEarRotate = 15 + swayAngle * 0.4;

    // Tail swinging loosely
    pose.tailRotate = swayAngle * 1.2;

    // Worried expression looking down towards ground
    pose.eyeType = "alert";
    pose.mouthType = "o";
    pose.pupilOffsetY = 0.7; // Looking down

    // Shadow is smaller and faint while held in air
    pose.shadowScale = 0.4;
    pose.shadowOpacity = 0.3;

    return pose;
  }

  exit(): void {}
}
