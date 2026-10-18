/**
 * Mintu Smart Clipboard Assistant (Milestone 8)
 * Detects Ctrl+C clipboard copies and presents contextual quick-actions:
 * - Code: "Koddakı xətanı yoxla"
 * - JSON: "Formatla və səliqəyə sal"
 * - Foreign text: "Azərbaycan dilinə tərcümə et"
 */

import { eventBus } from "../core/EventBus.ts";

export type ClipboardContentType = "code" | "json" | "translate" | "text";

export interface ClipboardAction {
  type: ClipboardContentType;
  label: string;
  prompt: string;
  content: string;
  summary: string;
}

export class SmartClipboard {
  private lastHash: string = "";
  private enabled: boolean = true;
  private currentAction: ClipboardAction | null = null;
  private dismissTimer: any = null;

  constructor() {
    this.enabled = localStorage.getItem("mintu_smart_clipboard") !== "off";
    this.initWatcher();
  }

  public setEnabled(val: boolean): void {
    this.enabled = val;
    localStorage.setItem("mintu_smart_clipboard", val ? "on" : "off");
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  private initWatcher(): void {
    if (typeof window === "undefined") return;

    // Listen to background clipboard update events from Tauri
    import("../core/AppBridge.ts").then(({ appBridge }) => {
      appBridge.listenToEvent<string>("clipboard-copied", (text) => {
        if (!this.enabled || !text) return;
        this.processCopiedText(text);
      });
    }).catch(() => {});

    // Polling fallback every 1200ms
    setInterval(() => {
      if (!this.enabled) return;
      this.checkClipboardFallback();
    }, 1200);
  }

  private async checkClipboardFallback(): Promise<void> {
    try {
      if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) {
        const { invoke } = await import("@tauri-apps/api/core");
        const text = await invoke<string>("tools_read_clipboard");
        if (text && text.trim().length > 3) {
          this.processCopiedText(text);
        }
      }
    } catch {}
  }

  public processCopiedText(raw: string): void {
    const text = raw.trim();
    if (!text || text.length < 5 || text.length > 35000) return;

    // Simple hash to avoid re-triggering on unchanged text
    const hash = `${text.length}_${text.slice(0, 30)}_${text.slice(-30)}`;
    if (hash === this.lastHash) return;
    this.lastHash = hash;

    const action = this.classifyText(text);
    if (!action) return;

    this.currentAction = action;
    eventBus.emit("clipboard:action-suggested", action);

    // Auto-dismiss pill after 6 seconds
    if (this.dismissTimer) clearTimeout(this.dismissTimer);
    this.dismissTimer = setTimeout(() => {
      this.clearAction();
    }, 6000);
  }

  public clearAction(): void {
    this.currentAction = null;
    eventBus.emit("clipboard:action-cleared", {});
    if (this.dismissTimer) clearTimeout(this.dismissTimer);
  }

  public getCurrentAction(): ClipboardAction | null {
    return this.currentAction;
  }

  public classifyText(text: string): ClipboardAction | null {
    // 1. Check if JSON data
    if ((text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]"))) {
      try {
        JSON.parse(text);
        return {
          type: "json",
          label: "Formatla və səliqəyə sal",
          prompt: `Aşağıdakı JSON məlumatını oxunaqlı və səliqəli şəkildə formatla, sintaksisini yoxla:\n\n\`\`\`json\n${text}\n\`\`\``,
          content: text,
          summary: text.slice(0, 60),
        };
      } catch {
        // May still be invalid/unformatted JSON
        if (text.includes('":') || text.includes('": ')) {
          return {
            type: "json",
            label: "Formatla və səliqəyə sal",
            prompt: `Aşağıdakı JSON strukturundakı xətaları düzəlt və səliqəli formatla:\n\n\`\`\`json\n${text}\n\`\`\``,
            content: text,
            summary: text.slice(0, 60),
          };
        }
      }
    }

    // 2. Check if Code
    const codeIndicators = [
      /\bfunction\s*\w*\s*\(/,
      /\bconst\s+\w+\s*=/,
      /\blet\s+\w+\s*=/,
      /\bdef\s+\w+\s*\(/,
      /\bclass\s+\w+/,
      /\bimport\s+.*\s+from\b/,
      /\bpublic\s+(class|void|fn|struct|enum)\b/,
      /\bfn\s+\w+\s*\(/,
      /console\.log\(/,
      /<\/[a-z]+>/i,
      /=>\s*\{/,
      /;\s*(\r?\n)/,
    ];

    const matchCount = codeIndicators.filter((re) => re.test(text)).length;
    if (matchCount >= 2 || (text.includes("```") && text.length > 20)) {
      return {
        type: "code",
        label: "Koddakı xətanı yoxla",
        prompt: `Aşağıdakı proqram kodunda mümkün xətaları, optimizasiya yollarını yoxla və qısa izah et:\n\n\`\`\`\n${text}\n\`\`\``,
        content: text,
        summary: text.slice(0, 60),
      };
    }

    // 3. Check if foreign language text (English, Russian, etc.) to translate to Azerbaijani
    const azLetters = /[əğıöşüçƏĞIÖŞÜÇ]/;
    const hasAzSpecific = azLetters.test(text);

    // Common English / Russian words
    const foreignMarkers = /\b(the|is|and|to|in|that|with|for|as|on|at|by|this|from|which|or|an|not|error|failed|cannot|undefined|null|для|что|или|как|если|при|это|было)\b/i;

    const words = text.split(/\s+/).filter(Boolean);
    if (!hasAzSpecific && words.length >= 6 && foreignMarkers.test(text)) {
      return {
        type: "translate",
        label: "Azərbaycan dilinə tərcümə et",
        prompt: `Aşağıdakı mətni təbii, dəqiq və səlis Azərbaycan dilinə tərcümə et:\n\n"${text}"`,
        content: text,
        summary: text.slice(0, 60),
      };
    }

    return null;
  }
}

export const smartClipboard = new SmartClipboard();
