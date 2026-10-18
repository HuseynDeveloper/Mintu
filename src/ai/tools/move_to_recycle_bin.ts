import { Tool, ToolDefinition, ToolExecutionResult } from "./Tool";

export class MoveToRecycleBinTool implements Tool {
  public definition: ToolDefinition = {
    name: "move_to_recycle_bin",
    description: "Move an individual file inside allowed folders (Downloads or Desktop) safely to the Windows Recycle Bin. Reversible and never permanently deletes.",
    risk: "modify",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Full file path of the file to move to the Recycle Bin",
        },
      },
      required: ["path"],
    },
  };

  async execute(params: Record<string, any>): Promise<ToolExecutionResult> {
    const filePath = String(params.path || "").trim();
    if (!filePath) {
      return {
        success: false,
        summary: "File path is required",
        error: "Missing path parameter",
      };
    }

    try {
      let output = `Moved file to Recycle Bin`;
      if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) {
        const { invoke } = await import("@tauri-apps/api/core");
        output = await invoke<string>("tools_move_to_recycle_bin", { path: filePath });
      }

      return {
        success: true,
        data: { path: filePath, output },
        summary: output,
      };
    } catch (e: any) {
      return {
        success: false,
        summary: `Failed to recycle file: ${filePath}`,
        error: e?.message || String(e),
      };
    }
  }
}
