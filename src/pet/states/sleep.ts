import { PetPose, PetState, StateContext } from "../types";
import { createDefaultPose } from "./basePose";

export class SleepState implements PetState {
  name = "sleep";
  private startTime = 0;

  enter(timeSec: number): void {
    this.startTime = timeSec;
  }

  update(timeSec: number, _dtSec: number, _context: StateContext): PetPose {
    const t = timeSec - this.startTime;
    const pose = createDefaultPose();

    // Very slow peaceful breathing (every 4.5 seconds)
    const breath = Math.sin(t * 1.4);

    // Flattened, lowered posture on the ground
    pose.bodyScaleX = 1.22 + breath * 0.02;
    pose.bodyScaleY = 0.72 - breath * 0.02;
    pose.bodyOffsetY = 16 + breath * 0.8;

    // Belly expands softly
    pose.bellyScaleX = 1.25 + breath * 0.03;
    pose.bellyScaleY = 0.7 + breath * 0.02;
    pose.bellyOffsetY = 6;

    // Head lowered and resting
    pose.headOffsetY = 8;
    pose.headTilt = 3;

    // Ears resting flat against the ground
    pose.leftEarRotate = -22;
    pose.leftEarFold = 10;
    pose.rightEarRotate = 22;
    pose.rightEarFold = 10;

    // Arms tucked flat forward
    pose.leftArmRotate = 35;
    pose.leftArmOffsetY = 6;
    pose.rightArmRotate = -35;
    pose.rightArmOffsetY = 6;

    // Feet tucked under
    pose.leftFootOffsetY = -4;
    pose.rightFootOffsetY = -4;

    // Tail curled peacefully
    pose.tailRotate = -10 + Math.sin(t * 0.8) * 4;

    // Sleeping expression with floating Z's
    pose.eyeType = "sleep";
    pose.mouthType = "sleep";
    pose.eyelidClose = 1;

    // Wider shadow on ground
    pose.shadowScale = 1.25;
    pose.shadowOpacity = 0.85;

    // Floating Z letters
    pose.accessory = "sleep-z";

    return pose;
  }

  exit(): void {}
}
