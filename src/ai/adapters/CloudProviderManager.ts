/**
 * Mintu Cloud Provider Manager
 * Manages active provider (local vs cloud), user consent, credentials, and privacy safeguards.
 */

import { AIProvider, LlamaCppProvider } from "../AIProvider";
import { CLOUD_PROVIDERS } from "../cloudCatalog";
import { OpenAICompatibleAdapter } from "./OpenAICompatibleAdapter";
import { AnthropicAdapter } from "./AnthropicAdapter";

export interface ProviderKeyStatus {
  provider: string;
  has_key: boolean;
  masked: string | null;
}

export class CloudProviderManager {
  private activeProviderId: string = "local"; // "local" | "gemini" | "anthropic" | ...
  private neverCloudForContextCaptures: boolean = true;
  private adapters: Map<string, AIProvider> = new Map();
  private tauriCore: any = null;

  constructor() {
    this.loadSettings();
    this.initTauri();
  }

  private async initTauri() {
    if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) {
      try {
        this.tauriCore = await import("@tauri-apps/api/core");
      } catch (e) {
        console.warn("[CloudProviderManager] Tauri API not available", e);
      }
    }
  }

  private loadSettings() {
    try {
      const savedProvider = localStorage.getItem("mintu_active_provider");
      if (savedProvider) this.activeProviderId = savedProvider;

      const savedPrivacy = localStorage.getItem("mintu_never_cloud_context");
      if (savedPrivacy !== null) {
        this.neverCloudForContextCaptures = savedPrivacy === "true";
      }
    } catch {}
  }

  public getActiveProviderId(): string {
    return this.activeProviderId;
  }

  public setActiveProviderId(id: string) {
    this.activeProviderId = id;
    localStorage.setItem("mintu_active_provider", id);
  }

  public getBaseUrl(providerId?: string): string {
    const prov = providerId || this.activeProviderId;
    const saved = localStorage.getItem(`mintu_base_url_${prov}`);
    if (saved && saved.trim()) return saved.trim();
    const config = CLOUD_PROVIDERS[prov];
    return config ? config.baseUrl : "https://api.openai.com/v1";
  }

  public setBaseUrl(providerId: string, url: string) {
    if (url && url.trim()) {
      localStorage.setItem(`mintu_base_url_${providerId}`, url.trim());
    } else {
      localStorage.removeItem(`mintu_base_url_${providerId}`);
    }
    const adapter = this.adapters.get(providerId);
    if (adapter && "setBaseUrl" in adapter) {
      (adapter as any).setBaseUrl(this.getBaseUrl(providerId));
    }
  }

  public getModel(providerId?: string): string {
    const prov = providerId || this.activeProviderId;
    const saved = localStorage.getItem(`mintu_cloud_model_${prov}`);
    if (saved && saved.trim()) return saved.trim();
    const config = CLOUD_PROVIDERS[prov];
    return config ? config.defaultModel : "gpt-4o";
  }

  public setModel(providerId: string, model: string) {
    if (model && model.trim()) {
      localStorage.setItem(`mintu_cloud_model_${providerId}`, model.trim());
    } else {
      localStorage.removeItem(`mintu_cloud_model_${providerId}`);
    }
    const adapter = this.adapters.get(providerId);
    if (adapter && "setModel" in adapter) {
      (adapter as any).setModel(this.getModel(providerId));
    }
  }

  public getActiveModel(): string {
    return this.getModel(this.activeProviderId);
  }

  public setActiveModel(model: string) {
    this.setModel(this.activeProviderId, model);
  }

  public getNeverCloudForContextCaptures(): boolean {
    return this.neverCloudForContextCaptures;
  }

  public setNeverCloudForContextCaptures(val: boolean) {
    this.neverCloudForContextCaptures = val;
    localStorage.setItem("mintu_never_cloud_context", String(val));
  }

  public hasConsent(providerId: string): boolean {
    if (providerId === "local") return true;
    return localStorage.getItem(`mintu_consent_${providerId}`) === "true";
  }

  public setConsent(providerId: string, consent: boolean) {
    if (consent) {
      localStorage.setItem(`mintu_consent_${providerId}`, "true");
    } else {
      localStorage.removeItem(`mintu_consent_${providerId}`);
    }
  }

  public getProviderInstance(): AIProvider {
    if (this.activeProviderId === "local") {
      return new LlamaCppProvider();
    }

    const currentModel = this.getModel(this.activeProviderId);
    const currentBaseUrl = this.getBaseUrl(this.activeProviderId);

    if (this.adapters.has(this.activeProviderId)) {
      const adapter = this.adapters.get(this.activeProviderId)!;
      if ("setModel" in adapter) (adapter as any).setModel(currentModel);
      if ("setBaseUrl" in adapter) (adapter as any).setBaseUrl(currentBaseUrl);
      return adapter;
    }

    let adapter: AIProvider;
    if (this.activeProviderId === "anthropic") {
      adapter = new AnthropicAdapter(currentModel || "claude-3-5-sonnet-20241022");
    } else {
      const config = CLOUD_PROVIDERS[this.activeProviderId];
      const name = config ? config.name : this.activeProviderId;
      adapter = new OpenAICompatibleAdapter(this.activeProviderId, name, currentBaseUrl, currentModel);
    }

    this.adapters.set(this.activeProviderId, adapter);
    return adapter;
  }

  public hasApiKey(providerId: string): boolean {
    const cached = localStorage.getItem(`mintu_has_key_${providerId}`);
    return cached === "true";
  }

  public async getKeyStatus(providerId: string): Promise<ProviderKeyStatus> {
    if (!this.tauriCore) await this.initTauri();
    if (this.tauriCore) {
      try {
        const res: ProviderKeyStatus = await this.tauriCore.invoke("get_key_status", { provider: providerId });
        localStorage.setItem(`mintu_has_key_${providerId}`, String(res.has_key));
        return res;
      } catch {}
    }
    return { provider: providerId, has_key: false, masked: null };
  }

  public async storeApiKey(providerId: string, key: string): Promise<void> {
    if (!this.tauriCore) await this.initTauri();
    if (this.tauriCore) {
      await this.tauriCore.invoke("store_api_key", { provider: providerId, key });
      localStorage.setItem(`mintu_has_key_${providerId}`, "true");
    }
  }

  public async deleteApiKey(providerId: string): Promise<boolean> {
    if (!this.tauriCore) await this.initTauri();
    if (this.tauriCore) {
      const ok = await this.tauriCore.invoke("delete_api_key", { provider: providerId });
      localStorage.removeItem(`mintu_has_key_${providerId}`);
      return ok;
    }
    return false;
  }
}

export const cloudProviderManager = new CloudProviderManager();
