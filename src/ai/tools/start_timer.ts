import { Tool, ToolDefinition, ToolExecutionResult } from "./Tool";
import { timerEngine } from "../../modules/timer/TimerEngine";

export class StartTimerTool implements Tool {
  public definition: ToolDefinition = {
    name: "start_timer",
    description: "Start a countdown timer, Pomodoro focus session, or stopwatch on Mintu's Dynamic Island.",
    risk: "low",
    parameters: {
      type: "object",
      properties: {
        minutes: {
          type: "number",
          description: "Duration in minutes (e.g. 10 for 10 minutes, 25 for a Pomodoro focus phase)",
        },
        seconds: {
          type: "number",
          description: "Additional duration in seconds",
        },
        mode: {
          type: "string",
          enum: ["countdown", "pomodoro", "stopwatch"],
          description: "Timer mode: 'countdown', 'pomodoro', or 'stopwatch' (default is 'countdown')",
        },
        label: {
          type: "string",
          description: "Optional task label or description (e.g. 'Read documentation', 'Deep work')",
        },
        focus_mode: {
          type: "boolean",
          description: "Whether to enable focus mode (queues non-urgent notifications and keeps pet calm)",
        },
      },
    },
  };

  async execute(params: Record<string, any>): Promise<ToolExecutionResult> {
    const mode = params.mode || "countdown";
    const label = String(params.label || "").trim();
    const focusMode = params.focus_mode !== false;

    let totalSeconds = 0;
    if (typeof params.minutes === "number" && params.minutes > 0) {
      totalSeconds += Math.round(params.minutes * 60);
    }
    if (typeof params.seconds === "number" && params.seconds > 0) {
      totalSeconds += Math.round(params.seconds);
    }

    if (mode === "stopwatch") {
      timerEngine.startStopwatch(label);
      return {
        success: true,
        summary: `Started stopwatch${label ? ` for '${label}'` : ""}`,
        data: { mode: "stopwatch", label },
      };
    }

    if (mode === "pomodoro") {
      const focusSec = totalSeconds > 0 ? totalSeconds : 25 * 60;
      timerEngine.startPomodoro({ focusDurationSec: focusSec }, label, focusMode);
      const minsDisplay = Math.round(focusSec / 60);
      return {
        success: true,
        summary: `Started ${minsDisplay}-minute Pomodoro focus session${label ? ` for '${label}'` : ""}`,
        data: { mode: "pomodoro", duration_sec: focusSec, label, focus_mode: focusMode },
      };
    }

    // Default countdown
    if (totalSeconds <= 0) {
      totalSeconds = 10 * 60; // Default 10 minutes
    }
    timerEngine.startCountdown(totalSeconds, label, focusMode);
    const minsDisplay = Math.round(totalSeconds / 60);
    return {
      success: true,
      summary: `Started ${minsDisplay}-minute countdown timer${label ? ` for '${label}'` : ""}`,
      data: { mode: "countdown", duration_sec: totalSeconds, label, focus_mode: focusMode },
    };
  }
}
