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

  console.log("cloud tests passed");
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
