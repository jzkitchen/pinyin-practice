"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var Grade = require("../js/grade.js");

var data = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/pinyin_tables_and_seeds_v1.json"), "utf8"));
Grade.init(data);

var byId = {};
data.seed_words.forEach(function (word) { byId[word.id] = word; });

assert.strictEqual(data.shengmu.length, 21);
assert.strictEqual(data.yunmu.length, 35);
assert.strictEqual(data.shengdiao.length, 5);
assert.deepStrictEqual(data.shengdiao.map(function (item) { return item.tone; }), [1, 2, 3, 4, 0]);
assert.strictEqual(data.shengdiao[4].label, "輕聲");
assert.ok(!data.shengmu.some(function (item) {
  return !item.key || item.key === "y" || item.key === "w" || item.label === "零";
}));
assert.ok(data.yunmu.some(function (item) { return item.label === "iou" && item.key === "iou"; }));
assert.ok(data.yunmu.some(function (item) { return item.label === "uei" && item.key === "uei"; }));
assert.ok(data.yunmu.some(function (item) { return item.label === "uen" && item.key === "uen"; }));
assert.ok(!data.yunmu.some(function (item) { return item.key === "er" || item.label === "er"; }));
assert.strictEqual(data.seed_words.length, 40);
assert.strictEqual(data.mode_copy.A.name, "點選拼音");
assert.strictEqual(data.mode_copy.B.name, "認讀選擇");
assert.strictEqual(data.mode_copy.C.name, "組合拼音");
assert.deepStrictEqual(data.polyphone_policy.normalize, ["lowercase", "ü≡v", "jqx後u≡ü", "trim_spaces"]);

assert.deepStrictEqual(byId.s01.accept, ["māma", "māmā"]);
assert.strictEqual(byId.s01.han, "媽媽");
assert.deepStrictEqual(byId.s37.accept, ["yínháng"]);
assert.strictEqual(byId.s37.han, "銀行");
assert.deepStrictEqual(byId.s38.accept, ["xíngli", "xínglǐ"]);
assert.deepStrictEqual(byId.s35.accept, ["kuàilè"]);
assert.deepStrictEqual(byId.s36.accept, ["yīnyuè"]);
assert.deepStrictEqual(byId.s39.accept, ["zhǎngdà"]);
assert.deepStrictEqual(byId.s40.accept, ["chángchéng"]);
assert.strictEqual(byId.s40.pinyin, "Chángchéng");
assert.strictEqual(byId.s19.pinyin, "Zhōngguó");
assert.strictEqual(byId.s20.pinyin, "Xiānggǎng");

data.seed_words.forEach(function (seed) {
  var word = Grade.mapSeedWord(seed, "set_demo");
  assert.ok(word, "拆音失敗：" + seed.han + " " + seed.pinyin);
  assert.strictEqual(word.hanzi, seed.han);
  assert.strictEqual(word.readings.length, seed.tones.length);
  word.readings.forEach(function (reading) {
    assert.notStrictEqual(reading.final, "");
  });
  var spelled = word.readings.map(function (reading) {
    return Grade.spellSyllable(reading.initial, reading.final, reading.tone);
  }).join("");
  assert.strictEqual(Grade.normalizePinyin(spelled), Grade.normalizePinyin(seed.pinyin), seed.han);
  assert.strictEqual(Grade.gradeAttempt(seed.pinyin, seed.accept).ok, true, seed.han);
  assert.strictEqual(Grade.gradeAttempt(word.readings, seed.accept).ok, true, seed.han + " readings");
  seed.accept.forEach(function (alt) {
    assert.strictEqual(Grade.isAccepted(alt, seed), true, seed.han + " " + alt);
  });
  var wrong = word.readings.map(function (reading, index) {
    if (index !== 0) return reading;
    return { initial: reading.initial, final: reading.final, tone: (reading.tone + 1) % 5 };
  });
  var wrongKey = Grade.gradeAttempt(wrong, seed.accept);
  var collided = seed.accept.some(function (alt) { return Grade.normalizePinyin(alt) === wrongKey.normalized; });
  if (!collided) assert.strictEqual(wrongKey.ok, false, seed.han + " 錯調仍算對");
});

assert.strictEqual(Grade.isAccepted("māmā", byId.s01), true);
assert.strictEqual(Grade.isAccepted("māma", byId.s01), true);
assert.strictEqual(Grade.isAccepted("mama", byId.s01), false);
assert.strictEqual(Grade.isAccepted("màma", byId.s01), false);
assert.strictEqual(Grade.isAccepted("Nǐ hǎo", ["nǐhǎo"]), true);
assert.strictEqual(Grade.isAccepted("Zhōngguó", ["zhōngguó"]), true);
assert.strictEqual(Grade.normalizePinyin("lüè"), Grade.normalizePinyin("lvè"));
assert.strictEqual(Grade.normalizePinyin("jué"), Grade.normalizePinyin("jüé"));
assert.strictEqual(Grade.normalizePinyin("jué"), Grade.normalizePinyin("jvé"));
assert.strictEqual(Grade.normalizePinyin("xuǎn"), Grade.normalizePinyin("xüǎn"));
assert.strictEqual(Grade.normalizePinyin("qún"), Grade.normalizePinyin("qǘn"));
assert.ok(Grade.normalizePinyin("qiū").indexOf("ü") < 0);
assert.strictEqual(Grade.normalizePinyin("xī'ān"), Grade.normalizePinyin("xīān"));
assert.strictEqual(Grade.normalizePinyin("lu\u0308e"), Grade.normalizePinyin("lüe"));
assert.strictEqual(Grade.isAccepted("zhǎngdà", byId.s40), false);
assert.strictEqual(Grade.isAccepted("chángchéng", byId.s39), false);
assert.strictEqual(Grade.isAccepted("xíng", byId.s37), false);
assert.strictEqual(Grade.isAccepted("yínháng", byId.s38), false);
assert.strictEqual(Grade.isAccepted("", byId.s12), false);

var mama = Grade.mapSeedWord(byId.s01, "set_demo");
assert.deepStrictEqual(mama.readings, [
  { initial: "m", final: "a", tone: 1 },
  { initial: "m", final: "a", tone: 0 }
]);
assert.strictEqual(Grade.isAccepted([
  { initial: "m", final: "a", tone: 1 },
  { initial: "m", final: "a", tone: 1 }
], byId.s01), true);

var fish = Grade.mapSeedWord(byId.s34, "set_demo");
assert.deepStrictEqual(fish.readings, [{ initial: "", final: "ü", tone: 2 }]);
assert.strictEqual(Grade.spellSyllable("", "ü", 2), "yú");
assert.strictEqual(Grade.spellSyllable("sh", "ui", 3), "shuǐ");
assert.strictEqual(Grade.spellSyllable("sh", "uei", 3), "shuǐ");
assert.strictEqual(Grade.spellSyllable("", "iu", 3), "yǒu");
assert.strictEqual(Grade.spellSyllable("", "iou", 3), "yǒu");
assert.strictEqual(Grade.spellSyllable("l", "iou", 2), "liú");
assert.strictEqual(Grade.spellSyllable("l", "iu", 2), "liú");
assert.strictEqual(Grade.spellSyllable("l", "uen", 4), "lùn");
assert.strictEqual(Grade.spellSyllable("l", "un", 4), "lùn");
assert.strictEqual(Grade.spellSyllable("", "uei", 4), "wèi");
assert.strictEqual(Grade.spellSyllable("", "uen", 2), "wén");
assert.strictEqual(Grade.spellSyllable("x", "üe", 2), "xué");
assert.strictEqual(Grade.spellSyllable("j", "ün", 2), "jún");
assert.strictEqual(Grade.spellSyllable("q", "üan", 2), "quán");
assert.strictEqual(Grade.normalizePinyin("lióu"), Grade.normalizePinyin("liú"));
assert.strictEqual(Grade.normalizePinyin("liǒu"), Grade.normalizePinyin("liǔ"));
assert.strictEqual(Grade.normalizePinyin("liǒu") === Grade.normalizePinyin("liú"), false);
assert.strictEqual(Grade.normalizePinyin("guěi"), Grade.normalizePinyin("guǐ"));
assert.strictEqual(Grade.normalizePinyin("luèn"), Grade.normalizePinyin("lùn"));
assert.strictEqual(Grade.normalizePinyin("zhuēng"), Grade.normalizePinyin("zhuēng"));
assert.strictEqual(Grade.isAccepted("lióu", ["liú"]), true);
assert.strictEqual(Grade.isAccepted("guěi", ["guǐ"]), true);
assert.strictEqual(Grade.isAccepted("luèn", ["lùn"]), true);
assert.strictEqual(Grade.isAccepted("liou", ["liú"]), false);

if (Grade.collisions().length) {
  console.error(Grade.collisions());
  throw new Error("拼音拼寫有衝突");
}

console.log("grade tests passed (" + data.seed_words.length + " seed words)");
