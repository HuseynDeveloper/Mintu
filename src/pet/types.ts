/**
 * Mintu Pet Types & Key Pose Definition
 */

export type EyeExpression = "normal" | "sleep" | "happy" | "alert";
export type MouthExpression = "smile" | "open" | "o" | "sleep" | "flat";
export type PetAccessory = "none" | "headphones" | "sleep-z" | "think-dots" | "question" | "music-notes" | "sparkles";

export interface PetPose {
  // Body transformation
  bodyScaleX: number;
  bodyScaleY: number;
  bodyOffsetY: number;
  bodyRotation: number;

  // Belly
  bellyScaleX: number;
  bellyScaleY: number;
  bellyOffsetY: number;

  // Head & Face
  headTilt: number;
  headOffsetX: number;
  headOffsetY: number;

  // Ears
  leftEarRotate: number;
  leftEarFold: number;
  rightEarRotate: number;
  rightEarFold: number;

  // Arms
  leftArmRotate: number;
  leftArmOffsetX: number;
  leftArmOffsetY: number;
  rightArmRotate: number;
  rightArmOffsetX: number;
  rightArmOffsetY: number;

  // Feet
  leftFootOffsetY: number;
  leftFootOffsetX: number;
  rightFootOffsetY: number;
  rightFootOffsetX: number;

  // Tail
  tailRotate: number;

  // Expressions
  eyeType: EyeExpression;
  mouthType: MouthExpression;
  pupilOffsetX: number; // -1 to 1
  pupilOffsetY: number; // -1 to 1
  eyelidClose: number;  // 0 = open, 1 = closed

  // Ground shadow
  shadowScale: number;
  shadowOpacity: number;

  // Accessories
  accessory: PetAccessory;
}

export interface PetState {
  name: string;
  enter(timeSec: number): void;
  update(timeSec: number, dtSec: number, context: StateContext): PetPose;
  exit(): void;
  isFinished?(): boolean;
}

export interface StateContext {
  cursorNormX: number; // Cursor relative to pet [-1..1]
  cursorNormY: number;
  cursorDistance: number;
  dragVelocityX: number;
  dragVelocityY: number;
  impactVelocity: number;
}
