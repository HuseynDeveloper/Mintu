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

test("v0.2.3: Safe math parser - new operators and edge cases", () => {
  assert.equal(tryEvaluateInline("-5 + 2"), "= -3");
  assert.equal(tryEvaluateInline("2 ** 3"), "= 8");
  assert.equal(tryEvaluateInline("2 ^ 3 ^ 2"), "= 512"); // right-associative: 2^(3^2) = 2^9 = 512
  assert.equal(tryEvaluateInline("10 % 4"), "= 2");
  assert.equal(tryEvaluateInline("1 / 0"), null);
  assert.equal(tryEvaluateInline("(1 + 2"), null);
  assert.equal(tryEvaluateInline("1 + + "), null);
  assert.equal(tryEvaluateInline("3 3 + 1"), null);
});
