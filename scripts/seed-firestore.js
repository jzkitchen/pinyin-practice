#!/usr/bin/env node
"use strict";

/* 把範例詞組和 40 個種子詞寫進 Firestore。
 * 家長須先在 Firebase Auth 建立 parentEmail。
 * 密碼從環境變數讀，不要寫進檔案或命令列參數。
 *
 *   PINYIN_PARENT_PASSWORD='…' node scripts/seed-firestore.js
 *
 * 只看將寫入的文件、不連線：
 *
 *   node scripts/seed-firestore.js --print
 *
 * 規則要先部署，否則寫入會被拒絕。見 README。
 */

var fs = require("fs");
var path = require("path");
var Grade = require("../js/grade.js");
var Tables = require("../js/pinyin-tables.js");
var config = require("../js/config.js");
var firebaseConfig = require("../js/firebase-config.js");

var root = path.join(__dirname, "..");
var seeds = JSON.parse(fs.readFileSync(path.join(root, "data/pinyin_tables_and_seeds_v1.json"), "utf8"));
var book = JSON.parse(fs.readFileSync(path.join(root, "data/book_pinyin_table_v1.json"), "utf8"));
var data = Tables.applyBook(seeds, book);
Grade.init(data);

function seedStamp(index) {
  return new Date(Date.UTC(2026, 9, 30, 0, 0, 0, index)).toISOString();
}

function bundle() {
  var setId = config.demoSetId;
  var stamp = seedStamp(0);
  var set = {
    id: setId,
    name: config.demoSetName,
    createdAt: stamp,
    updatedAt: stamp
  };
  var words = data.seed_words.map(function (seed, index) {
    var word = Grade.mapSeedWord(seed, setId);
    if (!word) throw new Error("種子詞拆音失敗：" + seed.han);
    var at = seedStamp(index);
    word.createdAt = at;
    word.updatedAt = at;
    return word;
  });
  return { set: set, words: words };
}

function fieldValue(value) {
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number" && Number.isFinite(value)) {
    if (Math.floor(value) === value) return { integerValue: String(value) };
    return { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(fieldValue) } };
  }
  if (value && typeof value === "object") {
    var fields = {};
    Object.keys(value).forEach(function (key) {
      fields[key] = fieldValue(value[key]);
    });
    return { mapValue: { fields: fields } };
  }
  return { nullValue: null };
}

function documentBody(value) {
  var encoded = fieldValue(value);
  return { fields: encoded.mapValue.fields };
}

var projectId = firebaseConfig.projectId;
var base = "https://firestore.googleapis.com/v1/projects/" + projectId + "/databases/(default)/documents";

function authHeaders(token) {
  return {
    Authorization: "Bearer " + token,
    "Content-Type": "application/json"
  };
}

function signIn(password) {
  var url = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + encodeURIComponent(firebaseConfig.apiKey);
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: config.parentEmail,
      password: password,
      returnSecureToken: true
    })
  }).then(function (res) {
    return res.json().then(function (body) {
      if (!res.ok) {
        var message = body && body.error && body.error.message ? body.error.message : "無法登入";
        throw new Error(message);
      }
      return body.idToken;
    });
  });
}

function readDoc(collection, id, token) {
  return fetch(base + "/" + collection + "/" + encodeURIComponent(id), {
    headers: authHeaders(token)
  }).then(function (res) {
    if (res.status === 404) return null;
    if (!res.ok) return res.text().then(function (text) { throw new Error(text || "讀取失敗"); });
    return res.json();
  });
}

function createDoc(collection, id, value, token) {
  var url = base + "/" + collection + "?documentId=" + encodeURIComponent(id);
  return fetch(url, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(documentBody(value))
  }).then(function (res) {
    if (res.status === 409) return { created: false };
    if (!res.ok) return res.text().then(function (text) { throw new Error(text || "寫入失敗"); });
    return { created: true };
  });
}

async function main() {
  var demo = bundle();
  if (process.argv.indexOf("--print") >= 0) {
    process.stdout.write(JSON.stringify(demo, null, 2) + "\n");
    return;
  }
  var password = process.env.PINYIN_PARENT_PASSWORD || "";
  if (!password) {
    console.error("請設定環境變數 PINYIN_PARENT_PASSWORD（家長密碼）。不要把密碼寫進檔案。");
    console.error("只預覽文件：node scripts/seed-firestore.js --print");
    process.exit(1);
  }
  var token = await signIn(password);
  var existing = await readDoc("sets", demo.set.id, token);
  if (existing) {
    console.log("範例詞組已存在，沒有覆寫。");
    return;
  }
  await createDoc("sets", demo.set.id, demo.set, token);
  for (var i = 0; i < demo.words.length; i++) {
    await createDoc("words", demo.words[i].id, demo.words[i], token);
  }
  console.log("已寫入範例詞組和 " + demo.words.length + " 個字詞。");
}

main().catch(function (err) {
  console.error(err.message || err);
  process.exit(1);
});
