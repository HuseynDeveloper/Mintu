/**
 * Model Manager
 * Handles models.json catalog, hardware recommendation, downloads, and model switching.
 */

import { DiskDriveInfo, DownloadProgress, HardwareInfo, InstalledModel, ModelCatalogItem } from "./types";
import { DEFAULT_MODELS_CATALOG } from "./modelsCatalog";

export class ModelManager {
  private catalog: ModelCatalogItem[] = DEFAULT_MODELS_CATALOG;
  private installedModels: InstalledModel[] = [];
  private hardwareInfo: HardwareInfo | null = null;
  private activeModelId: string = "";
  private tauriCore: any = null;
  private tauriEvent: any = null;

  public onDownloadProgress?: (progress: DownloadProgress) => void;
  public onInstalledModelsChanged?: (models: InstalledModel[]) => void;

  constructor() {
    this.initTauri();
  }

  private async initTauri() {
    if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) {
      try {
        this.tauriCore = await import("@tauri-apps/api/core");
        this.tauriEvent = await import("@tauri-apps/api/event");
        this.setupEventListeners();
      } catch (e) {
        console.warn("[ModelManager] Tauri API not available", e);
      }
    }
  }

  private async invoke(cmd: string, args?: any): Promise<any> {
    if (!this.tauriCore) await this.initTauri();
    if (!this.tauriCore) return null;
    return await this.tauriCore.invoke(cmd, args);
  }

  private async setupEventListeners() {
    if (!this.tauriEvent) return;
    await this.tauriEvent.listen("model-download-progress", (event: any) => {
      const progress: DownloadProgress = event.payload;
      if (this.onDownloadProgress) {
        this.onDownloadProgress(progress);
      }
      if (progress.status === "completed") {
        this.refreshInstalledModels();
      }
    });
  }

  async loadCatalog(): Promise<ModelCatalogItem[]> {
    try {
      const resp = await fetch("/models.json");
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data) && data.length > 0) {
          this.catalog = data;
        }
      }
    } catch (e) {
      console.warn("[ModelManager] Using fallback models catalog", e);
      this.catalog = DEFAULT_MODELS_CATALOG;
    }
    return this.catalog;
  }

  async detectHardware(): Promise<HardwareInfo> {
    try {
      const res = await this.invoke("get_hardware_info");
      if (res) {
        this.hardwareInfo = res;
        return res;
      }
    } catch (e) {
      console.warn("[ModelManager] Failed to detect hardware via Rust", e);
    }

    // Fallback info
    this.hardwareInfo = {
      total_ram_mb: 8192,
      available_ram_mb: 4096,
      cpu_cores: navigator.hardwareConcurrency || 4,
      free_disk_mb: 20480,
      gpu_name: null,
      recommended_tier: "low",
    };
    return this.hardwareInfo;
  }

  async refreshInstalledModels(): Promise<InstalledModel[]> {
    try {
      const res = await this.invoke("get_installed_models");
      if (Array.isArray(res)) {
        this.installedModels = res;
        if (this.onInstalledModelsChanged) {
          this.onInstalledModelsChanged(this.installedModels);
        }

        // Set default active model if none selected
        if (!this.activeModelId && this.installedModels.length > 0) {
          const saved = localStorage.getItem("mintu_active_model");
          if (saved && this.installedModels.some((m) => m.id === saved)) {
            this.activeModelId = saved;
          } else {
            this.activeModelId = this.installedModels[0].id;
          }
        }
      }
    } catch (e) {
      console.warn("[ModelManager] Failed to fetch installed models", e);
    }
    return this.installedModels;
  }

  getRecommendedModel(): ModelCatalogItem | null {
    if (!this.catalog.length) return null;
    const tier = this.hardwareInfo?.recommended_tier || "low";
    const found = this.catalog.find((m) => m.tier === tier);
    return found || this.catalog[0];
  }

  getCatalog(): ModelCatalogItem[] {
    return this.catalog;
  }

  getInstalledModels(): InstalledModel[] {
    return this.installedModels;
  }

  getActiveModelId(): string {
    return this.activeModelId;
  }

  setActiveModelId(id: string) {
    this.activeModelId = id;
    localStorage.setItem("mintu_active_model", id);
  }

  isModelInstalled(modelId: string): boolean {
    return this.installedModels.some((m) => m.id === modelId);
  }

  async startDownload(modelId: string): Promise<void> {
    const spec = this.catalog.find((m) => m.id === modelId);
    if (!spec) throw new Error(`Model ${modelId} not found in catalog`);

    await this.invoke("start_model_download", {
      spec: {
        id: spec.id,
        name: spec.name,
        tier: spec.tier,
        size_bytes: spec.size_bytes,
        min_ram_gb: spec.min_ram_gb,
        context_length: spec.context_length,
        url: spec.url,
        sha256: spec.sha256,
        license: spec.license,
        languages_note: spec.languages_note,
      },
    });
  }

  async pauseDownload(modelId: string): Promise<void> {
    await this.invoke("pause_model_download", { modelId });
  }

  async cancelDownload(modelId: string): Promise<void> {
    await this.invoke("cancel_model_download", { modelId });
  }

  async deleteModel(modelId: string): Promise<void> {
    await this.invoke("delete_model", { modelId });
    await this.refreshInstalledModels();
  }

  async getModelsDir(): Promise<string> {
    try {
      const res = await this.invoke("get_models_dir");
      if (res) return res;
    } catch (e) {
      console.warn("[ModelManager] Failed to get models dir", e);
    }
    return localStorage.getItem("mintu_models_dir") || "D:\\Mintu-Models";
  }

  async setModelsDir(newPath: string, moveExisting: boolean = false): Promise<HardwareInfo> {
    try {
      const res = await this.invoke("set_models_dir", { newPath, moveExisting });
      if (res) {
        this.hardwareInfo = res;
        localStorage.setItem("mintu_models_dir", newPath);
        await this.refreshInstalledModels();
        return res;
      }
    } catch (e) {
      console.warn("[ModelManager] Failed to set models dir", e);
      throw e;
    }
    localStorage.setItem("mintu_models_dir", newPath);
    return await this.detectHardware();
  }

  async getAvailableDisks(): Promise<DiskDriveInfo[]> {
    try {
      const res = await this.invoke("get_available_disks");
      if (Array.isArray(res) && res.length > 0) {
        return res;
      }
    } catch (e) {
      console.warn("[ModelManager] Failed to get available disks", e);
    }
    return [
      { drive_letter: "C:\\", total_mb: 120000, free_mb: 300, is_selected: false },
      { drive_letter: "D:\\", total_mb: 500000, free_mb: 154000, is_selected: true },
    ];
  }

  async browseModelsDir(): Promise<string | null> {
    try {
      const res = await this.invoke("browse_models_dir");
      return res || null;
    } catch (e) {
      console.warn("[ModelManager] Failed to browse models dir", e);
      return null;
    }
  }

  simulateMockDownload(modelId: string = "qwen2.5-0.5b"): void {
    const spec = this.catalog.find((m) => m.id === modelId) || this.catalog[0];
    const totalBytes = spec ? spec.size_bytes : 397000000;
    let step = 0;
    const steps = [
      { pct: 0.15, status: "downloading" as const, speed: 5200000, eta: 12 },
      { pct: 0.45, status: "downloading" as const, speed: 6800000, eta: 7 },
      { pct: 0.78, status: "downloading" as const, speed: 7100000, eta: 3 },
      { pct: 1.0, status: "verifying" as const, speed: 0, eta: 1 },
      { pct: 1.0, status: "completed" as const, speed: 0, eta: 0 },
    ];

    const interval = window.setInterval(() => {
      if (step >= steps.length) {
        clearInterval(interval);
        // Register mock installed model
        const mockInstalled: InstalledModel = {
          id: spec.id,
          file_name: `${spec.id}.gguf`,
          path: `mock://${spec.id}.gguf`,
          size_bytes: totalBytes,
        };
        if (!this.installedModels.some((m) => m.id === mockInstalled.id)) {
          this.installedModels.push(mockInstalled);
        }
        this.setActiveModelId(mockInstalled.id);
        if (this.onInstalledModelsChanged) {
          this.onInstalledModelsChanged(this.installedModels);
        }
        return;
      }

      const cur = steps[step];
      if (this.onDownloadProgress) {
        this.onDownloadProgress({
          model_id: spec.id,
          downloaded_bytes: Math.round(totalBytes * cur.pct),
          total_bytes: totalBytes,
          speed_bps: cur.speed,
          eta_seconds: cur.eta,
          status: cur.status,
        });
      }
      step++;
    }, 600);
  }
}

export const modelManager = new ModelManager();
