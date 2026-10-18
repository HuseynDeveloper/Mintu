import { PetPose, PetState, StateContext } from "../types";
import { createDefaultPose } from "./basePose";

export class HappyState implements PetState {
  name = "happy";
  private startTime = 0;

  enter(timeSec: number): void {
    this.startTime = timeSec;
  }

  update(timeSec: number, _dtSec: number, _context: StateContext): PetPose {
    const t = timeSec - this.startTime;
    const pose = createDefaultPose();
    const jumpFreq = 5.2; // Bouncy jumping rhythm

    // Jump parabola: bounce off ground into air
    const jumpCycle = (t * jumpFreq) % (Math.PI * 2);
    const jumpHeight = Math.max(0, Math.sin(jumpCycle));
    const isAirborne = jumpHeight > 0.05;

    // Vertical position: -22px at apex
    pose.bodyOffsetY = -jumpHeight * 22;

    // Squash on landing, stretch on rise
    if (isAirborne) {
      pose.bodyScaleX = 0.92;
      pose.bodyScaleY = 1.12;
      pose.shadowScale = 0.55;
      pose.shadowOpacity = 0.45;
    } else {
      pose.bodyScaleX = 1.15;
      pose.bodyScaleY = 0.85;
      pose.shadowScale = 1.15;
      pose.shadowOpacity = 0.9;
    }

    // Arms up high in celebration (\o/)
    pose.leftArmRotate = -115 + Math.sin(t * 8.0) * 12;
    pose.leftArmOffsetY = -14;
    pose.rightArmRotate = 115 - Math.sin(t * 8.0) * 12;
    pose.rightArmOffsetY = -14;

    // Ears flapping with jump inertia
    pose.leftEarRotate = -22 - jumpHeight * 14;
    pose.rightEarRotate = 22 + jumpHeight * 14;

    // Feet kicked up happily
    pose.leftFootOffsetY = -jumpHeight * 8;
    pose.rightFootOffsetY = -jumpHeight * 8;

    // Fast joyful tail wag
    pose.tailRotate = Math.sin(t * 12.0) * 22;

    // Closed "^ ^" happy eyes and wide laughing open mouth
    pose.eyeType = "happy";
    pose.mouthType = "open";

    // Golden sparkles floating
    pose.accessory = "sparkles";

    return pose;
  }

  exit(): void {}
}
