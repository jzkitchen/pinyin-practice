"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var Sessions = require("../js/sessions.js");

function memoryStorage() {
  var map = new Map();
  return {
    getItem: function (key) { return map.has(key) ? map.get(key) : null; },
    setItem: function (key, value) { map.set(key, String(value)); },
    removeItem: function (key) { map.delete(key); }
  };
}

async function main() {
  var storage = memoryStorage();
  var saved = await Sessions.createSession({
    mode: "A",
    setId: "unit-01",
    total: 9,
    correct: 7,
    durationMs: 1500,
    startedAt: "2026-10-31T01:02:03.000Z"
  }, storage);
  assert.ok(saved.id);
  assert.strictEqual(saved.correct, 7);
  assert.strictEqual(saved.mode, "A");

  var listed = await Sessions.listSessions(storage);
  assert.strictEqual(listed.length, 1);
  assert.strictEqual(listed[0].id, saved.id);
  assert.strictEqual(listed[0].durationMs, 1500);
  assert.strictEqual(listed[0].setId, "unit-01");

  var raw = storage.getItem(Sessions.storageKey);
  assert.ok(raw && raw.indexOf("unit-01") >= 0);
  var restored = JSON.parse(raw);
  assert.strictEqual(restored[0].correct, 7);

  await Sessions.createSession({
    mode: "C",
    setId: "unit-01",
    total: 2,
    correct: 2,
    durationMs: 10,
    startedAt: "2026-10-31T02:00:00.000Z"
  }, storage);
  var both = await Sessions.listSessions(storage);
  assert.strictEqual(both.length, 2);
  assert.strictEqual(both[0].mode, "C");

  await assert.rejects(Sessions.createSession({
    mode: "A",
    setId: "",
    total: 1,
    correct: 1
  }, storage), /練習紀錄/);

  var source = fs.readFileSync(path.join(__dirname, "../js/sessions.js"), "utf8");
  assert.ok(source.indexOf("firebase") < 0);
  assert.ok(source.indexOf("Firestore") < 0);
  assert.ok(source.indexOf("localStorage") >= 0 || source.indexOf("getItem") >= 0);

  console.log("session tests passed");
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
