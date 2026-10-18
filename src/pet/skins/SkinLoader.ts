/**
 * Skin Loader System
 * Supports SVG layered skin definitions and Spritesheet skin definitions
 * with custom color palettes mapped to CSS variables.
 */

export interface SkinColors {
  petBody?: string;
  petBodyShadow?: string;
  petBelly?: string;
  petBellyShadow?: string;
  petOutline?: string;
  petEye?: string;
  petEyeHighlight?: string;
  petBlush?: string;
  petNose?: string;
  petMouth?: string;
  petTongue?: string;
  petEarInner?: string;
  petGroundShadow?: string;
  accessoryHeadphones?: string;
  accessoryAccent?: string;
}

export interface SkinMetadata {
  id: string;
  name: string;
  author: string;
  version: string;
  type: "svg" | "spritesheet";
  colors: SkinColors;
  spritesheet?: {
    frameWidth: number;
    frameHeight: number;
    states: Record<string, { x: number; y: number; frames: number }>;
  };
}

export const DEFAULT_MINTU_SKIN: SkinMetadata = {
  id: "default-mintu",
  name: "Mintu (Classic Mint)",
  author: "Mintu Team",
  version: "1.0.0",
  type: "svg",
  colors: {
    petBody: "#A8E8D5",
    petBodyShadow: "#8FE0C8",
    petBelly: "#FFF2DD",
    petBellyShadow: "#FBE6CA",
    petOutline: "#2D3E36",
    petEye: "#23342D",
    petEyeHighlight: "#FFFFFF",
    petBlush: "#FFAAA6",
    petNose: "#23342D",
    petMouth: "#2D3E36",
    petTongue: "#FF758F",
    petEarInner: "#92DFC9",
    petGroundShadow: "rgba(45, 62, 54, 0.16)",
    accessoryHeadphones: "#374151",
    accessoryAccent: "#10B981",
  },
};

export class SkinLoader {
  private currentSkin: SkinMetadata = DEFAULT_MINTU_SKIN;

  constructor() {
    this.applySkin(this.currentSkin);
  }

  getCurrentSkin(): SkinMetadata {
    return this.currentSkin;
  }

  applySkin(skin: SkinMetadata): void {
    this.currentSkin = skin;
    const root = document.documentElement;

    const c = skin.colors;
    if (c.petBody) root.style.setProperty("--pet-body", c.petBody);
    if (c.petBodyShadow) root.style.setProperty("--pet-body-shadow", c.petBodyShadow);
    if (c.petBelly) root.style.setProperty("--pet-belly", c.petBelly);
    if (c.petBellyShadow) root.style.setProperty("--pet-belly-shadow", c.petBellyShadow);
    if (c.petOutline) root.style.setProperty("--pet-outline", c.petOutline);
    if (c.petEye) root.style.setProperty("--pet-eye", c.petEye);
    if (c.petEyeHighlight) root.style.setProperty("--pet-eye-highlight", c.petEyeHighlight);
    if (c.petBlush) root.style.setProperty("--pet-blush", c.petBlush);
    if (c.petNose) root.style.setProperty("--pet-nose", c.petNose);
    if (c.petMouth) root.style.setProperty("--pet-mouth", c.petMouth);
    if (c.petTongue) root.style.setProperty("--pet-tongue", c.petTongue);
    if (c.petEarInner) root.style.setProperty("--pet-ear-inner", c.petEarInner);
    if (c.petGroundShadow) root.style.setProperty("--pet-ground-shadow", c.petGroundShadow);
    if (c.accessoryHeadphones) root.style.setProperty("--pet-accessory-headphones", c.accessoryHeadphones);
    if (c.accessoryAccent) root.style.setProperty("--pet-accessory-headphones-accent", c.accessoryAccent);
  }

  loadFromJson(json: SkinMetadata): void {
    this.applySkin(json);
  }
}

export const skinLoader = new SkinLoader();
