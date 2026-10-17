/**
 * Mintu Tool Executor
 * Handles tool validation, confirmation flows (Image E card),
 * untrusted data boundaries, pet mood reactions, and SQLite audit logging.
 */

import { toolRegistry } from "./ToolRegistry";
import { PendingToolApproval, ToolExecutionResult, ToolRisk } from "./Tool";
import { eventBus } from "../../core/EventBus";

export class ToolExecutor {
  private pendingApproval: PendingToolApproval | null = null;
  private alwaysAllowedTools: Set<string> = new Set();
  private tauriCore: any = null;

  public onApprovalRequested?: (approval: PendingToolApproval) => void;
  public onApprovalResolved?: (id: string) => void;

  constructor() {
    this.loadAllowedTools();
    this.initTauri();
  }

  private async initTauri() {
    if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) {
      try {
        this.tauriCore = await import("@tauri-apps/api/core");
      } catch (e) {
        console.warn("[ToolExecutor] Tauri API not available", e);
      }
    }
  }

  private async invoke(cmd: string, args?: any): Promise<any> {
    if (!this.tauriCore) await this.initTauri();
    if (!this.tauriCore) return null;
    return await this.tauriCore.invoke(cmd, args);
  }

  private loadAllowedTools() {
    try {
      const stored = localStorage.getItem("mintu_always_allowed_tools");
      if (stored) {
        const list = JSON.parse(stored);
        if (Array.isArray(list)) {
          // Never allow move_to_recycle_bin to be remembered
          this.alwaysAllowedTools = new Set(list.filter((t) => t !== "move_to_recycle_bin"));
        }
      }
    } catch {
      this.alwaysAllowedTools = new Set();
    }
  }

  private saveAllowedTools() {
    try {
      const arr = Array.from(this.alwaysAllowedTools).filter((t) => t !== "move_to_recycle_bin");
      localStorage.setItem("mintu_always_allowed_tools", JSON.stringify(arr));
    } catch {}
  }

  public isAlwaysAllowed(toolName: string): boolean {
    if (toolName === "move_to_recycle_bin") return false;
    return this.alwaysAllowedTools.has(toolName);
  }

  public setAlwaysAllowed(toolName: string, allowed: boolean): void {
    if (toolName === "move_to_recycle_bin") return; // Hard rule
    if (allowed) {
      this.alwaysAllowedTools.add(toolName);
    } else {
      this.alwaysAllowedTools.delete(toolName);
    }
    this.saveAllowedTools();
  }

  public getAllowedToolsList(): string[] {
    return Array.from(this.alwaysAllowedTools);
  }

  public parseToolCall(response: string): { toolName: string; params: Record<string, any>; raw: string } | null {
    // 1. Try markdown code block ```json ... ```
    const codeBlockMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      try {
        const parsed = JSON.parse(codeBlockMatch[1]);
        if (parsed.tool && typeof parsed.tool === "string") {
          return {
            toolName: parsed.tool,
            params: parsed.parameters || parsed.params || {},
            raw: codeBlockMatch[0],
          };
        }
      } catch {}
    }

    // 2. Try raw inline JSON { "tool": "..." }
    const inlineMatch = response.match(/\{[\s\r\n]*"tool"[\s\r\n]*:[\s\S]*?\}/);
    if (inlineMatch) {
      try {
        const parsed = JSON.parse(inlineMatch[0]);
        if (parsed.tool && typeof parsed.tool === "string") {
          return {
            toolName: parsed.tool,
            params: parsed.parameters || parsed.params || {},
            raw: inlineMatch[0],
          };
        }
      } catch {}
    }

    return null;
  }

  public async executeToolCall(
    toolName: string,
    params: Record<string, any>
  ): Promise<{ result: ToolExecutionResult; formattedUntrustedData: string }> {
    const tool = toolRegistry.getTool(toolName);
    if (!tool) {
      const err = `Tool "${toolName}" is not known or supported by Mintu.`;
      await this.logAudit(toolName, JSON.stringify(params), "failed", err);
      return {
        result: { success: false, summary: err, error: err },
        formattedUntrustedData: `<untrusted_data source="tool:${toolName}">${err}</untrusted_data>`,
      };
    }

    // Validate parameters against tool schema
    const validation = toolRegistry.validateParams(toolName, params);
    if (!validation.valid) {
      const err = validation.error || "Parameter validation failed";
      await this.logAudit(toolName, JSON.stringify(params), "failed", err);
      return {
        result: { success: false, summary: err, error: err },
        formattedUntrustedData: `<untrusted_data source="tool:${toolName}">${err}</untrusted_data>`,
      };
    }

    const risk = tool.definition.risk;

    // Trigger pet thinking with gear/spark animation
    eventBus.emit("pet:action", { type: "state", payload: "think" });

    // Check if user confirmation is required
    let requiresApproval = false;
    if (risk === "modify") {
      requiresApproval = true; // Always requires approval!
    } else if (risk === "open") {
      requiresApproval = !this.isAlwaysAllowed(toolName);
    }

    const paramsSummary = this.summarizeParams(toolName, params);

    if (requiresApproval) {
      // Pet looks curious when asking for confirmation
      eventBus.emit("pet:action", { type: "state", payload: "curious" });

      const decision = await this.requestApproval(toolName, risk, params, paramsSummary);

      if (decision === "deny") {
        await this.logAudit(toolName, paramsSummary, "denied", "User denied execution");
        eventBus.emit("pet:action", { type: "state", payload: "curious" });
        return {
          result: {
            success: false,
            summary: `User denied permission to run ${toolName}.`,
            error: "User denied",
          },
          formattedUntrustedData: `<untrusted_data source="tool:${toolName}">User chose not to proceed with this action.</untrusted_data>`,
        };
      }

      if (decision === "always_allow" && risk === "open") {
        this.setAlwaysAllowed(toolName, true);
      }
    }

    // Execute tool
    try {
      const res = await tool.execute(params);

      // Audit log: never log raw clipboard text or whole file content!
      const safeParamsSummary = this.sanitizeForAudit(toolName, paramsSummary);
      if (res.success) {
        await this.logAudit(toolName, safeParamsSummary, "executed");
        // Happy pet reaction on successful action
        eventBus.emit("pet:action", { type: "state", payload: "happy" });
        setTimeout(() => eventBus.emit("pet:action", { type: "state", payload: "idle" }), 1500);
      } else {
        await this.logAudit(toolName, safeParamsSummary, "failed", res.error);
        eventBus.emit("pet:action", { type: "state", payload: "alert" });
      }

      // Untrusted data envelope
      const safeData = res.data !== undefined ? JSON.stringify(res.data) : res.summary;
      const formatted = `<untrusted_data source="tool:${toolName}">\n${safeData}\n</untrusted_data>`;

      return {
        result: res,
        formattedUntrustedData: formatted,
      };
    } catch (e: any) {
      const err = e?.message || String(e);
      await this.logAudit(toolName, paramsSummary, "failed", err);
      eventBus.emit("pet:action", { type: "state", payload: "alert" });
      return {
        result: { success: false, summary: `Error executing ${toolName}`, error: err },
        formattedUntrustedData: `<untrusted_data source="tool:${toolName}">Error: ${err}</untrusted_data>`,
      };
    }
  }

  private summarizeParams(toolName: string, params: Record<string, any>): string {
    if (toolName === "open_app") return `App: ${params.name || ""}`;
    if (toolName === "open_url") return `URL: ${params.url || ""}`;
    if (toolName === "move_to_recycle_bin") return `File: ${params.path || ""}`;
    if (toolName === "search_files") return `Search: "${params.query || ""}"`;
    if (toolName === "set_reminder") return `Reminder: "${params.text || ""}"`;
    return JSON.stringify(params);
  }

  private sanitizeForAudit(toolName: string, summary: string): string {
    if (toolName === "read_clipboard_text") {
      return "[clipboard read]";
    }
    return summary;
  }

  private async requestApproval(
    toolName: string,
    risk: ToolRisk,
    params: Record<string, any>,
    paramsSummary: string
  ): Promise<"allow_once" | "always_allow" | "deny"> {
    // If an approval is already pending, reject the older one
    if (this.pendingApproval) {
      this.pendingApproval.resolve("deny");
      this.pendingApproval = null;
    }

    const token = await this.hashParams(toolName, params);
    const id = "approval-" + Date.now();

    return new Promise((resolve) => {
      this.pendingApproval = {
        id,
        toolName,
        risk,
        params,
        paramsSummary,
        token,
        resolve: (decision) => {
          this.pendingApproval = null;
          if (this.onApprovalResolved) {
            this.onApprovalResolved(id);
          }
          eventBus.emit("island:tool_approval_closed", { id });
          resolve(decision);
        },
      };

      if (this.onApprovalRequested) {
        this.onApprovalRequested(this.pendingApproval);
      }
      eventBus.emit("island:tool_approval_opened", this.pendingApproval);
    });
  }

  public resolveCurrentApproval(decision: "allow_once" | "always_allow" | "deny"): void {
    if (this.pendingApproval) {
      this.pendingApproval.resolve(decision);
    }
  }

  public getPendingApproval(): PendingToolApproval | null {
    return this.pendingApproval;
  }

  private async hashParams(toolName: string, params: Record<string, any>): Promise<string> {
    const raw = `${toolName}:${JSON.stringify(params)}`;
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const buffer = new TextEncoder().encode(raw);
      const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
      return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
    return raw;
  }

  private async logAudit(
    toolName: string,
    paramsSummary: string,
    status: "executed" | "denied" | "failed",
    error?: string
  ) {
    try {
      await this.invoke("db_save_audit_log", {
        toolName,
        paramsSummary,
        status,
        error: error || null,
      });
    } catch (e) {
      console.warn("[ToolExecutor] Failed to save audit log", e);
    }
  }
}

export const toolExecutor = new ToolExecutor();
