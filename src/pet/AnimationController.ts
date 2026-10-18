/**
 * Animation Controller & Blended State Machine
 * Handles seamless cross-fading between poses (no hard cuts),
 * secondary micro-animations (breathing, blinks, double blinks, ear twitches),
 * and spring follow-through for ears and tail.
 */

import { PetPose, PetState, StateContext, PetAccessory } from "./types";
import { Spring1D, SpringPresets } from "./physics/Spring";
import { IdleState } from "./states/idle";
import { WalkState } from "./states/walk";
import { SleepState } from "./states/sleep";
import { WakeState } from "./states/wake";
import { ThinkState } from "./states/think";
import { TalkState } from "./states/talk";
import { HappyState } from "./states/happy";
import { CuriousState } from "./states/curious";
import { AlertState } from "./states/alert";
import { DraggedState } from "./states/dragged";
import { LandingState } from "./states/landing";
import { PeekState } from "./states/peek";
import { NotifyReactState } from "./states/notifyReact";
import { DanceState } from "./states/dance";
import { HeadphonesFocusState } from "./states/headphonesFocus";

export class AnimationController {
  private states = new Map<string, PetState>();
  private currentState: PetState;
  private previousState: PetState | null = null;
  private transitionStartTime: number = 0;
  private transitionDuration: number = 0.28; // Cross-fade duration (seconds)
  private isTransitioning: boolean = false;

  // Spring follow-through physics for ears and tail
  private earSpringLeft = new Spring1D(0, SpringPresets.bouncy);
  private earSpringRight = new Spring1D(0, SpringPresets.bouncy);
  private tailSpring = new Spring1D(0, SpringPresets.bouncy);

  // Micro-animation timers
  private nextBlinkTime: number = 2.0;
  private isBlinking: boolean = false;
  private blinkStartTime: number = 0;
  private isDoubleBlink: boolean = false;

  private nextEarTwitchTime: number = 4.5;
  private isEarTwitching: boolean = false;
  private earTwitchStartTime: number = 0;

  // Look-at cursor state
  public cursorNormX: number = 0;
  public cursorNormY: number = 0;
  public cursorDistance: number = 9999;
  public dragVelocityX: number = 0;
  public dragVelocityY: number = 0;
  public impactVelocity: number = 0;

  private forcedAccessory: PetAccessory | null = null;

  constructor() {
    // Register all 15 states
    this.registerState(new IdleState());
    this.registerState(new WalkState());
    this.registerState(new SleepState());
    this.registerState(new WakeState());
    this.registerState(new ThinkState());
    this.registerState(new TalkState());
    this.registerState(new HappyState());
    this.registerState(new CuriousState());
    this.registerState(new AlertState());
    this.registerState(new DraggedState());
    this.registerState(new LandingState());
    this.registerState(new PeekState());
    this.registerState(new NotifyReactState());
    this.registerState(new DanceState());
    this.registerState(new HeadphonesFocusState());

    this.currentState = this.states.get("idle")!;
    this.currentState.enter(0);
  }

  registerState(state: PetState): void {
    this.states.set(state.name, state);
  }

  getStateName(): string {
    return this.currentState.name;
  }

  setState(name: string, transitionDurationSec: number = 0.26): boolean {
    const next = this.states.get(name);
    if (!next || next === this.currentState) return false;

    const nowSec = performance.now() / 1000;
    this.previousState = this.currentState;
    this.currentState = next;
    this.currentState.enter(nowSec);
    this.transitionStartTime = nowSec;
    this.transitionDuration = Math.max(0.05, transitionDurationSec);
    this.isTransitioning = true;
    return true;
  }

  react(emotion: string): void {
    switch (emotion) {
      case "happy":
        this.setState("happy");
        break;
      case "alert":
        this.setState("alert");
        break;
      case "curious":
        this.setState("curious");
        break;
      case "think":
        this.setState("think");
        break;
      default:
        this.setState("idle");
    }
  }

  lookAt(normX: number, normY: number): void {
    this.cursorNormX = Math.max(-1, Math.min(1, normX));
    this.cursorNormY = Math.max(-1, Math.min(1, normY));
  }

  setAccessory(acc: PetAccessory): void {
    this.forcedAccessory = acc;
  }

  update(timeSec: number, dtSec: number): PetPose {
    const ctx: StateContext = {
      cursorNormX: this.cursorNormX,
      cursorNormY: this.cursorNormY,
      cursorDistance: this.cursorDistance,
      dragVelocityX: this.dragVelocityX,
      dragVelocityY: this.dragVelocityY,
      impactVelocity: this.impactVelocity,
    };

    // 1. Compute target pose from current state
    const currentPose = this.currentState.update(timeSec, dtSec, ctx);

    // 2. Blend with previous pose if transitioning (cross-fade parameters)
    let finalPose: PetPose;
    if (this.isTransitioning && this.previousState) {
      const elapsed = timeSec - this.transitionStartTime;
      const progress = Math.min(1.0, elapsed / this.transitionDuration);

      // Smooth cosine easing
      const t = 0.5 - 0.5 * Math.cos(progress * Math.PI);

      const prevPose = this.previousState.update(timeSec, dtSec, ctx);
      finalPose = this.blendPoses(prevPose, currentPose, t);

      if (progress >= 1.0) {
        this.isTransitioning = false;
        this.previousState.exit();
        this.previousState = null;
      }
    } else {
      finalPose = currentPose;
    }

    // 3. Apply Spring Follow-Through (ears & tail lag behind body movement)
    this.earSpringLeft.setTarget(finalPose.leftEarRotate);
    this.earSpringRight.setTarget(finalPose.rightEarRotate);
    this.tailSpring.setTarget(finalPose.tailRotate);

    this.earSpringLeft.update(dtSec);
    this.earSpringRight.update(dtSec);
    this.tailSpring.update(dtSec);

    finalPose.leftEarRotate = this.earSpringLeft.value;
    finalPose.rightEarRotate = this.earSpringRight.value;
    finalPose.tailRotate = this.tailSpring.value;

    // 4. Apply Independent Micro-Animations
    this.applyMicroAnimations(finalPose, timeSec);

    // 5. Override accessory if explicitly set
    if (this.forcedAccessory) {
      finalPose.accessory = this.forcedAccessory;
    }

    return finalPose;
  }

  private applyMicroAnimations(pose: PetPose, timeSec: number): void {
    // Only apply blinking if awake and eyes are normal
    if (pose.eyeType === "normal") {
      if (!this.isBlinking && timeSec >= this.nextBlinkTime) {
        this.isBlinking = true;
        this.blinkStartTime = timeSec;
        this.isDoubleBlink = Math.random() < 0.28; // 28% chance of cute double blink
      }

      if (this.isBlinking) {
        const blinkElapsed = timeSec - this.blinkStartTime;
        const singleBlinkDuration = 0.14;

        if (this.isDoubleBlink) {
          // Double blink pattern: blink 1 -> short pause -> blink 2
          if (blinkElapsed < singleBlinkDuration) {
            pose.eyeType = "sleep"; // Closed during blink
          } else if (blinkElapsed < singleBlinkDuration + 0.08) {
            pose.eyeType = "normal"; // Open pause
          } else if (blinkElapsed < singleBlinkDuration * 2 + 0.08) {
            pose.eyeType = "sleep"; // Second blink
          } else {
            this.isBlinking = false;
            this.nextBlinkTime = timeSec + 2.5 + Math.random() * 3.5;
          }
        } else {
          // Single blink
          if (blinkElapsed < singleBlinkDuration) {
            pose.eyeType = "sleep";
          } else {
            this.isBlinking = false;
            this.nextBlinkTime = timeSec + 2.5 + Math.random() * 3.5;
          }
        }
      }
    }

    // Ear Twitch: occasional random quick ear flick
    if (!this.isEarTwitching && timeSec >= this.nextEarTwitchTime) {
      this.isEarTwitching = true;
      this.earTwitchStartTime = timeSec;
    }
    if (this.isEarTwitching) {
      const twitchElapsed = timeSec - this.earTwitchStartTime;
      const twitchDuration = 0.22;
      if (twitchElapsed < twitchDuration) {
        const twitchAngle = Math.sin((twitchElapsed / twitchDuration) * Math.PI * 4) * 7;
        pose.leftEarRotate += twitchAngle;
        pose.leftEarFold += Math.abs(twitchAngle) * 0.5;
      } else {
        this.isEarTwitching = false;
        this.nextEarTwitchTime = timeSec + 4.0 + Math.random() * 6.0;
      }
    }
  }

  private blendPoses(a: PetPose, b: PetPose, t: number): PetPose {
    const lerp = (v1: number, v2: number) => v1 + (v2 - v1) * t;

    return {
      bodyScaleX: lerp(a.bodyScaleX, b.bodyScaleX),
      bodyScaleY: lerp(a.bodyScaleY, b.bodyScaleY),
      bodyOffsetY: lerp(a.bodyOffsetY, b.bodyOffsetY),
      bodyRotation: lerp(a.bodyRotation, b.bodyRotation),

      bellyScaleX: lerp(a.bellyScaleX, b.bellyScaleX),
      bellyScaleY: lerp(a.bellyScaleY, b.bellyScaleY),
      bellyOffsetY: lerp(a.bellyOffsetY, b.bellyOffsetY),

      headTilt: lerp(a.headTilt, b.headTilt),
      headOffsetX: lerp(a.headOffsetX, b.headOffsetX),
      headOffsetY: lerp(a.headOffsetY, b.headOffsetY),

      leftEarRotate: lerp(a.leftEarRotate, b.leftEarRotate),
      leftEarFold: lerp(a.leftEarFold, b.leftEarFold),
      rightEarRotate: lerp(a.rightEarRotate, b.rightEarRotate),
      rightEarFold: lerp(a.rightEarFold, b.rightEarFold),

      leftArmRotate: lerp(a.leftArmRotate, b.leftArmRotate),
      leftArmOffsetX: lerp(a.leftArmOffsetX, b.leftArmOffsetX),
      leftArmOffsetY: lerp(a.leftArmOffsetY, b.leftArmOffsetY),
      rightArmRotate: lerp(a.rightArmRotate, b.rightArmRotate),
      rightArmOffsetX: lerp(a.rightArmOffsetX, b.rightArmOffsetX),
      rightArmOffsetY: lerp(a.rightArmOffsetY, b.rightArmOffsetY),

      leftFootOffsetY: lerp(a.leftFootOffsetY, b.leftFootOffsetY),
      leftFootOffsetX: lerp(a.leftFootOffsetX, b.leftFootOffsetX),
      rightFootOffsetY: lerp(a.rightFootOffsetY, b.rightFootOffsetY),
      rightFootOffsetX: lerp(a.rightFootOffsetX, b.rightFootOffsetX),

      tailRotate: lerp(a.tailRotate, b.tailRotate),

      eyeType: t < 0.5 ? a.eyeType : b.eyeType,
      mouthType: t < 0.5 ? a.mouthType : b.mouthType,
      pupilOffsetX: lerp(a.pupilOffsetX, b.pupilOffsetX),
      pupilOffsetY: lerp(a.pupilOffsetY, b.pupilOffsetY),
      eyelidClose: lerp(a.eyelidClose, b.eyelidClose),

      shadowScale: lerp(a.shadowScale, b.shadowScale),
      shadowOpacity: lerp(a.shadowOpacity, b.shadowOpacity),

      accessory: t < 0.5 ? a.accessory : b.accessory,
    };
  }
}
