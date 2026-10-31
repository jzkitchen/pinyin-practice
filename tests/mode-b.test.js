"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var Grade = require("../js/grade.js");
var ModeA = require("../js/modes/a.js");
var ModeB = require("../js/modes/b.js");

var data = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/pinyin_tables_and_seeds_v1.json"), "utf8"));
Grade.init(data);

var copy = data.mode_copy.B;
assert.strictEqual(copy.name, "認讀選擇");
assert.strictEqual(copy.intro, "看帶調拼音，輸入正確的繁體字詞。");
assert.strictEqual(copy.prompt, "請寫出讀作 {帶調拼音} 的字詞。");
assert.strictEqual(copy.correct, "答對了！");
assert.strictEqual(copy.wrong, "不對。正確是：{漢字}（{帶調拼音}）");
assert.strictEqual(copy.set_done, "這組練習完成了，做得好！");
assert.ok(!copy.prompt_pinyin, "題幹改為打字，不再用選字提示");
assert.ok(!copy.prompt_audio, "模式 B 不靠聽讀選字");

function wordOf(id) {
  return Grade.mapSeedWord(data.seed_words.find(function (seed) { return seed.id === id; }), "set_demo");
}

var mama = wordOf("s01");
var shui = wordOf("s09");
var luggage = wordOf("s38");
var wall = wordOf("s40");
var grow = wordOf("s39");

assert.strictEqual(ModeB.displayPinyin(mama), "mā ma");
assert.strictEqual(ModeB.displayPinyin(luggage), "xíng li");
assert.ok(ModeB.displayPinyin(luggage).indexOf("lǐ") < 0, "行李的題幹用詞上的讀音，不用 accept 裡的另一調");
assert.strictEqual(ModeB.displayPinyin(wall), "cháng chéng");
assert.ok(ModeB.displayPinyin(wall).indexOf("zhǎng") < 0, "長城不顯示長大的讀音");
assert.strictEqual(ModeB.displayPinyin({ han: "中國", pinyin: "Zhōngguó" }), "Zhōngguó");

assert.strictEqual(ModeB.promptLine(copy, "mā ma"), "請寫出讀作 mā ma 的字詞。");
assert.strictEqual(ModeB.promptLine(null, "shuǐ"), "請寫出讀作 shuǐ 的字詞。");
assert.strictEqual(ModeB.wrongLine(copy, "媽媽", "mā ma"), "不對。正確是：媽媽（mā ma）");

assert.strictEqual(ModeB.gradeAnswer(mama, "媽媽").ok, true);
assert.strictEqual(ModeB.gradeAnswer(mama, " 媽媽 ").ok, true);
assert.strictEqual(ModeB.gradeAnswer(mama, "媽 媽").ok, true);
assert.strictEqual(ModeB.gradeAnswer(mama, "媽　媽").ok, true);
assert.strictEqual(ModeB.gradeAnswer(mama, "妈妈").ok, false);
assert.strictEqual(ModeB.gradeAnswer(mama, "媽妈").ok, false);
assert.strictEqual(ModeB.gradeAnswer(mama, "māma").ok, false);
assert.strictEqual(ModeB.gradeAnswer(mama, "māmā").ok, false);
assert.strictEqual(ModeB.gradeAnswer(mama, "").ok, false);
assert.strictEqual(ModeB.gradeAnswer(mama, "   ").ok, false);
assert.strictEqual(ModeB.gradeAnswer(mama, "媽媽。").ok, false);
assert.strictEqual(ModeB.gradeAnswer(mama, "媽媽").han, "媽媽");
assert.strictEqual(ModeB.gradeAnswer(mama, "爸爸").pinyin, "mā ma");

assert.strictEqual(ModeB.gradeAnswer(luggage, "行李").ok, true);
assert.strictEqual(ModeB.gradeAnswer(luggage, "行理").ok, false);
assert.strictEqual(ModeB.gradeAnswer(wall, "長城").ok, true);
assert.strictEqual(ModeB.gradeAnswer(wall, "长城").ok, false);
assert.strictEqual(ModeB.gradeAnswer(wall, "長大").ok, false);
assert.strictEqual(ModeB.gradeAnswer(grow, "長大").ok, true);
assert.strictEqual(ModeB.gradeAnswer(grow, "長城").ok, false);

var cloud = {
  hanzi: "水",
  pinyin: "shuǐ",
  accept: ["shuǐ", "shuí"],
  readings: [{ initial: "sh", final: "ui", tone: 3 }]
};
assert.strictEqual(ModeB.gradeAnswer(cloud, "水").ok, true);
assert.strictEqual(ModeB.gradeAnswer(cloud, "水 ").ok, true);
assert.strictEqual(ModeB.gradeAnswer(cloud, "shuǐ").ok, false, "accept 是拼音變體，不是字形");

var both = {
  han: "裏",
  hanzi: "裡",
  pinyin: "lǐ",
  readings: [{ initial: "l", final: "i", tone: 3 }]
};
assert.strictEqual(ModeB.gradeAnswer(both, "裏").ok, true);
assert.strictEqual(ModeB.gradeAnswer(both, "裡").ok, false, "不另收異體字");

var run = ModeB.createRun([mama, null, shui], copy);
assert.strictEqual(run.total, 2);
assert.strictEqual(run.done, false);
assert.strictEqual(run.correctWords, 0);
var wrong = ModeB.submit(run, "爸");
assert.strictEqual(wrong.ok, false);
assert.strictEqual(wrong.wordDone, true);
assert.strictEqual(wrong.allCorrect, false);
assert.strictEqual(wrong.setDone, false);
assert.strictEqual(wrong.feedback, "不對。正確是：媽媽（mā ma）");
assert.strictEqual(run.correctWords, 0);
assert.strictEqual(run.index, 1);
var right = ModeB.submit(run, " 水 ");
assert.strictEqual(right.ok, true);
assert.strictEqual(right.feedback, "答對了！");
assert.strictEqual(right.allCorrect, true);
assert.strictEqual(right.setDone, true);
assert.strictEqual(run.correctWords, 1);
assert.strictEqual(run.done, true);

var record = ModeB.sessionRecord(run, { setId: "set_demo" });
assert.strictEqual(record.mode, "B");
assert.strictEqual(record.setId, "set_demo");
assert.strictEqual(record.total, 2);
assert.strictEqual(record.correct, 1);
assert.strictEqual(record.startedAt.length, 24);
assert.strictEqual(typeof record.durationMs, "number");
assert.ok(record.durationMs >= 0);

var empty = ModeB.createRun([], copy);
assert.strictEqual(empty.total, 0);
assert.strictEqual(empty.done, false);

assert.strictEqual(ModeA.gradeSyllable(mama, 1, { initial: "m", final: "a", tone: 1 }).ok, true, "模式 B 不改模式 A 的 accept 判定");

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
    this.value = "";
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

function findForm(root) {
  var found = null;
  walk(root, function (node) {
    if (node.tagName === "FORM") found = node;
  });
  return found;
}

function mountWith(words) {
  var doc = createDocument();
  global.document = doc;
  var root = doc.createElement("div");
  var done = [];
  ModeB.mount(root, {
    copy: copy,
    words: words,
    tables: data,
    setId: "set_demo",
    onDone: function (record) { done.push(record); }
  });
  return { root: root, done: done, doc: doc };
}

function submitAnswer(mounted, value) {
  var input = mounted.doc.getElementById("han-answer");
  assert.ok(input, "需要漢字輸入框");
  input.value = value;
  var form = findForm(mounted.root);
  assert.ok(form, "輸入要放在表單裡，方便鍵盤送出");
  assert.ok(form.listeners.submit && form.listeners.submit.length, "表單要接住送出");
  form.listeners.submit.forEach(function (fn) {
    fn({ preventDefault: function () {} });
  });
}

var played = mountWith([mama, shui]);
assert.ok(textOf(played.root).indexOf("即將推出") < 0);
assert.ok(textOf(played.root).indexOf(copy.intro) >= 0);
assert.ok(textOf(played.root).indexOf("請寫出讀作 mā ma 的字詞。") >= 0);
assert.ok(textOf(played.root).indexOf("mā ma") >= 0);
assert.ok(textOf(played.root).indexOf("媽媽") < 0, "作答前不顯示漢字");
assert.ok(textOf(played.root).indexOf("第 1 題，共 2 題") >= 0);
var input = played.doc.getElementById("han-answer");
assert.strictEqual(input.tagName, "INPUT");
assert.strictEqual(input.type, "text");
assert.strictEqual(input.getAttribute("lang"), "zh-Hant");
assert.strictEqual(input.getAttribute("autocomplete"), "off");
assert.ok(findButton(played.root, "確定"), "需要確定按鈕");
submitAnswer(played, "   ");
assert.ok(textOf(played.root).indexOf("媽媽") < 0, "空白答案不揭曉");
assert.ok(textOf(played.root).indexOf("不對") < 0);
submitAnswer(played, "爸");
assert.ok(textOf(played.root).indexOf("不對。正確是：媽媽（mā ma）") >= 0);
assert.ok(textOf(played.root).indexOf("媽媽") >= 0);
assert.ok(findButton(played.root, "繼續"));
findButton(played.root, "繼續").click();
assert.ok(textOf(played.root).indexOf("請寫出讀作 shuǐ 的字詞。") >= 0);
assert.ok(textOf(played.root).indexOf("媽媽") < 0);
assert.ok(textOf(played.root).indexOf("水") < 0, "下一題作答前不顯示漢字");
submitAnswer(played, "水");
assert.ok(textOf(played.root).indexOf("答對了！") >= 0);
assert.ok(textOf(played.root).indexOf("不對") < 0);
findButton(played.root, "繼續").click();
assert.ok(textOf(played.root).indexOf("這組練習完成了，做得好！") >= 0);
assert.ok(textOf(played.root).indexOf("答對 1／2 題") >= 0);
assert.strictEqual(played.done.length, 1);
assert.strictEqual(played.done[0].mode, "B");
assert.strictEqual(played.done[0].setId, "set_demo");
assert.strictEqual(played.done[0].total, 2);
assert.strictEqual(played.done[0].correct, 1);

var none = mountWith([]);
assert.ok(textOf(none.root).indexOf("請先選擇有字詞的詞組。") >= 0);
assert.strictEqual(none.doc.getElementById("han-answer"), null);

console.log("mode B tests passed");
