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
assert.ok(config.indexOf('adminPasswordSha256: "4cc69e6c10d10a0a8172a5a4c34a2b7f94476b447218564ce8a3c109849c43e2"') > 0);
assert.ok(config.indexOf('storage: "local"') > 0);
assert.strictEqual((config.match(/4cc69e6c10d10a0a8172a5a4c34a2b7f94476b447218564ce8a3c109849c43e2/g) || []).length, 1);

var hash = "4cc69e6c10d10a0a8172a5a4c34a2b7f94476b447218564ce8a3c109849c43e2";
function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
    if (entry.name === ".git" || entry.name === "node_modules" || entry.name === "tests") return;
    var full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(js|md|html|css|json|sql|example|webmanifest)$/.test(entry.name) || entry.name === ".gitignore") {
      var text = fs.readFileSync(full, "utf8");
      var rel = path.relative(root, full);
      if (rel !== "js/config.js") assert.ok(text.indexOf(hash) < 0, "校驗碼不應出現在 " + rel);
      assert.ok(!/adminPassword"\s*:/.test(text), rel);
    }
  });
}
walk(root);

assert.ok(read("sw.js").indexOf('var VERSION = "v1"') > 0);
var manifest = JSON.parse(read("manifest.webmanifest"));
assert.strictEqual(manifest.name, "普通話拼音練習");
assert.strictEqual(manifest.lang, "zh-Hant");
assert.ok(read("worker/src/index.js").indexOf(hash) < 0);
assert.ok(read("worker/schema.sql").indexOf("CREATE TABLE IF NOT EXISTS sets") > 0);
assert.ok(read("worker/schema.sql").indexOf("CREATE TABLE IF NOT EXISTS words") > 0);
assert.ok(read("worker/schema.sql").indexOf("CREATE TABLE IF NOT EXISTS sessions") > 0);
assert.ok(read("README.md").indexOf("adminPasswordSha256") > 0);
assert.ok(read("README.md").indexOf("data/pinyin_tables_and_seeds_v1.json") > 0);
assert.ok(read("js/modes/a.js").indexOf("copy.name") > 0);
assert.ok(read("js/modes/b.js").indexOf("copy.name") > 0);
assert.ok(read("js/modes/c.js").indexOf("copy.name") > 0);
assert.ok(read("js/modes/a.js").indexOf("即將推出") > 0);
assert.ok(!/textContent\s*=\s*"點選拼音"/.test(read("js/modes/a.js")));

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
