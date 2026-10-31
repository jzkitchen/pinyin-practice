"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var Grade = require("../js/grade.js");
var Tts = require("../js/tts.js");
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
var first = ModeC.submit(run, [
  { initial: "m", final: "a", tone: 4 },
  { initial: "m", final: "a", tone: 0 }
]);
assert.strictEqual(first.ok, false);
assert.strictEqual(first.wordDone, true);
assert.strictEqual(first.feedback, "不對。正確是：mā ma（媽媽）");
assert.strictEqual(run.correctWords, 0);
var third = ModeC.submit(run, [{ initial: "sh", final: "ui", tone: 3 }]);
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

function memoryStorage(initial) {
  var data = {};
  var key;
  initial = initial || {};
  for (key in initial) {
    if (Object.prototype.hasOwnProperty.call(initial, key)) data[key] = initial[key];
  }
  return {
    getItem: function (name) {
      return Object.prototype.hasOwnProperty.call(data, name) ? data[name] : null;
    },
    setItem: function (name, value) {
      data[name] = String(value);
    }
  };
}

assert.strictEqual(ModeC.speechRateKey, "pinyinSpeechRate");
assert.deepStrictEqual(ModeC.speechRateOptions.map(function (item) {
  return item.label + ":" + item.rate;
}), ["慢:0.7", "正常:1", "快:1.3"]);
assert.strictEqual(ModeC.readSpeechRateId(null), "normal");
assert.strictEqual(ModeC.readSpeechRate(null), 1);
assert.strictEqual(ModeC.readSpeechRate(memoryStorage()), 1);
assert.strictEqual(ModeC.readSpeechRate(memoryStorage({ pinyinSpeechRate: "slow" })), 0.7);
assert.strictEqual(ModeC.readSpeechRate(memoryStorage({ pinyinSpeechRate: "normal" })), 1);
assert.strictEqual(ModeC.readSpeechRate(memoryStorage({ pinyinSpeechRate: "fast" })), 1.3);
assert.strictEqual(ModeC.readSpeechRate(memoryStorage({ pinyinSpeechRate: "nope" })), 1);
assert.strictEqual(ModeC.readSpeechRate({ getItem: function () { throw new Error("denied"); } }), 1);
assert.strictEqual(ModeC.clampSpeechRate(0.7), 0.7);
assert.strictEqual(ModeC.clampSpeechRate(0), 0.1);
assert.strictEqual(ModeC.clampSpeechRate(99), 10);
assert.strictEqual(ModeC.clampSpeechRate("fast"), 1);
var saved = memoryStorage();
assert.strictEqual(ModeC.writeSpeechRateId(saved, "slow"), "slow");
assert.strictEqual(saved.getItem("pinyinSpeechRate"), "slow");
assert.strictEqual(ModeC.readSpeechRate(saved), 0.7);
assert.strictEqual(ModeC.writeSpeechRateId(saved, "bogus"), "normal");
assert.strictEqual(saved.getItem("pinyinSpeechRate"), "normal");
var locked = {
  getItem: function () { return "fast"; },
  setItem: function () { throw new Error("denied"); }
};
assert.strictEqual(ModeC.writeSpeechRateId(locked, "slow"), "slow");

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

function findSlot(root, index) {
  var found = null;
  walk(root, function (node) {
    if (node.tagName === "BUTTON" && node.getAttribute("data-slot") === String(index)) found = node;
  });
  return found;
}

function fillSlot(root, index, initial, final, tone) {
  findSlot(root, index).click();
  findPick(root, "initial", initial).click();
  findPick(root, "final", final).click();
  findPick(root, "tone", tone).click();
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
assert.strictEqual(zhSynth.spoken[0].rate, 1, "預設語速是正常");
assert.strictEqual(findButton(heard.root, "慢").getAttribute("aria-pressed"), "false");
assert.strictEqual(findButton(heard.root, "正常").getAttribute("aria-pressed"), "true");
assert.strictEqual(findButton(heard.root, "快").getAttribute("aria-pressed"), "false");
assert.strictEqual(findButton(heard.root, "系統內建").getAttribute("aria-pressed"), "true");
assert.strictEqual(findButton(heard.root, "神經模型（首次約 63MB×聲線）").getAttribute("aria-pressed"), "false");
assert.strictEqual(findButton(heard.root, "女聲").getAttribute("aria-pressed"), "true");
assert.strictEqual(findButton(heard.root, "男聲").getAttribute("aria-pressed"), "false");
assert.ok(findSlot(heard.root, 0), "兩個字要同時看到格子");
assert.ok(findSlot(heard.root, 1));
assert.ok(textOf(heard.root).indexOf("第 1 個字") < 0);
assert.ok(findButton(heard.root, "確定").disabled, "未選齊不能送出");
findPick(heard.root, "initial", "m").click();
assert.strictEqual(zhSynth.spoken.length, 1, "點選時不重複朗讀");
findPick(heard.root, "final", "a").click();
findPick(heard.root, "tone", "4").click();
assert.ok(findButton(heard.root, "確定").disabled, "還有字沒選不能送出");
fillSlot(heard.root, 1, "m", "a", "0");
assert.strictEqual(findButton(heard.root, "確定").disabled, false);
findButton(heard.root, "確定").click();
assert.ok(textOf(heard.root).indexOf("不對。正確是：mā ma（媽媽）") >= 0);
assert.ok(textOf(heard.root).indexOf("媽媽") >= 0, "答完整詞才顯示漢字");
replay = findButton(heard.root, "再聽一次");
assert.ok(replay);
var beforeReplay = zhSynth.spoken.length;
replay.click();
assert.ok(zhSynth.spoken.length > beforeReplay);
assert.strictEqual(zhSynth.spoken[zhSynth.spoken.length - 1].text, "媽媽");
assert.ok(zhSynth.cancelled >= 1);
findButton(heard.root, "繼續").click();
assert.ok(textOf(heard.root).indexOf("第 2 題，共 2 題") >= 0);
assert.ok(textOf(heard.root).indexOf("水") < 0);
assert.strictEqual(zhSynth.spoken[zhSynth.spoken.length - 1].text, "水");
fillSlot(heard.root, 0, "sh", "ui", "3");
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
fillSlot(silent.root, 0, "m", "a", "1");
fillSlot(silent.root, 1, "m", "a", "0");
findButton(silent.root, "確定").click();
assert.ok(textOf(silent.root).indexOf("完成！") >= 0);
assert.ok(textOf(silent.root).indexOf("媽媽") >= 0);

var broken = createSynth([{ lang: "zh-CN", name: "Tingting" }]);
broken.speak = function () { throw new Error("speech failed"); };
var failed = mountWith([mama], broken);
assert.ok(textOf(failed.root).indexOf(copy.no_speech) >= 0);
assert.ok(textOf(failed.root).indexOf("媽媽") >= 0);

var slowStore = memoryStorage({ pinyinSpeechRate: "slow" });
var slowSynth = createSynth([{ lang: "zh-CN", name: "Tingting" }]);
var slowMount = mountWith([mama, shui], slowSynth, { storage: slowStore });
assert.strictEqual(slowSynth.spoken[0].text, "媽媽");
assert.strictEqual(slowSynth.spoken[0].rate, 0.7);
assert.strictEqual(findButton(slowMount.root, "慢").getAttribute("aria-pressed"), "true");
assert.strictEqual(findButton(slowMount.root, "正常").getAttribute("aria-pressed"), "false");
findButton(slowMount.root, "快").click();
assert.strictEqual(slowStore.getItem("pinyinSpeechRate"), "fast");
assert.strictEqual(findButton(slowMount.root, "快").getAttribute("aria-pressed"), "true");
assert.strictEqual(slowSynth.spoken.length, 1, "改語速本身不重播");
var beforeFast = slowSynth.spoken.length;
findButton(slowMount.root, "再聽一次").click();
assert.strictEqual(slowSynth.spoken.length, beforeFast + 1);
assert.strictEqual(slowSynth.spoken[beforeFast].text, "媽媽");
assert.strictEqual(slowSynth.spoken[beforeFast].rate, 1.3);
fillSlot(slowMount.root, 0, "m", "a", "1");
fillSlot(slowMount.root, 1, "m", "a", "0");
findButton(slowMount.root, "確定").click();
findButton(slowMount.root, "繼續").click();
assert.strictEqual(slowSynth.spoken[slowSynth.spoken.length - 1].text, "水");
assert.strictEqual(slowSynth.spoken[slowSynth.spoken.length - 1].rate, 1.3);

var denied = {
  getItem: function () { throw new Error("denied"); },
  setItem: function () { throw new Error("denied"); }
};
var deniedSynth = createSynth([{ lang: "zh-CN", name: "Tingting" }]);
var deniedMount = mountWith([shui], deniedSynth, { storage: denied });
assert.strictEqual(deniedSynth.spoken[0].rate, 1);
findButton(deniedMount.root, "慢").click();
findButton(deniedMount.root, "再聽一次").click();
assert.strictEqual(deniedSynth.spoken[deniedSynth.spoken.length - 1].rate, 0.7);
assert.strictEqual(deniedSynth.spoken[deniedSynth.spoken.length - 1].lang, "zh-CN");

var lateRate = createSynth([]);
mountWith([shui], lateRate, { storage: memoryStorage({ pinyinSpeechRate: "fast" }) });
assert.strictEqual(lateRate.spoken[0].rate, 1.3);
lateRate.voices = [{ lang: "zh-CN", name: "Tingting" }];
lateRate.listeners.voiceschanged();
assert.strictEqual(lateRate.spoken[1].rate, 1.3);
assert.strictEqual(lateRate.spoken[1].voice.name, "Tingting");

var prefetchLog = [];
var prefetchMount = mountWith([mama], createSynth([{ lang: "zh-CN", name: "Tingting" }]), {
  prefetchVoice: function (voice, how) { prefetchLog.push(voice + ":" + how); }
});
assert.deepStrictEqual(prefetchLog, ["female:warmup"]);
findButton(prefetchMount.root, "神經模型（首次約 63MB×聲線）").click();
assert.ok(prefetchLog.indexOf("female:force") >= 0);
var maleAt = prefetchLog.length;
findButton(prefetchMount.root, "男聲").click();
assert.ok(prefetchLog.indexOf("male:force") >= 0);
assert.strictEqual(prefetchLog.slice(maleAt).indexOf("female:force"), -1);
findButton(prefetchMount.root, "女聲").click();
assert.strictEqual(prefetchLog[prefetchLog.length - 1], "female:force");

var bothPrefetch = [];
mountWith([mama], createSynth([{ lang: "zh-CN", name: "Tingting" }]), {
  storage: memoryStorage({ pinyinSpeechEngine: "neural", pinyinSpeechVoice: "male" }),
  prefetchVoice: function (voice, how) { bothPrefetch.push(voice + ":" + how); },
  neuralSpeak: function () { return Promise.resolve(true); }
});
assert.deepStrictEqual(bothPrefetch, ["female:warmup", "male:warmup"]);

Tts.resetDownloads();
var blockedCalls = [];
var blockedSynth = createSynth([{ lang: "zh-CN", name: "Tingting" }]);
mountWith([mama], blockedSynth, {
  storage: memoryStorage({ pinyinSpeechEngine: "neural" }),
  neuralSpeak: function (request) {
    blockedCalls.push(request);
    return Promise.resolve(true);
  }
});
assert.strictEqual(blockedCalls.length, 0, "女聲模型未完成前不走神經模型");
assert.strictEqual(blockedSynth.spoken.length, 1);
assert.strictEqual(blockedSynth.spoken[0].text, "媽媽");
assert.strictEqual(blockedSynth.spoken[0].lang, "zh-CN");

function memoryCache() {
  var store = {};
  return {
    match: function (url) {
      if (!Object.prototype.hasOwnProperty.call(store, url)) return Promise.resolve(undefined);
      return Promise.resolve(new Response(store[url].slice(0)));
    },
    put: function (url, response) {
      return response.arrayBuffer().then(function (buf) { store[url] = buf; });
    }
  };
}

Tts.resetDownloads();
var downloadFetches = 0;
var downloadPromise = Tts.prefetchVoice("female", {
  cache: memoryCache(),
  fetch: function (url, opts) {
    downloadFetches += 1;
    assert.ok(String(url).indexOf("zh_CN-xiao_ya-medium.onnx") > 0);
    assert.ok(String(url).indexOf("chaowen") < 0);
    if (opts && opts.signal && opts.signal.aborted) {
      var aborted = new Error("aborted");
      aborted.name = "AbortError";
      return Promise.reject(aborted);
    }
    return new Promise(function (resolve, reject) {
      if (opts && opts.signal) {
        opts.signal.addEventListener("abort", function () {
          var err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      }
    });
  }
});
var downloadSynth = createSynth([{ lang: "zh-CN", name: "Tingting" }]);
var downloadMount = mountWith([shui], downloadSynth);
assert.strictEqual(Tts.downloadState("female").state, "loading");
assert.strictEqual(Tts.downloadState("male").state, "idle");
assert.ok(textOf(downloadMount.root).indexOf("正在下載女聲模型") >= 0);
assert.ok(findButton(downloadMount.root, "取消下載"));
assert.strictEqual(downloadSynth.spoken[0].lang, "zh-CN");
findButton(downloadMount.root, "取消下載").click();
assert.strictEqual(Tts.downloadState("female").state, "cancelled");
assert.strictEqual(findButton(downloadMount.root, "取消下載"), null);
assert.ok(textOf(downloadMount.root).indexOf("正在下載女聲模型") < 0);
var beforeCancelReplay = downloadSynth.spoken.length;
findButton(downloadMount.root, "再聽一次").click();
assert.strictEqual(downloadSynth.spoken.length, beforeCancelReplay + 1);
assert.strictEqual(downloadSynth.spoken[downloadSynth.spoken.length - 1].lang, "zh-CN");
assert.ok(downloadFetches <= 1);

Tts.resetDownloads();
Tts.markVoiceReady("female");
var neuralCalls = [];
var neuralStore = memoryStorage({
  pinyinSpeechEngine: "neural",
  pinyinSpeechVoice: "female",
  pinyinSpeechRate: "normal"
});
var neuralSynth = createSynth([{ lang: "zh-CN", name: "Microsoft Xiaoxiao" }, { lang: "zh-CN", name: "Microsoft Yunyang" }]);
var neuralMount = mountWith([mama], neuralSynth, {
  storage: neuralStore,
  neuralSpeak: function (request) {
    neuralCalls.push(request);
    return Promise.resolve(true);
  }
});
assert.strictEqual(neuralSynth.spoken.length, 0, "模型已就緒時神經模型不走 speechSynthesis");
assert.strictEqual(neuralCalls.length, 1);
assert.strictEqual(neuralCalls[0].voice, "female");
assert.strictEqual(neuralCalls[0].rate, 1);
assert.strictEqual(neuralCalls[0].lengthScale, 1);
assert.deepStrictEqual(neuralCalls[0].phonemes, ["m", "a", "1", "m", "a", "5"]);
assert.strictEqual(findButton(neuralMount.root, "神經模型（首次約 63MB×聲線）").getAttribute("aria-pressed"), "true");
findButton(neuralMount.root, "男聲").click();
findButton(neuralMount.root, "慢").click();
assert.strictEqual(neuralStore.getItem("pinyinSpeechVoice"), "male");
assert.strictEqual(neuralStore.getItem("pinyinSpeechRate"), "slow");
assert.strictEqual(neuralCalls.length, 1, "改聲線或語速本身不重播");
findButton(neuralMount.root, "再聽一次").click();
assert.strictEqual(neuralCalls.length, 1, "男聲模型未完成前改走系統內建");
assert.strictEqual(neuralSynth.spoken.length, 1);
assert.strictEqual(neuralSynth.spoken[0].text, "媽媽");
assert.strictEqual(neuralSynth.spoken[0].lang, "zh-CN");
assert.strictEqual(neuralSynth.spoken[0].rate, 0.7);
Tts.markVoiceReady("male");
findButton(neuralMount.root, "再聽一次").click();
assert.strictEqual(neuralCalls.length, 2);
assert.strictEqual(neuralCalls[1].voice, "male");
assert.strictEqual(neuralCalls[1].rate, 0.7);
assert.strictEqual(neuralCalls[1].lengthScale, 1 / 0.7);
assert.strictEqual(neuralCalls[1].hanzi, "媽媽");
findButton(neuralMount.root, "系統內建").click();
findButton(neuralMount.root, "再聽一次").click();
assert.strictEqual(neuralSynth.spoken[neuralSynth.spoken.length - 1].text, "媽媽");
assert.strictEqual(neuralSynth.spoken[neuralSynth.spoken.length - 1].rate, 0.7);
assert.strictEqual(neuralSynth.spoken[neuralSynth.spoken.length - 1].voice.name, "Microsoft Yunyang");
assert.strictEqual(neuralSynth.spoken[neuralSynth.spoken.length - 1].lang, "zh-CN");

Tts.resetDownloads();
Tts.markVoiceReady("female");
var fallbackCalls = 0;
var fallbackSynth = createSynth([{ lang: "zh-CN", name: "Tingting" }]);
var fallbackMount = mountWith([mama], fallbackSynth, {
  storage: memoryStorage({ pinyinSpeechEngine: "neural" }),
  neuralSpeak: function () {
    fallbackCalls += 1;
    return Promise.reject(new Error("download failed"));
  }
});
assert.strictEqual(fallbackCalls, 1);

function finishModeC() {
  assert.ok(fallbackSynth.spoken.length >= 1, "神經模型失敗時改用系統內建");
  assert.strictEqual(fallbackSynth.spoken[0].text, "媽媽");
  assert.strictEqual(fallbackSynth.spoken[0].rate, 1);
  assert.ok(textOf(fallbackMount.root).indexOf("神經模型暫時無法使用，已改用系統內建。") >= 0);
  console.log("mode C tests passed");
}

Promise.resolve().then(function () {
  return Promise.resolve();
}).then(finishModeC).catch(function (err) {
  console.error(err);
  process.exit(1);
});
