"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var crypto = require("crypto");

var root = path.join(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

var required = [
  "index.html",
  "admin.html",
  "styles.css",
  "manifest.webmanifest",
  "sw.js",
  ".nojekyll",
  "data/pinyin_tables_and_seeds_v1.json",
  "js/config.js",
  "js/cloud.js",
  "js/app.js",
  "js/admin.js",
  "js/grade.js",
  "js/pinyin-tables.js",
  "js/modes/a.js",
  "js/modes/b.js",
  "js/modes/c.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
  "js/firebase-config.js",
  "firestore.rules",
  "worker/DEPRECATED.md",
  "worker/src/index.js",
  "worker/schema.sql",
  "worker/wrangler.toml.example",
  "README.md",
  "TECH.md"
];

required.forEach(function (rel) {
  assert.ok(fs.existsSync(path.join(root, rel)), "缺少 " + rel);
});

var config = read("js/config.js");
assert.ok(config.indexOf('storage: "firebase"') > 0);
assert.ok(config.indexOf("apiBase") < 0);
assert.ok(config.indexOf("adminPasswordSha256") < 0);
assert.ok(read("js/admin.js").indexOf("adminPasswordSha256") < 0);
assert.ok(read("js/admin.js").indexOf("signIn") > 0);
assert.ok(read("js/cloud.js").indexOf("signInWithEmailAndPassword") > 0);
assert.ok(read("js/cloud.js").indexOf("apiBase") < 0);
assert.ok(read("js/cloud.js").indexOf("X-Admin-Password-Sha256") < 0);
assert.ok(read("js/cloud.js").indexOf('collection("sets")') > 0);
assert.ok(read("js/cloud.js").indexOf('collection("words")') > 0);
assert.ok(read("js/cloud.js").indexOf('collection("sessions")') > 0);
assert.ok(read("admin.html").indexOf("雲端尚未設定") > 0);
assert.ok(read("js/config.js").indexOf("parent@pinyin-practice.local") > 0);
assert.ok(read("js/admin.js").indexOf("parentEmail") > 0);
var firebaseConfig = require(path.join(root, "js/firebase-config.js"));
assert.strictEqual(typeof firebaseConfig.apiKey, "string");
assert.ok(firebaseConfig.apiKey.length > 0, "apiKey 必須是非空字串");
assert.ok(/^AIza[0-9A-Za-z_-]+$/.test(firebaseConfig.apiKey), "apiKey 格式");
["projectId", "authDomain", "appId"].forEach(function (field) {
  assert.strictEqual(typeof firebaseConfig[field], "string", field);
  assert.ok(firebaseConfig[field].length > 0, field + " 必須存在");
});
assert.ok(read("js/firebase-config.js").indexOf("TODO") < 0);
var rules = read("firestore.rules");
assert.ok(rules.indexOf("request.auth") > 0);
assert.ok(/match\s+\/sets\/\{id\}/.test(rules));
assert.ok(/match\s+\/words\/\{id\}/.test(rules));
assert.ok(/match\s+\/sessions\/\{id\}/.test(rules));
assert.ok(rules.indexOf("allow read: if true") > 0);
assert.ok(rules.indexOf("allow write: if request.auth != null") > 0);
assert.ok(/match\s+\/sessions\/\{id\}[\s\S]*?allow read:\s*if true/.test(rules));
assert.ok(/match\s+\/sessions\/\{id\}[\s\S]*?allow create:\s*if true/.test(rules));
var sessionRules = rules.split("match /sessions/{id}")[1].split("match /")[0];
assert.ok(sessionRules.indexOf("update") < 0, "sessions 不開放 update");
assert.ok(sessionRules.indexOf("delete") < 0, "sessions 不開放 delete");
assert.ok(read("README.md").indexOf("Firebase") > 0);
assert.ok(read("README.md").indexOf("js/firebase-config.js") > 0);
assert.ok(read("README.md").indexOf("firestore.rules") > 0);
assert.ok(read("README.md").indexOf("wrangler secret put") < 0);
assert.ok(read("TECH.md").indexOf("Firebase") > 0);
assert.ok(read("TECH.md").indexOf("wrangler secret put") < 0);
assert.ok(read("worker/DEPRECATED.md").indexOf("DEPRECATED") > 0);

function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
    if (entry.name === ".git" || entry.name === "node_modules") return;
    var full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(js|md|html|css|json|sql|example|webmanifest)$/.test(entry.name) || entry.name === ".gitignore") {
      var text = fs.readFileSync(full, "utf8");
      var rel = path.relative(root, full);
      if (rel !== "js/firebase-config.js") {
        assert.ok(!/AIza[0-9A-Za-z_-]{35}/.test(text), "API key 不應出現在 " + rel);
      }
      assert.ok(!/adminPassword"\s*:/.test(text), rel);
      assert.ok(!/adminPasswordSha256"\s*:/.test(text), rel);
    }
  });
}
walk(root);

assert.ok(read("sw.js").indexOf('var VERSION = "v2"') > 0);
var manifest = JSON.parse(read("manifest.webmanifest"));
assert.strictEqual(manifest.name, "普通話拼音練習");
assert.strictEqual(manifest.lang, "zh-Hant");
assert.ok(read("worker/src/index.js").indexOf("adminPasswordSha256") < 0);
assert.ok(read("worker/schema.sql").indexOf("CREATE TABLE IF NOT EXISTS sets") > 0);
assert.ok(read("worker/schema.sql").indexOf("CREATE TABLE IF NOT EXISTS words") > 0);
assert.ok(read("worker/schema.sql").indexOf("CREATE TABLE IF NOT EXISTS sessions") > 0);
assert.ok(read("README.md").indexOf("data/pinyin_tables_and_seeds_v1.json") > 0);
assert.ok(read("README.md").indexOf("範例") > 0);
assert.ok(read("js/modes/a.js").indexOf("copy.name") > 0);
assert.ok(read("js/modes/b.js").indexOf("copy.name") > 0);
assert.ok(read("js/modes/c.js").indexOf("copy.name") > 0);
assert.ok(read("js/modes/a.js").indexOf("即將推出") < 0);
assert.ok(read("js/modes/b.js").indexOf("即將推出") > 0);
assert.ok(read("js/modes/c.js").indexOf("即將推出") > 0);
assert.ok(!/textContent\s*=\s*"點選拼音"/.test(read("js/modes/a.js")));
assert.ok(read("js/modes/a.js").indexOf("PinyinGrade") > 0 || read("js/modes/a.js").indexOf("gradeSyllable") > 0);

async function hashSamples() {
  for (var sample of ["abc", "拼音"]) {
    var nodeHex = crypto.createHash("sha256").update(sample, "utf8").digest("hex");
    var buffer = await crypto.webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(sample));
    var webHex = Buffer.from(buffer).toString("hex");
    assert.strictEqual(webHex, nodeHex, sample);
  }
}

hashSamples().then(function () {
  console.log("static checks passed");
}).catch(function (err) {
  console.error(err);
  process.exit(1);
});
