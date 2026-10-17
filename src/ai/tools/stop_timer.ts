import { Tool, ToolDefinition, ToolExecutionResult } from "./Tool";
import { timerEngine } from "../../modules/timer/TimerEngine";

export class StopTimerTool implements Tool {
  public definition: ToolDefinition = {
    name: "stop_timer",
    description: "Stop, pause, or reset the active timer on Mintu's Dynamic Island.",
    risk: "low",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["reset", "pause"],
          description: "Action to perform: 'reset' (cancels/clears timer) or 'pause' (pauses countdown)",
        },
      },
    },
  };

  async execute(params: Record<string, any>): Promise<ToolExecutionResult> {
    const action = params.action || "reset";
    const state = timerEngine.getState();

    if (state === "idle") {
      return {
        success: true,
        summary: "No timer is currently active",
        data: { state: "idle" },
      };
    }

    if (action === "pause") {
      timerEngine.pause();
      return {
        success: true,
        summary: `Paused timer at ${timerEngine.getFormattedTime()}`,
        data: { state: "paused", remaining: timerEngine.getRemainingSec() },
      };
    }

    timerEngine.reset();
    return {
      success: true,
      summary: "Reset and stopped the timer",
      data: { state: "idle" },
    };
  }
}
