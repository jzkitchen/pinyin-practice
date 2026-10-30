/* 詞組、字詞、練習紀錄。
 * local：localStorage。api：REST（見 worker/）。
 * 兩種後端都用同一份資料形狀。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.PinyinCloud = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var STORAGE_KEY = "pinyin-practice.v1";
  var ctx = {
    config: null,
    grade: null,
    tables: null,
    storage: null
  };

  function init(config, extras) {
    extras = extras || {};
    ctx.config = config;
    ctx.grade = extras.grade || rootGrade();
    ctx.tables = extras.tables || null;
    ctx.storage = extras.storage || rootStorage();
    return api;
  }

  function rootGrade() {
    return typeof PinyinGrade !== "undefined" ? PinyinGrade : null;
  }

  function rootStorage() {
    try {
      if (typeof localStorage !== "undefined") return localStorage;
    } catch (err) { /* private mode */ }
    return null;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function uid(prefix) {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function emptyDb() {
    return { version: 1, seeded: false, sets: [], words: [], sessions: [] };
  }

  function readDb() {
    if (!ctx.storage) throw new Error("這台裝置無法使用本機儲存");
    var raw = ctx.storage.getItem(STORAGE_KEY);
    if (!raw) return emptyDb();
    try {
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.sets) || !Array.isArray(parsed.words)) return emptyDb();
      parsed.sessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
      parsed.seeded = !!parsed.seeded;
      return parsed;
    } catch (err) {
      return emptyDb();
    }
  }

  function writeDb(db) {
    try {
      ctx.storage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch (err) {
      throw new Error("無法寫入本機儲存");
    }
  }

  function isApi() {
    return ctx.config && ctx.config.storage === "api";
  }

  function adminSha() {
    try {
      return sessionStorage.getItem("pinyinAdminSha") || "";
    } catch (err) {
      return "";
    }
  }

  function apiJSON(method, path, body, auth) {
    var base = String(ctx.config.apiBase || "").replace(/\/$/, "");
    if (!base) return Promise.reject(new Error("尚未設定 apiBase"));
    var headers = { "Accept": "application/json" };
    if (body != null) headers["Content-Type"] = "application/json";
    if (auth) {
      var sha = adminSha();
      if (sha) headers["X-Admin-Password-Sha256"] = sha;
    }
    return fetch(base + path, {
      method: method,
      headers: headers,
      body: body != null ? JSON.stringify(body) : undefined
    }).then(function (res) {
      return res.text().then(function (text) {
        var payload = text ? JSON.parse(text) : null;
        if (!res.ok) {
          var msg = payload && payload.error ? payload.error : "無法連線到伺服器";
          throw new Error(msg);
        }
        return payload;
      });
    });
  }

  function seedStamp(index) {
    return new Date(Date.UTC(2026, 9, 30, 0, 0, 0, index)).toISOString();
  }

  function demoBundle() {
    if (!ctx.tables || !ctx.tables.seed_words) throw new Error("拼音資料尚未載入");
    if (!ctx.grade) throw new Error("判定模組尚未載入");
    var setId = ctx.config.demoSetId;
    var stamp = seedStamp(0);
    var set = {
      id: setId,
      name: ctx.config.demoSetName,
      createdAt: stamp,
      updatedAt: stamp
    };
    var words = ctx.tables.seed_words.map(function (seed, index) {
      var word = ctx.grade.mapSeedWord(seed, setId);
      if (!word) throw new Error("種子詞拆音失敗：" + seed.han);
      var at = seedStamp(index);
      word.createdAt = at;
      word.updatedAt = at;
      return word;
    });
    return { set: set, words: words };
  }

  function sortByTime(list) {
    return list.slice().sort(function (a, b) {
      return String(a.createdAt).localeCompare(String(b.createdAt));
    });
  }

  function listSets() {
    if (isApi()) return apiJSON("GET", "/api/sets");
    return Promise.resolve(sortByTime(readDb().sets));
  }

  function listWords(setId) {
    if (isApi()) return apiJSON("GET", "/api/words?setId=" + encodeURIComponent(setId));
    var words = readDb().words.filter(function (word) { return word.setId === setId; });
    return Promise.resolve(sortByTime(words));
  }

  function listSessions() {
    if (isApi()) return apiJSON("GET", "/api/sessions");
    var sessions = readDb().sessions.slice().sort(function (a, b) {
      return String(b.startedAt).localeCompare(String(a.startedAt));
    });
    return Promise.resolve(sessions);
  }

  function createSet(name) {
    var trimmed = String(name || "").trim();
    if (!trimmed) return Promise.reject(new Error("請填詞組名稱"));
    if (isApi()) return apiJSON("POST", "/api/sets", { name: trimmed }, true);
    var db = readDb();
    var at = nowIso();
    var set = { id: uid("set"), name: trimmed, createdAt: at, updatedAt: at };
    db.sets.push(set);
    writeDb(db);
    return Promise.resolve(clone(set));
  }

  function updateSet(id, patch) {
    var trimmed = String(patch && patch.name || "").trim();
    if (!trimmed) return Promise.reject(new Error("請填詞組名稱"));
    if (isApi()) return apiJSON("PATCH", "/api/sets/" + encodeURIComponent(id), { name: trimmed }, true);
    var db = readDb();
    var set = db.sets.find(function (item) { return item.id === id; });
    if (!set) return Promise.reject(new Error("找不到詞組"));
    set.name = trimmed;
    set.updatedAt = nowIso();
    writeDb(db);
    return Promise.resolve(clone(set));
  }

  function deleteSet(id) {
    if (isApi()) return apiJSON("DELETE", "/api/sets/" + encodeURIComponent(id), null, true);
    var db = readDb();
    db.sets = db.sets.filter(function (item) { return item.id !== id; });
    db.words = db.words.filter(function (item) { return item.setId !== id; });
    writeDb(db);
    return Promise.resolve({ ok: true });
  }

  function normalizeWord(input, previous) {
    var hanzi = String(input.hanzi || "").trim();
    var pinyin = String(input.pinyin || "").trim();
    if (!hanzi) throw new Error("請填漢字");
    if (!pinyin) throw new Error("請填帶調拼音");
    if (!input.setId) throw new Error("請先選擇詞組");
    var tones = input.tones;
    if (!Array.isArray(tones) || !tones.length) throw new Error("請填聲調");
    var accept = (input.accept || []).map(function (item) { return String(item || "").trim(); }).filter(Boolean);
    if (!accept.length) throw new Error("請至少填一個可接受讀音");
    var readings = input.readings;
    if (!Array.isArray(readings) || readings.length !== tones.length) throw new Error("拼音與聲調無法對上");
    var at = nowIso();
    return {
      id: (previous && previous.id) || input.id || uid("word"),
      setId: input.setId,
      hanzi: hanzi,
      pinyin: pinyin,
      tones: tones.slice(),
      accept: accept,
      readings: readings.map(function (reading) {
        return { initial: reading.initial || "", final: reading.final || "", tone: reading.tone };
      }),
      note: String(input.note || "").trim(),
      createdAt: (previous && previous.createdAt) || input.createdAt || at,
      updatedAt: at
    };
  }

  function createWord(input) {
    var word;
    try { word = normalizeWord(input, null); }
    catch (err) { return Promise.reject(err); }
    if (isApi()) return apiJSON("POST", "/api/words", word, true);
    var db = readDb();
    if (!db.sets.some(function (set) { return set.id === word.setId; })) {
      return Promise.reject(new Error("找不到詞組"));
    }
    db.words.push(word);
    writeDb(db);
    return Promise.resolve(clone(word));
  }

  function updateWord(id, input) {
    if (isApi()) {
      var word;
      try { word = normalizeWord(Object.assign({}, input, { id: id }), { id: id, createdAt: input.createdAt }); }
      catch (err) { return Promise.reject(err); }
      return apiJSON("PATCH", "/api/words/" + encodeURIComponent(id), word, true);
    }
    var db = readDb();
    var index = db.words.findIndex(function (item) { return item.id === id; });
    if (index < 0) return Promise.reject(new Error("找不到字詞"));
    var next;
    try { next = normalizeWord(Object.assign({}, input, { id: id }), db.words[index]); }
    catch (err) { return Promise.reject(err); }
    db.words[index] = next;
    writeDb(db);
    return Promise.resolve(clone(next));
  }

  function deleteWord(id) {
    if (isApi()) return apiJSON("DELETE", "/api/words/" + encodeURIComponent(id), null, true);
    var db = readDb();
    db.words = db.words.filter(function (item) { return item.id !== id; });
    writeDb(db);
    return Promise.resolve({ ok: true });
  }

  function createSession(input) {
    var session = {
      id: input.id || uid("session"),
      startedAt: input.startedAt || nowIso(),
      durationMs: Number(input.durationMs) || 0,
      mode: input.mode,
      setId: input.setId,
      total: Number(input.total) || 0,
      correct: Number(input.correct) || 0
    };
    if (!session.mode || !session.setId) return Promise.reject(new Error("練習紀錄不完整"));
    if (isApi()) return apiJSON("POST", "/api/sessions", session, false);
    var db = readDb();
    db.sessions.push(session);
    writeDb(db);
    return Promise.resolve(clone(session));
  }

  function seedIfEmpty() {
    if (isApi()) return listSets();
    var db = readDb();
    if (db.seeded) return Promise.resolve(sortByTime(db.sets));
    var bundle = demoBundle();
    db.sets.push(bundle.set);
    db.words = db.words.concat(bundle.words);
    db.seeded = true;
    writeDb(db);
    return Promise.resolve(sortByTime(db.sets));
  }

  function importDemoSet() {
    var bundle = demoBundle();
    if (isApi()) return apiJSON("POST", "/api/seed", bundle, true);
    var db = readDb();
    if (db.sets.some(function (set) { return set.id === bundle.set.id; })) {
      return Promise.resolve({ created: false });
    }
    db.sets.push(bundle.set);
    db.words = db.words.concat(bundle.words);
    db.seeded = true;
    writeDb(db);
    return Promise.resolve({ created: true });
  }

  var api = {
    init: init,
    listSets: listSets,
    listWords: listWords,
    listSessions: listSessions,
    createSet: createSet,
    updateSet: updateSet,
    deleteSet: deleteSet,
    createWord: createWord,
    updateWord: updateWord,
    deleteWord: deleteWord,
    createSession: createSession,
    seedIfEmpty: seedIfEmpty,
    importDemoSet: importDemoSet,
    storageKey: STORAGE_KEY
  };

  return api;
});
