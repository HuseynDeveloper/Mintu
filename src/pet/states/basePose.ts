import { PetPose } from "../types";

export function createDefaultPose(): PetPose {
  return {
    bodyScaleX: 1.0,
    bodyScaleY: 1.0,
    bodyOffsetY: 0,
    bodyRotation: 0,

    bellyScaleX: 1.0,
    bellyScaleY: 1.0,
    bellyOffsetY: 0,

    headTilt: 0,
    headOffsetX: 0,
    headOffsetY: 0,

    leftEarRotate: 0,
    leftEarFold: 0,
    rightEarRotate: 0,
    rightEarFold: 0,

    leftArmRotate: 0,
    leftArmOffsetX: 0,
    leftArmOffsetY: 0,
    rightArmRotate: 0,
    rightArmOffsetX: 0,
    rightArmOffsetY: 0,

    leftFootOffsetY: 0,
    leftFootOffsetX: 0,
    rightFootOffsetY: 0,
    rightFootOffsetX: 0,

    tailRotate: 0,

    eyeType: "normal",
    mouthType: "smile",
    pupilOffsetX: 0,
    pupilOffsetY: 0,
    eyelidClose: 0,

    shadowScale: 1.0,
    shadowOpacity: 1.0,

    accessory: "none",
  };
}
