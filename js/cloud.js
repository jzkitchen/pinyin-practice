/* 詞組、字詞、練習紀錄。
 * local：localStorage，給測試和離線開發。
 * firebase：Firestore 集合 sets、words、sessions。練習頁不登入。
 * 家長寫入靠 Firebase Auth，前端不存放預期密碼。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.PinyinCloud = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var STORAGE_KEY = "pinyin-practice.v1";
  var SDK = "https://www.gstatic.com/firebasejs/10.14.1/";
  var ctx = {
    config: null,
    grade: null,
    tables: null,
    storage: null,
    db: null,
    auth: null,
    firebaseConfig: null,
    firebaseReady: false
  };

  function init(config, extras) {
    extras = extras || {};
    ctx.config = config;
    ctx.grade = extras.grade || rootGrade();
    ctx.tables = extras.tables || null;
    ctx.storage = extras.storage || rootStorage();
    ctx.db = extras.firestore || null;
    ctx.auth = extras.auth || null;
    ctx.firebaseConfig = extras.firebaseConfig || null;
    ctx.firebaseReady = !!extras.firestore;
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

  function isFirebase() {
    return ctx.config && ctx.config.storage === "firebase";
  }

  function readFirebaseConfig() {
    if (ctx.firebaseConfig) return ctx.firebaseConfig;
    if (typeof FIREBASE_CONFIG !== "undefined") return FIREBASE_CONFIG;
    return null;
  }

  function liveConfig(cfg) {
    if (!cfg) return false;
    var projectId = String(cfg.projectId || "").trim();
    var apiKey = String(cfg.apiKey || "").trim();
    if (!projectId || !apiKey) return false;
    if (projectId === "TODO" || apiKey === "TODO") return false;
    if (projectId.indexOf("TODO") === 0 || apiKey.indexOf("TODO") === 0) return false;
    return true;
  }

  function firebaseConfigured() {
    if (ctx.firebaseReady && ctx.db) return true;
    return liveConfig(readFirebaseConfig());
  }

  function bundledDemo() {
    return isFirebase() && !firebaseConfigured();
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src="' + src + '"]');
      if (existing && existing.getAttribute("data-loaded") === "1") return resolve();
      if (existing) {
        existing.addEventListener("load", function () { resolve(); });
        existing.addEventListener("error", function () { reject(new Error("無法載入雲端")); });
        return;
      }
      var script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.onload = function () {
        script.setAttribute("data-loaded", "1");
        resolve();
      };
      script.onerror = function () { reject(new Error("無法載入雲端")); };
      document.head.appendChild(script);
    });
  }

  function connect(options) {
    options = options || {};
    if (!isFirebase()) return Promise.resolve(false);
    if (ctx.db && (!options.auth || ctx.auth)) return Promise.resolve(true);
    if (!firebaseConfigured()) return Promise.resolve(false);
    if (typeof document === "undefined") return Promise.reject(new Error("雲端尚未設定"));
    var chain = loadScript(SDK + "firebase-app-compat.js")
      .then(function () { return loadScript(SDK + "firebase-firestore-compat.js"); });
    if (options.auth) {
      chain = chain.then(function () { return loadScript(SDK + "firebase-auth-compat.js"); });
    }
    return chain.then(function () {
      var cfg = readFirebaseConfig();
      if (typeof firebase === "undefined") throw new Error("無法載入雲端");
      if (!firebase.apps.length) firebase.initializeApp(cfg);
      ctx.db = firebase.firestore();
      if (options.auth) ctx.auth = firebase.auth();
      ctx.firebaseReady = true;
      return true;
    });
  }

  function needCloud() {
    if (!isFirebase() || !firebaseConfigured()) return Promise.reject(new Error("雲端尚未設定"));
    return connect().then(function () {
      if (!ctx.db) throw new Error("雲端尚未設定");
    });
  }

  function asCloud(promise) {
    return Promise.resolve(promise).catch(function (err) {
      var code = err && err.code;
      if (code === "permission-denied" || code === "unauthenticated") {
        var denied = new Error("雲端拒絕存取。請確認已部署 Firestore 規則，而且家長已登入。");
        denied.code = code;
        throw denied;
      }
      throw err;
    });
  }

  function fromDoc(doc) {
    var data = (doc && doc.data && doc.data()) || {};
    var copy = Object.assign({}, data);
    copy.id = doc.id;
    return copy;
  }

  function authMessage(err) {
    var code = err && err.code;
    if (code === "auth/wrong-password" || code === "auth/invalid-credential" || code === "auth/user-not-found" || code === "auth/invalid-login-credentials") {
      return "電郵或密碼不正確。";
    }
    if (code === "auth/invalid-email") return "請輸入有效的電郵。";
    if (code === "auth/too-many-requests") return "嘗試太多次，請稍後再來。";
    if (code === "auth/network-request-failed") return "無法連線到雲端。";
    if (code === "auth/weak-password") return "密碼至少 6 個字元。";
    if (code === "auth/requires-recent-login") return "請先登出再登入，然後更改密碼。";
    return (err && err.message) || "無法登入。";
  }

  function signIn(email, password) {
    email = String(email || "").trim();
    if (!email || !password) return Promise.reject(new Error("請輸入電郵和密碼"));
    if (!isFirebase() || !firebaseConfigured()) return Promise.reject(new Error("雲端尚未設定"));
    return connect({ auth: true }).then(function () {
      if (!ctx.auth || typeof ctx.auth.signInWithEmailAndPassword !== "function") {
        return Promise.reject(new Error("雲端尚未設定"));
      }
      return ctx.auth.signInWithEmailAndPassword(email, password).then(function (cred) {
        var user = cred && cred.user ? cred.user : {};
        return { email: user.email || email, uid: user.uid || "" };
      }).catch(function (err) {
        var mapped = new Error(authMessage(err));
        mapped.code = err && err.code;
        throw mapped;
      });
    });
  }

  function signOut() {
    if (ctx.auth && typeof ctx.auth.signOut === "function") return ctx.auth.signOut();
    return Promise.resolve();
  }

  function currentUser() {
    if (!ctx.auth) return Promise.resolve(null);
    if (ctx.auth.currentUser) return Promise.resolve(ctx.auth.currentUser);
    if (typeof ctx.auth.onAuthStateChanged !== "function") return Promise.resolve(null);
    return new Promise(function (resolve) {
      var unsub = ctx.auth.onAuthStateChanged(function (user) {
        if (typeof unsub === "function") unsub();
        resolve(user || null);
      });
    });
  }

  function changePassword(nextPassword) {
    var next = String(nextPassword || "");
    if (next.length < 6) return Promise.reject(new Error("密碼至少 6 個字元"));
    return connect({ auth: true }).then(function () {
      var user = ctx.auth && ctx.auth.currentUser;
      if (!user || typeof user.updatePassword !== "function") return Promise.reject(new Error("請先登入"));
      return user.updatePassword(next).catch(function (err) {
        var mapped = new Error(authMessage(err));
        mapped.code = err && err.code;
        throw mapped;
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

  function demoCatalog() {
    var bundle = demoBundle();
    return { set: clone(bundle.set), words: clone(bundle.words) };
  }

  function sortByTime(list) {
    return list.slice().sort(function (a, b) {
      return String(a.createdAt).localeCompare(String(b.createdAt));
    });
  }

  function sortSessions(list) {
    return list.slice().sort(function (a, b) {
      return String(b.startedAt).localeCompare(String(a.startedAt));
    });
  }

  function listSets() {
    if (!isFirebase()) return Promise.resolve(sortByTime(readDb().sets));
    if (!firebaseConfigured()) return Promise.resolve(sortByTime([demoBundle().set]));
    return asCloud(needCloud().then(function () {
      return ctx.db.collection("sets").get();
    }).then(function (snap) {
      return sortByTime((snap.docs || []).map(fromDoc));
    }));
  }

  function listWords(setId) {
    if (!isFirebase()) {
      var words = readDb().words.filter(function (word) { return word.setId === setId; });
      return Promise.resolve(sortByTime(words));
    }
    if (!firebaseConfigured()) {
      var bundle = demoBundle();
      if (setId !== bundle.set.id) return Promise.resolve([]);
      return Promise.resolve(bundle.words.slice());
    }
    return asCloud(needCloud().then(function () {
      return ctx.db.collection("words").where("setId", "==", setId).get();
    }).then(function (snap) {
      return sortByTime((snap.docs || []).map(fromDoc));
    }));
  }

  function listSessions() {
    if (!isFirebase()) {
      return Promise.resolve(sortSessions(readDb().sessions));
    }
    if (!firebaseConfigured()) return Promise.resolve([]);
    return asCloud(needCloud().then(function () {
      return ctx.db.collection("sessions").get();
    }).then(function (snap) {
      return sortSessions((snap.docs || []).map(fromDoc));
    }));
  }

  function createSet(name) {
    var trimmed = String(name || "").trim();
    if (!trimmed) return Promise.reject(new Error("請填詞組名稱"));
    if (isFirebase()) {
      return asCloud(needCloud().then(function () {
        var at = nowIso();
        var set = { id: uid("set"), name: trimmed, createdAt: at, updatedAt: at };
        return ctx.db.collection("sets").doc(set.id).set(set).then(function () {
          return clone(set);
        });
      }));
    }
    var db = readDb();
    var atLocal = nowIso();
    var localSet = { id: uid("set"), name: trimmed, createdAt: atLocal, updatedAt: atLocal };
    db.sets.push(localSet);
    writeDb(db);
    return Promise.resolve(clone(localSet));
  }

  function updateSet(id, patch) {
    var trimmed = String(patch && patch.name || "").trim();
    if (!trimmed) return Promise.reject(new Error("請填詞組名稱"));
    if (isFirebase()) {
      return asCloud(needCloud().then(function () {
        return ctx.db.collection("sets").doc(id).get();
      }).then(function (snap) {
        if (!snap.exists) throw new Error("找不到詞組");
        var prev = fromDoc(snap);
        var next = { id: id, name: trimmed, createdAt: prev.createdAt, updatedAt: nowIso() };
        return ctx.db.collection("sets").doc(id).set(next).then(function () { return clone(next); });
      }));
    }
    var db = readDb();
    var set = db.sets.find(function (item) { return item.id === id; });
    if (!set) return Promise.reject(new Error("找不到詞組"));
    set.name = trimmed;
    set.updatedAt = nowIso();
    writeDb(db);
    return Promise.resolve(clone(set));
  }

  function deleteSet(id) {
    if (isFirebase()) {
      return asCloud(needCloud().then(function () {
        return ctx.db.collection("words").where("setId", "==", id).get();
      }).then(function (snap) {
        var docs = snap.docs || [];
        return docs.reduce(function (chain, doc) {
          return chain.then(function () {
            return ctx.db.collection("words").doc(doc.id).delete();
          });
        }, Promise.resolve());
      }).then(function () {
        return ctx.db.collection("sets").doc(id).delete();
      }).then(function () { return { ok: true }; }));
    }
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
    if (isFirebase()) {
      return asCloud(needCloud().then(function () {
        return ctx.db.collection("sets").doc(word.setId).get();
      }).then(function (snap) {
        if (!snap.exists) throw new Error("找不到詞組");
        return ctx.db.collection("words").doc(word.id).set(word);
      }).then(function () { return clone(word); }));
    }
    var db = readDb();
    if (!db.sets.some(function (set) { return set.id === word.setId; })) {
      return Promise.reject(new Error("找不到詞組"));
    }
    db.words.push(word);
    writeDb(db);
    return Promise.resolve(clone(word));
  }

  function updateWord(id, input) {
    if (isFirebase()) {
      var word;
      try { word = normalizeWord(Object.assign({}, input, { id: id }), { id: id, createdAt: input.createdAt }); }
      catch (err) { return Promise.reject(err); }
      return asCloud(needCloud().then(function () {
        return ctx.db.collection("words").doc(id).set(word);
      }).then(function () { return clone(word); }));
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
    if (isFirebase()) {
      return asCloud(needCloud().then(function () {
        return ctx.db.collection("words").doc(id).delete();
      }).then(function () { return { ok: true }; }));
    }
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
    if (isFirebase()) {
      if (!firebaseConfigured()) return Promise.resolve(clone(session));
      return asCloud(needCloud().then(function () {
        return ctx.db.collection("sessions").doc(session.id).set(session);
      }).then(function () { return clone(session); }));
    }
    var db = readDb();
    db.sessions.push(session);
    writeDb(db);
    return Promise.resolve(clone(session));
  }

  function seedIfEmpty() {
    if (isFirebase()) {
      if (!firebaseConfigured()) return Promise.resolve(sortByTime([demoBundle().set]));
      return listSets();
    }
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
    if (isFirebase()) {
      return asCloud(needCloud().then(function () {
        return ctx.db.collection("sets").doc(bundle.set.id).get();
      }).then(function (snap) {
        if (snap && snap.exists) return { created: false };
        return ctx.db.collection("sets").doc(bundle.set.id).set(bundle.set).then(function () {
          return bundle.words.reduce(function (chain, word) {
            return chain.then(function () {
              return ctx.db.collection("words").doc(word.id).set(word);
            });
          }, Promise.resolve());
        }).then(function () { return { created: true }; });
      }));
    }
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
    connect: connect,
    firebaseConfigured: firebaseConfigured,
    bundledDemo: bundledDemo,
    demoCatalog: demoCatalog,
    signIn: signIn,
    signOut: signOut,
    currentUser: currentUser,
    changePassword: changePassword,
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
