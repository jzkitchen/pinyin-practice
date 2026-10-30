"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var Grade = require("../js/grade.js");
var config = require("../js/config.js");

var data = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/pinyin_tables_and_seeds_v1.json"), "utf8"));
Grade.init(data);

function memoryStorage() {
  var map = new Map();
  return {
    getItem: function (key) { return map.has(key) ? map.get(key) : null; },
    setItem: function (key, value) { map.set(key, String(value)); },
    removeItem: function (key) { map.delete(key); }
  };
}

function loadCloud() {
  delete require.cache[require.resolve("../js/cloud.js")];
  return require("../js/cloud.js");
}

async function main() {
  var storage = memoryStorage();
  var cloud = loadCloud();
  cloud.init(Object.assign({}, config, { storage: "local" }), {
    grade: Grade,
    tables: data,
    storage: storage
  });

  var sets = await cloud.seedIfEmpty();
  assert.strictEqual(sets.length, 1);
  assert.strictEqual(sets[0].name, "範例");
  assert.strictEqual(sets[0].id, "set_demo");
  var again = await cloud.seedIfEmpty();
  assert.strictEqual(again.length, 1);

  var words = await cloud.listWords("set_demo");
  assert.strictEqual(words.length, 40);
  assert.strictEqual(words[0].hanzi, "媽媽");
  assert.strictEqual(words[0].pinyin, "māma");
  assert.deepStrictEqual(words[0].accept, ["māma", "māmā"]);
  assert.strictEqual(words[39].hanzi, "長城");
  assert.strictEqual(Grade.isAccepted(words[0].readings, words[0].accept), true);

  var created = await cloud.createSet("動物");
  sets = await cloud.listSets();
  assert.strictEqual(sets.length, 2);
  await cloud.updateSet(created.id, { name: "小動物" });
  var renamed = (await cloud.listSets()).find(function (set) { return set.id === created.id; });
  assert.strictEqual(renamed.name, "小動物");

  var cat = await cloud.createWord({
    setId: created.id,
    hanzi: "貓",
    pinyin: "māo",
    tones: [1],
    accept: ["māo"],
    readings: [{ initial: "m", final: "ao", tone: 1 }],
    note: ""
  });
  assert.strictEqual((await cloud.listWords(created.id)).length, 1);
  var edited = await cloud.updateWord(cat.id, {
    setId: created.id,
    hanzi: "小貓",
    pinyin: "xiǎomāo",
    tones: [3, 1],
    accept: ["xiǎomāo"],
    readings: [
      { initial: "x", final: "iao", tone: 3 },
      { initial: "m", final: "ao", tone: 1 }
    ],
    note: "測試",
    createdAt: cat.createdAt
  });
  assert.strictEqual(edited.hanzi, "小貓");
  assert.strictEqual(edited.createdAt, cat.createdAt);
  await cloud.deleteWord(cat.id);
  assert.strictEqual((await cloud.listWords(created.id)).length, 0);
  await cloud.deleteSet(created.id);
  assert.strictEqual((await cloud.listSets()).length, 1);
  assert.strictEqual((await cloud.listWords("set_demo")).length, 40);

  var session = await cloud.createSession({
    mode: "A",
    setId: "set_demo",
    total: 2,
    correct: 1,
    durationMs: 1000,
    startedAt: "2026-10-30T01:00:00.000Z"
  });
  var sessions = await cloud.listSessions();
  assert.strictEqual(sessions[0].id, session.id);
  assert.strictEqual(sessions[0].correct, 1);

  var restore = await cloud.importDemoSet();
  assert.strictEqual(restore.created, false);

  await assert.rejects(cloud.createSet("  "), /詞組名稱/);
  await assert.rejects(cloud.createWord({
    setId: "set_demo",
    hanzi: "",
    pinyin: "māo",
    tones: [1],
    accept: ["māo"],
    readings: [{ initial: "m", final: "ao", tone: 1 }]
  }), /漢字/);

  var remote = loadCloud();
  var db = mockFirestore();
  var auth = mockAuth("secret");
  remote.init(Object.assign({}, config, { storage: "firebase" }), {
    grade: Grade,
    tables: data,
    storage: memoryStorage(),
    firestore: db,
    auth: auth
  });
  assert.strictEqual(remote.firebaseConfigured(), true);
  assert.strictEqual(remote.bundledDemo(), false);
  assert.strictEqual((await remote.listSets()).length, 0);
  await assert.rejects(remote.listSessions(), /家長/);
  await assert.rejects(remote.signIn("parent@example.com", "nope"), function (err) {
    assert.strictEqual(err.code, "auth/wrong-password");
    return true;
  });
  var stranger = await remote.signIn("stranger@example.com", "secret");
  assert.strictEqual(stranger.email, "stranger@example.com");
  await assert.rejects(remote.listSessions(), /家長/);
  await remote.signOut();
  var signed = await remote.signIn(config.parentEmail, "secret");
  assert.strictEqual(signed.email, config.parentEmail);
  var made = await remote.createSet("動物");
  assert.strictEqual(made.name, "動物");
  assert.ok(db.rows.sets.has(made.id));
  var listed = await remote.listSets();
  assert.strictEqual(listed.find(function (set) { return set.id === made.id; }).name, "動物");
  var cat = await remote.createWord({
    setId: made.id,
    hanzi: "貓",
    pinyin: "māo",
    tones: [1],
    accept: ["māo"],
    readings: [{ initial: "m", final: "ao", tone: 1 }],
    note: ""
  });
  assert.strictEqual((await remote.listWords(made.id)).length, 1);
  assert.strictEqual((await remote.listWords("set_demo")).length, 0);
  await remote.updateWord(cat.id, {
    setId: made.id,
    hanzi: "小貓",
    pinyin: "xiǎomāo",
    tones: [3, 1],
    accept: ["xiǎomāo"],
    readings: [
      { initial: "x", final: "iao", tone: 3 },
      { initial: "m", final: "ao", tone: 1 }
    ],
    note: "",
    createdAt: cat.createdAt
  });
  assert.strictEqual((await remote.listWords(made.id))[0].hanzi, "小貓");
  var seeded = await remote.importDemoSet();
  assert.strictEqual(seeded.created, true);
  assert.strictEqual((await remote.listWords("set_demo")).length, 40);
  assert.strictEqual((await remote.importDemoSet()).created, false);
  var practice = await remote.createSession({
    mode: "A",
    setId: "set_demo",
    total: 1,
    correct: 1,
    durationMs: 10,
    startedAt: "2026-10-30T02:00:00.000Z"
  });
  assert.strictEqual((await remote.listSessions())[0].id, practice.id);
  assert.ok(db.rows.sessions.has(practice.id));
  assert.deepStrictEqual(Object.keys(db.rows.sessions.get(practice.id)).sort(), [
    "correct", "durationMs", "id", "mode", "setId", "startedAt", "total"
  ]);
  await assert.rejects(remote.changePassword("abcdef"), /目前密碼/);
  await assert.rejects(remote.changePassword("abc", "secret"), /至少 6/);
  await assert.rejects(remote.changePassword("abcdef", "wrong"), /目前密碼不正確/);
  assert.strictEqual((await remote.signIn(config.parentEmail, "secret")).email, config.parentEmail);
  await remote.changePassword("abcdef", "secret");
  await remote.signOut();
  await assert.rejects(remote.signIn(config.parentEmail, "secret"), function (err) {
    assert.strictEqual(err.code, "auth/wrong-password");
    return true;
  });
  assert.strictEqual((await remote.signIn(config.parentEmail, "abcdef")).email, config.parentEmail);
  await remote.deleteWord(cat.id);
  await remote.deleteSet(made.id);
  assert.strictEqual((await remote.listWords(made.id)).length, 0);
  assert.ok(!db.rows.sets.has(made.id));
  await remote.signOut();
  assert.strictEqual(auth.currentUser, null);

  var offline = loadCloud();
  offline.init(Object.assign({}, config, { storage: "firebase" }), {
    grade: Grade,
    tables: data,
    storage: memoryStorage(),
    firebaseConfig: { apiKey: "TODO", projectId: "TODO" }
  });
  assert.strictEqual(offline.firebaseConfigured(), false);
  assert.strictEqual(offline.bundledDemo(), true);
  var offlineSets = await offline.listSets();
  assert.strictEqual(offlineSets[0].id, "set_demo");
  assert.strictEqual(offlineSets[0].name, "範例");
  assert.strictEqual((await offline.listWords("set_demo")).length, 40);
  assert.strictEqual((await offline.listWords("set_demo"))[0].hanzi, "媽媽");
  await assert.rejects(offline.createSet("動物"), /雲端尚未設定/);
  await assert.rejects(offline.importDemoSet(), /雲端尚未設定/);
  await assert.rejects(offline.signIn("parent@example.com", "secret"), /雲端尚未設定/);

  console.log("cloud tests passed");
}

function mockFirestore() {
  var rows = { sets: new Map(), words: new Map(), sessions: new Map() };
  function collection(name) {
    return {
      get: function () {
        var docs = [];
        rows[name].forEach(function (data, id) {
          docs.push({ id: id, data: function () { return Object.assign({}, data); } });
        });
        return Promise.resolve({ docs: docs });
      },
      where: function (field, op, value) {
        return {
          get: function () {
            var docs = [];
            rows[name].forEach(function (data, id) {
              if (op === "==" && data[field] === value) {
                docs.push({ id: id, data: function () { return Object.assign({}, data); } });
              }
            });
            return Promise.resolve({ docs: docs });
          }
        };
      },
      doc: function (id) {
        return {
          set: function (data) {
            rows[name].set(id, Object.assign({}, data));
            return Promise.resolve();
          },
          delete: function () {
            rows[name].delete(id);
            return Promise.resolve();
          },
          get: function () {
            var data = rows[name].get(id);
            return Promise.resolve({
              exists: !!data,
              id: id,
              data: function () { return data ? Object.assign({}, data) : null; }
            });
          }
        };
      }
    };
  }
  return { collection: collection, rows: rows };
}

function mockAuth(password) {
  var state = { currentUser: null, password: password, recent: false };
  function buildUser(email) {
    return {
      email: email,
      uid: "parent",
      reauthenticateWithCredential: function (cred) {
        if (!cred || cred.password !== state.password) {
          var err = new Error("wrong");
          err.code = "auth/wrong-password";
          return Promise.reject(err);
        }
        state.recent = true;
        return Promise.resolve();
      },
      updatePassword: function (next) {
        if (!state.recent) {
          var err = new Error("recent");
          err.code = "auth/requires-recent-login";
          return Promise.reject(err);
        }
        state.password = next;
        state.recent = false;
        return Promise.resolve();
      }
    };
  }
  return {
    get currentUser() { return state.currentUser; },
    EmailAuthProvider: {
      credential: function (email, pw) {
        return { email: email, password: pw };
      }
    },
    signInWithEmailAndPassword: function (email, pw) {
      if (pw !== state.password) {
        var err = new Error("wrong");
        err.code = "auth/wrong-password";
        return Promise.reject(err);
      }
      state.recent = false;
      state.currentUser = buildUser(email);
      return Promise.resolve({ user: state.currentUser });
    },
    signOut: function () {
      state.currentUser = null;
      return Promise.resolve();
    },
    onAuthStateChanged: function (cb) {
      cb(state.currentUser);
      return function () {};
    }
  };
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
