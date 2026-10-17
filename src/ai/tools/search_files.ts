import { Tool, ToolDefinition, ToolExecutionResult } from "./Tool";

export interface FileSearchResult {
  path: string;
  filename: string;
  size_bytes: number;
  modified_ms: number;
  snippet?: string;
}

export class SearchFilesTool implements Tool {
  public definition: ToolDefinition = {
    name: "search_files",
    description: "Search for text files by filename or keyword in allowed user folders (Downloads, Desktop, Documents). Files must be under 1MB.",
    risk: "low",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Filename pattern or keyword to search for inside documents",
        },
        subfolder: {
          type: "string",
          description: "Optional subfolder path within allowed folders to restrict search",
        },
      },
      required: ["query"],
    },
  };

  async execute(params: Record<string, any>): Promise<ToolExecutionResult> {
    const query = String(params.query || "").trim();
    const subfolder = params.subfolder ? String(params.subfolder) : undefined;

    if (!query) {
      return {
        success: false,
        summary: "Search query cannot be empty",
        error: "Missing required parameter: query",
      };
    }

    try {
      let results: FileSearchResult[] = [];
      if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) {
        const { invoke } = await import("@tauri-apps/api/core");
        results = await invoke<FileSearchResult[]>("tools_search_files", {
          query,
          subfolder,
          maxResults: 20,
        });
      }

      const count = results.length;
      if (count === 0) {
        return {
          success: true,
          data: { files: [] },
          summary: `No matching files found for "${query}" in allowed folders.`,
        };
      }

      const fileListSummary = results
        .slice(0, 3)
        .map((f) => f.filename)
        .join(", ");
      const extra = count > 3 ? ` and ${count - 3} more` : "";

      return {
        success: true,
        data: {
          files: results.map((f) => ({
            filename: f.filename,
            path: f.path,
            size_kb: Math.round(f.size_bytes / 1024),
            snippet: f.snippet,
          })),
        },
        summary: `Found ${count} file${count > 1 ? "s" : ""}: ${fileListSummary}${extra}`,
      };
    } catch (e: any) {
      return {
        success: false,
        summary: `File search failed for "${query}"`,
        error: e?.message || String(e),
      };
    }
  }
}
