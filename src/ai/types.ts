/**
 * Mintu AI Chat Types (Milestone 5)
 */

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: number;
  tokens?: number;
  attachments?: string;
  tool_calls?: string;
  version_index?: number;
  versions?: string; // JSON serialized string array of alternate version contents
}

export interface Conversation {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  model: string;
  pinned?: number;
  draft?: string;
  last_preview?: string;
}

export interface ChatSearchResult {
  conversation_id: string;
  message_id?: string;
  title: string;
  snippet: string;
  role?: string;
  updated_at: number;
}

export type MemoryKind = "fact" | "preference" | "project";

export interface MemoryEntry {
  id: string;
  kind: MemoryKind;
  text: string;
  created_at: number;
  updated_at: number;
  source: string;
  pinned: number;
  deleted_at?: number | null;
}

export type PetMood = "calm" | "cheerful" | "sleepy" | "curious" | "focused" | "worried" | "proud";

export interface MoodState {
  mood: PetMood;
  reason: string;
  updatedAt: number;
}

export interface ModelCatalogItem {
  id: string;
  name: string;
  tier: "very-low" | "low" | "medium" | "high" | "embedding";
  size_bytes: number;
  size_human: string;
  min_ram_gb: number;
  context_length: number;
  url: string;
  sha256: string;
  license: string;
  languages_note: string;
  description: string;
  verification_status?: string;
  verification_source?: string;
}

export interface HardwareInfo {
  total_ram_mb: number;
  available_ram_mb: number;
  cpu_cores: number;
  free_disk_mb: number;
  gpu_name?: string | null;
  recommended_tier: string;
}

export interface DiskDriveInfo {
  drive_letter: string;
  total_mb: number;
  free_mb: number;
  is_selected: boolean;
}

export interface InstalledModel {
  id: string;
  file_name: string;
  path: string;
  size_bytes: number;
}

export interface DownloadProgress {
  model_id: string;
  downloaded_bytes: number;
  total_bytes: number;
  speed_bps: number;
  eta_seconds: number;
  status: "downloading" | "paused" | "verifying" | "completed" | "cancelled" | "error";
  error?: string;
}

export interface SidecarInfo {
  status: "stopped" | "starting" | "ready" | "idle_unloaded" | "error";
  port: number;
  api_key: string;
  model_path?: string;
  error?: string;
}

export type AIState = "idle" | "loading" | "thinking" | "streaming" | "error";
