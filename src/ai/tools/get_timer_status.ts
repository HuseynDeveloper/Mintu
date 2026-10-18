import { Tool, ToolDefinition, ToolExecutionResult } from "./Tool";
import { timerEngine } from "../../modules/timer/TimerEngine";

export class GetTimerStatusTool implements Tool {
  public definition: ToolDefinition = {
    name: "get_timer_status",
    description: "Get the current status, remaining time, and mode of the timer on Mintu's Dynamic Island.",
    risk: "low",
    parameters: {
      type: "object",
      properties: {},
    },
  };

  async execute(_params: Record<string, any>): Promise<ToolExecutionResult> {
    const state = timerEngine.getState();
    const mode = timerEngine.getMode();
    const phase = timerEngine.getPhase();
    const remainingSec = timerEngine.getRemainingSec();
    const formatted = timerEngine.getFormattedTime();
    const label = timerEngine.getLabel();
    const focusMode = timerEngine.isFocusModeActive();

    if (state === "idle") {
      return {
        success: true,
        summary: "No timer is running",
        data: { state: "idle" },
      };
    }

    return {
      success: true,
      summary: `Timer is ${state} (${mode}, phase: ${phase}) with ${formatted} remaining${label ? ` for '${label}'` : ""}`,
      data: {
        state,
        mode,
        phase,
        remaining_sec: remainingSec,
        formatted_time: formatted,
        label,
        focus_mode_active: focusMode,
      },
    };
  }
}
