import test from "node:test";
import assert from "node:assert/strict";

// Mock minimal DOM/localStorage for Node test runner
const storage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, String(v)),
  removeItem: (k: string) => storage.delete(k),
  clear: () => storage.clear(),
};

const { IslandLayout } = await import("../src/ui/IslandLayout.ts");
const { getAppIconSvg } = await import("../src/ui/AppIcons.ts");

test("IslandLayout: Reserved Mintu slot when Mintu is inside", () => {
  const html = IslandLayout.html({
    mintuInside: true,
    content: '<div class="test-content">Content</div>',
    trailing: '<button class="test-close">X</button>',
  });

  assert.ok(html.includes("has-mintu-slot"), "Must have has-mintu-slot class");
  assert.ok(html.includes('data-slot="mintuSlot"'), "Must render mintuSlot element");
  assert.ok(html.includes('data-slot="content"'), "Must render content slot");
  assert.ok(html.includes('data-slot="trailing"'), "Must render trailing slot");
  assert.strictEqual(IslandLayout.MINTU_SLOT_WIDTH_PX, 52, "Reserved slot width must be 52px");
  assert.ok(IslandLayout.MIN_GAP_PX >= 8, "Minimum gap must be at least 8px");
});

test("IslandLayout: Mintu-less layout when Mintu is outside roaming", () => {
  const html = IslandLayout.html({
    mintuInside: false,
    content: '<div class="test-content">Content</div>',
    trailing: '<button class="test-close">X</button>',
  });

  assert.ok(html.includes("mintu-less"), "Must have mintu-less class");
  assert.ok(!html.includes('data-slot="mintuSlot"'), "Must NOT render mintuSlot when outside");
  assert.ok(html.includes('data-slot="content"'), "Must render content slot taking left edge");
  assert.ok(html.includes('data-slot="trailing"'), "Must render trailing slot");
});

test("AppIcons: Correct SVG badges for Antigravity, PowerShell, and ecosystem apps", () => {
  const agSvg = getAppIconSvg("ANTIGRAVITY");
  assert.ok(agSvg.includes("<svg"), "Must return an SVG element");
  assert.ok(agSvg.includes("#18181B"), "Antigravity must use sleek dark square badge");

  const psSvg = getAppIconSvg("PowerShell");
  assert.ok(psSvg.includes("<svg"), "Must return an SVG element");
  assert.ok(psSvg.includes("#012456"), "PowerShell must use terminal blue badge");

  const dcSvg = getAppIconSvg("Discord");
  assert.ok(dcSvg.includes("#5865F2"), "Discord must use brand blurple");

  const tgSvg = getAppIconSvg("Telegram");
  assert.ok(tgSvg.includes("#24A1DE"), "Telegram must use Telegram blue");

  const crSvg = getAppIconSvg("Google Chrome");
  assert.ok(crSvg.includes("#EA4335"), "Chrome must use multicolored badge");

  const fallbackSvg = getAppIconSvg("UnknownCustomApp");
  assert.ok(fallbackSvg.includes("<svg"), "Must provide fallback SVG");
  assert.ok(fallbackSvg.includes("neutralAppGrad"), "Must use clean gradient fallback");
});
