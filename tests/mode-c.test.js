"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var Grade = require("../js/grade.js");
var ModeA = require("../js/modes/a.js");
var ModeC = require("../js/modes/c.js");

var data = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/pinyin_tables_and_seeds_v1.json"), "utf8"));
Grade.init(data);

var copy = data.mode_copy.C;
assert.strictEqual(copy.name, "組合拼音");
assert.strictEqual(copy.correct, "答對了！");
assert.strictEqual(copy.wrong, "不對。正確是：{正解帶調拼音}");
assert.strictEqual(copy.word_done, "完成！");
assert.strictEqual(copy.set_done, "這組練習完成了，做得好！");
assert.strictEqual(copy.prompt, "聽一聽，選出正確的聲母、韻母和聲調。");
assert.ok(copy.prompt.indexOf("{詞}") < 0, "聽力題幹不應先露出詞");
assert.strictEqual(copy.replay, "再聽一次");
assert.strictEqual(copy.syllable, "第 {n} 個字");
assert.ok(copy.no_speech && copy.no_speech.indexOf("瀏覽器") >= 0);
assert.ok(copy.prompt_fallback && copy.prompt_fallback.indexOf("{詞}") < 0);

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
var shui = wordOf("s09");

assert.strictEqual(ModeC.syllableLine(copy, 2), "第 2 個字");
assert.strictEqual(ModeC.gradeSyllable(mama, 0, { initial: "m", final: "a", tone: 1 }).ok, true);
var mamaWrong = ModeC.gradeSyllable(mama, 0, { initial: "m", final: "a", tone: 4 });
assert.strictEqual(mamaWrong.ok, false);
assert.strictEqual(mamaWrong.correctPinyin, "mā");
assert.strictEqual(ModeC.wrongLine(copy, mamaWrong.correctPinyin), "不對。正確是：mā");
assert.strictEqual(ModeC.gradeSyllable(mama, 1, { initial: "m", final: "a", tone: 0 }).ok, true);
assert.strictEqual(ModeC.gradeSyllable(mama, 1, { initial: "m", final: "a", tone: 1 }).ok, true);
assert.strictEqual(ModeC.gradeSyllable(bank, 1, { initial: "h", final: "ang", tone: 2 }).ok, true);
assert.strictEqual(ModeC.gradeSyllable(bank, 1, { initial: "x", final: "ing", tone: 2 }).ok, false);
assert.strictEqual(ModeC.gradeSyllable(grow, 0, { initial: "zh", final: "ang", tone: 3 }).ok, true);
assert.strictEqual(ModeC.gradeSyllable(wall, 0, { initial: "ch", final: "ang", tone: 2 }).ok, true);
assert.strictEqual(ModeC.gradeSyllable(wall, 0, { initial: "zh", final: "ang", tone: 3 }).ok, false);
assert.strictEqual(ModeC.gradeSyllable(fish, 0, { initial: "", final: "ü", tone: 2 }).ok, true);
assert.strictEqual(ModeC.gradeSyllable(fish, 0, { initial: "y", final: "u", tone: 2 }).ok, false);
assert.strictEqual(ModeC.gradeSyllable(school, 0, { initial: "x", final: "üe", tone: 2 }).ok, true);
assert.strictEqual(ModeC.gradeSyllable(luggage, 1, { initial: "l", final: "i", tone: 0 }).ok, true);
assert.strictEqual(ModeC.gradeSyllable(luggage, 1, { initial: "l", final: "i", tone: 3 }).ok, true);

var ju = {
  hanzi: "居",
  pinyin: "jū",
  accept: ["jū"],
  readings: [{ initial: "j", final: "ü", tone: 1 }]
};
assert.strictEqual(ModeC.gradeSyllable(ju, 0, { initial: "j", final: "u", tone: 1 }).ok, true);
assert.strictEqual(ModeA.gradeSyllable(ju, 0, { initial: "j", final: "ü", tone: 1 }).ok, true);
assert.strictEqual(ModeC.gradeSyllable(ju, 0, { initial: "j", final: "ü", tone: 1 }).ok, true);

data.seed_words.forEach(function (seed) {
  var word = Grade.mapSeedWord(seed, "set_demo");
  word.readings.forEach(function (reading, index) {
    var graded = ModeC.gradeSyllable(word, index, reading);
    assert.strictEqual(graded.ok, true, seed.han + " 第 " + (index + 1) + " 音");
  });
});

var run = ModeC.createRun([mama, shui], copy);
var first = ModeC.submit(run, { initial: "m", final: "a", tone: 4 });
assert.strictEqual(first.ok, false);
assert.strictEqual(first.wordDone, false);
assert.strictEqual(first.feedback, "不對。正確是：mā");
var second = ModeC.submit(run, { initial: "m", final: "a", tone: 0 });
assert.strictEqual(second.wordDone, true);
assert.strictEqual(second.allCorrect, false);
assert.strictEqual(run.correctWords, 0);
var third = ModeC.submit(run, { initial: "sh", final: "ui", tone: 3 });
assert.strictEqual(third.ok, true);
assert.strictEqual(third.allCorrect, true);
assert.strictEqual(third.setDone, true);
assert.ok(third.feedback.indexOf("完成！") === 0);
assert.ok(third.feedback.indexOf("shuǐ") > 0);
var record = ModeC.sessionRecord(run, { setId: "set_demo" });
assert.strictEqual(record.mode, "C");
assert.strictEqual(record.setId, "set_demo");
assert.strictEqual(record.total, 2);
assert.strictEqual(record.correct, 1);

function createDocument() {
  var byId = {};
  function Element(tag) {
    this.tagName = String(tag || "").toUpperCase();
    this.className = "";
    this._text = "";
    this.children = [];
    this.attributes = {};
    this.listeners = {};
    this.disabled = false;
    this.type = "";
    this._id = "";
  }
  Object.defineProperty(Element.prototype, "id", {
    get: function () { return this._id; },
    set: function (value) {
      if (this._id && byId[this._id] === this) delete byId[this._id];
      this._id = value == null ? "" : String(value);
      if (this._id) byId[this._id] = this;
    }
  });
  Object.defineProperty(Element.prototype, "textContent", {
    get: function () { return this._text; },
    set: function (value) { this._text = value == null ? "" : String(value); }
  });
  Element.prototype.setAttribute = function (name, value) {
    this.attributes[name] = String(value);
  };
  Element.prototype.getAttribute = function (name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
  };
  Element.prototype.appendChild = function (child) {
    this.children.push(child);
    return child;
  };
  Element.prototype.append = function () {
    for (var i = 0; i < arguments.length; i++) this.appendChild(arguments[i]);
  };
  Element.prototype.replaceChildren = function () {
    this.children = [];
  };
  Element.prototype.addEventListener = function (type, fn) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(fn);
  };
  Element.prototype.click = function () {
    (this.listeners.click || []).slice().forEach(function (fn) { fn(); });
  };
  return {
    byId: byId,
    createElement: function (tag) { return new Element(tag); },
    getElementById: function (id) { return byId[id] || null; }
  };
}

function walk(node, fn) {
  fn(node);
  (node.children || []).forEach(function (child) { walk(child, fn); });
}

function textOf(root) {
  function own(node) {
    var childText = (node.children || []).map(own).join("");
    return (node.textContent || "") + childText;
  }
  return own(root);
}

function findButton(root, label) {
  var found = null;
  walk(root, function (node) {
    if (node.tagName === "BUTTON" && node.textContent === label) found = node;
  });
  return found;
}

function findPick(root, part, value) {
  var found = null;
  walk(root, function (node) {
    if (node.tagName !== "BUTTON") return;
    if (node.getAttribute("data-part") === part && node.getAttribute("data-value") === String(value)) found = node;
  });
  return found;
}

function Utterance(text) {
  this.text = text;
  this.lang = "";
  this.voice = null;
}

function createSynth(voices) {
  var synth = {
    voices: voices || [],
    spoken: [],
    cancelled: 0,
    listeners: {},
    getVoices: function () { return synth.voices; },
    cancel: function () { synth.cancelled += 1; },
    speak: function (utter) { synth.spoken.push(utter); },
    addEventListener: function (name, fn) { synth.listeners[name] = fn; }
  };
  return synth;
}

function mountWith(words, synth, extra) {
  var doc = createDocument();
  global.document = doc;
  var root = doc.createElement("div");
  var done = [];
  ModeC.mount(root, Object.assign({
    copy: copy,
    words: words,
    tables: data,
    setId: "set_demo",
    speechSynthesis: synth,
    Utterance: Utterance,
    onDone: function (record) { done.push(record); }
  }, extra || {}));
  return { root: root, done: done, doc: doc };
}

var zhSynth = createSynth([
  { lang: "en-US", name: "Alex" },
  { lang: "zh-TW", name: "Meijia" },
  { lang: "zh-CN", name: "Tingting" }
]);
var heard = mountWith([mama, shui], zhSynth);
assert.ok(textOf(heard.root).indexOf("聽一聽，選出正確的聲母、韻母和聲調。") >= 0);
assert.ok(textOf(heard.root).indexOf(copy.no_speech) < 0);
assert.ok(textOf(heard.root).indexOf(copy.prompt_fallback) < 0);
assert.ok(textOf(heard.root).indexOf("媽媽") < 0, "作答前不顯示漢字");
assert.ok(textOf(heard.root).indexOf("mā") < 0, "作答前不顯示拼音");
var replay = findButton(heard.root, "再聽一次");
assert.ok(replay, "需要重播按鈕");
assert.strictEqual(replay.disabled, false);
assert.strictEqual(zhSynth.spoken.length, 1);
assert.strictEqual(zhSynth.spoken[0].text, "媽媽");
assert.strictEqual(zhSynth.spoken[0].lang, "zh-CN");
assert.strictEqual(zhSynth.spoken[0].voice.name, "Tingting");
assert.ok(findButton(heard.root, "確定").disabled, "未選齊不能送出");
findPick(heard.root, "initial", "m").click();
assert.strictEqual(zhSynth.spoken.length, 1, "點選時不重複朗讀");
findPick(heard.root, "final", "a").click();
findPick(heard.root, "tone", "4").click();
assert.strictEqual(findButton(heard.root, "確定").disabled, false);
findButton(heard.root, "確定").click();
assert.ok(textOf(heard.root).indexOf("不對。正確是：mā") >= 0);
assert.ok(textOf(heard.root).indexOf("媽媽") < 0, "詞還沒答完先不揭曉整詞");
replay = findButton(heard.root, "再聽一次");
assert.ok(replay);
var beforeReplay = zhSynth.spoken.length;
replay.click();
assert.ok(zhSynth.spoken.length > beforeReplay);
assert.strictEqual(zhSynth.spoken[zhSynth.spoken.length - 1].text, "媽媽");
assert.ok(zhSynth.cancelled >= 1);
findButton(heard.root, "繼續").click();
assert.ok(textOf(heard.root).indexOf("第 2 個字") >= 0);
assert.ok(textOf(heard.root).indexOf("媽媽") < 0);
findPick(heard.root, "initial", "m").click();
findPick(heard.root, "final", "a").click();
findPick(heard.root, "tone", "0").click();
findButton(heard.root, "確定").click();
assert.ok(textOf(heard.root).indexOf("媽媽") >= 0, "答完才顯示詞");
assert.ok(textOf(heard.root).indexOf("mā ma") >= 0 || textOf(heard.root).indexOf("māma") >= 0);
findButton(heard.root, "繼續").click();
assert.strictEqual(zhSynth.spoken[zhSynth.spoken.length - 1].text, "水");
assert.ok(textOf(heard.root).indexOf("水") < 0);
findPick(heard.root, "initial", "sh").click();
findPick(heard.root, "final", "ui").click();
findPick(heard.root, "tone", "3").click();
findButton(heard.root, "確定").click();
assert.ok(textOf(heard.root).indexOf("水") >= 0);
assert.ok(textOf(heard.root).indexOf("完成！") >= 0);
findButton(heard.root, "繼續").click();
assert.ok(textOf(heard.root).indexOf("這組練習完成了，做得好！") >= 0);
assert.strictEqual(heard.done.length, 1);
assert.strictEqual(heard.done[0].mode, "C");
assert.strictEqual(heard.done[0].setId, "set_demo");
assert.strictEqual(heard.done[0].total, 2);
assert.strictEqual(heard.done[0].correct, 1);

var late = createSynth([]);
var lateMount = mountWith([shui], late);
assert.strictEqual(late.spoken.length, 1);
assert.strictEqual(late.spoken[0].voice, null);
assert.strictEqual(late.spoken[0].lang, "zh-CN");
late.voices = [{ lang: "cmn-Hans-CN", name: "Mainland" }, { lang: "en-GB", name: "Emma" }];
late.listeners.voiceschanged();
assert.strictEqual(late.spoken.length, 2);
assert.strictEqual(late.spoken[1].voice.name, "Mainland");
assert.strictEqual(late.spoken[1].lang, "zh-CN");
late.listeners.voiceschanged();
assert.strictEqual(late.spoken.length, 2, "已有普通話聲線後不再重播");

var english = createSynth([{ lang: "en-US", name: "Alex" }]);
mountWith([shui], english);
assert.strictEqual(english.spoken[0].lang, "zh-CN");
assert.strictEqual(english.spoken[0].voice, null);

function StrictUtterance(text) {
  this.text = text;
  this.lang = "";
  this._voice = null;
}
Object.defineProperty(StrictUtterance.prototype, "voice", {
  get: function () { return this._voice; },
  set: function (value) {
    if (value && !value.realVoice) throw new Error("bad voice");
    this._voice = value;
  }
});
var strictSynth = createSynth([{ lang: "zh-CN", name: "Tingting" }]);
var strictMount = mountWith([shui], strictSynth, { Utterance: StrictUtterance });
assert.strictEqual(strictSynth.spoken.length, 1);
assert.strictEqual(strictSynth.spoken[0].lang, "zh-CN");
assert.strictEqual(strictSynth.spoken[0].voice, null);
assert.ok(textOf(strictMount.root).indexOf("水") < 0, "聲線掛不上時仍用語句語言朗讀，不改看字");
assert.ok(textOf(strictMount.root).indexOf(copy.no_speech) < 0);

var silent = mountWith([mama], null);
assert.ok(textOf(silent.root).indexOf(copy.no_speech) >= 0);
assert.ok(textOf(silent.root).indexOf(copy.prompt_fallback) >= 0);
assert.ok(textOf(silent.root).indexOf("媽媽") >= 0, "不能朗讀時仍可看字練習");
assert.strictEqual(findButton(silent.root, "再聽一次").disabled, true);
findPick(silent.root, "initial", "m").click();
findPick(silent.root, "final", "a").click();
findPick(silent.root, "tone", "1").click();
findButton(silent.root, "確定").click();
assert.ok(textOf(silent.root).indexOf("答對了！") >= 0);

var broken = createSynth([{ lang: "zh-CN", name: "Tingting" }]);
broken.speak = function () { throw new Error("speech failed"); };
var failed = mountWith([mama], broken);
assert.ok(textOf(failed.root).indexOf(copy.no_speech) >= 0);
assert.ok(textOf(failed.root).indexOf("媽媽") >= 0);

console.log("mode C tests passed");
