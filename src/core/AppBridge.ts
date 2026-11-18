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

  async readClipboardText(): Promise<string> {
    try {
      return await invoke("tools_read_clipboard");
    } catch {
      return await navigator.clipboard.readText().catch(() => "");
    }
  }

  async isStorePackage(): Promise<boolean> {
    try {
      return await invoke("is_store_package");
    } catch {
      return false;
    }
  }

  async purgeMemory(): Promise<boolean> {
    try {
      return await invoke("purge_memory");
    } catch {
      return false;
    }
  }

  async getPowerStatus(): Promise<{ is_battery: boolean; battery_percent: number; is_charging: boolean }> {
    try {
      return await invoke("get_power_status");
    } catch {
      return { is_battery: false, battery_percent: 100, is_charging: true };
    }
  }

  async getAvailableMonitors(): Promise<Array<{ name: string | null; x: number; y: number; width: number; height: number; scale_factor: number; is_primary: boolean }>> {
    try {
      return await invoke("get_available_monitors");
    } catch {
      return [];
    }
  }

  async getSystemVolume(): Promise<{ percent: number; muted: boolean } | null> {
    try {
      return await invoke("get_system_volume");
    } catch {
      return null;
    }
  }

  async setSystemVolume(percent: number, muted?: boolean): Promise<{ percent: number; muted: boolean } | null> {
    try {
      return await invoke("set_system_volume", { percent, muted: muted ?? null });
    } catch {
      return null;
    }
  }

  async openShelfFile(path: string): Promise<boolean> {
    try {
      await invoke("open_shelf_file", { path });
      return true;
    } catch {
      return false;
    }
  }

  async revealShelfFile(path: string): Promise<boolean> {
    try {
      await invoke("reveal_shelf_file", { path });
      return true;
    } catch {
      return false;
    }
  }

  async getCursorPos(): Promise<[number, number] | null> {
    try {
      return await invoke("get_cursor_pos");
    } catch {
      return null;
    }
  }

  async pickCursorColor(): Promise<string | null> {
    try {
      return await invoke("pick_cursor_color");
    } catch {
      return null;
    }
  }

  async setTypingPulseEnabled(enabled: boolean): Promise<void> {
    try {
      await invoke("set_typing_pulse_enabled", { enabled });
    } catch {}
  }

  async moveToMonitor(monitorIndex: number): Promise<boolean> {
    try {
      await invoke("move_to_monitor", { monitorIndex });
      return true;
    } catch {
      return false;
    }
  }

  async getSystemStatusInfo(): Promise<{
    network_connected: boolean;
    network_down_kbps: number;
    network_up_kbps: number;
    cpu_percent: number;
    ram_percent: number;
  } | null> {
    try {
      return await invoke("get_system_status_info");
    } catch {
      return null;
    }
  }

  async createReminder(text: string, dueAt: number): Promise<any> {
    try {
      return await invoke("db_create_reminder", { text, dueAt });
    } catch {
      return null;
    }
  }

  async listReminders(): Promise<Array<{ id: number; text: string; due_time: number; status: string }>> {
    try {
      const res = await invoke("db_list_reminders");
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  }

  async deleteReminder(id: number): Promise<void> {
    try {
      await invoke("db_delete_reminder", { id });
    } catch {}
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
