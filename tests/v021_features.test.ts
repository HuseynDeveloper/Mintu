import test from "node:test";
import assert from "node:assert/strict";
import { tryEvaluateInline } from "../src/core/InlineEvaluator.ts";
import { soundEngine } from "../src/core/SoundEngine.ts";

test("v0.2.1: Inline Math & Arithmetic Evaluation", () => {
  assert.equal(tryEvaluateInline("25 * 40"), "= 1000");
  assert.equal(tryEvaluateInline("1200 / 4"), "= 300");
  assert.equal(tryEvaluateInline("15 + 85"), "= 100");
  assert.equal(tryEvaluateInline("2 ^ 8"), "= 256");
  assert.equal(tryEvaluateInline("(10 + 20) * 3"), "= 90");
  assert.equal(tryEvaluateInline("hello world"), null);
  assert.equal(tryEvaluateInline(""), null);
});

test("v0.2.1: Inline Currency & Unit Conversions", () => {
  assert.equal(tryEvaluateInline("100 usd to azn"), "= 170.00 AZN");
  assert.equal(tryEvaluateInline("10 km in m"), "= 10,000 m");
  assert.equal(tryEvaluateInline("1024 mb in gb"), "= 1.00 GB");
  assert.equal(tryEvaluateInline("5 kg in g"), "= 5,000 g");
});

test("v0.2.1: SoundEngine Mute and State", () => {
  soundEngine.setMuted(true);
  assert.equal(soundEngine.getIsMuted(), true);
  assert.equal(soundEngine.getIsAmbientPlaying(), false);

  soundEngine.setMuted(false);
  assert.equal(soundEngine.getIsMuted(), false);
});
