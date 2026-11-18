/**
 * Skin Loader System
 * Supports SVG layered skin definitions and Spritesheet skin definitions
 * with custom color palettes mapped to CSS variables and 6 built-in presets.
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
  swatch: [string, string];
  colors: SkinColors;
  spritesheet?: {
    frameWidth: number;
    frameHeight: number;
    states: Record<string, { x: number; y: number; frames: number }>;
  };
}

export const DEFAULT_MINTU_SKIN: SkinMetadata = {
  id: "default-mintu",
  name: "Classic Mint",
  author: "Mintu Team",
  version: "1.0.0",
  type: "svg",
  swatch: ["#A8E8D5", "#10B981"],
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

export const SKIN_PRESETS: SkinMetadata[] = [
  DEFAULT_MINTU_SKIN,
  {
    id: "sakura-pink",
    name: "Sakura Pink",
    author: "Mintu Team",
    version: "1.0.0",
    type: "svg",
    swatch: ["#FBCFE8", "#EC4899"],
    colors: {
      petBody: "#FBCFE8",
      petBodyShadow: "#F9A8D4",
      petBelly: "#FFF5F7",
      petBellyShadow: "#FCE7F3",
      petOutline: "#4A2036",
      petEye: "#3B172A",
      petEyeHighlight: "#FFFFFF",
      petBlush: "#FB7185",
      petNose: "#4A2036",
      petMouth: "#4A2036",
      petTongue: "#F43F5E",
      petEarInner: "#F472B6",
      petGroundShadow: "rgba(74, 32, 54, 0.18)",
      accessoryHeadphones: "#4A2036",
      accessoryAccent: "#EC4899",
    },
  },
  {
    id: "midnight-obsidian",
    name: "Midnight",
    author: "Mintu Team",
    version: "1.0.0",
    type: "svg",
    swatch: ["#334155", "#38BDF8"],
    colors: {
      petBody: "#334155",
      petBodyShadow: "#1E293B",
      petBelly: "#CBD5E1",
      petBellyShadow: "#94A3B8",
      petOutline: "#0F172A",
      petEye: "#F8FAFC",
      petEyeHighlight: "#38BDF8",
      petBlush: "#818CF8",
      petNose: "#E2E8F0",
      petMouth: "#E2E8F0",
      petTongue: "#F472B6",
      petEarInner: "#475569",
      petGroundShadow: "rgba(15, 23, 42, 0.34)",
      accessoryHeadphones: "#0F172A",
      accessoryAccent: "#38BDF8",
    },
  },
  {
    id: "cyber-neon",
    name: "Cyber Neon",
    author: "Mintu Team",
    version: "1.0.0",
    type: "svg",
    swatch: ["#22D3EE", "#A855F7"],
    colors: {
      petBody: "#22D3EE",
      petBodyShadow: "#06B6D4",
      petBelly: "#ECFEFF",
      petBellyShadow: "#CFFAFE",
      petOutline: "#0F172A",
      petEye: "#1E1B4B",
      petEyeHighlight: "#FFFFFF",
      petBlush: "#E879F9",
      petNose: "#1E1B4B",
      petMouth: "#1E1B4B",
      petTongue: "#F43F5E",
      petEarInner: "#67E8F9",
      petGroundShadow: "rgba(6, 182, 212, 0.24)",
      accessoryHeadphones: "#1E1B4B",
      accessoryAccent: "#A855F7",
    },
  },
  {
    id: "golden-sunset",
    name: "Sunset Gold",
    author: "Mintu Team",
    version: "1.0.0",
    type: "svg",
    swatch: ["#FCD34D", "#F97316"],
    colors: {
      petBody: "#FCD34D",
      petBodyShadow: "#F59E0B",
      petBelly: "#FFFBEB",
      petBellyShadow: "#FEF3C7",
      petOutline: "#451A03",
      petEye: "#451A03",
      petEyeHighlight: "#FFFFFF",
      petBlush: "#FB7185",
      petNose: "#451A03",
      petMouth: "#451A03",
      petTongue: "#F43F5E",
      petEarInner: "#FBBF24",
      petGroundShadow: "rgba(120, 53, 15, 0.18)",
      accessoryHeadphones: "#451A03",
      accessoryAccent: "#F97316",
    },
  },
  {
    id: "matcha-cream",
    name: "Matcha",
    author: "Mintu Team",
    version: "1.0.0",
    type: "svg",
    swatch: ["#BEF264", "#65A30D"],
    colors: {
      petBody: "#BEF264",
      petBodyShadow: "#A3E635",
      petBelly: "#FEFCE8",
      petBellyShadow: "#FEF9C3",
      petOutline: "#263612",
      petEye: "#1A2E05",
      petEyeHighlight: "#FFFFFF",
      petBlush: "#FCA5A5",
      petNose: "#1A2E05",
      petMouth: "#263612",
      petTongue: "#FB7185",
      petEarInner: "#A3E635",
      petGroundShadow: "rgba(38, 54, 18, 0.18)",
      accessoryHeadphones: "#365314",
      accessoryAccent: "#84CC16",
    },
  },
];

const SKIN_STORAGE_KEY = "mintu_selected_skin";

export class SkinLoader {
  private currentSkin: SkinMetadata = DEFAULT_MINTU_SKIN;

  constructor() {
    let initial = DEFAULT_MINTU_SKIN;
    if (typeof localStorage !== "undefined") {
      try {
        const savedId = localStorage.getItem(SKIN_STORAGE_KEY);
        if (savedId) {
          const found = SKIN_PRESETS.find((s) => s.id === savedId);
          if (found) initial = found;
        }
      } catch {}
    }
    this.applySkin(initial, false);
  }

  getPresets(): SkinMetadata[] {
    return SKIN_PRESETS;
  }

  getCurrentSkin(): SkinMetadata {
    return this.currentSkin;
  }

  selectSkin(id: string): SkinMetadata | null {
    const found = SKIN_PRESETS.find((s) => s.id === id);
    if (!found) return null;
    this.applySkin(found, true);
    return found;
  }

  applySkin(skin: SkinMetadata, persist: boolean = true): void {
    this.currentSkin = skin;

    if (persist && typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(SKIN_STORAGE_KEY, skin.id);
      } catch {}
    }

    if (typeof document === "undefined") return;
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
    this.applySkin(json, true);
  }
}

export const skinLoader = new SkinLoader();
