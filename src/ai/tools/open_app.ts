import { Tool, ToolDefinition, ToolExecutionResult } from "./Tool";

export class OpenAppTool implements Tool {
  public definition: ToolDefinition = {
    name: "open_app",
    description: "Launch an installed desktop application by its name (e.g. 'Notepad', 'Calculator', 'Chrome', 'Spotify').",
    risk: "open",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name of the application to launch",
        },
      },
      required: ["name"],
    },
  };

  async execute(params: Record<string, any>): Promise<ToolExecutionResult> {
    const name = String(params.name || "").trim();
    if (!name) {
      return {
        success: false,
        summary: "Application name is required",
        error: "Missing name parameter",
      };
    }

    try {
      let output = `Opened ${name}`;
      if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) {
        const { invoke } = await import("@tauri-apps/api/core");
        output = await invoke<string>("tools_open_app", { name });
      }

      return {
        success: true,
        data: { name, output },
        summary: output,
      };
    } catch (e: any) {
      return {
        success: false,
        summary: `Could not launch ${name}`,
        error: e?.message || String(e),
      };
    }
  }
}
