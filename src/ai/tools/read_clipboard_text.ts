import { Tool, ToolDefinition, ToolExecutionResult } from "./Tool";

export class ReadClipboardTextTool implements Tool {
  public definition: ToolDefinition = {
    name: "read_clipboard_text",
    description: "Read the current plain text copied on the user's system clipboard.",
    risk: "low",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  };

  async execute(): Promise<ToolExecutionResult> {
    try {
      let text = "";
      if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) {
        const { invoke } = await import("@tauri-apps/api/core");
        text = await invoke<string>("tools_read_clipboard");
      } else if (navigator.clipboard?.readText) {
        text = await navigator.clipboard.readText();
      }

      if (!text || text.trim() === "") {
        return {
          success: true,
          data: { text: "" },
          summary: "Clipboard is currently empty or contains non-text content.",
        };
      }

      const preview = text.length > 60 ? text.substring(0, 57).replace(/\s+/g, " ") + "..." : text;

      return {
        success: true,
        data: { text },
        summary: `Read clipboard (${text.length} chars): "${preview}"`,
      };
    } catch (e: any) {
      return {
        success: false,
        summary: "Failed to read clipboard text",
        error: e?.message || String(e),
      };
    }
  }
}
