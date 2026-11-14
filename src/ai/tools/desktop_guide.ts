import { Tool, ToolDefinition, ToolExecutionResult } from "./Tool";

export class DesktopGuideTool implements Tool {
  public definition: ToolDefinition = {
    name: "desktop_guide",
    description: "Guide the user across the desktop by moving the mouse cursor, pointing to UI elements, or providing interactive step-by-step visual guidance.",
    risk: "open",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "Action type: 'move_mouse' (move cursor to coordinate), 'guide_step' (provide directions and point to UI), 'highlight' (point to screen area)",
        },
        description: {
          type: "string",
          description: "Explanation of the guidance or what to do next",
        },
        x: {
          type: "number",
          description: "Target X screen coordinate (optional)",
        },
        y: {
          type: "number",
          description: "Target Y screen coordinate (optional)",
        },
      },
      required: ["description"],
    },
  };

  async execute(params: Record<string, any>): Promise<ToolExecutionResult> {
    const description = String(params.description || "").trim();
    const action = String(params.action || "guide_step");
    const targetX = typeof params.x === "number" ? params.x : null;
    const targetY = typeof params.y === "number" ? params.y : null;

    try {
      if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) {
        const { invoke } = await import("@tauri-apps/api/core");
        
        if (targetX !== null && targetY !== null) {
          await invoke("tools_move_mouse_cursor", { x: Math.round(targetX), y: Math.round(targetY) });
        }
      }

      return {
        success: true,
        data: { action, description, x: targetX, y: targetY },
        summary: `Desktop Guide: ${description}`,
      };
    } catch (e: any) {
      return {
        success: false,
        summary: `Desktop guidance error: ${description}`,
        error: e?.message || String(e),
      };
    }
  }
}
