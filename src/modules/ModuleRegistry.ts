import { IslandModule, ModuleContext, ModuleSettingsConfig } from "./types";

export class ModuleRegistry {
  private static instance: ModuleRegistry;
  private modules: Map<string, IslandModule> = new Map();
  private configs: Map<string, ModuleSettingsConfig> = new Map();
  private context: ModuleContext | null = null;
  private tickTimers: Map<string, number> = new Map();
  private isIslandVisible: boolean = true;
  private isReducedMotion: boolean = false;

  private constructor() {
    this.loadConfigs();
    this.initReduceMotion();
  }

  public static getInstance(): ModuleRegistry {
    if (!ModuleRegistry.instance) {
      ModuleRegistry.instance = new ModuleRegistry();
    }
    return ModuleRegistry.instance;
  }

  public init(context: ModuleContext): void {
    this.context = context;
    // Start enabled modules
    for (const [id, mod] of this.modules) {
      const cfg = this.getConfig(id);
      if (cfg.enabled) {
        this.startModule(mod);
      }
    }
  }

  public register(module: IslandModule): void {
    this.modules.set(module.id, module);
    if (!this.configs.has(module.id)) {
      this.configs.set(module.id, {
        enabled: true,
        order: this.modules.size,
      });
      this.saveConfigs();
    }

    if (this.context && this.getConfig(module.id).enabled) {
      this.startModule(module);
    }
  }

  public getModule(id: string): IslandModule | undefined {
    return this.modules.get(id);
  }

  public getAllModules(): IslandModule[] {
    const list = Array.from(this.modules.values());
    list.sort((a, b) => {
      const ordA = this.getConfig(a.id).order ?? 0;
      const ordB = this.getConfig(b.id).order ?? 0;
      return ordA - ordB;
    });
    return list;
  }

  public isEnabled(id: string): boolean {
    return this.getConfig(id).enabled;
  }

  public setEnabled(id: string, enabled: boolean): void {
    const cfg = this.getConfig(id);
    cfg.enabled = enabled;
    this.configs.set(id, cfg);
    this.saveConfigs();

    const mod = this.modules.get(id);
    if (!mod) return;

    if (enabled) {
      if (this.context) this.startModule(mod);
    } else {
      this.stopModule(mod);
    }
  }

  public setOrder(orderList: string[]): void {
    orderList.forEach((id, idx) => {
      const cfg = this.getConfig(id);
      cfg.order = idx;
      this.configs.set(id, cfg);
    });
    this.saveConfigs();
  }

  public setIslandVisibility(visible: boolean): void {
    this.isIslandVisible = visible;
    for (const [id, mod] of this.modules) {
      if (this.isEnabled(id)) {
        mod.onVisibilityChange?.(visible);
        if (visible) {
          this.scheduleTick(mod);
        } else {
          this.clearTick(id);
        }
      }
    }
  }

  public getReduceMotion(): boolean {
    return this.isReducedMotion;
  }

  public getReduceMotionSetting(): "system" | "on" | "off" {
    const saved = localStorage.getItem("mintu_reduce_motion");
    if (saved === "true") return "on";
    if (saved === "false") return "off";
    return "system";
  }

  public setReduceMotion(mode: "system" | "on" | "off" | boolean): void {
    if (mode === true || mode === "on") {
      this.isReducedMotion = true;
      localStorage.setItem("mintu_reduce_motion", "true");
    } else if (mode === false || mode === "off") {
      this.isReducedMotion = false;
      localStorage.setItem("mintu_reduce_motion", "false");
    } else {
      localStorage.removeItem("mintu_reduce_motion");
      this.isReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    document.documentElement.classList.toggle("reduce-motion", this.isReducedMotion);
  }

  private startModule(mod: IslandModule): void {
    if (!this.context) return;
    try {
      mod.start(this.context);
      if (this.isIslandVisible) {
        this.scheduleTick(mod);
      }
    } catch (e) {
      console.error(`Failed to start module ${mod.id}:`, e);
    }
  }

  private stopModule(mod: IslandModule): void {
    try {
      this.clearTick(mod.id);
      mod.stop();
    } catch (e) {
      console.error(`Failed to stop module ${mod.id}:`, e);
    }
  }

  private scheduleTick(mod: IslandModule): void {
    this.clearTick(mod.id);
    if (!mod.onTick) return;

    const rateHz = mod.updateRateHz || 1;
    const intervalMs = Math.max(250, Math.round(1000 / rateHz));

    const timerId = window.setInterval(() => {
      if (this.isIslandVisible && this.isEnabled(mod.id)) {
        mod.onTick?.();
      }
    }, intervalMs);

    this.tickTimers.set(mod.id, timerId);
  }

  private clearTick(id: string): void {
    const timerId = this.tickTimers.get(id);
    if (timerId !== undefined) {
      window.clearInterval(timerId);
      this.tickTimers.delete(id);
    }
  }

  private getConfig(id: string): ModuleSettingsConfig {
    return (
      this.configs.get(id) || {
        enabled: true,
        order: 0,
      }
    );
  }

  private loadConfigs(): void {
    try {
      const raw = localStorage.getItem("mintu_island_modules");
      if (raw) {
        const parsed = JSON.parse(raw);
        for (const k of Object.keys(parsed)) {
          this.configs.set(k, parsed[k]);
        }
      }
    } catch {}
  }

  private saveConfigs(): void {
    try {
      const obj: Record<string, ModuleSettingsConfig> = {};
      for (const [k, v] of this.configs) {
        obj[k] = v;
      }
      localStorage.setItem("mintu_island_modules", JSON.stringify(obj));
    } catch {}
  }

  private initReduceMotion(): void {
    const saved = localStorage.getItem("mintu_reduce_motion");
    if (saved !== null) {
      this.isReducedMotion = saved === "true";
    } else {
      // Follow Windows OS prefers-reduced-motion setting
      this.isReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    document.documentElement.classList.toggle("reduce-motion", this.isReducedMotion);
  }

  public isModuleEnabled(id: string): boolean {
    return this.isEnabled(id);
  }

  public setModuleEnabled(id: string, enabled: boolean): void {
    this.setEnabled(id, enabled);
  }
}

export const moduleRegistry = ModuleRegistry.getInstance();
