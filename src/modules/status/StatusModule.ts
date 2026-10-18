import { IslandModule, ModuleContext } from "../types";
import { modelManager } from "../../ai/ModelManager";
import { cloudProviderManager } from "../../ai/adapters/CloudProviderManager";
import { chatManager } from "../../ai/ChatManager";

export type StatusWidgetId = "clock" | "battery" | "system_load" | "disk" | "network" | "ai_status";

export interface BackendSystemStatus {
  battery_percent: number | null;
  is_charging: boolean | null;
  has_battery: boolean;
  cpu_percent: number;
  ram_percent: number;
  ram_free_mb: number;
  ram_total_mb: number;
  disk_free_gb: number;
  disk_total_gb: number;
  network_connected: boolean;
  network_down_kbps: number;
  network_up_kbps: number;
}

export class StatusModule implements IslandModule {
  public id = "status";
  public name = "Status Widgets";
  public icon = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
      <line x1="8" y1="21" x2="16" y2="21"></line>
      <line x1="12" y1="17" x2="12" y2="21"></line>
    </svg>
  `;
  public priority = 20; // Matches status_widgets priority in ActivityManager
  public updateRateHz = 1;

  private context: ModuleContext | null = null;
  private currentWidgetIndex = 0;
  private pinnedWidgetId: StatusWidgetId | null = null;
  private enabledWidgets: Set<StatusWidgetId> = new Set([
    "clock",
    "battery",
    "system_load",
    "disk",
    "network",
    "ai_status",
  ]);

  private latestStatus: BackendSystemStatus = {
    battery_percent: 85,
    is_charging: false,
    has_battery: true,
    cpu_percent: 12,
    ram_percent: 42,
    ram_free_mb: 8192,
    ram_total_mb: 16384,
    disk_free_gb: 142.5,
    disk_total_gb: 512.0,
    network_connected: true,
    network_down_kbps: 0,
    network_up_kbps: 0,
  };

  // In-memory history for graphs (last 30 samples, 1 per sec)
  private cpuHistory: number[] = [];
  private ramHistory: number[] = [];
  private netDownHistory: number[] = [];

  // Low battery alert tracking
  private hasAlertedLowBattery = false;
  private lastChargingState: boolean | null = null;

  // Fake dev overrides for developer panel
  public fakeBatteryPercent: number | null = null;
  public fakeIsCharging: boolean | null = null;
  public fakeCpuPercent: number | null = null;

  constructor() {
    this.loadSettings();
  }

  public start(context: ModuleContext): void {
    this.context = context;
    this.fetchSystemStatus();
  }

  public stop(): void {
    this.context = null;
  }

  public isActive(): boolean {
    return true;
  }

  public onTick(): void {
    this.fetchSystemStatus();
  }

  private async fetchSystemStatus(): Promise<void> {
    try {
      if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) {
        const { invoke } = await import("@tauri-apps/api/core");
        const res: BackendSystemStatus = await invoke("get_system_status_info");
        if (res) {
          this.latestStatus = res;
        }
      }
    } catch {}

    // Apply fake dev overrides if active
    if (this.fakeBatteryPercent !== null) {
      this.latestStatus.battery_percent = this.fakeBatteryPercent;
      this.latestStatus.has_battery = true;
    }
    if (this.fakeIsCharging !== null) {
      this.latestStatus.is_charging = this.fakeIsCharging;
    }
    if (this.fakeCpuPercent !== null) {
      this.latestStatus.cpu_percent = this.fakeCpuPercent;
    }

    // Record in-memory history
    this.cpuHistory.push(this.latestStatus.cpu_percent);
    if (this.cpuHistory.length > 30) this.cpuHistory.shift();

    this.ramHistory.push(this.latestStatus.ram_percent);
    if (this.ramHistory.length > 30) this.ramHistory.shift();

    this.netDownHistory.push(this.latestStatus.network_down_kbps);
    if (this.netDownHistory.length > 30) this.netDownHistory.shift();

    // Check battery alerts
    this.checkBatteryAlerts();
  }

  private checkBatteryAlerts(): void {
    if (!this.context || !this.latestStatus.has_battery) return;

    const b = this.latestStatus.battery_percent;
    const chg = this.latestStatus.is_charging;

    // Plugged in happy reaction
    if (this.lastChargingState !== null && this.lastChargingState === false && chg === true) {
      this.context.eventBus.emit("pet:action", { type: "state", payload: "happy" });
    }
    this.lastChargingState = chg ?? null;

    // Low battery alert (< 15% and not charging)
    if (b !== null && b < 15 && chg !== true) {
      if (!this.hasAlertedLowBattery) {
        this.hasAlertedLowBattery = true;
        this.context.activityManager.push({
          id: "battery_low_alert",
          type: "normal_notif",
          priority: 50,
          islandState: "notification",
          petState: "worried",
          payload: {
            title: "Battery low",
            text: `${b}% remaining. Please connect power.`,
            appName: "BATTERY",
            appIcon: "internal",
          },
          autoDismissMs: 12000,
        });
      }
    } else if (b !== null && b >= 20) {
      this.hasAlertedLowBattery = false;
    }
  }

  // ==========================================
  // Cycling & Pinning
  // ==========================================

  public getActiveWidgets(): StatusWidgetId[] {
    const all: StatusWidgetId[] = ["clock", "battery", "system_load", "disk", "network", "ai_status"];
    return all.filter((w) => this.enabledWidgets.has(w));
  }

  public nextWidget(): void {
    const list = this.getActiveWidgets();
    if (list.length === 0) return;
    this.currentWidgetIndex = (this.currentWidgetIndex + 1) % list.length;
  }

  public prevWidget(): void {
    const list = this.getActiveWidgets();
    if (list.length === 0) return;
    this.currentWidgetIndex = (this.currentWidgetIndex - 1 + list.length) % list.length;
  }

  public getCurrentWidgetId(): StatusWidgetId {
    if (this.pinnedWidgetId && this.enabledWidgets.has(this.pinnedWidgetId)) {
      return this.pinnedWidgetId;
    }
    const list = this.getActiveWidgets();
    if (list.length === 0) return "clock";
    return list[this.currentWidgetIndex % list.length];
  }

  public setPinnedWidget(id: StatusWidgetId | null): void {
    this.pinnedWidgetId = id;
    if (id) {
      localStorage.setItem("mintu_pinned_status_widget", id);
    } else {
      localStorage.removeItem("mintu_pinned_status_widget");
    }
  }

  public isWidgetPinned(id: StatusWidgetId): boolean {
    return this.pinnedWidgetId === id;
  }

  // ==========================================
  // Compact View (Idle Island)
  // ==========================================

  public renderCompact(container: HTMLElement, options: { mintuInside: boolean }): void {
    const widgetId = this.getCurrentWidgetId();
    const activeList = this.getActiveWidgets();
    const curIdx = activeList.indexOf(widgetId);

    // Indicator dots
    const dotsHtml =
      activeList.length > 1
        ? `
        <div class="status-cycle-dots" style="display: flex; gap: 3px; align-items: center; margin-left: 6px;">
          ${activeList
            .map(
              (_, i) =>
                `<span style="width: 4px; height: 4px; border-radius: 50%; background: ${
                  i === curIdx ? "#10B981" : "rgba(255,255,255,0.2)"
                }; display: inline-block;"></span>`
            )
            .join("")}
        </div>
      `
        : "";

    let contentHtml = "";

    switch (widgetId) {
      case "clock": {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, "0");
        const mm = String(now.getMinutes()).padStart(2, "0");
        contentHtml = `<span style="font-size: 14px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px;">${hh}:${mm}</span>`;
        break;
      }
      case "battery": {
        const b = this.latestStatus.battery_percent ?? 100;
        const chg = this.latestStatus.is_charging;
        const color = b <= 20 ? "#ef4444" : b <= 40 ? "#f59e0b" : "#10B981";
        contentHtml = `
          <div style="display: flex; align-items: center; gap: 5px;">
            <svg width="18" height="12" viewBox="0 0 24 14" fill="none" stroke="currentColor" stroke-width="2" style="color: #9ca3af;">
              <rect x="1" y="1" width="19" height="12" rx="2" />
              <rect x="3" y="3" width="${Math.round((b / 100) * 15)}" height="8" rx="1" fill="${color}" stroke="none" />
              <path d="M22 5v4" stroke-linecap="round" />
            </svg>
            <span style="font-size: 12px; font-weight: 700; color: #ffffff;">${b}%</span>
            ${chg ? '<svg width="10" height="12" viewBox="0 0 24 24" fill="#10B981" style="vertical-align: middle;"><path d="M13 2L3 14h7v8l11-12h-8l1-8z"/></svg>' : ""}
          </div>
        `;
        break;
      }
      case "system_load": {
        const cpu = this.latestStatus.cpu_percent;
        const ram = this.latestStatus.ram_percent;
        contentHtml = `
          <div style="display: flex; align-items: center; gap: 8px; font-size: 11.5px; font-weight: 600;">
            <span style="color: #9ca3af;">C: <strong style="color: ${cpu > 80 ? '#ef4444' : '#ffffff'};">${cpu}%</strong></span>
            <span style="color: #9ca3af;">R: <strong style="color: ${ram > 85 ? '#ef4444' : '#ffffff'};">${ram}%</strong></span>
          </div>
        `;
        break;
      }
      case "disk": {
        const freeGb = Math.round(this.latestStatus.disk_free_gb);
        contentHtml = `
          <div style="display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; color: #ffffff;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #9ca3af;">
              <line x1="22" y1="12" x2="2" y2="12"></line>
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>
              <line x1="6" y1="16" x2="6.01" y2="16"></line>
              <line x1="10" y1="16" x2="10.01" y2="16"></line>
            </svg>
            <span>${freeGb} GB free</span>
          </div>
        `;
        break;
      }
      case "network": {
        const isOnline = this.latestStatus.network_connected;
        const down = this.latestStatus.network_down_kbps;
        const downStr = down > 1024 ? `${(down / 1024).toFixed(1)} MB/s` : `${Math.round(down)} KB/s`;
        contentHtml = `
          <div style="display: flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 600;">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: ${isOnline ? '#10B981' : '#ef4444'};"></span>
            <span style="color: #ffffff;">${isOnline ? downStr : 'Offline'}</span>
          </div>
        `;
        break;
      }
      case "ai_status": {
        const cloudProv = cloudProviderManager.getActiveProviderId();
        const isCloud = cloudProv !== "local";
        const activeModel = isCloud
          ? cloudProviderManager.getModel(cloudProv) || "Cloud"
          : modelManager.getActiveModelId()?.replace("qwen2.5-", "Qwen ") || "Local";
        const aiState = chatManager.getAiState();
        contentHtml = `
          <div style="display: flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 600;">
            <span style="color: ${isCloud ? '#fbbf24' : '#10B981'};">${activeModel}</span>
            <span style="color: #71717a; font-size: 10px;">(${aiState})</span>
          </div>
        `;
        break;
      }
    }

    container.innerHTML = `
      <div class="island-status-compact" style="display: flex; align-items: center; justify-content: space-between; width: 100%; cursor: pointer; user-select: none;">
        ${options.mintuInside ? '<div class="slot-left-pet-anchor"></div>' : ""}
        <div style="display: flex; align-items: center; gap: 6px; margin-left: auto;">
          ${contentHtml}
          ${dotsHtml}
        </div>
      </div>
    `;

    // Click on widget cycles next
    container.onclick = (e) => {
      e.stopPropagation();
      this.nextWidget();
      this.renderCompact(container, options);
    };

    // Wheel/scroll cycles
    container.onwheel = (e) => {
      e.preventDefault();
      if (e.deltaY > 0) {
        this.nextWidget();
      } else {
        this.prevWidget();
      }
      this.renderCompact(container, options);
    };
  }

  // ==========================================
  // Expanded View
  // ==========================================

  public renderExpanded(container: HTMLElement): void {
    const curWidget = this.getCurrentWidgetId();
    const isPinned = this.isWidgetPinned(curWidget);

    // Sparkline generator helper
    const renderSparkline = (data: number[], color: string, maxVal: number = 100) => {
      if (data.length < 2) return "";
      const pts = data
        .map((val, i) => {
          const x = (i / (data.length - 1)) * 140;
          const y = 35 - Math.min(35, (val / maxVal) * 35);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");
      return `
        <svg width="140" height="40" viewBox="0 0 140 40" style="overflow: visible;">
          <polyline fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" points="${pts}" />
        </svg>
      `;
    };

    container.innerHTML = `
      <div class="status-expanded-card" style="display: flex; flex-direction: column; gap: 12px; width: 100%; padding: 12px 16px; box-sizing: border-box;">
        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
          <span style="font-size: 14px; font-weight: 700; color: #ffffff;">System Status</span>
          <button id="btn-pin-widget" style="padding: 2px 8px; border-radius: 6px; background: ${
            isPinned ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.06)'
          }; border: 1px solid ${isPinned ? '#10B981' : 'rgba(255,255,255,0.1)'}; color: ${
      isPinned ? '#10B981' : '#9ca3af'
    }; font-size: 11px; cursor: pointer;">
            ${isPinned ? 'Pinned' : 'Pin to island'}
          </button>
        </div>

        <!-- 2x3 Grid of Status Cards -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 100%;">
          <!-- CPU & RAM -->
          <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 8px 10px;">
            <div style="font-size: 10px; color: #71717a; text-transform: uppercase; font-weight: 700;">CPU & RAM</div>
            <div style="display: flex; justify-content: space-between; margin-top: 4px; font-size: 12px;">
              <span>CPU: <strong style="color: #10b981;">${this.latestStatus.cpu_percent}%</strong></span>
              <span>RAM: <strong style="color: #38bdf8;">${this.latestStatus.ram_percent}%</strong></span>
            </div>
            <div style="margin-top: 6px; display: flex; justify-content: center;">
              ${renderSparkline(this.cpuHistory, "#10b981", 100)}
            </div>
          </div>

          <!-- Battery -->
          <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 8px 10px;">
            <div style="font-size: 10px; color: #71717a; text-transform: uppercase; font-weight: 700;">Battery</div>
            <div style="font-size: 18px; font-weight: 700; color: #ffffff; margin-top: 4px;">
              ${this.latestStatus.battery_percent ?? 100}%
              ${this.latestStatus.is_charging ? '<span style="color: #10b981; font-size: 13px;">(Charging)</span>' : ''}
            </div>
            <div style="font-size: 11px; color: #9ca3af; margin-top: 2px;">
              ${this.latestStatus.has_battery ? 'Healthy discharge rate' : 'AC Desktop Power'}
            </div>
          </div>

          <!-- Disk -->
          <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 8px 10px;">
            <div style="font-size: 10px; color: #71717a; text-transform: uppercase; font-weight: 700;">System Disk (C:)</div>
            <div style="font-size: 16px; font-weight: 700; color: #ffffff; margin-top: 4px;">
              ${Math.round(this.latestStatus.disk_free_gb)} GB free
            </div>
            <div style="font-size: 11px; color: #9ca3af; margin-top: 2px;">
              Total: ${Math.round(this.latestStatus.disk_total_gb)} GB
            </div>
          </div>

          <!-- Network -->
          <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 8px 10px;">
            <div style="font-size: 10px; color: #71717a; text-transform: uppercase; font-weight: 700;">Network Throughput</div>
            <div style="font-size: 12px; color: #ffffff; margin-top: 4px;">
              ↓ ${Math.round(this.latestStatus.network_down_kbps)} KB/s &nbsp; ↑ ${Math.round(this.latestStatus.network_up_kbps)} KB/s
            </div>
            <div style="font-size: 10.5px; color: #10b981; margin-top: 2px;">
              ${this.latestStatus.network_connected ? 'Connected (local stats)' : 'Disconnected'}
            </div>
          </div>
        </div>
      </div>
    `;

    container.querySelector("#btn-pin-widget")?.addEventListener("click", () => {
      if (isPinned) {
        this.setPinnedWidget(null);
      } else {
        this.setPinnedWidget(curWidget);
      }
      this.renderExpanded(container);
    });
  }

  // ==========================================
  // Settings View
  // ==========================================

  public renderSettings(container: HTMLElement): void {
    const allWidgets: Array<{ id: StatusWidgetId; name: string }> = [
      { id: "clock", name: "Clock & Date" },
      { id: "battery", name: "Battery Level & Charging" },
      { id: "system_load", name: "System Load (CPU & RAM)" },
      { id: "disk", name: "Disk Free Space (System Drive)" },
      { id: "network", name: "Network Status & Speed" },
      { id: "ai_status", name: "Mintu AI Status & Model" },
    ];

    container.innerHTML = `
      <div class="status-settings-view" style="display: flex; flex-direction: column; gap: 10px; width: 100%;">
        <div style="font-size: 13px; font-weight: 700; color: #ffffff;">Enabled Island Status Widgets</div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${allWidgets
            .map(
              (w) => `
            <label style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; border-radius: 6px; background: rgba(255,255,255,0.04); font-size: 12px; color: #e5e7eb; cursor: pointer;">
              <span>${w.name}</span>
              <input type="checkbox" class="chk-status-widget" data-id="${w.id}" ${
                this.enabledWidgets.has(w.id) ? "checked" : ""
              } />
            </label>
          `
            )
            .join("")}
        </div>
      </div>
    `;

    container.querySelectorAll(".chk-status-widget").forEach((chk) => {
      chk.addEventListener("change", () => {
        const id = (chk as HTMLElement).dataset.id as StatusWidgetId;
        const checked = (chk as HTMLInputElement).checked;
        if (checked) {
          this.enabledWidgets.add(id);
        } else {
          this.enabledWidgets.delete(id);
        }
        this.saveSettings();
      });
    });
  }

  private loadSettings(): void {
    try {
      this.pinnedWidgetId = (localStorage.getItem("mintu_pinned_status_widget") as StatusWidgetId) || null;
      const raw = localStorage.getItem("mintu_enabled_status_widgets");
      if (raw) {
        this.enabledWidgets = new Set(JSON.parse(raw));
      }
    } catch {}
  }

  private saveSettings(): void {
    try {
      localStorage.setItem("mintu_enabled_status_widgets", JSON.stringify(Array.from(this.enabledWidgets)));
    } catch {}
  }
}

export const statusModule = new StatusModule();
