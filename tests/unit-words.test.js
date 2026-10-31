"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var Grade = require("../js/grade.js");
var Tables = require("../js/pinyin-tables.js");
var Units = require("../js/units.js");
var ModeA = require("../js/modes/a.js");
var ModeB = require("../js/modes/b.js");
var ModeC = require("../js/modes/c.js");

var root = path.join(__dirname, "..");
var seeds = JSON.parse(fs.readFileSync(path.join(root, "data/pinyin_tables_and_seeds_v1.json"), "utf8"));
var book = JSON.parse(fs.readFileSync(path.join(root, "data/book_pinyin_table_v1.json"), "utf8"));
var unitDoc = JSON.parse(fs.readFileSync(path.join(root, "data/units/unit-01.json"), "utf8"));
Grade.init(Tables.applyBook(seeds, book));

var unit = Units.mapUnit(unitDoc, "unit-01");
assert.strictEqual(unit.id, "unit-01");
assert.strictEqual(unit.name, "單元一");
assert.strictEqual(unit.words.length, 9);

function byId(id) {
  return unit.words.find(function (word) { return word.id === id; });
}

unit.words.forEach(function (word) {
  assert.strictEqual(word.hanzi, word.han);
  assert.ok(word.syllables && word.syllables.length === word.readings.length, word.han + " 音節");
  assert.strictEqual(ModeB.displayPinyin(word), word.pinyinDisplay, word.han);
  word.accept.forEach(function (alt) {
    assert.strictEqual(Grade.isAccepted(alt, word), true, word.han + " " + alt);
  });
  var run = ModeA.createRun([word]);
  var graded = ModeA.submit(run, word.readings.map(function (reading) {
    return {
      initial: reading.initial,
      final: reading.final,
      tone: reading.tone,
      erhua: !!reading.erhua
    };
  }));
  assert.strictEqual(graded.ok, true, word.han + " 首選讀音");
  assert.strictEqual(ModeB.gradeAnswer(word, word.han).ok, true, word.han + " 模式 B");
});

var shangban = byId("u1_01");
assert.strictEqual(shangban.pinyinDisplay, "shàng bān");
assert.strictEqual(shangban.syllables[0].accept[0], "shàng");

var dai = byId("u1_02");
assert.strictEqual(dai.readings.length, 1);
assert.strictEqual(ModeB.gradeAnswer(dai, "带").ok, false);

var zhidao = byId("u1_06");
assert.strictEqual(zhidao.pinyinDisplay, "zhī dao");
assert.strictEqual(zhidao.readings[1].tone, 0);
assert.deepStrictEqual(zhidao.syllables[1].accept, ["dao", "dào"]);
assert.strictEqual(Grade.isAccepted("zhīdao", zhidao), true);
assert.strictEqual(Grade.isAccepted("zhīdào", zhidao), true);
assert.strictEqual(ModeA.submit(ModeA.createRun([zhidao]), [
  { initial: "zh", final: "i", tone: 1 },
  { initial: "d", final: "ao", tone: 4 }
]).ok, true);

var yiding = byId("u1_07");
assert.strictEqual(yiding.pinyinDisplay, "yí dìng");
assert.strictEqual(yiding.syllables[0].tone_sandhi, true);
assert.strictEqual(yiding.syllables[0].citation, "yī");
assert.deepStrictEqual(yiding.accept, ["yídìng", "yīdìng"]);
assert.strictEqual(Grade.isAccepted("yídìng", yiding), true);
assert.strictEqual(Grade.isAccepted("yīdìng", yiding), true);
assert.strictEqual(Grade.isAccepted("yìdìng", yiding), false);
assert.strictEqual(Grade.isAccepted("yì dìng", yiding), false);
assert.strictEqual(ModeA.submit(ModeA.createRun([yiding]), [
  { initial: "", final: "i", tone: 1 },
  { initial: "d", final: "ing", tone: 4 }
]).ok, true);
assert.strictEqual(ModeA.submit(ModeA.createRun([yiding]), [
  { initial: "", final: "i", tone: 4 },
  { initial: "d", final: "ing", tone: 4 }
]).ok, false);
assert.strictEqual(ModeA.submit(ModeA.createRun([yiding]), [
  { initial: "", final: "i", tone: 2 },
  { initial: "d", final: "ing", tone: 4 }
]).correctPinyin, "yí dìng");

var gaosu = byId("u1_08");
var keqi = byId("u1_09");
assert.strictEqual(gaosu.pinyinDisplay, "gào su");
assert.strictEqual(keqi.pinyinDisplay, "kè qi");
assert.strictEqual(Grade.isAccepted("gàosu", gaosu), true);
assert.strictEqual(Grade.isAccepted("gàosù", gaosu), true);
assert.strictEqual(Grade.isAccepted("kèqi", keqi), true);
assert.strictEqual(Grade.isAccepted("kèqì", keqi), true);

var kou = byId("u1_04");
assert.strictEqual(kou.han, "口信兒");
assert.strictEqual(kou.erhua, true);
assert.strictEqual(kou.readings.length, 2);
assert.deepStrictEqual(ModeA.syllableLabels(kou), ["口", "信兒"]);
assert.strictEqual(kou.readings[1].erhua, true);
assert.strictEqual(kou.readings[1].final, "in");
assert.strictEqual(kou.syllables[1].base_pinyin, "xìn");
assert.deepStrictEqual(kou.syllables[1].accept, ["xìnr"]);
assert.deepStrictEqual(kou.accept, ["kǒuxìnr", "kǒuxìn"]);
assert.notStrictEqual(kou.readings.length, Array.from(kou.han).length);

var bare = { initial: "x", final: null, tone: null };
assert.strictEqual(ModeA.erhuaToggleState(kou.readings[1], bare).offered, false);
var picked = { initial: "x", final: "in", tone: 4, erhua: false };
var off = ModeA.erhuaToggleState(kou.readings[1], picked);
assert.strictEqual(off.offered, true);
assert.strictEqual(off.pressed, false);
assert.strictEqual(off.spelled, "xìn");
picked.erhua = true;
var on = ModeA.erhuaToggleState(kou.readings[1], picked);
assert.strictEqual(on.pressed, true);
assert.strictEqual(on.spelled, "xìnr");
assert.strictEqual(ModeA.erhuaToggleState(kou.readings[0], picked).offered, false);

var withR = ModeA.submit(ModeA.createRun([kou]), [
  { initial: "k", final: "ou", tone: 3 },
  { initial: "x", final: "in", tone: 4, erhua: true }
]);
assert.strictEqual(withR.ok, true);
assert.strictEqual(withR.correctPinyin, "kǒu xìnr");

var withoutR = ModeA.submit(ModeA.createRun([kou]), [
  { initial: "k", final: "ou", tone: 3 },
  { initial: "x", final: "in", tone: 4, erhua: false }
]);
assert.strictEqual(withoutR.ok, true);

var wrong = ModeC.submit(ModeC.createRun([kou]), [
  { initial: "k", final: "ou", tone: 3 },
  { initial: "x", final: "ing", tone: 4, erhua: true }
]);
assert.strictEqual(wrong.ok, false);
assert.ok(wrong.feedback.indexOf("kǒu xìnr") >= 0, wrong.feedback);
assert.ok(wrong.feedback.indexOf("口信兒") >= 0, wrong.feedback);

assert.strictEqual(ModeB.gradeAnswer(kou, "口信兒").ok, true);
assert.strictEqual(ModeB.gradeAnswer(kou, "口信").ok, false);
assert.strictEqual(ModeB.gradeAnswer(kou, "口信儿").ok, false);
assert.strictEqual(ModeB.displayPinyin(kou), "kǒu xìnr");

var catalog = Units.catalog();
assert.strictEqual(catalog.length, 1);
assert.strictEqual(catalog[0].id, "unit-01");
assert.ok(catalog[0].url.indexOf("data/units/unit-01.json") >= 0);

console.log("unit word tests passed");
