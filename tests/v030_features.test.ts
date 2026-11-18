import test from "node:test";
import assert from "node:assert/strict";
import { SKIN_PRESETS, SkinLoader } from "../src/pet/skins/SkinLoader.ts";
import { PetCareManager } from "../src/pet/PetCareManager.ts";
import { mapWmoCode } from "../src/core/WeatherService.ts";
import { translations } from "../src/core/i18n.ts";

if (typeof globalThis.localStorage === "undefined") {
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const k in store) delete store[k];
    },
    length: 0,
    key: () => null,
  } as unknown as Storage;
}

test("SkinLoader: provides 6 curated presets and persists selection", () => {
  localStorage.clear();
  assert.equal(SKIN_PRESETS.length, 6);
  const loader = new SkinLoader();
  assert.equal(loader.getCurrentSkin().id, "default-mintu");

  const sakura = loader.selectSkin("sakura-pink");
  assert.ok(sakura);
  assert.equal(loader.getCurrentSkin().id, "sakura-pink");

  const restored = new SkinLoader();
  assert.equal(restored.getCurrentSkin().id, "sakura-pink");
});

test("PetCareManager: feedCookie, giveTea, pat, and safe decay clamping", () => {
  localStorage.clear();
  const care = new PetCareManager();
  const initial = care.getState();
  assert.ok(initial.energy >= 15 && initial.energy <= 100);
  assert.ok(initial.happiness >= 15 && initial.happiness <= 100);

  // Decay 48 hours into the future -> should clamp safely at >= 15
  const decayed = care.applyDecay(Date.now() + 48 * 60 * 60 * 1000);
  assert.equal(decayed.energy, 15);
  assert.equal(decayed.happiness, 15);

  const cookieRes = care.feedCookie();
  assert.equal(cookieRes.xpAwarded, 8);
  assert.ok(cookieRes.energy > 15);
  assert.ok(cookieRes.happiness > 15);

  const teaRes = care.giveTea();
  assert.equal(teaRes.xpAwarded, 8);
  assert.ok(teaRes.energy > cookieRes.energy);

  const patRes = care.pat();
  assert.equal(patRes.xpAwarded, 5);
  assert.ok(patRes.happiness >= teaRes.happiness);
});

test("WeatherService: maps WMO weather codes accurately", () => {
  assert.equal(mapWmoCode(0), "clear");
  assert.equal(mapWmoCode(3), "cloudy");
  assert.equal(mapWmoCode(45), "fog");
  assert.equal(mapWmoCode(61), "rain");
  assert.equal(mapWmoCode(73), "snow");
  assert.equal(mapWmoCode(95), "storm");
});

test("i18n v0.3.0: complete 4-language petHub parity across az, en, tr, ru", () => {
  const langs = ["az", "en", "tr", "ru"] as const;
  const requiredKeys = [
    "focusTimer",
    "start",
    "pause",
    "resume",
    "reset",
    "energy",
    "happiness",
    "feedCookie",
    "giveTea",
    "patMintu",
    "dance",
    "sleep",
    "chaseCursor",
    "stopChase",
    "desktopMode",
    "dailyTip",
    "quickNote",
    "fileShelf",
    "nowPlaying",
    "ambientTitle",
    "ambientRain",
    "ambientFireplace",
    "ambientBrown",
    "ambientWhite",
    "shelfTitle",
    "volumeLabel",
    "volumeMuted",
    "skinsTitle",
    "weatherToggle",
  ] as const;

  for (const lang of langs) {
    const hub = translations[lang].petHub;
    assert.ok(hub, `petHub missing in ${lang}`);
    for (const k of requiredKeys) {
      assert.ok(hub[k] && hub[k].length > 0, `petHub.${k} missing in ${lang}`);
    }
    assert.ok(Array.isArray(hub.tips) && hub.tips.length >= 4, `petHub.tips in ${lang}`);
  }
});

import { WellnessManager } from "../src/productivity/WellnessManager.ts";
import { ClipboardHistoryManager } from "../src/clipboard/ClipboardHistory.ts";

test("WellnessManager: water intake, custom pet name, todos, and star collection", () => {
  localStorage.clear();
  const wm = new WellnessManager();
  assert.equal(wm.getPetName(), "Mintu");
  assert.equal(wm.setPetName("Mochi"), "Mochi");
  assert.equal(wm.getPetName(), "Mochi");

  const w1 = wm.drinkWater();
  assert.equal(w1.glasses, 1);
  assert.equal(w1.xpAwarded, 5);

  const todo = wm.addTodo("Finish Mintu v0.2.4");
  assert.ok(todo);
  const toggled = wm.toggleTodo(todo.id);
  assert.ok(toggled && toggled.done && toggled.xpAwarded === 10);

  assert.equal(wm.recordStarCaught(), 1);
  assert.equal(wm.recordStarCaught(), 2);
});

test("ClipboardHistoryManager: deduplicates, pins to top, and caps at 15", () => {
  localStorage.clear();
  const cm = new ClipboardHistoryManager();
  for (let i = 1; i <= 18; i++) {
    cm.add(`Clip item ${i}`);
  }
  const all = cm.getAll();
  assert.equal(all.length, 15);

  const last = all[all.length - 1];
  cm.togglePin(last.id);
  assert.equal(cm.getAll()[0].id, last.id);

  cm.clearUnpinned();
  assert.equal(cm.getAll().length, 1);
  assert.equal(cm.getAll()[0].pinned, true);
});
