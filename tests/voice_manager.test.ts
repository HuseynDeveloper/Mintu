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

// Import VoiceManager with .ts extension
const { VoiceManager } = await import("../src/voice/VoiceManager.ts");

test("VoiceManager: Sanitize markdown and code blocks for natural speech", () => {
  const vm = new VoiceManager();

  const raw1 = "Hello **world**! Check this `console.log('hi')` inline code.";
  const clean1 = vm.sanitizeForSpeech(raw1);
  assert.strictEqual(clean1, "Hello world! Check this console.log('hi') inline code.");

  const raw2 = "Here is Python code:\n```python\nprint('hello')\n```\nIt works!";
  const clean2 = vm.sanitizeForSpeech(raw2);
  assert.ok(!clean2.includes("print('hello')"));
  assert.ok(clean2.includes("Here is Python code: [kod bloku] It works!"));

  const raw3 = "Visit https://github.com/HuseynDeveloper/Mintu for updates.";
  const clean3 = vm.sanitizeForSpeech(raw3);
  assert.ok(!clean3.includes("https://github.com"));
  assert.ok(clean3.includes("Visit link for updates."));
});

test("VoiceManager: Configuration loading and saving", () => {
  const vm = new VoiceManager();

  vm.saveConfig({
    ttsEnabled: false,
    ttsRate: 1.2,
    ttsPitch: 1.3,
    sttLanguage: "az-AZ",
  });

  const cfg = vm.getConfig();
  assert.strictEqual(cfg.ttsEnabled, false);
  assert.strictEqual(cfg.ttsRate, 1.2);
  assert.strictEqual(cfg.ttsPitch, 1.3);
  assert.strictEqual(cfg.sttLanguage, "az-AZ");
  assert.strictEqual(localStorage.getItem("mintu_tts_enabled"), "false");
  assert.strictEqual(localStorage.getItem("mintu_stt_lang"), "az-AZ");
});

test("VoiceManager: Safe handling when window.speechSynthesis is unavailable", () => {
  const vm = new VoiceManager();
  // Should not throw even in Node.js test environment where speechSynthesis is not defined
  assert.doesNotThrow(() => {
    vm.speak("Test speech output");
  });
  assert.strictEqual(vm.isCurrentlySpeaking(), false);
  assert.strictEqual(vm.isListening(), false);
});
