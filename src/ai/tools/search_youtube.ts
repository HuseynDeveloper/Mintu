import { Tool, ToolDefinition, ToolExecutionResult } from "./Tool";

export class SearchYoutubeTool implements Tool {
  public definition: ToolDefinition = {
    name: "search_youtube",
    description: "Search and play a video, song, tutorial, or live stream on YouTube.",
    risk: "open",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Video name, song title, channel, or topic to search on YouTube",
        },
      },
      required: ["query"],
    },
  };

  async execute(params: Record<string, any>): Promise<ToolExecutionResult> {
    const query = String(params.query || "").trim();
    if (!query) {
      return {
        success: false,
        summary: "Search query is required",
        error: "Missing query parameter",
      };
    }

    const encoded = encodeURIComponent(query);
    const youtubeUrl = `https://www.youtube.com/results?search_query=${encoded}`;

    try {
      if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("tools_open_url", { url: youtubeUrl });
      } else {
        window.open(youtubeUrl, "_blank");
      }

      return {
        success: true,
        data: { query, url: youtubeUrl },
        summary: `Found and opened YouTube search for "${query}"`,
      };
    } catch (e: any) {
      return {
        success: false,
        summary: `Could not open YouTube for "${query}"`,
        error: e?.message || String(e),
      };
    }
  }
}
