/* 模式 C 的朗讀設定與 Piper 拼音音素。
 * 系統內建走 speechSynthesis。神經模型是 Piper zh_CN（phoneme_type: pinyin），
 * 不用 espeak，也不下載 g2pW。練習詞已有聲母、韻母、聲調，直接對上模型的音素。
 * 模型本體約 63MB，不放進 git。進入模式 C 時背景下載預設女聲；
 * 男聲只在選了神經模型的男聲時才下載。下載完成前朗讀走系統內建。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.PinyinTts = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var SPEECH_RATE_KEY = "pinyinSpeechRate";
  var SPEECH_ENGINE_KEY = "pinyinSpeechEngine";
  var SPEECH_VOICE_KEY = "pinyinSpeechVoice";
  var SPEECH_RATE_MIN = 0.1;
  var SPEECH_RATE_MAX = 10;
  var SAMPLE_RATE = 22050;
  var MODEL_CACHE = "pinyin-piper-models";
  var IDB_NAME = "pinyin-piper";
  var IDB_STORE = "models";
  var ORT_JS = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/ort.wasm.min.js";
  var ORT_WASM = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/";
  var HF = "https://huggingface.co/rhasspy/piper-voices/resolve/main/zh/zh_CN/";

  var SPEECH_RATE_OPTIONS = [
    { id: "slow", label: "慢", rate: 0.7 },
    { id: "normal", label: "正常", rate: 1 },
    { id: "fast", label: "快", rate: 1.3 }
  ];

  var ENGINES = [
    { id: "builtin", label: "系統內建" },
    { id: "neural", label: "神經模型（首次約 63MB×聲線）" }
  ];

  var VOICES = [
    { id: "female", label: "女聲" },
    { id: "male", label: "男聲" }
  ];

  var MODELS = {
    female: {
      id: "zh_CN-xiao_ya-medium",
      url: HF + "xiao_ya/medium/zh_CN-xiao_ya-medium.onnx"
    },
    male: {
      id: "zh_CN-chaowen-medium",
      url: HF + "chaowen/medium/zh_CN-chaowen-medium.onnx"
    }
  };

  var NEURAL_FALLBACK = "神經模型暫時無法使用，已改用系統內建。";

  var INITIALS = ["zh", "ch", "sh", "b", "p", "m", "f", "d", "t", "n", "l", "g", "k", "h", "j", "q", "x", "r", "z", "c", "s", "y", "w"];

  var PHONEME_ID = {
    "_": 0, "^": 1, "$": 2, "Ø": 3,
    "b": 4, "p": 5, "m": 6, "f": 7, "d": 8, "t": 9, "n": 10, "l": 11,
    "g": 12, "k": 13, "h": 14, "j": 15, "q": 16, "x": 17,
    "zh": 18, "ch": 19, "sh": 20, "r": 21, "z": 22, "c": 23, "s": 24, "y": 25, "w": 26,
    "a": 27, "o": 28, "e": 29, "ai": 30, "ei": 31, "ao": 32, "ou": 33,
    "an": 34, "en": 35, "ang": 36, "eng": 37, "ong": 38,
    "i": 39, "ia": 40, "ie": 41, "iao": 42, "iu": 43, "ian": 44, "in": 45, "iang": 46, "ing": 47, "iong": 48,
    "u": 49, "ua": 50, "uo": 51, "uai": 52, "ui": 53, "uan": 54, "un": 55, "uang": 56, "ueng": 57,
    "v": 58, "ve": 59, "van": 60, "vn": 61, "er": 62, "ue": 63,
    "1": 64, "2": 65, "3": 66, "4": 67, "5": 68
  };

  var sessions = {};
  var ortPromise = null;
  var generation = 0;
  var sharedCtx = null;
  var currentSource = null;
  var jobs = {};

  function speechRateOption(id) {
    var i;
    for (i = 0; i < SPEECH_RATE_OPTIONS.length; i++) {
      if (SPEECH_RATE_OPTIONS[i].id === id) return SPEECH_RATE_OPTIONS[i];
    }
    return null;
  }

  function clampSpeechRate(rate) {
    var n = Number(rate);
    if (!isFinite(n)) return 1;
    if (n < SPEECH_RATE_MIN) return SPEECH_RATE_MIN;
    if (n > SPEECH_RATE_MAX) return SPEECH_RATE_MAX;
    return n;
  }

  function rateById(id) {
    var option = speechRateOption(id) || speechRateOption("normal");
    return option.rate;
  }

  function lengthScaleForRate(rate) {
    return 1 / clampSpeechRate(rate);
  }

  function canonical(field, value) {
    if (field === "rate") return speechRateOption(value) ? value : "normal";
    if (field === "engine") return value === "neural" ? "neural" : "builtin";
    if (field === "voice") return value === "male" ? "male" : "female";
    return "";
  }

  function storageKey(field) {
    if (field === "rate") return SPEECH_RATE_KEY;
    if (field === "engine") return SPEECH_ENGINE_KEY;
    return SPEECH_VOICE_KEY;
  }

  function readField(storage, field) {
    try {
      if (!storage || typeof storage.getItem !== "function") return canonical(field, null);
      return canonical(field, storage.getItem(storageKey(field)));
    } catch (err) {
      return canonical(field, null);
    }
  }

  function readSpeechRateId(storage) {
    return readField(storage, "rate");
  }

  function readSpeechRate(storage) {
    return rateById(readSpeechRateId(storage));
  }

  function readPrefs(storage) {
    var rateId = readField(storage, "rate");
    var rate = rateById(rateId);
    return {
      rateId: rateId,
      rate: rate,
      engine: readField(storage, "engine"),
      voice: readField(storage, "voice"),
      lengthScale: lengthScaleForRate(rate)
    };
  }

  function writePref(storage, field, value) {
    var chosen = canonical(field, value);
    try {
      if (storage && typeof storage.setItem === "function") storage.setItem(storageKey(field), chosen);
    } catch (err) {}
    return chosen;
  }

  function normLang(lang) {
    return String(lang || "").toLowerCase().replace(/_/g, "-");
  }

  function isZhCN(lang) {
    var n = normLang(lang);
    return n === "zh-cn" || n.indexOf("zh-cn-") === 0 ||
      n === "cmn-cn" || n.indexOf("cmn-cn-") === 0 || n.indexOf("cmn-hans-cn") === 0;
  }

  function isZh(lang) {
    var n = normLang(lang);
    return n === "zh" || n.indexOf("zh-") === 0 || n.indexOf("cmn") === 0;
  }

  function hintedGender(voice) {
    var explicit = String(voice && (voice.gender || voice.voiceGender) || "").toLowerCase();
    if (explicit === "female" || explicit === "male") return explicit;
    var name = String(voice && voice.name || "").toLowerCase();
    if (/female|woman|女|xiaoxiao|xiaoyi|xiaomo|yaoyao|huihui|hanhan|tingting|ting-ting|sin-ji|sinji|meijia/.test(name)) return "female";
    if (/male|男|yunyang|yunxi|yunjian|yunye|kangkang/.test(name)) return "male";
    return "";
  }

  function chooseBuiltinVoice(list, gender) {
    var voices = list || [];
    var want = gender === "male" ? "male" : "female";
    function pick(pred) {
      var i;
      for (i = 0; i < voices.length; i++) {
        if (pred(voices[i])) return voices[i];
      }
      return null;
    }
    return pick(function (voice) { return isZhCN(voice.lang) && hintedGender(voice) === want; }) ||
      pick(function (voice) { return isZhCN(voice.lang); }) ||
      pick(function (voice) { return isZh(voice.lang) && hintedGender(voice) === want; }) ||
      pick(function (voice) { return isZh(voice.lang); }) ||
      null;
  }

  function syllableBase(initial, final) {
    var fin = String(final || "").replace(/ü/g, "v");
    var ini = String(initial || "");
    if (ini) return ini + fin;
    if (fin === "i" || fin === "in" || fin === "ing") return "y" + fin;
    if (fin === "iu") return "you";
    if (fin.charAt(0) === "i") return "y" + fin.slice(1);
    if (fin === "u") return "wu";
    if (fin === "ui") return "wei";
    if (fin === "un") return "wen";
    if (fin.charAt(0) === "u") return "w" + fin.slice(1);
    if (fin === "v") return "yv";
    if (fin === "ve") return "yve";
    if (fin === "vn") return "yvn";
    if (fin === "van") return "yvan";
    return fin;
  }

  function splitSyllable(base) {
    var ini = "";
    var i;
    for (i = 0; i < INITIALS.length; i++) {
      if (base.indexOf(INITIALS[i]) === 0) {
        ini = INITIALS[i];
        break;
      }
    }
    var fin = base.slice(ini.length);
    if (!fin || !Object.prototype.hasOwnProperty.call(PHONEME_ID, fin)) return null;
    if (!ini) ini = "Ø";
    if (!Object.prototype.hasOwnProperty.call(PHONEME_ID, ini)) return null;
    return { initial: ini, final: fin };
  }

  function phonemesForReading(reading) {
    if (!reading) return null;
    var tone = Number(reading.tone);
    if (tone !== 1 && tone !== 2 && tone !== 3 && tone !== 4) tone = 5;
    var parts = splitSyllable(syllableBase(reading.initial, reading.final));
    if (!parts) return null;
    return [parts.initial, parts.final, String(tone)];
  }

  function phonemesForReadings(readings) {
    if (!readings || !readings.length) return null;
    var all = [];
    var i;
    for (i = 0; i < readings.length; i++) {
      var one = phonemesForReading(readings[i]);
      if (!one) return null;
      all = all.concat(one);
    }
    return all;
  }

  function phonemesToIds(phonemes) {
    if (!phonemes || !phonemes.length) return null;
    var ids = [PHONEME_ID["^"]];
    var i;
    for (i = 0; i < phonemes.length; i++) {
      if (!Object.prototype.hasOwnProperty.call(PHONEME_ID, phonemes[i])) return null;
      ids.push(PHONEME_ID[phonemes[i]]);
      if (phonemes[i] === "1" || phonemes[i] === "2" || phonemes[i] === "3" || phonemes[i] === "4" || phonemes[i] === "5") {
        ids.push(PHONEME_ID._);
      }
    }
    ids.push(PHONEME_ID.$);
    return ids;
  }

  function progressText(label, loaded, total) {
    var name = label || "語音";
    if (!total) return "正在下載" + name + "模型…";
    var pct = Math.round((loaded / total) * 100);
    if (pct < 0) pct = 0;
    if (pct > 100) pct = 100;
    return "正在下載" + name + "模型… " + pct + "%";
  }

  function responseToBuffer(response) {
    if (!response || typeof response.arrayBuffer !== "function") return Promise.resolve(null);
    return response.arrayBuffer().then(function (buf) {
      return buf && buf.byteLength ? buf : null;
    });
  }

  function abortError() {
    var err = new Error("aborted");
    err.name = "AbortError";
    return err;
  }

  function isAbortError(err) {
    return !!(err && (err.name === "AbortError" || err.message === "aborted"));
  }

  function readBody(res, onProgress, signal) {
    var total = 0;
    try {
      total = Number(res.headers && res.headers.get && res.headers.get("content-length")) || 0;
    } catch (err) {
      total = 0;
    }
    if (signal && signal.aborted) return Promise.reject(abortError());
    if (!res.body || typeof res.body.getReader !== "function") {
      return res.arrayBuffer().then(function (buf) {
        if (signal && signal.aborted) throw abortError();
        if (onProgress) onProgress(buf.byteLength, total || buf.byteLength);
        return buf;
      });
    }
    var reader = res.body.getReader();
    if (signal && typeof signal.addEventListener === "function") {
      signal.addEventListener("abort", function () {
        try { reader.cancel(); } catch (err) {}
      });
    }
    var chunks = [];
    var received = 0;
    function pump() {
      if (signal && signal.aborted) return Promise.reject(abortError());
      return reader.read().then(function (step) {
        if (signal && signal.aborted) throw abortError();
        if (step.done) {
          var all = new Uint8Array(received);
          var offset = 0;
          chunks.forEach(function (chunk) {
            all.set(chunk, offset);
            offset += chunk.byteLength || chunk.length;
          });
          if (onProgress) onProgress(received, total || received);
          return all.buffer;
        }
        chunks.push(step.value);
        received += step.value.byteLength || step.value.length;
        if (onProgress) onProgress(received, total);
        return pump();
      });
    }
    return pump();
  }

  function idbStore(mode) {
    return new Promise(function (resolve, reject) {
      if (typeof indexedDB === "undefined") {
        resolve(null);
        return;
      }
      var open = indexedDB.open(IDB_NAME, 1);
      open.onupgradeneeded = function () {
        if (!open.result.objectStoreNames.contains(IDB_STORE)) open.result.createObjectStore(IDB_STORE);
      };
      open.onerror = function () { reject(open.error || new Error("無法使用本機模型儲存")); };
      open.onsuccess = function () {
        var db = open.result;
        var tx = db.transaction(IDB_STORE, mode);
        resolve({ db: db, store: tx.objectStore(IDB_STORE), tx: tx });
      };
    });
  }

  function idbGet(url) {
    return idbStore("readonly").then(function (opened) {
      if (!opened) return null;
      return new Promise(function (resolve, reject) {
        var req = opened.store.get(url);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error); };
      });
    }).catch(function () { return null; });
  }

  function idbPut(url, buffer) {
    return idbStore("readwrite").then(function (opened) {
      if (!opened) return buffer;
      return new Promise(function (resolve, reject) {
        var req = opened.store.put(buffer, url);
        req.onsuccess = function () { resolve(buffer); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function cacheGet(cache, url) {
    return Promise.resolve(cache.match(url)).then(responseToBuffer);
  }

  function cachePut(cache, url, buffer) {
    return Promise.resolve(cache.put(url, new Response(buffer.slice(0)))).then(function () {
      return buffer.slice(0);
    });
  }

  function loadModelBytes(url, opts) {
    opts = opts || {};
    var fetchFn = opts.fetch || (typeof fetch === "function" ? fetch : null);
    function fromCache() {
      if (opts.cache && typeof opts.cache.match === "function") return cacheGet(opts.cache, url);
      if (typeof caches !== "undefined" && caches && typeof caches.open === "function") {
        return caches.open(MODEL_CACHE).then(function (cache) { return cacheGet(cache, url); }).catch(function () { return null; });
      }
      return idbGet(url);
    }
    function save(buffer) {
      if (opts.cache && typeof opts.cache.put === "function") return cachePut(opts.cache, url, buffer);
      if (typeof caches !== "undefined" && caches && typeof caches.open === "function") {
        return caches.open(MODEL_CACHE).then(function (cache) { return cachePut(cache, url, buffer); }).catch(function () { return idbPut(url, buffer); });
      }
      return idbPut(url, buffer);
    }
    return fromCache().then(function (cached) {
      if (opts.signal && opts.signal.aborted) return Promise.reject(abortError());
      if (cached && cached.byteLength) return cached;
      if (typeof fetchFn !== "function") throw new Error("無法下載語音模型");
      var fetchOpts = opts.signal ? { signal: opts.signal } : {};
      return fetchFn(url, fetchOpts).then(function (res) {
        if (opts.signal && opts.signal.aborted) return Promise.reject(abortError());
        if (!res || !res.ok) throw new Error("無法下載語音模型");
        return readBody(res, opts.onProgress, opts.signal);
      }).then(function (buf) {
        if (opts.signal && opts.signal.aborted) return Promise.reject(abortError());
        return save(buf);
      });
    });
  }

  function configureOrt(runtime) {
    runtime.env.wasm.wasmPaths = ORT_WASM;
    runtime.env.wasm.numThreads = 1;
    runtime.env.wasm.proxy = false;
  }

  function loadOrt() {
    if (typeof ort !== "undefined" && ort && ort.InferenceSession) {
      try { configureOrt(ort); } catch (err) {}
      return Promise.resolve(ort);
    }
    if (ortPromise) return ortPromise;
    ortPromise = new Promise(function (resolve, reject) {
      if (typeof document === "undefined") {
        reject(new Error("ONNX Runtime 需要瀏覽器"));
        return;
      }
      var script = document.createElement("script");
      script.src = ORT_JS;
      script.async = true;
      script.onload = function () {
        if (typeof ort === "undefined" || !ort.InferenceSession) {
          reject(new Error("ONNX Runtime 沒有載入"));
          return;
        }
        try { configureOrt(ort); } catch (err) {}
        resolve(ort);
      };
      script.onerror = function () { reject(new Error("ONNX Runtime 沒有載入")); };
      document.head.appendChild(script);
    });
    return ortPromise;
  }

  function sessionFor(voiceId, bytes) {
    if (sessions[voiceId]) return sessions[voiceId];
    sessions[voiceId] = loadOrt().then(function (runtime) {
      // onnxruntime-web 1.18 的預設圖最佳化會讓這兩個 Piper 模型的 create() 一直不回來。
      return runtime.InferenceSession.create(bytes, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "disabled"
      });
    }).catch(function (err) {
      delete sessions[voiceId];
      throw err;
    });
    return sessions[voiceId];
  }

  function infer(session, ids, lengthScale) {
    var runtime = ort;
    var idData = new BigInt64Array(ids.length);
    var i;
    for (i = 0; i < ids.length; i++) idData[i] = BigInt(ids[i]);
    var feeds = {};
    var names = session.inputNames || ["input", "input_lengths", "scales"];
    names.forEach(function (name) {
      if (name === "input") feeds.input = new runtime.Tensor("int64", idData, [1, ids.length]);
      else if (name === "input_lengths" || name === "input_length") {
        feeds[name] = new runtime.Tensor("int64", BigInt64Array.from([BigInt(ids.length)]), [1]);
      } else if (name === "scales") {
        feeds.scales = new runtime.Tensor("float32", Float32Array.from([0.667, lengthScale, 0.8]), [3]);
      } else if (name === "sid") {
        feeds.sid = new runtime.Tensor("int64", BigInt64Array.from([0]), [1]);
      }
    });
    if (!feeds.input) feeds.input = new runtime.Tensor("int64", idData, [1, ids.length]);
    return session.run(feeds).then(function (out) {
      var key = session.outputNames && session.outputNames[0];
      var tensor = key && out[key] ? out[key] : out[Object.keys(out)[0]];
      if (!tensor || !tensor.data || !tensor.data.length) throw new Error("模型沒有聲音");
      if (tensor.data instanceof Float32Array) return tensor.data;
      return Float32Array.from(tensor.data);
    });
  }

  function playSamples(samples, sampleRate) {
    var AC = typeof AudioContext !== "undefined" ? AudioContext : root.webkitAudioContext;
    if (typeof AC !== "function") return Promise.reject(new Error("這個瀏覽器不能播放神經語音"));
    if (!sharedCtx) sharedCtx = new AC();
    var resumePromise = sharedCtx.state === "suspended" && typeof sharedCtx.resume === "function" ? sharedCtx.resume() : Promise.resolve();
    var ready = Promise.race([
      Promise.resolve(resumePromise).catch(function () {}),
      new Promise(function (resolve) { setTimeout(resolve, 400); })
    ]);
    return ready.then(function () {
      if (currentSource) {
        try { currentSource.stop(); } catch (err) {}
        currentSource = null;
      }
      var buffer = sharedCtx.createBuffer(1, samples.length, sampleRate);
      buffer.getChannelData(0).set(samples);
      var src = sharedCtx.createBufferSource();
      src.buffer = buffer;
      src.connect(sharedCtx.destination);
      currentSource = src;
      src.start();
      return true;
    });
  }

  function cancel() {
    generation += 1;
    if (currentSource) {
      try { currentSource.stop(); } catch (err) {}
      currentSource = null;
    }
  }

  function voiceKey(voice) {
    return voice === "male" ? "male" : "female";
  }

  function jobOf(voice) {
    var key = voiceKey(voice);
    if (!jobs[key]) {
      jobs[key] = {
        voice: key,
        state: "idle",
        loaded: 0,
        total: 0,
        bytes: null,
        controller: null,
        listeners: [],
        promise: null
      };
    }
    return jobs[key];
  }

  function snapshot(job) {
    return {
      voice: job.voice,
      state: job.state,
      loaded: job.loaded || 0,
      total: job.total || 0
    };
  }

  function emit(job) {
    var snap = snapshot(job);
    job.listeners.slice().forEach(function (fn) {
      try { fn(snap); } catch (err) {}
    });
  }

  function downloadState(voice) {
    var job = jobs[voiceKey(voice)];
    if (!job) return { voice: voiceKey(voice), state: "idle", loaded: 0, total: 0 };
    return snapshot(job);
  }

  function watchDownload(voice, fn) {
    var job = jobOf(voice);
    job.listeners.push(fn);
    try { fn(snapshot(job)); } catch (err) {}
    return function () {
      var index = job.listeners.indexOf(fn);
      if (index >= 0) job.listeners.splice(index, 1);
    };
  }

  function isModelReady(voice) {
    var job = jobs[voiceKey(voice)];
    return !!(job && job.state === "ready");
  }

  function readyBytes(voice) {
    var job = jobs[voiceKey(voice)];
    if (job && job.state === "ready" && job.bytes) return job.bytes;
    return null;
  }

  function markVoiceReady(voice) {
    var job = jobOf(voice);
    job.state = "ready";
    job.bytes = job.bytes || new Uint8Array([1]).buffer;
    job.loaded = job.bytes.byteLength || 1;
    job.total = job.loaded;
    emit(job);
    return true;
  }

  function resetDownloads() {
    Object.keys(jobs).forEach(function (key) {
      var job = jobs[key];
      job.state = "cancelled";
      if (job.controller) {
        try { job.controller.abort(); } catch (err) {}
        job.controller = null;
      }
      job.listeners = [];
    });
    jobs = {};
  }

  function prefetchVoice(voice, opts) {
    opts = opts || {};
    var key = voiceKey(voice);
    var job = jobOf(key);
    if (job.state === "loading" || job.state === "ready") return job.promise || Promise.resolve(job.bytes);
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    job.state = "loading";
    job.loaded = 0;
    job.total = 0;
    job.bytes = null;
    job.controller = controller;
    emit(job);
    job.promise = loadModelBytes(MODELS[key].url, {
      cache: opts.cache,
      fetch: opts.fetch,
      signal: controller ? controller.signal : null,
      onProgress: function (loaded, total) {
        if (job.state !== "loading") return;
        job.loaded = loaded;
        job.total = total;
        emit(job);
      }
    }).then(function (bytes) {
      if (job.state !== "loading") return null;
      job.state = "ready";
      job.bytes = bytes;
      job.loaded = bytes && bytes.byteLength ? bytes.byteLength : job.loaded;
      job.total = job.loaded;
      job.controller = null;
      emit(job);
      return bytes;
    }).catch(function (err) {
      if (job.state === "cancelled" || isAbortError(err)) {
        if (job.state !== "cancelled") job.state = "cancelled";
        job.controller = null;
        emit(job);
        return null;
      }
      job.state = "error";
      job.controller = null;
      emit(job);
      return null;
    });
    return job.promise;
  }

  function warmupVoice(voice, opts) {
    var job = jobOf(voice);
    if (job.state === "loading" || job.state === "ready" || job.state === "cancelled") {
      return job.promise || Promise.resolve(job.bytes);
    }
    return prefetchVoice(voice, opts);
  }

  function cancelDownload(voice) {
    var job = jobs[voiceKey(voice)];
    if (!job || job.state !== "loading") return downloadState(voice);
    job.state = "cancelled";
    var controller = job.controller;
    job.controller = null;
    if (controller) {
      try { controller.abort(); } catch (err) {}
    }
    emit(job);
    return downloadState(voice);
  }

  function mountDownloadBar(parent, onChange) {
    var stops = [];
    var docRef = typeof document !== "undefined" ? document : null;
    if (!docRef || !parent || typeof docRef.createElement !== "function") {
      return function () {};
    }
    ["female", "male"].forEach(function (voice) {
      var job = downloadState(voice);
      if (job.state !== "loading" && job.state !== "error") return;
      var label = voice === "male" ? "男聲" : "女聲";
      var row = docRef.createElement("div");
      row.className = "piper-download";
      var text = docRef.createElement("p");
      text.className = "hint";
      text.setAttribute("role", "status");
      if (job.state === "error") {
        text.textContent = label + "模型下載失敗，朗讀先用系統內建。";
        row.appendChild(text);
      } else {
        text.textContent = progressText(label, job.loaded, job.total);
        var cancelBtn = docRef.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "secondary";
        cancelBtn.id = "piper-cancel-" + voice;
        cancelBtn.textContent = "取消下載";
        cancelBtn.addEventListener("click", function () {
          cancelDownload(voice);
        });
        row.append(text, cancelBtn);
        stops.push(watchDownload(voice, function (next) {
          if (next.state === "loading") {
            text.textContent = progressText(label, next.loaded, next.total);
            return;
          }
          if (typeof onChange === "function") onChange(next);
        }));
      }
      parent.appendChild(row);
    });
    return function () {
      stops.forEach(function (stop) { stop(); });
      stops = [];
    };
  }

  function speakNeural(options) {
    options = options || {};
    var voice = options.voice === "male" ? "male" : "female";
    var model = MODELS[voice];
    var phonemes = options.phonemes;
    var ids = phonemesToIds(phonemes);
    if (!ids) return Promise.reject(new Error("無法標音"));
    var gen = generation;
    var label = voice === "male" ? "男聲" : "女聲";
    var prepared = readyBytes(voice);
    var modelPromise = prepared ? Promise.resolve(prepared) : loadModelBytes(model.url, {
      cache: options.cache,
      fetch: options.fetch,
      onProgress: function (loaded, total) {
        if (typeof options.onProgress === "function") options.onProgress(loaded, total, label);
      }
    });
    return modelPromise.then(function (bytes) {
      if (gen !== generation) return false;
      if (typeof options.onStatus === "function") options.onStatus("正在準備" + label + "模型…");
      return sessionFor(voice, bytes);
    }).then(function (session) {
      if (session === false || gen !== generation) return false;
      return infer(session, ids, options.lengthScale || 1);
    }).then(function (samples) {
      if (samples === false || gen !== generation) return false;
      return playSamples(samples, SAMPLE_RATE);
    });
  }

  return {
    speechRateKey: SPEECH_RATE_KEY,
    speechEngineKey: SPEECH_ENGINE_KEY,
    speechVoiceKey: SPEECH_VOICE_KEY,
    speechRateOptions: SPEECH_RATE_OPTIONS,
    engines: ENGINES,
    voices: VOICES,
    models: MODELS,
    sampleRate: SAMPLE_RATE,
    ortScript: ORT_JS,
    ortWasm: ORT_WASM,
    neuralFallback: NEURAL_FALLBACK,
    modelCacheName: MODEL_CACHE,
    clampSpeechRate: clampSpeechRate,
    rateById: rateById,
    lengthScaleForRate: lengthScaleForRate,
    readSpeechRateId: readSpeechRateId,
    readSpeechRate: readSpeechRate,
    readPrefs: readPrefs,
    writePref: writePref,
    chooseBuiltinVoice: chooseBuiltinVoice,
    phonemesForReading: phonemesForReading,
    phonemesForReadings: phonemesForReadings,
    phonemesToIds: phonemesToIds,
    progressText: progressText,
    loadModelBytes: loadModelBytes,
    speakNeural: speakNeural,
    cancel: cancel,
    prefetchVoice: prefetchVoice,
    warmupVoice: warmupVoice,
    cancelDownload: cancelDownload,
    downloadState: downloadState,
    isModelReady: isModelReady,
    markVoiceReady: markVoiceReady,
    resetDownloads: resetDownloads,
    mountDownloadBar: mountDownloadBar
  };
});
