import { Tool, ToolDefinition } from "./Tool";
import { GetTimeAndDateTool } from "./get_time_and_date";
import { ReadClipboardTextTool } from "./read_clipboard_text";
import { SearchFilesTool } from "./search_files";
import { SetReminderTool } from "./set_reminder";
import { OpenAppTool } from "./open_app";
import { OpenUrlTool } from "./open_url";
import { MoveToRecycleBinTool } from "./move_to_recycle_bin";
import { StartTimerTool } from "./start_timer";
import { StopTimerTool } from "./stop_timer";
import { GetTimerStatusTool } from "./get_timer_status";
import { CreateCodeFileTool } from "./create_code_file";
import { PlaySpotifyTool } from "./play_spotify";
import { SearchYoutubeTool } from "./search_youtube";
import { DesktopGuideTool } from "./desktop_guide";

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  constructor() {
    this.register(new GetTimeAndDateTool());
    this.register(new ReadClipboardTextTool());
    this.register(new SearchFilesTool());
    this.register(new SetReminderTool());
    this.register(new OpenAppTool());
    this.register(new OpenUrlTool());
    this.register(new MoveToRecycleBinTool());
    this.register(new StartTimerTool());
    this.register(new StopTimerTool());
    this.register(new GetTimerStatusTool());
    this.register(new CreateCodeFileTool());
    this.register(new PlaySpotifyTool());
    this.register(new SearchYoutubeTool());
    this.register(new DesktopGuideTool());
  }

  public register(tool: Tool): void {
    this.tools.set(tool.definition.name, tool);
  }

  public getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  public getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  public getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  public validateParams(name: string, params: Record<string, any>): { valid: boolean; error?: string } {
    const tool = this.tools.get(name);
    if (!tool) {
      return { valid: false, error: `Tool "${name}" is not registered.` };
    }

    const schema = tool.definition.parameters;
    const required = schema.required || [];
    for (const req of required) {
      if (params[req] === undefined || params[req] === null || params[req] === "") {
        return { valid: false, error: `Missing required parameter "${req}" for tool "${name}".` };
      }
    }

    // Type checking
    for (const [key, value] of Object.entries(params)) {
      const prop = schema.properties[key];
      if (!prop) {
        // Unknown property, but let's be forgiving unless required
        continue;
      }
      if (prop.type === "string" && typeof value !== "string") {
        return { valid: false, error: `Parameter "${key}" must be a string.` };
      }
      if (prop.type === "number" && typeof value !== "number") {
        return { valid: false, error: `Parameter "${key}" must be a number.` };
      }
      if (prop.type === "boolean" && typeof value !== "boolean") {
        return { valid: false, error: `Parameter "${key}" must be a boolean.` };
      }
    }

    return { valid: true };
  }

  public getPromptInstructions(): string {
    const toolList = this.getAllTools()
      .map((t) => {
        const props = Object.keys(t.definition.parameters.properties || {}).join(", ");
        return `- ${t.definition.name}(${props}): ${t.definition.description}`;
      })
      .join("\n");

    return `Desktop Tools:
${toolList}

To execute a tool, output a JSON block:
\`\`\`json
{"tool": "name", "parameters": { ... }}
\`\`\`
Examples:
- Open website: {"tool": "open_url", "parameters": {"url": "https://google.com"}}
- Launch app: {"tool": "open_app", "parameters": {"name": "Spotify"}}
- Create code file: {"tool": "create_code_file", "parameters": {"filename": "app.py", "content": "print('hello')", "editor": "code"}}
- Play Spotify: {"tool": "play_spotify", "parameters": {"query": "Bohemian Rhapsody"}}
- Search YouTube: {"tool": "search_youtube", "parameters": {"query": "Mintu companion"}}`;
  }
}

export const toolRegistry = new ToolRegistry();
