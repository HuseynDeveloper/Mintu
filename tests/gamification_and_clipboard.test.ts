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

const { XPManager } = await import("../src/gamification/XPManager.ts");
const { SmartClipboard } = await import("../src/clipboard/SmartClipboard.ts");
const { UpdateChecker } = await import("../src/updater/UpdateChecker.ts");

test("XPManager: Level progression and XP calculations", () => {
  storage.clear();
  const xm = new XPManager();

  assert.strictEqual(xm.calcLevel(0), 1);
  assert.strictEqual(xm.calcLevel(99), 1);
  assert.strictEqual(xm.calcLevel(100), 2);
  assert.strictEqual(xm.calcLevel(399), 2);
  assert.strictEqual(xm.calcLevel(400), 3);
  assert.strictEqual(xm.calcLevel(900), 4);

  // Check progress calculation
  const prog1 = xm.getProgress();
  assert.strictEqual(prog1.level, 1);
  assert.strictEqual(prog1.totalXP, 0);
  assert.strictEqual(prog1.progressPercent, 0);

  // Add Pomodoro session (25 minutes = 250 XP)
  xm.recordPomodoro(25);
  const prog2 = xm.getProgress();
  assert.strictEqual(prog2.totalXP, 250);
  assert.strictEqual(prog2.level, 2); // 250 XP is Level 2

  // Check accessory unlock at level 2
  const stats = xm.getStats();
  assert.ok(stats.unlockedAccessories.includes("coffee_cup"));
  assert.strictEqual(stats.pomodorosCompleted, 1);
  assert.strictEqual(stats.focusMinutes, 25);
});

test("XPManager: Accessory wardrobe equip constraints", () => {
  storage.clear();
  const xm = new XPManager();

  // Initially glasses and none are unlocked
  assert.strictEqual(xm.equipAccessory("glasses"), true);
  assert.strictEqual(xm.getEquippedAccessory(), "glasses");

  // Headphones is locked at Level 1 (requires Level 4)
  assert.strictEqual(xm.equipAccessory("headphones"), false);
  assert.strictEqual(xm.getEquippedAccessory(), "glasses");

  // Advance to Level 4 (900 XP)
  xm.addXP(1000, "Bonus test XP");
  assert.strictEqual(xm.getStats().level >= 4, true);

  // Now headphones can be equipped
  assert.strictEqual(xm.equipAccessory("headphones"), true);
  assert.strictEqual(xm.getEquippedAccessory(), "headphones");
});

test("SmartClipboard: Content classification for code, JSON, and translation", () => {
  const sc = new SmartClipboard();

  // 1. JSON
  const jsonAction = sc.classifyText('{"status": "ok", "count": 42}');
  assert.ok(jsonAction);
  assert.strictEqual(jsonAction?.type, "json");
  assert.ok(jsonAction?.label.includes("Formatla"));

  // 2. Code snippet
  const codeSnippet = `
function calculateTax(subtotal) {
  const rate = 0.18;
  return subtotal * rate;
}
console.log(calculateTax(100));
  `;
  const codeAction = sc.classifyText(codeSnippet);
  assert.ok(codeAction);
  assert.strictEqual(codeAction?.type, "code");
  assert.ok(codeAction?.label.includes("xətanı yoxla"));

  // 3. Foreign text
  const englishText = "The application failed to initialize because the required configuration file was not found on the local filesystem.";
  const transAction = sc.classifyText(englishText);
  assert.ok(transAction);
  assert.strictEqual(transAction?.type, "translate");
  assert.ok(transAction?.label.includes("tərcümə et"));
});

test("UpdateChecker: SemVer comparison logic", () => {
  const uc = new UpdateChecker();

  // Newer versions
  assert.strictEqual(uc.compareSemver("0.1.3", "0.1.2"), 1);
  assert.strictEqual(uc.compareSemver("0.2.0", "0.1.2"), 1);
  assert.strictEqual(uc.compareSemver("1.0.0", "0.1.2"), 1);

  // Equal versions
  assert.strictEqual(uc.compareSemver("0.1.2", "0.1.2"), 0);

  // Older versions
  assert.strictEqual(uc.compareSemver("0.1.1", "0.1.2"), -1);
  assert.strictEqual(uc.compareSemver("0.0.9", "0.1.2"), -1);
});
