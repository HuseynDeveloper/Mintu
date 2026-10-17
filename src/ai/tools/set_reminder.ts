import { Tool, ToolDefinition, ToolExecutionResult } from "./Tool";

export class SetReminderTool implements Tool {
  public definition: ToolDefinition = {
    name: "set_reminder",
    description: "Set a reminder with a specific message and time duration (in seconds, minutes, or hours). Mintu will notify you when it's due.",
    risk: "low",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The reminder text or task description (e.g. 'Take a break', 'Check email')",
        },
        in_seconds: {
          type: "number",
          description: "Number of seconds from now until the reminder triggers (e.g. 60 for 1 minute)",
        },
        in_minutes: {
          type: "number",
          description: "Number of minutes from now until the reminder triggers",
        },
      },
      required: ["text"],
    },
  };

  async execute(params: Record<string, any>): Promise<ToolExecutionResult> {
    const text = String(params.text || "").trim();
    if (!text) {
      return {
        success: false,
        summary: "Reminder text is required",
        error: "Missing text",
      };
    }

    let delaySeconds = 60; // Default 1 min
    if (typeof params.in_seconds === "number" && params.in_seconds > 0) {
      delaySeconds = Math.round(params.in_seconds);
    } else if (typeof params.in_minutes === "number" && params.in_minutes > 0) {
      delaySeconds = Math.round(params.in_minutes * 60);
    }

    const dueTimeMs = Date.now() + delaySeconds * 1000;
    const dueTimeDate = new Date(dueTimeMs);
    const timeFormatted = dueTimeDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    try {
      if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("db_create_reminder", {
          text,
          dueTime: dueTimeMs,
        });
      }

      const humanDelay =
        delaySeconds >= 3600
          ? `${(delaySeconds / 3600).toFixed(1)} hour(s)`
          : delaySeconds >= 60
          ? `${Math.round(delaySeconds / 60)} minute(s)`
          : `${delaySeconds} second(s)`;

      return {
        success: true,
        data: {
          text,
          due_time: dueTimeMs,
          time_formatted: timeFormatted,
          delay_seconds: delaySeconds,
        },
        summary: `Set reminder for "${text}" in ${humanDelay} (at ${timeFormatted})`,
      };
    } catch (e: any) {
      return {
        success: false,
        summary: `Failed to set reminder for "${text}"`,
        error: e?.message || String(e),
      };
    }
  }
}
