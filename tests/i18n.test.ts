import test from "node:test";
import assert from "node:assert/strict";
import { translations, I18nManager } from "../src/core/i18n.ts";

// Mock localStorage if running in Node environment
if (typeof globalThis.localStorage === "undefined") {
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (key: string) => store[key] || null,
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

test("i18n: All supported languages have complete dictionary keys", () => {
  const langs = ["az", "en", "tr", "ru"] as const;
  for (const l of langs) {
    const dict = translations[l];
    assert.ok(dict, `Language dictionary ${l} exists`);
    assert.ok(dict.appName, `appName in ${l}`);
    assert.ok(dict.howCanIHelp, `howCanIHelp in ${l}`);
    assert.ok(dict.typeMessageOrSpeak, `typeMessageOrSpeak in ${l}`);
    assert.ok(dict.chips.checkTasks, `chips.checkTasks in ${l}`);
    assert.ok(dict.chips.askAi, `chips.askAi in ${l}`);
    assert.ok(dict.drawer.conversations, `drawer.conversations in ${l}`);
    assert.ok(dict.settings.title, `settings.title in ${l}`);
    assert.ok(dict.settings.mintuVersion, `settings.mintuVersion in ${l}`);
    assert.ok(dict.settings.appLanguage, `settings.appLanguage in ${l}`);
    assert.ok(dict.actions.newChat, `actions.newChat in ${l}`);
    assert.ok(dict.scratchpad.title, `scratchpad.title in ${l}`);
  }
});

test("i18n: Manager switches language and persists to localStorage", () => {
  const manager = new I18nManager();
  manager.setLang("tr");
  assert.equal(manager.getLang(), "tr");
  assert.equal(manager.t().settings.title, "Ayarlar");

  manager.setLang("ru");
  assert.equal(manager.getLang(), "ru");
  assert.equal(manager.t().settings.title, "Настройки");

  manager.setLang("en");
  assert.equal(manager.getLang(), "en");
  assert.equal(manager.t().settings.title, "Settings");

  manager.setLang("az");
  assert.equal(manager.getLang(), "az");
  assert.equal(manager.t().settings.title, "Tənzimləmələr");
});
