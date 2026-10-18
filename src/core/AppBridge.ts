import { invoke } from "@tauri-apps/api/core";
import { listen, emit } from "@tauri-apps/api/event";

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

  constructor() {
    this.isTauriApp = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
  }

  get isTauri(): boolean {
    return this.isTauriApp || (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window));
  }

  async invoke(cmd: string, args?: any): Promise<any> {
    try {
      return await invoke(cmd, args);
    } catch (e) {
      console.warn(`[AppBridge] invoke ${cmd} error:`, e);
      return null;
    }
  }

  async setHitRegions(windowLabel: string, regions: HitRect[]): Promise<void> {
    try {
      await invoke("set_hit_regions", { windowLabel, regions });
    } catch {
      // ignore outside tauri
    }
  }

  async setAppMode(mode: "island" | "free"): Promise<void> {
    try {
      await invoke("set_app_mode", { mode });
    } catch {
      window.dispatchEvent(new CustomEvent("mintu-mode-changed", { detail: mode }));
    }
  }

  async getWorkArea(): Promise<ScreenWorkArea | null> {
    try {
      return await invoke("get_work_area");
    } catch {
      return {
        x: 0,
        y: 0,
        width: window.innerWidth,
        height: window.innerHeight,
        scale_factor: window.devicePixelRatio || 1,
      };
    }
  }

  async listenToEvent<T>(event: string, handler: (payload: T) => void): Promise<() => void> {
    try {
      return await listen(event, (ev: any) => handler(ev.payload));
    } catch {
      const browserListener = (e: Event) => {
        handler((e as CustomEvent).detail);
      };
      window.addEventListener(`tauri-${event}`, browserListener);
      return () => window.removeEventListener(`tauri-${event}`, browserListener);
    }
  }

  async broadcastEvent(event: string, payload: unknown): Promise<void> {
    try {
      await emit(event, payload);
    } catch {
      window.dispatchEvent(new CustomEvent(`tauri-${event}`, { detail: payload }));
    }
  }

  async getActiveWindowInfo(): Promise<{ title: string; process_name: string; is_blocked: boolean } | null> {
    try {
      return await invoke("get_active_window");
    } catch {
      return null;
    }
  }

  async captureContext(): Promise<{ text: string | null; image_base64: string | null; app_info: { title: string; process_name: string; is_blocked: boolean } } | null> {
    try {
      return await invoke("capture_context");
    } catch {
      return null;
    }
  }

  async setPrivacyBlocklist(blocklist: string[]): Promise<void> {
    try {
      await invoke("set_privacy_blocklist", { blocklist });
    } catch (e) {
      console.warn("[AppBridge] setPrivacyBlocklist error:", e);
    }
  }

  async openRegionCapture(): Promise<void> {
    try {
      await invoke("open_region_capture");
    } catch {
      window.dispatchEvent(new CustomEvent("open-mock-region-capture"));
    }
  }

  async focusMainWindow(): Promise<void> {
    try {
      await invoke("focus_main_window");
    } catch {}
  }

  async mediaGetState(): Promise<any> {
    try {
      return await invoke("media_get_state");
    } catch {
      return null;
    }
  }

  async mediaTogglePlayPause(): Promise<boolean> {
    try {
      return await invoke("media_toggle_play_pause");
    } catch {
      return false;
    }
  }

  async mediaNext(): Promise<boolean> {
    try {
      return await invoke("media_next");
    } catch {
      return false;
    }
  }

  async mediaPrevious(): Promise<boolean> {
    try {
      return await invoke("media_previous");
    } catch {
      return false;
    }
  }

  async focusAppWindow(appName: string): Promise<void> {
    await invoke("focus_app_window", { appName });
  }

  async getWalkableWindows(): Promise<WalkableWindow[]> {
    try {
      return await invoke("get_walkable_windows");
    } catch {
      return [];
    }
  }

  async setWindowIgnoreList(list: string[]): Promise<void> {
    try {
      await invoke("set_window_ignore_list", { list });
    } catch {}
  }

  async getAutostart(): Promise<boolean> {
    try {
      return await invoke("get_autostart");
    } catch {
      return false;
    }
  }

  async setAutostart(enable: boolean): Promise<boolean> {
    try {
      return await invoke("set_autostart", { enable });
    } catch {
      return false;
    }
  }
}

export interface WalkableWindow {
  hwnd: number;
  title: string;
  process_name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const appBridge = new AppBridge();
