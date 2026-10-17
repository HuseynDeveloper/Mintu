import { Tool, ToolDefinition, ToolExecutionResult } from "./Tool";

export class GetTimeAndDateTool implements Tool {
  public definition: ToolDefinition = {
    name: "get_time_and_date",
    description: "Get the current local system date, time, day of the week, and timezone.",
    risk: "low",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  };

  async execute(): Promise<ToolExecutionResult> {
    const now = new Date();
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const day = days[now.getDay()];
    const dateStr = now.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    return {
      success: true,
      data: {
        iso: now.toISOString(),
        day,
        date: dateStr,
        time: timeStr,
        timezone,
        timestamp_ms: now.getTime(),
      },
      summary: `Current time: ${timeStr}, ${day} (${timezone})`,
    };
  }
}
