"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var Grade = require("../js/grade.js");
var Tables = require("../js/pinyin-tables.js");
var Picker = require("../js/syllable-picker.js");
var ModeA = require("../js/modes/a.js");
var Tts = require("../js/tts.js");

var root = path.join(__dirname, "..");
var book = JSON.parse(fs.readFileSync(path.join(root, "data/book_pinyin_table_v1.json"), "utf8"));
var seeds = JSON.parse(fs.readFileSync(path.join(root, "data/pinyin_tables_and_seeds_v1.json"), "utf8"));
var data = Tables.applyBook(seeds, book);
Grade.init(data);

Tables.bookKeys.forEach(function (key) {
  assert.deepStrictEqual(seeds[key], book[key], key);
  assert.deepStrictEqual(data[key], book[key], key);
});
assert.strictEqual(data.picker_source, "data/book_pinyin_table_v1.json");

assert.strictEqual(book.shengmu.length, 21);
assert.strictEqual(book.yunmu.length, 35);
assert.deepStrictEqual(book.normalize_rules, [
  "lowercase_trim",
  "ü_equiv_v",
  "iou_equiv_iu",
  "uei_equiv_ui",
  "uen_equiv_un",
  "jqx_u_equiv_ü"
]);
assert.strictEqual(book.decisions.zhengti_picker, false);
assert.strictEqual(book.decisions.show_y_w_buttons, false);
assert.strictEqual(book.decisions.er_on_picker, false);
assert.strictEqual(book.decisions.empty_shengmu_allowed, true);

var view = Picker.model(book);
var shownShengmu = [];
view.shengmuGroups.forEach(function (group) {
  group.items.forEach(function (item) { shownShengmu.push(item.key); });
});
assert.strictEqual(shownShengmu.length, 21);
assert.deepStrictEqual(shownShengmu, book.shengmu.map(function (item) { return item.key; }));
["y", "w", ""].forEach(function (key) {
  assert.ok(shownShengmu.indexOf(key) < 0, key);
});
assert.deepStrictEqual(view.shengmuGroups.map(function (group) { return group.items.length; }), [4, 4, 3, 3, 4, 3]);
assert.strictEqual(view.emptyHint, "這個音不用選聲母");
assert.strictEqual(view.yunmuNote, "");
assert.strictEqual(view.abbrevHint, "");
assert.ok(!Object.prototype.hasOwnProperty.call(book.ui_copy, "yunmu_note"));
assert.ok(!Object.prototype.hasOwnProperty.call(book.ui_copy, "abbrev_hint"));
assert.deepStrictEqual(view.columns.map(function (col) { return col.title; }), ["開口", "齊齒", "合口", "撮口"]);
assert.deepStrictEqual(view.columns.map(function (col) { return col.items.length; }), [12, 10, 9, 4]);
var labels = [];
view.columns.forEach(function (col) {
  col.items.forEach(function (item) { labels.push(item.label); });
});
assert.strictEqual(labels.length, 35);
["iou", "uei", "uen", "ü", "üe", "üan", "ün", "ueng"].forEach(function (label) {
  assert.ok(labels.indexOf(label) >= 0, label);
});
["iu", "ui", "un", "er", "y", "w", "零"].forEach(function (label) {
  assert.ok(labels.indexOf(label) < 0, label);
});
assert.strictEqual(view.columns[1].items.some(function (item) { return item.key === "iou"; }), true);
assert.strictEqual(view.columns[2].items.some(function (item) { return item.key === "uei" && item.label === "uei"; }), true);

var stale = Tables.applyBook({
  seed_words: seeds.seed_words,
  shengmu: [{ id: "sm_0", label: "零", key: "" }, { id: "sm_y", label: "y", key: "y" }],
  yunmu: [{ id: "ym_er", label: "er", key: "er", group: "特殊" }]
}, book);
assert.strictEqual(stale.shengmu.length, 21);
assert.ok(!stale.shengmu.some(function (item) { return item.label === "零" || item.key === "y"; }));
assert.ok(!stale.yunmu.some(function (item) { return item.key === "er"; }));

function wordOf(id) {
  return Grade.mapSeedWord(seeds.seed_words.find(function (seed) { return seed.id === id; }), "set_demo");
}

seeds.seed_words.forEach(function (seed) {
  var word = Grade.mapSeedWord(seed, "set_demo");
  assert.ok(word, seed.han);
  assert.strictEqual(Grade.gradeAttempt(word.readings, seed).ok, true, seed.han + " readings");
  seed.accept.forEach(function (alt) {
    assert.strictEqual(Grade.isAccepted(alt, word), true, seed.han + " " + alt);
    assert.strictEqual(Grade.isAccepted(alt, seed.accept), true, seed.han + " accept[]");
  });
  assert.ok(Tts.phonemesForReadings(word.readings), seed.han + " 音素");
  word.readings.forEach(function (reading, index) {
    var full = { iu: "iou", ui: "uei", un: "uen" }[reading.final] || reading.final;
    var abbrev = { iou: "iu", uei: "ui", uen: "un" }[reading.final];
    assert.strictEqual(ModeA.gradeSyllable(word, index, {
      initial: reading.initial,
      final: full,
      tone: reading.tone
    }).ok, true, seed.han + " 完整式");
    if (abbrev) {
      assert.strictEqual(ModeA.gradeSyllable(word, index, {
        initial: reading.initial,
        final: abbrev,
        tone: reading.tone
      }).ok, true, seed.han + " 省略式");
      assert.strictEqual(
        Grade.spellSyllable(reading.initial, full, reading.tone),
        Grade.spellSyllable(reading.initial, abbrev, reading.tone),
        seed.han
      );
    }
  });
});

var shui = wordOf("s09");
assert.strictEqual(shui.readings[0].final, "uei");
assert.strictEqual(ModeA.gradeSyllable(shui, 0, { initial: "sh", final: "uei", tone: 3 }).ok, true);
assert.strictEqual(ModeA.gradeSyllable(shui, 0, { initial: "sh", final: "ui", tone: 3 }).ok, true);
assert.strictEqual(Grade.spellSyllable("sh", "uei", 3), "shuǐ");

var mama = wordOf("s01");
assert.strictEqual(Grade.isAccepted("māma", mama), true);
assert.strictEqual(Grade.isAccepted("māmā", mama), true);
assert.strictEqual(Grade.isAccepted("mama", mama), false);
assert.strictEqual(ModeA.submit(ModeA.createRun([mama]), [
  { initial: "m", final: "a", tone: 1 },
  { initial: "m", final: "a", tone: 1 }
]).ok, true);

assert.strictEqual(Grade.splitPinyin("ér", [2]), null);
assert.strictEqual(Grade.collisions().length, 0);

console.log("book table tests passed");
