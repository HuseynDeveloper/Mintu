/**
 * Mintu Clipboard History Manager (Last 15 items, with Pin support)
 */

export interface ClipboardEntry {
  id: string;
  text: string;
  pinned: boolean;
  copiedAt: number;
}

const STORAGE_KEY = "mintu_clipboard_history_v1";
const MAX_ITEMS = 15;

export class ClipboardHistoryManager {
  private items: ClipboardEntry[] = [];

  constructor() {
    this.items = this.load();
  }

  private load(): ClipboardEntry[] {
    if (typeof localStorage === "undefined") return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(0, MAX_ITEMS) : [];
    } catch {
      return [];
    }
  }

  private save(): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
    } catch {}
  }

  public add(rawText: string): ClipboardEntry | null {
    const clean = String(rawText || "").trim();
    if (!clean || clean.length > 4000) return null;

    const existing = this.items.find((i) => i.text === clean);
    if (existing) {
      existing.copiedAt = Date.now();
      this.sortAndTrim();
      this.save();
      return existing;
    }

    const entry: ClipboardEntry = {
      id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text: clean,
      pinned: false,
      copiedAt: Date.now(),
    };
    this.items.unshift(entry);
    this.sortAndTrim();
    this.save();
    return entry;
  }

  public togglePin(id: string): void {
    const found = this.items.find((i) => i.id === id);
    if (found) {
      found.pinned = !found.pinned;
      this.sortAndTrim();
      this.save();
    }
  }

  public remove(id: string): void {
    this.items = this.items.filter((i) => i.id !== id);
    this.save();
  }

  public clearUnpinned(): void {
    this.items = this.items.filter((i) => i.pinned);
    this.save();
  }

  public getAll(): ClipboardEntry[] {
    return this.items.map((i) => ({ ...i }));
  }

  private sortAndTrim(): void {
    const pinned = this.items.filter((i) => i.pinned).sort((a, b) => b.copiedAt - a.copiedAt);
    const regular = this.items.filter((i) => !i.pinned).sort((a, b) => b.copiedAt - a.copiedAt);
    this.items = [...pinned, ...regular].slice(0, MAX_ITEMS);
  }
}

export const clipboardHistory = new ClipboardHistoryManager();
