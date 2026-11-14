import { Tool, ToolDefinition, ToolExecutionResult } from "./Tool";

export class PlaySpotifyTool implements Tool {
  public definition: ToolDefinition = {
    name: "play_spotify",
    description: "Search and play a song, artist, album, or playlist on Spotify.",
    risk: "open",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Song title, artist name, or album to search on Spotify",
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
    const spotifyWebUrl = `https://open.spotify.com/search/${encoded}`;

    try {
      if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) {
        const { invoke } = await import("@tauri-apps/api/core");
        // Open Spotify search in browser or desktop client
        await invoke("tools_open_url", { url: spotifyWebUrl });
      } else {
        window.open(spotifyWebUrl, "_blank");
      }

      return {
        success: true,
        data: { query, url: spotifyWebUrl },
        summary: `Searching and playing "${query}" on Spotify`,
      };
    } catch (e: any) {
      return {
        success: false,
        summary: `Could not open Spotify for "${query}"`,
        error: e?.message || String(e),
      };
    }
  }
}
