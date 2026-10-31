"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var Grade = require("../js/grade.js");
var Tts = require("../js/tts.js");

var data = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/pinyin_tables_and_seeds_v1.json"), "utf8"));
Grade.init(data);

function wordOf(id) {
  return Grade.mapSeedWord(data.seed_words.find(function (seed) { return seed.id === id; }), "set_demo");
}

assert.strictEqual(Tts.speechRateKey, "pinyinSpeechRate");
assert.strictEqual(Tts.speechEngineKey, "pinyinSpeechEngine");
assert.strictEqual(Tts.speechVoiceKey, "pinyinSpeechVoice");
assert.strictEqual(Tts.engines[0].label, "系統內建");
assert.strictEqual(Tts.engines[1].label, "神經模型（首次約 63MB×聲線）");
assert.strictEqual(Tts.voices[0].label, "女聲");
assert.strictEqual(Tts.voices[1].label, "男聲");
assert.strictEqual(Tts.rateById("slow"), 0.7);
assert.strictEqual(Tts.rateById("normal"), 1);
assert.strictEqual(Tts.rateById("fast"), 1.3);
assert.strictEqual(Tts.lengthScaleForRate(0.7), 1 / 0.7);
assert.strictEqual(Tts.lengthScaleForRate(1), 1);
assert.strictEqual(Tts.lengthScaleForRate(1.3), 1 / 1.3);
assert.strictEqual(Tts.lengthScaleForRate(0), 10);
assert.strictEqual(Tts.lengthScaleForRate(99), 0.1);

var blank = Tts.readPrefs(null);
assert.strictEqual(blank.rateId, "normal");
assert.strictEqual(blank.rate, 1);
assert.strictEqual(blank.engine, "builtin");
assert.strictEqual(blank.voice, "female");
assert.strictEqual(blank.lengthScale, 1);

function memoryStorage(initial) {
  var stored = Object.assign({}, initial || {});
  return {
    getItem: function (key) {
      return Object.prototype.hasOwnProperty.call(stored, key) ? stored[key] : null;
    },
    setItem: function (key, value) { stored[key] = String(value); }
  };
}

var saved = memoryStorage();
assert.strictEqual(Tts.writePref(saved, "engine", "neural"), "neural");
assert.strictEqual(Tts.writePref(saved, "voice", "male"), "male");
assert.strictEqual(Tts.writePref(saved, "rate", "slow"), "slow");
assert.strictEqual(saved.getItem("pinyinSpeechEngine"), "neural");
assert.strictEqual(saved.getItem("pinyinSpeechVoice"), "male");
assert.strictEqual(saved.getItem("pinyinSpeechRate"), "slow");
var restored = Tts.readPrefs(saved);
assert.strictEqual(restored.engine, "neural");
assert.strictEqual(restored.voice, "male");
assert.strictEqual(restored.rate, 0.7);
assert.strictEqual(restored.lengthScale, 1 / 0.7);
assert.strictEqual(Tts.writePref(saved, "engine", "nope"), "builtin");
assert.strictEqual(Tts.writePref(saved, "voice", "nope"), "female");
assert.strictEqual(Tts.readPrefs({ getItem: function () { throw new Error("denied"); } }).engine, "builtin");

var mama = Tts.phonemesForReadings(wordOf("s01").readings);
assert.deepStrictEqual(mama, ["m", "a", "1", "m", "a", "5"]);
assert.deepStrictEqual(Tts.phonemesToIds(mama), [1, 6, 27, 64, 0, 6, 27, 68, 0, 2]);
assert.deepStrictEqual(Tts.phonemesForReadings(wordOf("s09").readings), ["sh", "ui", "3"]);
assert.deepStrictEqual(Tts.phonemesForReadings([{ initial: "sh", final: "uei", tone: 3 }]), ["sh", "ui", "3"]);
assert.deepStrictEqual(Tts.phonemesForReadings([{ initial: "l", final: "iou", tone: 2 }]), ["l", "iu", "2"]);
assert.deepStrictEqual(Tts.phonemesForReadings([{ initial: "", final: "uen", tone: 2 }]), ["w", "en", "2"]);
assert.deepStrictEqual(Tts.phonemesForReadings(wordOf("s21").readings), ["x", "ve", "2", "x", "iao", "4"]);
assert.deepStrictEqual(Tts.phonemesForReadings(wordOf("s34").readings), ["y", "v", "2"]);
assert.deepStrictEqual(Tts.phonemesForReadings(wordOf("s36").readings), ["y", "in", "1", "y", "ve", "4"]);
assert.deepStrictEqual(Tts.phonemesForReadings(wordOf("s37").readings), ["y", "in", "2", "h", "ang", "2"]);
assert.strictEqual(Tts.phonemesForReadings([{ initial: "zz", final: "a", tone: 1 }]), null);
assert.strictEqual(Tts.phonemesToIds(["nope"]), null);
assert.strictEqual(Tts.progressText("女聲", 31610992, 63221984), "正在下載女聲模型… 50%");
assert.strictEqual(Tts.progressText("男聲", 10, 0), "正在下載男聲模型…");

assert.ok(Tts.models.female.url.indexOf("huggingface.co/rhasspy/piper-voices") > 0);
assert.ok(Tts.models.female.url.indexOf("zh_CN-xiao_ya-medium.onnx") > 0);
assert.ok(Tts.models.male.url.indexOf("zh_CN-chaowen-medium.onnx") > 0);
assert.strictEqual(Tts.models.female.id, "zh_CN-xiao_ya-medium");
assert.strictEqual(Tts.models.male.id, "zh_CN-chaowen-medium");
assert.ok(Tts.ortScript.indexOf("onnxruntime-web@1.18.0") > 0);
assert.ok(Tts.ortWasm.indexOf("onnxruntime-web@1.18.0/dist/") > 0);

var voices = [
  { lang: "en-US", name: "Alex" },
  { lang: "zh-TW", name: "Meijia" },
  { lang: "zh-CN", name: "Microsoft Yunyang" },
  { lang: "zh-CN", name: "Microsoft Xiaoxiao" }
];
assert.strictEqual(Tts.chooseBuiltinVoice(voices, "female").name, "Microsoft Xiaoxiao");
assert.strictEqual(Tts.chooseBuiltinVoice(voices, "male").name, "Microsoft Yunyang");
assert.strictEqual(Tts.chooseBuiltinVoice([
  { lang: "en-US", name: "Alex" },
  { lang: "zh-CN", name: "Microsoft Yunyang" }
], "female").name, "Microsoft Yunyang");
assert.strictEqual(Tts.chooseBuiltinVoice([
  { lang: "zh-CN", name: "Mystery", gender: "male" },
  { lang: "zh-CN", name: "Microsoft Xiaoxiao" }
], "male").name, "Mystery");
assert.strictEqual(Tts.chooseBuiltinVoice([{ lang: "en-US", name: "Alex" }], "female"), null);

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

var payload = new Uint8Array([1, 2, 3, 4]);
var cache = memoryCache();
var fetches = 0;
var progress = [];
function fakeFetch() {
  fetches += 1;
  var stream = new ReadableStream({
    start: function (controller) {
      controller.enqueue(payload);
      controller.close();
    }
  });
  return Promise.resolve(new Response(stream, {
    status: 200,
    headers: { "content-length": "4" }
  }));
}

loadModelBytesCheck().then(function () {
  console.log("tts tests passed");
}).catch(function (err) {
  console.error(err);
  process.exit(1);
});

function loadModelBytesCheck() {
  var url = "https://example.test/model.onnx";
  return Tts.loadModelBytes(url, {
    cache: cache,
    fetch: fakeFetch,
    onProgress: function (loaded, total) { progress.push([loaded, total]); }
  }).then(function (buf) {
    assert.strictEqual(new Uint8Array(buf).join(","), "1,2,3,4");
    assert.deepStrictEqual(progress[progress.length - 1], [4, 4]);
    return Tts.loadModelBytes(url, { cache: cache, fetch: fakeFetch });
  }).then(function (buf) {
    assert.strictEqual(fetches, 1);
    assert.strictEqual(new Uint8Array(buf).join(","), "1,2,3,4");
    return Tts.loadModelBytes(url, {
      cache: memoryCache(),
      fetch: function () { return Promise.resolve(new Response("", { status: 404 })); }
    });
  }).then(function () {
    throw new Error("失敗的下載不應成功");
  }, function (err) {
    assert.ok(err);
    return prefetchChecks();
  });
}

function hangFetch(bucket) {
  return function (url, opts) {
    bucket.count += 1;
    bucket.urls.push(String(url));
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
  };
}

function flushed() {
  return Promise.resolve().then(function () { return Promise.resolve(); });
}

function prefetchChecks() {
  Tts.resetDownloads();
  var bucket = { count: 0, urls: [] };
  var first = Tts.prefetchVoice("female", { cache: memoryCache(), fetch: hangFetch(bucket) });
  assert.strictEqual(Tts.downloadState("female").state, "loading");
  assert.strictEqual(Tts.downloadState("male").state, "idle");
  return flushed().then(function () {
    assert.strictEqual(bucket.count, 1);
    assert.ok(bucket.urls[0].indexOf("zh_CN-xiao_ya-medium.onnx") > 0);
    assert.ok(bucket.urls[0].indexOf("chaowen") < 0);
    assert.strictEqual(Tts.isModelReady("female"), false);
    Tts.warmupVoice("female", { cache: memoryCache(), fetch: hangFetch(bucket) });
    assert.strictEqual(bucket.count, 1);
    Tts.cancelDownload("female");
    assert.strictEqual(Tts.downloadState("female").state, "cancelled");
    Tts.warmupVoice("female", { cache: memoryCache(), fetch: hangFetch(bucket) });
    assert.strictEqual(bucket.count, 1, "取消後暖機不再下載");
    return first;
  }).then(function (value) {
    assert.strictEqual(value, null);
    var again = Tts.prefetchVoice("female", { cache: memoryCache(), fetch: hangFetch(bucket) });
    assert.strictEqual(Tts.downloadState("female").state, "loading");
    return flushed().then(function () {
      assert.strictEqual(bucket.count, 2, "再次要求會重新下載");
      Tts.cancelDownload("female");
      return again;
    });
  }).then(function () {
    Tts.resetDownloads();
    var fetches = 0;
    var payload = new Uint8Array([7, 8, 9]);
    var cache = memoryCache();
    function once() {
      fetches += 1;
      var stream = new ReadableStream({
        start: function (controller) {
          controller.enqueue(payload);
          controller.close();
        }
      });
      return Promise.resolve(new Response(stream, {
        status: 200,
        headers: { "content-length": "3" }
      }));
    }
    return Tts.prefetchVoice("female", { cache: cache, fetch: once }).then(function (bytes) {
      assert.strictEqual(Tts.isModelReady("female"), true);
      assert.strictEqual(new Uint8Array(bytes).join(","), "7,8,9");
      return Tts.prefetchVoice("female", {
        cache: cache,
        fetch: function () {
          fetches += 1;
          throw new Error("不應再下載");
        }
      });
    }).then(function () {
      assert.strictEqual(fetches, 1);
      assert.strictEqual(Tts.isModelReady("male"), false);
      Tts.markVoiceReady("male");
      assert.strictEqual(Tts.isModelReady("male"), true);
      Tts.resetDownloads();
      assert.strictEqual(Tts.isModelReady("female"), false);
      assert.strictEqual(Tts.isModelReady("male"), false);
      return Tts.prefetchVoice("male", {
        cache: memoryCache(),
        fetch: function (url) {
          assert.ok(String(url).indexOf("zh_CN-chaowen-medium.onnx") > 0);
          return Promise.resolve(new Response("", { status: 503 }));
        }
      });
    }).then(function (value) {
      assert.strictEqual(value, null);
      assert.strictEqual(Tts.downloadState("male").state, "error");
      assert.strictEqual(Tts.isModelReady("male"), false);
      Tts.resetDownloads();
    });
  });
}
