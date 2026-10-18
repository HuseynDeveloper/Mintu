import { Tool, ToolDefinition, ToolExecutionResult } from "./Tool";

export class OpenUrlTool implements Tool {
  public definition: ToolDefinition = {
    name: "open_url",
    description: "Open a web URL in the user's default web browser. Restricted to http:// and https:// URLs only.",
    risk: "open",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Web address to open (must begin with http:// or https://)",
        },
      },
      required: ["url"],
    },
  };

  async execute(params: Record<string, any>): Promise<ToolExecutionResult> {
    const rawUrl = String(params.url || "").trim();

    if (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
      return {
        success: false,
        summary: `Refused to open invalid URL scheme: ${rawUrl}`,
        error: "Security restriction: Only http:// and https:// URLs are permitted.",
      };
    }

    try {
      let output = `Opened ${rawUrl} in browser`;
      if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) {
        const { invoke } = await import("@tauri-apps/api/core");
        output = await invoke<string>("tools_open_url", { url: rawUrl });
      }

      return {
        success: true,
        data: { url: rawUrl },
        summary: output,
      };
    } catch (e: any) {
      return {
        success: false,
        summary: `Failed to open ${rawUrl}`,
        error: e?.message || String(e),
      };
    }
  }
}
