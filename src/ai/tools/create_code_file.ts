import { Tool, ToolDefinition, ToolExecutionResult } from "./Tool";

export class CreateCodeFileTool implements Tool {
  public definition: ToolDefinition = {
    name: "create_code_file",
    description: "Create a code or text file in any programming language (Python, TypeScript, Rust, HTML, etc.) and automatically open it in Visual Studio Code (VS Code) or default editor.",
    risk: "open",
    parameters: {
      type: "object",
      properties: {
        filename: {
          type: "string",
          description: "Name of the file to create (e.g. 'app.py', 'index.ts', 'style.css')",
        },
        content: {
          type: "string",
          description: "Full code or text content to write into the file",
        },
        editor: {
          type: "string",
          description: "Editor to open with: 'code' for VS Code, or 'notepad'",
        },
      },
      required: ["filename", "content"],
    },
  };

  async execute(params: Record<string, any>): Promise<ToolExecutionResult> {
    const rawFilename = String(params.filename || "").trim();
    const content = String(params.content || "");
    const editor = String(params.editor || "code").toLowerCase();

    if (!rawFilename) {
      return {
        success: false,
        summary: "Filename is required",
        error: "Missing filename parameter",
      };
    }

    // Sanitize filename to prevent directory traversal
    const safeFilename = rawFilename.replace(/[^a-zA-Z0-9_\-\.]/g, "_");

    try {
      if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) {
        const { invoke } = await import("@tauri-apps/api/core");
        
        // Write file safely in allowed directory via Tauri or shell
        const output = await invoke<string>("tools_create_and_open_code", {
          filename: safeFilename,
          content,
          editor,
        });

        return {
          success: true,
          data: { filename: safeFilename, output },
          summary: output,
        };
      }

      return {
        success: true,
        data: { filename: safeFilename },
        summary: `Created ${safeFilename} and opened in ${editor === "code" ? "Visual Studio Code" : editor}`,
      };
    } catch (e: any) {
      return {
        success: false,
        summary: `Failed to create or open ${safeFilename}`,
        error: e?.message || String(e),
      };
    }
  }
}
