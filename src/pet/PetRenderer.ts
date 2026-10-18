/**
 * Layered SVG Mintu Pet Renderer
 * Faithfully recreates the character sheet (Image A) as separate transformable
 * SVG groups driven by CSS variables and hardware-accelerated transforms.
 */

import { PetPose, PetAccessory } from "./types";

export class PetRenderer {
  public readonly container: HTMLElement;
  public readonly svg: SVGSVGElement;

  // Cached DOM elements for 60fps transform manipulation
  private elBody!: SVGGElement;
  private elBelly!: SVGGElement;
  private elHead!: SVGGElement;
  private elLeftEar!: SVGGElement;
  private elRightEar!: SVGGElement;
  private elLeftArm!: SVGGElement;
  private elRightArm!: SVGGElement;
  private elLeftFoot!: SVGGElement;
  private elRightFoot!: SVGGElement;
  private elTail!: SVGGElement;
  private elShadow!: SVGEllipseElement;

  // Eyes and facial features
  private elLeftPupil!: SVGGElement;
  private elRightPupil!: SVGGElement;
  private elLeftNormalEye!: SVGGElement;
  private elRightNormalEye!: SVGGElement;
  private elLeftHappyEye!: SVGPathElement;
  private elRightHappyEye!: SVGPathElement;
  private elLeftAlertEye!: SVGGElement;
  private elRightAlertEye!: SVGGElement;
  private elLeftSleepEye!: SVGPathElement;
  private elRightSleepEye!: SVGPathElement;

  // Mouth shapes
  private elMouthSmile!: SVGPathElement;
  private elMouthOpen!: SVGGElement;
  private elMouthO!: SVGGElement;
  private elMouthSleep!: SVGPathElement;
  private elMouthFlat!: SVGPathElement;

  // Accessories
  private elAccHeadphones!: SVGGElement;
  private elAccGlasses!: SVGGElement;
  private elAccWinterHat!: SVGGElement;
  private elAccCoffeeCup!: SVGGElement;
  private elAccSleepZ!: SVGGElement;
  private elAccThinkDots!: SVGGElement;
  private elAccQuestion!: SVGGElement;
  private elAccMusicNotes!: SVGGElement;
  private elAccSparkles!: SVGGElement;

  private isPillMode: boolean = false;

  constructor(isPillMode: boolean = false) {
    this.isPillMode = isPillMode;
    this.container = document.createElement("div");
    this.container.className = `mintu-pet-container ${isPillMode ? "pill-mode" : "full-mode"}`;
    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.initSvg();
    this.container.appendChild(this.svg);
  }

  private initSvg(): void {
    const s = this.svg;
    s.setAttribute("viewBox", "0 0 160 160");
    s.setAttribute("class", "mintu-pet-svg");
    s.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    s.innerHTML = `
      <defs>
        <!-- Soft head specular gradient -->
        <linearGradient id="headHighlightGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.32" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0.0" />
        </linearGradient>
        <!-- Ground shadow gradient -->
        <radialGradient id="shadowGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="var(--pet-ground-shadow, rgba(45,62,54,0.22))" />
          <stop offset="100%" stop-color="var(--pet-ground-shadow, rgba(45,62,54,0.0))" />
        </radialGradient>
      </defs>

      <!-- Layer 1: Ground Shadow (Free mode) -->
      <ellipse id="pet-shadow" cx="80" cy="147" rx="38" ry="7" fill="url(#shadowGrad)" />

      <!-- Layer 2: Curly Spiral Tail (behind body) -->
      <g id="pet-tail" style="transform-origin: 122px 115px;">
        <path d="M 122,118 C 132,122 142,118 140,108 C 138,98 126,100 128,110 C 130,116 136,116 137,112"
              fill="var(--pet-body)" stroke="var(--pet-outline)" stroke-width="3.5"
              stroke-linecap="round" stroke-linejoin="round" />
      </g>

      <!-- Layer 3: Tiny Feet (behind/under body) -->
      <g id="pet-left-foot" style="transform-origin: 63px 136px;">
        <path d="M 54,136 C 54,144 58,146 64,146 C 70,146 74,144 74,136 Z"
              fill="var(--pet-body)" stroke="var(--pet-outline)" stroke-width="3.2"
              stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g id="pet-right-foot" style="transform-origin: 97px 136px;">
        <path d="M 86,136 C 86,144 90,146 96,146 C 102,146 106,144 106,136 Z"
              fill="var(--pet-body)" stroke="var(--pet-outline)" stroke-width="3.2"
              stroke-linecap="round" stroke-linejoin="round" />
      </g>

      <!-- Layer 4: Main Chubby Body Blob -->
      <g id="pet-body" style="transform-origin: 80px 105px;">
        <!-- Base body contour -->
        <path d="M 80,44 C 108,44 126,62 126,92 C 126,122 110,140 80,140 C 50,140 34,122 34,92 C 34,62 52,44 80,44 Z"
              fill="var(--pet-body)" stroke="var(--pet-outline)" stroke-width="3.8"
              stroke-linejoin="round" />

        <!-- Soft top head highlight -->
        <path d="M 64,50 C 72,46 88,46 96,50 C 93,55 87,58 80,58 C 73,58 67,55 64,50 Z"
              fill="url(#headHighlightGrad)" />

        <!-- Cream / Peach Oval Belly -->
        <g id="pet-belly" style="transform-origin: 80px 108px;">
          <ellipse cx="80" cy="108" rx="28" ry="24" fill="var(--pet-belly)" />
        </g>
      </g>

      <!-- Layer 5: Floppy Puppy Ears -->
      <g id="pet-left-ear" style="transform-origin: 54px 54px;">
        <path d="M 54,54 C 36,54 28,68 34,80 C 37,86 46,88 52,82 C 55,78 52,66 54,54 Z"
              fill="var(--pet-body)" stroke="var(--pet-outline)" stroke-width="3.6"
              stroke-linejoin="round" />
        <!-- Ear fold line -->
        <path d="M 40,73 C 44,79 48,81 51,77"
              fill="none" stroke="var(--pet-outline)" stroke-width="2.6" stroke-linecap="round" />
      </g>
      <g id="pet-right-ear" style="transform-origin: 106px 54px;">
        <path d="M 106,54 C 124,54 132,68 126,80 C 123,86 114,88 108,82 C 105,78 108,66 106,54 Z"
              fill="var(--pet-body)" stroke="var(--pet-outline)" stroke-width="3.6"
              stroke-linejoin="round" />
        <!-- Ear fold line -->
        <path d="M 120,73 C 116,79 112,81 109,77"
              fill="none" stroke="var(--pet-outline)" stroke-width="2.6" stroke-linecap="round" />
      </g>

      <!-- Layer 6: Head & Facial Features Group -->
      <g id="pet-head" style="transform-origin: 80px 80px;">
        <!-- Soft pink blush marks on cheeks -->
        <ellipse cx="54" cy="85" rx="7" ry="4.5" fill="var(--pet-blush)" />
        <ellipse cx="106" cy="85" rx="7" ry="4.5" fill="var(--pet-blush)" />

        <!-- Tiny dark nose -->
        <ellipse cx="80" cy="77.5" rx="2.5" ry="1.8" fill="var(--pet-nose)" />

        <!-- LEFT EYE VARIANTS -->
        <g id="eye-left-normal" style="transform-origin: 66px 74px;">
          <circle cx="66" cy="74" r="7.5" fill="var(--pet-eye)" />
          <g id="pupil-left" style="transform-origin: 66px 74px;">
            <circle cx="64" cy="71.5" r="2.8" fill="var(--pet-eye-highlight)" />
            <circle cx="68" cy="76" r="1.3" fill="var(--pet-eye-highlight)" />
          </g>
        </g>
        <path id="eye-left-happy" d="M 60,76 L 66,70 L 72,76"
              fill="none" stroke="var(--pet-outline)" stroke-width="3.2"
              stroke-linecap="round" stroke-linejoin="round" style="display: none;" />
        <path id="eye-left-sleep" d="M 60,74 Q 66,79 72,74"
              fill="none" stroke="var(--pet-outline)" stroke-width="3.0"
              stroke-linecap="round" style="display: none;" />
        <g id="eye-left-alert" style="display: none;">
          <circle cx="66" cy="74" r="8.5" fill="#ffffff" stroke="var(--pet-outline)" stroke-width="2.5" />
          <circle cx="66" cy="74" r="3.0" fill="var(--pet-eye)" />
        </g>

        <!-- RIGHT EYE VARIANTS -->
        <g id="eye-right-normal" style="transform-origin: 94px 74px;">
          <circle cx="94" cy="74" r="7.5" fill="var(--pet-eye)" />
          <g id="pupil-right" style="transform-origin: 94px 74px;">
            <circle cx="92" cy="71.5" r="2.8" fill="var(--pet-eye-highlight)" />
            <circle cx="96" cy="76" r="1.3" fill="var(--pet-eye-highlight)" />
          </g>
        </g>
        <path id="eye-right-happy" d="M 88,76 L 94,70 L 100,76"
              fill="none" stroke="var(--pet-outline)" stroke-width="3.2"
              stroke-linecap="round" stroke-linejoin="round" style="display: none;" />
        <path id="eye-right-sleep" d="M 88,74 Q 94,79 100,74"
              fill="none" stroke="var(--pet-outline)" stroke-width="3.0"
              stroke-linecap="round" style="display: none;" />
        <g id="eye-right-alert" style="display: none;">
          <circle cx="94" cy="74" r="8.5" fill="#ffffff" stroke="var(--pet-outline)" stroke-width="2.5" />
          <circle cx="94" cy="74" r="3.0" fill="var(--pet-eye)" />
        </g>

        <!-- MOUTH VARIANTS -->
        <!-- 1: Default Puppy "w" smile -->
        <path id="mouth-smile" d="M 73.5,81 Q 76.8,84.5 80,81.5 Q 83.2,84.5 86.5,81"
              fill="none" stroke="var(--pet-mouth)" stroke-width="2.8" stroke-linecap="round" />

        <!-- 2: Happy Open Smile with pink tongue -->
        <g id="mouth-open" style="display: none;">
          <path d="M 73.5,81 Q 80,79.5 86.5,81 C 86.5,88.5 73.5,88.5 73.5,81 Z"
                fill="var(--pet-outline)" stroke="var(--pet-outline)" stroke-width="2.4" stroke-linejoin="round" />
          <path d="M 76,84.5 Q 80,82.5 84,84.5 Q 80,88.5 76,84.5 Z"
                fill="var(--pet-tongue)" />
        </g>

        <!-- 3: Alert / Shocked small round "o" mouth -->
        <g id="mouth-o" style="display: none;">
          <ellipse cx="80" cy="83.5" rx="3.5" ry="4.5" fill="var(--pet-outline)" />
          <ellipse cx="80" cy="84.5" rx="2.2" ry="2.5" fill="var(--pet-tongue)" />
        </g>

        <!-- 4: Sleepy subtle mouth -->
        <path id="mouth-sleep" d="M 77,82.5 Q 80,84.5 83,82.5"
              fill="none" stroke="var(--pet-mouth)" stroke-width="2.4" stroke-linecap="round" style="display: none;" />

        <!-- 5: Thinking flat mouth -->
        <path id="mouth-flat" d="M 75,82.5 Q 79,81.5 83,83"
              fill="none" stroke="var(--pet-mouth)" stroke-width="2.6" stroke-linecap="round" style="display: none;" />
      </g>

      <!-- Layer 7: Stubby Arms (in front of body) -->
      <g id="pet-left-arm" style="transform-origin: 42px 92px;">
        <path d="M 40,88 C 34,92 34,106 46,110 C 52,112 56,108 52,102 C 48,96 44,92 40,88 Z"
              fill="var(--pet-body)" stroke="var(--pet-outline)" stroke-width="3.4"
              stroke-linejoin="round" />
      </g>
      <g id="pet-right-arm" style="transform-origin: 118px 92px;">
        <path d="M 120,88 C 126,92 126,106 114,110 C 108,112 104,108 108,102 C 112,96 116,92 120,88 Z"
              fill="var(--pet-body)" stroke="var(--pet-outline)" stroke-width="3.4"
              stroke-linejoin="round" />
      </g>

      <!-- Layer 8: Accessories Layer (Overlays) -->
      <!-- A: Headphones (Timer slot) -->
      <g id="acc-headphones" style="display: none;">
        <path d="M 44,66 C 44,28 116,28 116,66"
              fill="none" stroke="var(--pet-accessory-headphones, #374151)" stroke-width="5" stroke-linecap="round" />
        <rect x="34" y="54" width="13" height="25" rx="6.5"
              fill="var(--pet-accessory-headphones, #374151)" stroke="var(--pet-accessory-headphones-accent, #10B981)" stroke-width="2.2" />
        <rect x="113" y="54" width="13" height="25" rx="6.5"
              fill="var(--pet-accessory-headphones, #374151)" stroke="var(--pet-accessory-headphones-accent, #10B981)" stroke-width="2.2" />
      </g>

      <!-- G: Stylish Round Glasses -->
      <g id="acc-glasses" style="display: none;">
        <circle cx="66" cy="74" r="11" fill="none" stroke="#1e293b" stroke-width="2.2" />
        <circle cx="94" cy="74" r="11" fill="none" stroke="#1e293b" stroke-width="2.2" />
        <path d="M 77,74 Q 80,71 83,74" fill="none" stroke="#1e293b" stroke-width="2.2" />
        <path d="M 55,73 L 44,71 M 105,73 L 116,71" fill="none" stroke="#1e293b" stroke-width="2.2" stroke-linecap="round" />
        <line x1="61" y1="68" x2="65" y2="65" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" opacity="0.6" />
        <line x1="89" y1="68" x2="93" y2="65" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" opacity="0.6" />
      </g>

      <!-- H: Knitted Winter Hat -->
      <g id="acc-winter-hat" style="display: none;">
        <!-- Fluffy pompom on top -->
        <circle cx="80" cy="22" r="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5" />
        <!-- Red knitted cap body -->
        <path d="M 48,52 C 50,30 110,30 112,52 Z" fill="#ef4444" stroke="#dc2626" stroke-width="1.8" />
        <!-- White folded brim -->
        <rect x="46" y="47" width="68" height="11" rx="5.5" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5" />
      </g>

      <!-- I: Warm Coffee Cup -->
      <g id="acc-coffee-cup" style="display: none;">
        <!-- Rising steam -->
        <path d="M 114,88 Q 112,83 115,79 M 121,88 Q 124,83 122,79" fill="none" stroke="#cbd5e1" stroke-width="1.5" stroke-linecap="round" />
        <!-- Cup -->
        <path d="M 108,93 L 111,114 C 111,117 125,117 125,114 L 128,93 Z" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.8" />
        <!-- Mint sleeve -->
        <rect x="109" y="99" width="18" height="8" rx="2" fill="#34d399" />
      </g>

      <!-- B: Sleep Z's -->
      <g id="acc-sleep-z" style="display: none;" class="acc-float">
        <text x="108" y="38" font-family="'Inter', sans-serif" font-size="14" font-weight="bold" fill="#7ed4bd">Z</text>
        <text x="124" y="24" font-family="'Inter', sans-serif" font-size="19" font-weight="bold" fill="#7ed4bd">Z</text>
      </g>

      <!-- C: Thinking Dots "..." -->
      <g id="acc-think-dots" style="display: none;" class="acc-float">
        <circle cx="70" cy="28" r="3.2" fill="#7ed4bd" />
        <circle cx="80" cy="26" r="3.2" fill="#7ed4bd" />
        <circle cx="90" cy="28" r="3.2" fill="#7ed4bd" />
      </g>

      <!-- D: Curious Question Mark "?" -->
      <g id="acc-question" style="display: none;" class="acc-float">
        <text x="110" y="38" font-family="'Inter', sans-serif" font-size="20" font-weight="900" fill="#7ed4bd">?</text>
      </g>

      <!-- E: Music Notes "♪ ♫" -->
      <g id="acc-music-notes" style="display: none;" class="acc-float">
        <text x="32" y="44" font-family="'Inter', sans-serif" font-size="16" fill="#7ed4bd">♪</text>
        <text x="116" y="36" font-family="'Inter', sans-serif" font-size="18" fill="#7ed4bd">♫</text>
      </g>

      <!-- F: Joyful Sparkles -->
      <g id="acc-sparkles" style="display: none;" class="acc-float">
        <path d="M 36,36 Q 40,36 40,32 Q 40,36 44,36 Q 40,36 40,40 Q 40,36 36,36 Z" fill="#ffd166" />
        <path d="M 120,40 Q 124,40 124,36 Q 124,40 128,40 Q 124,40 124,44 Q 124,40 120,40 Z" fill="#ffd166" />
      </g>
    `;

    // Query and cache all elements
    this.elBody = s.querySelector("#pet-body")!;
    this.elBelly = s.querySelector("#pet-belly")!;
    this.elHead = s.querySelector("#pet-head")!;
    this.elLeftEar = s.querySelector("#pet-left-ear")!;
    this.elRightEar = s.querySelector("#pet-right-ear")!;
    this.elLeftArm = s.querySelector("#pet-left-arm")!;
    this.elRightArm = s.querySelector("#pet-right-arm")!;
    this.elLeftFoot = s.querySelector("#pet-left-foot")!;
    this.elRightFoot = s.querySelector("#pet-right-foot")!;
    this.elTail = s.querySelector("#pet-tail")!;
    this.elShadow = s.querySelector("#pet-shadow")!;

    this.elLeftPupil = s.querySelector("#pupil-left")!;
    this.elRightPupil = s.querySelector("#pupil-right")!;
    this.elLeftNormalEye = s.querySelector("#eye-left-normal")!;
    this.elRightNormalEye = s.querySelector("#eye-right-normal")!;
    this.elLeftHappyEye = s.querySelector("#eye-left-happy")!;
    this.elRightHappyEye = s.querySelector("#eye-right-happy")!;
    this.elLeftAlertEye = s.querySelector("#eye-left-alert")!;
    this.elRightAlertEye = s.querySelector("#eye-right-alert")!;
    this.elLeftSleepEye = s.querySelector("#eye-left-sleep")!;
    this.elRightSleepEye = s.querySelector("#eye-right-sleep")!;

    this.elMouthSmile = s.querySelector("#mouth-smile")!;
    this.elMouthOpen = s.querySelector("#mouth-open")!;
    this.elMouthO = s.querySelector("#mouth-o")!;
    this.elMouthSleep = s.querySelector("#mouth-sleep")!;
    this.elMouthFlat = s.querySelector("#mouth-flat")!;

    this.elAccHeadphones = s.querySelector("#acc-headphones")!;
    this.elAccGlasses = s.querySelector("#acc-glasses")!;
    this.elAccWinterHat = s.querySelector("#acc-winter-hat")!;
    this.elAccCoffeeCup = s.querySelector("#acc-coffee-cup")!;
    this.elAccSleepZ = s.querySelector("#acc-sleep-z")!;
    this.elAccThinkDots = s.querySelector("#acc-think-dots")!;
    this.elAccQuestion = s.querySelector("#acc-question")!;
    this.elAccMusicNotes = s.querySelector("#acc-music-notes")!;
    this.elAccSparkles = s.querySelector("#acc-sparkles")!;

    if (this.isPillMode) {
      this.elShadow.style.display = "none";
      this.elLeftFoot.style.display = "none";
      this.elRightFoot.style.display = "none";
      this.elTail.style.display = "none";
    }
  }

  render(pose: PetPose): void {
    // 1. Body & Belly
    this.elBody.style.transform = `translate(0px, ${pose.bodyOffsetY}px) rotate(${pose.bodyRotation}deg) scale(${pose.bodyScaleX}, ${pose.bodyScaleY})`;
    this.elBelly.style.transform = `translate(0px, ${pose.bellyOffsetY}px) scale(${pose.bellyScaleX}, ${pose.bellyScaleY})`;

    // 2. Head & Tilt
    this.elHead.style.transform = `translate(${pose.headOffsetX}px, ${pose.headOffsetY}px) rotate(${pose.headTilt}deg)`;

    // 3. Ears
    this.elLeftEar.style.transform = `rotate(${pose.leftEarRotate}deg) skewY(${pose.leftEarFold}deg)`;
    this.elRightEar.style.transform = `rotate(${pose.rightEarRotate}deg) skewY(${-pose.rightEarFold}deg)`;

    // 4. Arms
    this.elLeftArm.style.transform = `translate(${pose.leftArmOffsetX}px, ${pose.leftArmOffsetY}px) rotate(${pose.leftArmRotate}deg)`;
    this.elRightArm.style.transform = `translate(${pose.rightArmOffsetX}px, ${pose.rightArmOffsetY}px) rotate(${pose.rightArmRotate}deg)`;

    // 5. Feet & Tail
    if (!this.isPillMode) {
      this.elLeftFoot.style.transform = `translate(${pose.leftFootOffsetX}px, ${pose.leftFootOffsetY}px)`;
      this.elRightFoot.style.transform = `translate(${pose.rightFootOffsetX}px, ${pose.rightFootOffsetY}px)`;
      this.elTail.style.transform = `rotate(${pose.tailRotate}deg)`;

      // Shadow
      this.elShadow.style.transform = `scale(${pose.shadowScale})`;
      this.elShadow.style.opacity = `${pose.shadowOpacity}`;
    }

    // 6. Eyes
    const e = pose.eyeType;
    this.elLeftNormalEye.style.display = e === "normal" ? "inline" : "none";
    this.elRightNormalEye.style.display = e === "normal" ? "inline" : "none";
    this.elLeftHappyEye.style.display = e === "happy" ? "inline" : "none";
    this.elRightHappyEye.style.display = e === "happy" ? "inline" : "none";
    this.elLeftSleepEye.style.display = e === "sleep" ? "inline" : "none";
    this.elRightSleepEye.style.display = e === "sleep" ? "inline" : "none";
    this.elLeftAlertEye.style.display = e === "alert" ? "inline" : "none";
    this.elRightAlertEye.style.display = e === "alert" ? "inline" : "none";

    // Pupils translation (normal eye mode)
    if (e === "normal") {
      const px = pose.pupilOffsetX * 3.5;
      const py = pose.pupilOffsetY * 2.8;
      this.elLeftPupil.style.transform = `translate(${px}px, ${py}px)`;
      this.elRightPupil.style.transform = `translate(${px}px, ${py}px)`;
    }

    // 7. Mouth
    const m = pose.mouthType;
    this.elMouthSmile.style.display = m === "smile" ? "inline" : "none";
    this.elMouthOpen.style.display = m === "open" ? "inline" : "none";
    this.elMouthO.style.display = m === "o" ? "inline" : "none";
    this.elMouthSleep.style.display = m === "sleep" ? "inline" : "none";
    this.elMouthFlat.style.display = m === "flat" ? "inline" : "none";

    // 8. Accessories
    const acc = pose.accessory;
    this.elAccHeadphones.style.display = acc === "headphones" ? "inline" : "none";
    this.elAccGlasses.style.display = acc === "glasses" ? "inline" : "none";
    this.elAccWinterHat.style.display = acc === "winter_hat" ? "inline" : "none";
    this.elAccCoffeeCup.style.display = acc === "coffee_cup" ? "inline" : "none";
    this.elAccSleepZ.style.display = acc === "sleep-z" ? "inline" : "none";
    this.elAccThinkDots.style.display = acc === "think-dots" ? "inline" : "none";
    this.elAccQuestion.style.display = acc === "question" ? "inline" : "none";
    this.elAccMusicNotes.style.display = acc === "music-notes" ? "inline" : "none";
    this.elAccSparkles.style.display = acc === "sparkles" ? "inline" : "none";
  }

  setAccessory(acc: PetAccessory): void {
    this.elAccHeadphones.style.display = acc === "headphones" ? "inline" : "none";
    this.elAccGlasses.style.display = acc === "glasses" ? "inline" : "none";
    this.elAccWinterHat.style.display = acc === "winter_hat" ? "inline" : "none";
    this.elAccCoffeeCup.style.display = acc === "coffee_cup" ? "inline" : "none";
    this.elAccSleepZ.style.display = acc === "sleep-z" ? "inline" : "none";
    this.elAccThinkDots.style.display = acc === "think-dots" ? "inline" : "none";
    this.elAccQuestion.style.display = acc === "question" ? "inline" : "none";
    this.elAccMusicNotes.style.display = acc === "music-notes" ? "inline" : "none";
    this.elAccSparkles.style.display = acc === "sparkles" ? "inline" : "none";
  }
}
