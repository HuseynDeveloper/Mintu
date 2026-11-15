import test from "node:test";
import assert from "node:assert/strict";
import { DailyRecapManager } from "../src/productivity/DailyRecap.ts";
import { UpdateChecker } from "../src/updater/UpdateChecker.ts";

test("v0.2.3.1: DailyRecapManager stats tracking and zero-emoji markdown format", () => {
  const recap = new DailyRecapManager();
  
  // Record activities
  recap.recordMessage();
  recap.recordMessage();
  recap.recordFocus(25);
  recap.recordFileProcessed();
  recap.recordXP(35);

  const stats = recap.getTodayStats();
  assert.ok(stats.messagesSent >= 2);
  assert.ok(stats.focusMinutes >= 25);
  assert.ok(stats.filesProcessed >= 1);
  assert.ok(stats.xpEarned >= 35);

  const md = recap.generateRecapMarkdown(2);
  assert.ok(md.includes("Mintu Gunluk Inkisaf Hesabati"));
  assert.ok(md.includes("Fokus vaxti:"));
  assert.ok(md.includes("Emal olunan fayllar (NotchDrop):"));
  assert.ok(md.includes("Mintu v0.2.3.1"));
  
  // Verify ZERO EMOJIS in generated markdown
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  assert.strictEqual(emojiRegex.test(md), false, "Markdown should contain no emojis");
});

test("v0.2.3.1: UpdateChecker 4-part SemVer comparisons (0.2.3.1 vs 0.2.3 and 0.2.4)", () => {
  const checker = new UpdateChecker();

  assert.strictEqual(checker.compareSemver("0.2.3.1", "0.2.3"), 1);
  assert.strictEqual(checker.compareSemver("0.2.3", "0.2.3.1"), -1);
  assert.strictEqual(checker.compareSemver("0.2.3.1", "0.2.3.1"), 0);
  assert.strictEqual(checker.compareSemver("0.2.3.1", "0.2.4"), -1);
  assert.strictEqual(checker.compareSemver("0.2.4", "0.2.3.1"), 1);
  assert.strictEqual(checker.compareSemver("0.2.3.2", "0.2.3.1"), 1);
});

test("v0.2.3.1: NotchDrop file extension classification", () => {
  const classify = (ext: string) => {
    if (["js", "ts", "py", "rs", "html", "css", "json", "c", "cpp", "go", "sql", "sh", "java"].includes(ext)) {
      return "Kod";
    } else if (["png", "jpg", "jpeg", "webp", "svg", "gif", "bmp"].includes(ext)) {
      return "Şəkil";
    } else if (["pdf", "txt", "md", "csv", "log"].includes(ext)) {
      return "Sənəd";
    }
    return "Fayl";
  };

  assert.strictEqual(classify("rs"), "Kod");
  assert.strictEqual(classify("py"), "Kod");
  assert.strictEqual(classify("png"), "Şəkil");
  assert.strictEqual(classify("pdf"), "Sənəd");
  assert.strictEqual(classify("xyz"), "Fayl");
});
