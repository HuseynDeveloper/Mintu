import test from "node:test";
import assert from "node:assert/strict";

// Mock localStorage for headless Node environment
const storage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, String(v)),
  removeItem: (k: string) => storage.delete(k),
  clear: () => storage.clear(),
};

// Now import TimerEngine
const { timerEngine } = await import("../src/modules/timer/TimerEngine.ts");

test("TimerEngine: Countdown lifecycle and formatting", () => {
  storage.clear();
  timerEngine.reset();

  // Start a 10-minute timer (600 seconds)
  timerEngine.startCountdown(600, "Write tests");

  assert.equal(timerEngine.getState(), "running");
  assert.equal(timerEngine.getMode(), "countdown");
  assert.equal(timerEngine.getLabel(), "Write tests");
  assert.equal(timerEngine.getRemainingSec(), 600);
  assert.equal(timerEngine.getFormattedTime(), "10:00");
  assert.equal(timerEngine.getProgressPercent(), 0);

  // Pause timer
  timerEngine.pause();
  assert.equal(timerEngine.getState(), "paused");

  // Resume timer
  timerEngine.resume();
  assert.equal(timerEngine.getState(), "running");

  // Reset
  timerEngine.reset();
  assert.equal(timerEngine.getState(), "idle");
  assert.equal(timerEngine.getRemainingSec(), 0);
});

test("TimerEngine: Pomodoro phases and 4-session cycle", () => {
  storage.clear();
  timerEngine.reset();

  timerEngine.configurePomodoro({
    focusDurationSec: 25 * 60,
    shortBreakSec: 5 * 60,
    longBreakSec: 15 * 60,
    sessionsBeforeLongBreak: 4,
  });

  // Session 1: Focus
  timerEngine.startPomodoro(undefined, "Milestone 6", true);
  assert.equal(timerEngine.getMode(), "pomodoro");
  assert.equal(timerEngine.getPhase(), "focus");
  assert.equal(timerEngine.getPomodoroCount(), 1);
  assert.equal(timerEngine.isFocusModeActive(), true);

  // Trigger end of Focus session 1 -> transitions to short_break
  timerEngine.triggerEndNow();
  assert.equal(timerEngine.getPhase(), "short_break");
  assert.equal(timerEngine.isFocusModeActive(), false);

  // Trigger end of short_break 1 -> transitions to Focus 2
  timerEngine.triggerEndNow();
  assert.equal(timerEngine.getPhase(), "focus");
  assert.equal(timerEngine.getPomodoroCount(), 2);

  // Focus 2 -> short_break 2
  timerEngine.triggerEndNow();
  assert.equal(timerEngine.getPhase(), "short_break");

  // short_break 2 -> Focus 3
  timerEngine.triggerEndNow();
  assert.equal(timerEngine.getPhase(), "focus");
  assert.equal(timerEngine.getPomodoroCount(), 3);

  // Focus 3 -> short_break 3
  timerEngine.triggerEndNow();
  assert.equal(timerEngine.getPhase(), "short_break");

  // short_break 3 -> Focus 4 (4th session!)
  timerEngine.triggerEndNow();
  assert.equal(timerEngine.getPhase(), "focus");
  assert.equal(timerEngine.getPomodoroCount(), 4);

  // After 4th focus session -> transitions to long_break!
  timerEngine.triggerEndNow();
  assert.equal(timerEngine.getPhase(), "long_break");

  timerEngine.reset();
});

test("TimerEngine: Stopwatch mode", () => {
  storage.clear();
  timerEngine.reset();

  timerEngine.startStopwatch("Benchmarking");
  assert.equal(timerEngine.getMode(), "stopwatch");
  assert.equal(timerEngine.getState(), "running");

  timerEngine.pause();
  assert.equal(timerEngine.getState(), "paused");

  timerEngine.resume();
  assert.equal(timerEngine.getState(), "running");

  timerEngine.reset();
  assert.equal(timerEngine.getState(), "idle");
});

test("TimerEngine: Sleep and App Restart simulation with absolute targetEndTime", () => {
  storage.clear();
  timerEngine.reset();

  // 1. Simulate active timer saved before app exit
  const targetEndTime = Date.now() + 300 * 1000; // 5 minutes remaining
  const stateData = {
    mode: "countdown",
    state: "running",
    phase: "focus",
    totalDurationSec: 600,
    targetEndTime,
    remainingSecWhenPaused: 0,
    label: "Project Meeting",
    pomodoroCount: 1,
    focusModeEnabled: true,
    config: {
      focusDurationSec: 1500,
      shortBreakSec: 300,
      longBreakSec: 900,
      sessionsBeforeLongBreak: 4,
    },
  };
  storage.set("mintu_active_timer", JSON.stringify(stateData));

  // Load state
  timerEngine.loadState();
  assert.equal(timerEngine.getState(), "running");
  assert.equal(timerEngine.getLabel(), "Project Meeting");
  assert.ok(timerEngine.getRemainingSec() > 295 && timerEngine.getRemainingSec() <= 300);

  // 2. Simulate timer expiring while app was closed / computer was sleeping
  const expiredEndTime = Date.now() - 60 * 1000; // expired 1 minute ago
  stateData.targetEndTime = expiredEndTime;
  storage.set("mintu_active_timer", JSON.stringify(stateData));

  timerEngine.loadState();
  assert.equal(timerEngine.getState(), "finished");
  assert.ok(timerEngine.getFinishedAtString()?.startsWith("Timer finished at"));

  timerEngine.reset();
});

test("TimerEngine: Focus Session History recording and deletion", () => {
  storage.clear();
  timerEngine.deleteFocusHistory();

  assert.equal(timerEngine.getFocusHistory("all").length, 0);

  timerEngine.recordFocusSession(1500, "Refactoring");
  timerEngine.recordFocusSession(1800, "Writing documentation");

  const history = timerEngine.getFocusHistory("all");
  assert.equal(history.length, 2);
  assert.equal(history[0].label, "Writing documentation");
  assert.equal(history[0].durationSec, 1800);
  assert.equal(history[1].label, "Refactoring");

  timerEngine.deleteFocusHistory();
  assert.equal(timerEngine.getFocusHistory("all").length, 0);
});
