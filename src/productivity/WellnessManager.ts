/**
 * Mintu Wellness, Daily To-Do & Pet Profile Manager
 * Persists daily water intake (resets each day), 20-20-20 eye break,
 * mini daily checklist, custom pet name, hourly chime, and caught stars.
 */

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
}

export interface WellnessState {
  dateKey: string;
  waterGlasses: number;
  waterGoal: number;
  waterIntervalMin: number; // 0 = off, 20, 30, 45, 60
  eyeBreak2020: boolean;
  hourlyChime: boolean;
  petName: string;
  starsCaught: number;
  todos: TodoItem[];
}

const STORAGE_KEY = "mintu_wellness_v1";
const MAX_TODOS = 10;

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export class WellnessManager {
  private state: WellnessState;

  constructor() {
    this.state = this.load();
    this.ensureToday();
  }

  private defaultState(): WellnessState {
    return {
      dateKey: todayKey(),
      waterGlasses: 0,
      waterGoal: 8,
      waterIntervalMin: 30,
      eyeBreak2020: true,
      hourlyChime: false,
      petName: "Mintu",
      starsCaught: 0,
      todos: [],
    };
  }

  private load(): WellnessState {
    if (typeof localStorage === "undefined") return this.defaultState();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return this.defaultState();
      const parsed = JSON.parse(raw);
      return {
        dateKey: String(parsed.dateKey || todayKey()),
        waterGlasses: Math.max(0, Number(parsed.waterGlasses || 0)),
        waterGoal: Math.max(1, Math.min(20, Number(parsed.waterGoal || 8))),
        waterIntervalMin: Number(parsed.waterIntervalMin ?? 30),
        eyeBreak2020: Boolean(parsed.eyeBreak2020 ?? true),
        hourlyChime: Boolean(parsed.hourlyChime ?? false),
        petName: String(parsed.petName || "Mintu").trim() || "Mintu",
        starsCaught: Math.max(0, Number(parsed.starsCaught || 0)),
        todos: Array.isArray(parsed.todos) ? parsed.todos.slice(0, MAX_TODOS) : [],
      };
    } catch {
      return this.defaultState();
    }
  }

  private save(): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {}
  }

  public ensureToday(): void {
    const today = todayKey();
    if (this.state.dateKey !== today) {
      this.state.dateKey = today;
      this.state.waterGlasses = 0;
      this.save();
    }
  }

  public getState(): WellnessState {
    this.ensureToday();
    return {
      ...this.state,
      todos: this.state.todos.map((t) => ({ ...t })),
    };
  }

  public drinkWater(): { glasses: number; goal: number; xpAwarded: number } {
    this.ensureToday();
    this.state.waterGlasses = Math.min(25, this.state.waterGlasses + 1);
    this.save();
    return {
      glasses: this.state.waterGlasses,
      goal: this.state.waterGoal,
      xpAwarded: 5,
    };
  }

  public resetWater(): void {
    this.ensureToday();
    this.state.waterGlasses = 0;
    this.save();
  }

  public setWaterInterval(minutes: number): void {
    this.state.waterIntervalMin = Math.max(0, Math.min(180, Math.round(minutes)));
    this.save();
  }

  public setEyeBreak2020(enabled: boolean): void {
    this.state.eyeBreak2020 = enabled;
    this.save();
  }

  public setHourlyChime(enabled: boolean): void {
    this.state.hourlyChime = enabled;
    this.save();
  }

  public setPetName(name: string): string {
    const clean = name.trim().slice(0, 18) || "Mintu";
    this.state.petName = clean;
    this.save();
    return clean;
  }

  public getPetName(): string {
    return this.state.petName || "Mintu";
  }

  public recordStarCaught(): number {
    this.state.starsCaught += 1;
    this.save();
    return this.state.starsCaught;
  }

  public addTodo(text: string): TodoItem | null {
    const clean = text.trim().slice(0, 80);
    if (!clean) return null;
    const item: TodoItem = {
      id: `todo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text: clean,
      done: false,
      createdAt: Date.now(),
    };
    this.state.todos.unshift(item);
    this.state.todos = this.state.todos.slice(0, MAX_TODOS);
    this.save();
    return item;
  }

  public toggleTodo(id: string): { done: boolean; xpAwarded: number } | null {
    const found = this.state.todos.find((t) => t.id === id);
    if (!found) return null;
    found.done = !found.done;
    this.save();
    return { done: found.done, xpAwarded: found.done ? 10 : 0 };
  }

  public removeTodo(id: string): void {
    this.state.todos = this.state.todos.filter((t) => t.id !== id);
    this.save();
  }
}

export const wellnessManager = new WellnessManager();
