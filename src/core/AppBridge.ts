/**
 * Tauri IPC App Bridge
 * Bridges frontend events and commands to Tauri 2 Rust backend
 * with safe fallback when running in a normal web browser.
 */

export interface HitRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenWorkArea {
  x: number;
  y: number;
  width: number;
  height: number;
  scale_factor: number;
}

class AppBridge {
  private isTauriApp: boolean = false;
  private tauriCore: any = null;
  private tauriEvent: any = null;

  constructor() {
    this.init();
  }

  private async init() {
    if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) {
      try {
        this.tauriCore = await import("@tauri-apps/api/core");
        this.tauriEvent = await import("@tauri-apps/api/event");
        this.isTauriApp = true;
      } catch (e) {
        console.warn("[AppBridge] Tauri API failed to import, running in web fallback mode", e);
      }
    }
  }

  get isTauri(): boolean {
    return this.isTauriApp;
  }

  async setHitRegions(windowLabel: string, regions: HitRect[]): Promise<void> {
    if (!this.isTauriApp || !this.tauriCore) return;
    try {
      await this.tauriCore.invoke("set_hit_regions", {
        windowLabel,
        regions,
      });
    } catch (e) {
      console.warn("[AppBridge] set_hit_regions error:", e);
    }
  }

  async setAppMode(mode: "island" | "free"): Promise<void> {
    if (!this.isTauriApp || !this.tauriCore) {
      // In browser mode, simply dispatch custom event
      window.dispatchEvent(new CustomEvent("mintu-mode-changed", { detail: mode }));
      return;
    }
    try {
      await this.tauriCore.invoke("set_app_mode", { mode });
    } catch (e) {
      console.warn("[AppBridge] set_app_mode error:", e);
    }
  }

  async getWorkArea(): Promise<ScreenWorkArea | null> {
    if (!this.isTauriApp || !this.tauriCore) {
      return {
        x: 0,
        y: 0,
        width: window.innerWidth,
        height: window.innerHeight,
        scale_factor: window.devicePixelRatio || 1,
      };
    }
    try {
      return await this.tauriCore.invoke("get_work_area");
    } catch (e) {
      console.warn("[AppBridge] getWorkArea error:", e);
      return null;
    }
  }

  async listenToEvent<T>(event: string, handler: (payload: T) => void): Promise<() => void> {
    if (this.isTauriApp && this.tauriEvent) {
      const unlisten = await this.tauriEvent.listen(event, (ev: any) => {
        handler(ev.payload);
      });
      return unlisten;
    }
    // Browser fallback
    const browserListener = (e: Event) => {
      const custom = e as CustomEvent;
      handler(custom.detail);
    };
    window.addEventListener(`tauri-${event}`, browserListener);
    return () => window.removeEventListener(`tauri-${event}`, browserListener);
  }

  async broadcastEvent(event: string, payload: unknown): Promise<void> {
    if (this.isTauriApp && this.tauriCore) {
      try {
        await this.tauriCore.invoke("emit_bus_event", {
          event,
          payload: typeof payload === "string" ? payload : JSON.stringify(payload),
        });
      } catch (e) {
        console.warn("[AppBridge] broadcastEvent error:", e);
      }
    } else {
      window.dispatchEvent(new CustomEvent(`tauri-${event}`, { detail: payload }));
    }
  }
}

export const appBridge = new AppBridge();
