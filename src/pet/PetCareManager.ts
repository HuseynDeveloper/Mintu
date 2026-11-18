/**
 * Pet Care Manager (Tamagotchi Energy & Happiness System)
 * Pure local persistence with gentle time decay (Mintu always stays safe & cozy).
 */

export interface PetCareState {
  energy: number;
  happiness: number;
  cookiesFed: number;
  teasGiven: number;
  lastUpdatedAt: number;
}

export interface PetCareActionResult {
  energy: number;
  happiness: number;
  xpAwarded: number;
}

const CARE_STORAGE_KEY = "mintu_pet_care_v1";
const MIN_STAT = 15;
const MAX_STAT = 100;

export class PetCareManager {
  private state: PetCareState;

  constructor() {
    this.state = this.load();
    this.applyDecay();
  }

  private defaultState(): PetCareState {
    return {
      energy: 84,
      happiness: 88,
      cookiesFed: 0,
      teasGiven: 0,
      lastUpdatedAt: Date.now(),
    };
  }

  private load(): PetCareState {
    if (typeof localStorage === "undefined") return this.defaultState();
    try {
      const raw = localStorage.getItem(CARE_STORAGE_KEY);
      if (!raw) return this.defaultState();
      const parsed = JSON.parse(raw);
      return {
        energy: this.clamp(Number(parsed.energy ?? 84)),
        happiness: this.clamp(Number(parsed.happiness ?? 88)),
        cookiesFed: Number(parsed.cookiesFed ?? 0),
        teasGiven: Number(parsed.teasGiven ?? 0),
        lastUpdatedAt: Number(parsed.lastUpdatedAt ?? Date.now()),
      };
    } catch {
      return this.defaultState();
    }
  }

  private save(): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(CARE_STORAGE_KEY, JSON.stringify(this.state));
    } catch {}
  }

  private clamp(val: number): number {
    return Math.max(MIN_STAT, Math.min(MAX_STAT, Math.round(val)));
  }

  public applyDecay(nowMs: number = Date.now()): PetCareState {
    const elapsedMin = Math.max(0, (nowMs - this.state.lastUpdatedAt) / 60000);
    if (elapsedMin >= 12) {
      const energyLoss = Math.floor(elapsedMin / 12);
      const happyLoss = Math.floor(elapsedMin / 15);
      if (energyLoss > 0 || happyLoss > 0) {
        this.state.energy = this.clamp(this.state.energy - energyLoss);
        this.state.happiness = this.clamp(this.state.happiness - happyLoss);
        this.state.lastUpdatedAt = nowMs;
        this.save();
      }
    }
    return this.getState();
  }

  public getState(): PetCareState {
    return { ...this.state };
  }

  public feedCookie(): PetCareActionResult {
    this.applyDecay();
    this.state.energy = this.clamp(this.state.energy + 18);
    this.state.happiness = this.clamp(this.state.happiness + 10);
    this.state.cookiesFed += 1;
    this.state.lastUpdatedAt = Date.now();
    this.save();
    return {
      energy: this.state.energy,
      happiness: this.state.happiness,
      xpAwarded: 8,
    };
  }

  public giveTea(): PetCareActionResult {
    this.applyDecay();
    this.state.energy = this.clamp(this.state.energy + 24);
    this.state.happiness = this.clamp(this.state.happiness + 8);
    this.state.teasGiven += 1;
    this.state.lastUpdatedAt = Date.now();
    this.save();
    return {
      energy: this.state.energy,
      happiness: this.state.happiness,
      xpAwarded: 8,
    };
  }

  public pat(): PetCareActionResult {
    this.applyDecay();
    this.state.happiness = this.clamp(this.state.happiness + 12);
    this.state.energy = this.clamp(this.state.energy + 3);
    this.state.lastUpdatedAt = Date.now();
    this.save();
    return {
      energy: this.state.energy,
      happiness: this.state.happiness,
      xpAwarded: 5,
    };
  }

  public restTick(): void {
    this.state.energy = this.clamp(this.state.energy + 2);
    this.state.lastUpdatedAt = Date.now();
    this.save();
  }
}

export const petCareManager = new PetCareManager();
