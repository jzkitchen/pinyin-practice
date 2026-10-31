"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var Grade = require("../js/grade.js");
var ModeA = require("../js/modes/a.js");

var data = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/pinyin_tables_and_seeds_v1.json"), "utf8"));
Grade.init(data);

assert.strictEqual(data.mode_copy.A.syllable, "第 {n} 個字");
assert.strictEqual(data.mode_copy.A.before, "請選出正確的聲母、韻母和聲調。選錯會立刻看到正確答案。");
assert.strictEqual(data.mode_copy.A.word_done, "完成！");
assert.strictEqual(data.mode_copy.A.wrong, "不對。正確是：{正解帶調拼音}");

function wordOf(id) {
  return Grade.mapSeedWord(data.seed_words.find(function (seed) { return seed.id === id; }), "set_demo");
}

var mama = wordOf("s01");
var bank = wordOf("s37");
var grow = wordOf("s39");
var wall = wordOf("s40");
var fish = wordOf("s34");
var school = wordOf("s21");
var luggage = wordOf("s38");

assert.strictEqual(ModeA.syllableLine(data.mode_copy.A, 1), "第 1 個字");
assert.strictEqual(ModeA.syllableLine(data.mode_copy.A, 2), "第 2 個字");

assert.strictEqual(ModeA.gradeSyllable(mama, 0, { initial: "m", final: "a", tone: 1 }).ok, true);
var mamaWrong = ModeA.gradeSyllable(mama, 0, { initial: "m", final: "a", tone: 4 });
assert.strictEqual(mamaWrong.ok, false);
assert.strictEqual(mamaWrong.correctPinyin, "mā");
assert.strictEqual(ModeA.wrongLine(data.mode_copy.A, mamaWrong.correctPinyin), "不對。正確是：mā");

assert.strictEqual(ModeA.gradeSyllable(mama, 1, { initial: "m", final: "a", tone: 0 }).ok, true);
assert.strictEqual(ModeA.gradeSyllable(mama, 1, { initial: "m", final: "a", tone: 1 }).ok, true);
var mamaTone = ModeA.gradeSyllable(mama, 1, { initial: "m", final: "a", tone: 4 });
assert.strictEqual(mamaTone.ok, false);
assert.strictEqual(mamaTone.correctPinyin, "ma");

assert.strictEqual(ModeA.gradeSyllable(bank, 1, { initial: "h", final: "ang", tone: 2 }).ok, true);
assert.strictEqual(ModeA.gradeSyllable(bank, 1, { initial: "x", final: "ing", tone: 2 }).ok, false);
assert.strictEqual(ModeA.gradeSyllable(grow, 0, { initial: "zh", final: "ang", tone: 3 }).ok, true);
assert.strictEqual(ModeA.gradeSyllable(grow, 0, { initial: "ch", final: "ang", tone: 2 }).ok, false);
assert.strictEqual(ModeA.gradeSyllable(wall, 0, { initial: "ch", final: "ang", tone: 2 }).ok, true);
assert.strictEqual(ModeA.gradeSyllable(wall, 0, { initial: "zh", final: "ang", tone: 3 }).ok, false);
assert.strictEqual(ModeA.gradeSyllable(fish, 0, { initial: "", final: "ü", tone: 2 }).ok, true);
assert.strictEqual(ModeA.gradeSyllable(fish, 0, { initial: "y", final: "u", tone: 2 }).ok, false);
assert.strictEqual(ModeA.gradeSyllable(school, 0, { initial: "x", final: "üe", tone: 2 }).ok, true);
assert.strictEqual(ModeA.gradeSyllable(luggage, 1, { initial: "l", final: "i", tone: 0 }).ok, true);
assert.strictEqual(ModeA.gradeSyllable(luggage, 1, { initial: "l", final: "i", tone: 3 }).ok, true);

var ju = {
  hanzi: "居",
  pinyin: "jū",
  accept: ["jū"],
  readings: [{ initial: "j", final: "ü", tone: 1 }]
};
assert.strictEqual(ModeA.gradeSyllable(ju, 0, { initial: "j", final: "u", tone: 1 }).ok, true);
assert.strictEqual(ModeA.gradeSyllable(ju, 0, { initial: "j", final: "ü", tone: 1 }).ok, true);

data.seed_words.forEach(function (seed) {
  var word = Grade.mapSeedWord(seed, "set_demo");
  word.readings.forEach(function (reading, index) {
    var graded = ModeA.gradeSyllable(word, index, reading);
    assert.strictEqual(graded.ok, true, seed.han + " 第 " + (index + 1) + " 音");
    assert.strictEqual(
      graded.correctPinyin,
      Grade.spellSyllable(reading.initial, reading.final, reading.tone),
      seed.han
    );
  });
  seed.accept.forEach(function (alt) {
    assert.strictEqual(Grade.isAccepted(alt, word), true, seed.han + " " + alt);
  });
});

var shui = wordOf("s09");
var run = ModeA.createRun([mama, shui]);
assert.strictEqual(run.done, false);
assert.strictEqual(run.total, 2);
var first = ModeA.submit(run, [
  { initial: "m", final: "a", tone: 1 },
  { initial: "m", final: "a", tone: 4 }
]);
assert.strictEqual(first.ok, false);
assert.strictEqual(first.wordDone, true);
assert.strictEqual(first.allCorrect, false);
assert.strictEqual(first.feedback, "不對。正確是：mā ma");
assert.strictEqual(first.hanzi, "媽媽");
assert.strictEqual(run.index, 1);
assert.strictEqual(run.correctWords, 0);
var bothTones = ModeA.createRun([mama]);
var accepted = ModeA.submit(bothTones, [
  { initial: "m", final: "a", tone: 1 },
  { initial: "m", final: "a", tone: 1 }
]);
assert.strictEqual(accepted.ok, true);
assert.strictEqual(accepted.allCorrect, true);
assert.ok(accepted.feedback.indexOf("mā ma") >= 0);
var third = ModeA.submit(run, [{ initial: "sh", final: "ui", tone: 3 }]);
assert.strictEqual(third.ok, true);
assert.strictEqual(third.wordDone, true);
assert.strictEqual(third.allCorrect, true);
assert.strictEqual(third.setDone, true);
assert.ok(third.feedback.indexOf(data.mode_copy.A.word_done) === 0);
assert.strictEqual(run.correctWords, 1);
assert.strictEqual(run.done, true);

var perfect = ModeA.createRun([shui]);
var only = ModeA.submit(perfect, [{ initial: "sh", final: "ui", tone: 3 }]);
assert.strictEqual(only.allCorrect, true);
assert.strictEqual(only.feedback.indexOf("shuǐ") > 0, true);
var incomplete = ModeA.createRun([mama]);
var missing = ModeA.submit(incomplete, [{ initial: "m", final: "a", tone: 1 }]);
assert.strictEqual(missing.ok, false);
assert.strictEqual(missing.wordDone, true);

var empty = ModeA.createRun([]);
assert.strictEqual(empty.total, 0);
assert.strictEqual(empty.done, false);

var record = ModeA.sessionRecord(run, { setId: "set_demo" });
assert.strictEqual(record.mode, "A");
assert.strictEqual(record.setId, "set_demo");
assert.strictEqual(record.total, 2);
assert.strictEqual(record.correct, 1);

console.log("mode A tests passed");
