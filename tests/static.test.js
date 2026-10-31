"use strict";

var assert = require("assert");
var fs = require("fs");
var os = require("os");
var path = require("path");
var crypto = require("crypto");
var execFileSync = require("child_process").execFileSync;

var root = path.join(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

var required = [
  "index.html",
  "styles.css",
  "manifest.webmanifest",
  "sw.js",
  ".nojekyll",
  "data/pinyin_tables_and_seeds_v1.json",
  "data/book_pinyin_table_v1.json",
  "data/units/unit-01.json",
  "js/config.js",
  "js/units.js",
  "js/sessions.js",
  "js/app.js",
  "js/grade.js",
  "js/syllable-picker.js",
  "js/pinyin-tables.js",
  "js/tts.js",
  "js/modes/a.js",
  "js/modes/b.js",
  "js/modes/c.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
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
assert.ok(config.indexOf("firebase") < 0);
assert.ok(config.indexOf("apiBase") < 0);
assert.ok(config.indexOf("adminPasswordSha256") < 0);
assert.ok(config.indexOf("parentEmail") < 0);
["admin.html", "js/admin.js", "js/cloud.js", "js/firebase-config.js", "firestore.rules", "firebase.json", "scripts/seed-firestore.js"].forEach(function (rel) {
  assert.ok(!fs.existsSync(path.join(root, rel)), "不應留下 " + rel);
});
["js/app.js", "js/units.js", "js/sessions.js", "index.html", "sw.js"].forEach(function (rel) {
  var text = read(rel);
  assert.ok(text.indexOf("firebase") < 0, rel);
  assert.ok(text.indexOf("Firestore") < 0, rel);
  assert.ok(text.indexOf("PinyinCloud") < 0, rel);
});
assert.ok(read("js/sessions.js").indexOf("localStorage") > 0);
assert.ok(read("js/sessions.js").indexOf("pinyin-practice.sessions.v1") > 0);
assert.ok(read("js/units.js").indexOf("data/units/unit-01.json") > 0);
assert.ok(read("js/modes/a.js").indexOf("兒化") > 0);
assert.ok(read("js/modes/c.js").indexOf("appendErhuaToggle") > 0);
assert.ok(read("js/syllable-picker.js").indexOf("不放 er") > 0);
var unitDoc = JSON.parse(read("data/units/unit-01.json"));
assert.strictEqual(unitDoc.unit, "單元一");
assert.strictEqual(unitDoc.words.length, 9);
assert.strictEqual(unitDoc.words[3].han, "口信兒");
assert.strictEqual(unitDoc.words[3].erhua, true);

var ignore = read(".gitignore").split(/\r?\n/);
[".env", ".env.*", "*firebase-adminsdk*.json", "*-service-account*.json", ".runtimeconfig.json"].forEach(function (line) {
  assert.ok(ignore.indexOf(line) >= 0, "gitignore 缺少 " + line);
});

var workflow = read(".github/workflows/pages.yml");
assert.ok(workflow.indexOf("node scripts/export-pages.js") > 0);
assert.ok(workflow.indexOf("actions/upload-pages-artifact@") > 0);
assert.ok(workflow.indexOf("actions/deploy-pages@") > 0);
assert.ok(workflow.indexOf("pages: write") > 0);

var site = fs.mkdtempSync(path.join(os.tmpdir(), "pinyin-pages-"));
execFileSync(process.execPath, ["scripts/export-pages.js", site], { cwd: root });
[
  "index.html",
  "styles.css",
  "manifest.webmanifest",
  "sw.js",
  ".nojekyll",
  "data/pinyin_tables_and_seeds_v1.json",
  "data/book_pinyin_table_v1.json",
  "data/units/unit-01.json",
  "js/config.js",
  "js/units.js",
  "js/sessions.js",
  "js/app.js",
  "js/grade.js",
  "js/syllable-picker.js",
  "js/pinyin-tables.js",
  "js/tts.js",
  "js/modes/a.js",
  "js/modes/b.js",
  "js/modes/c.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png"
].forEach(function (rel) {
  assert.ok(fs.existsSync(path.join(site, rel)), "Pages 成品缺少 " + rel);
});
["admin.html", "js/firebase-config.js", "js/cloud.js", "js/admin.js", "README.md", "TECH.md"].forEach(function (rel) {
  assert.ok(!fs.existsSync(path.join(site, rel)), "Pages 不應包含 " + rel);
});
["tests", "scripts", "worker", ".github"].forEach(function (rel) {
  assert.ok(!fs.existsSync(path.join(site, rel)), "Pages 不應包含 " + rel);
});
assert.ok(read("README.md").indexOf("GitHub Actions") > 0);
assert.ok(read("README.md").indexOf("根目錄發佈") < 0);
assert.ok(read("TECH.md").indexOf("GitHub Actions") > 0);
assert.ok(read("js/app.js").indexOf("listSessions") < 0);
assert.ok(read("js/sessions.js").indexOf("listSessions") > 0);
assert.ok(read("README.md").indexOf("Firebase") < 0);
assert.ok(read("README.md").indexOf("firebase") < 0);
assert.ok(read("README.md").indexOf("data/units/unit-01.json") > 0);
assert.ok(read("README.md").indexOf("localStorage") > 0);
assert.ok(read("README.md").indexOf("wrangler secret put") < 0);
assert.ok(read("TECH.md").indexOf("Firebase") < 0);
assert.ok(read("TECH.md").indexOf("localStorage") > 0);
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
      assert.ok(!/AIza[0-9A-Za-z_-]{35}/.test(text), "API key 不應出現在 " + rel);
      assert.ok(!/adminPassword"\s*:/.test(text), rel);
      assert.ok(!/adminPasswordSha256"\s*:/.test(text), rel);
    }
  });
}
walk(root);

assert.ok(read("sw.js").indexOf('var VERSION = "v12"') > 0);
assert.ok(read("styles.css").indexOf("grid-template-columns: 1fr 1fr") < 0);
assert.ok(read("styles.css").indexOf(".shengmu-groups button.pick") > 0);
assert.ok(read("styles.css").indexOf("border-radius: 50%") > 0);
assert.ok(read("js/modes/a.js").indexOf("practice-progress") > 0);
assert.ok(read("js/modes/c.js").indexOf("practice-progress") > 0);
assert.ok(read("js/tts.js").indexOf("神經模型（首次約 63MB×聲線）") < 0);
assert.ok(read("data/book_pinyin_table_v1.json").indexOf("拼法參考") < 0);
assert.ok(read("data/book_pinyin_table_v1.json").indexOf("書本寫") < 0);
assert.ok(read("styles.css").indexOf(".han { font-size: 1.2rem;") > 0);
assert.ok(read("sw.js").indexOf("function networkFirst") > 0);
assert.ok(read("js/app.js").indexOf("拼音表") < 0);
assert.ok(read("js/app.js").indexOf("registration.update") > 0);
assert.ok(read("README.md").indexOf("`v12`") > 0);
assert.ok(read("TECH.md").indexOf("`v12`") > 0);
assert.ok(read("sw.js").indexOf("data/units/unit-01.json") > 0);
assert.ok(read("sw.js").indexOf("js/units.js") > 0);
assert.ok(read("sw.js").indexOf("js/sessions.js") > 0);
assert.ok(read("sw.js").indexOf("admin.html") < 0);
assert.ok(read("scripts/export-pages.js").indexOf("data/units/unit-01.json") > 0);
assert.ok(read("sw.js").indexOf("data/book_pinyin_table_v1.json") > 0);
assert.ok(read("sw.js").indexOf("js/syllable-picker.js") > 0);
assert.ok(read("scripts/export-pages.js").indexOf("data/book_pinyin_table_v1.json") > 0);
assert.ok(read("scripts/export-pages.js").indexOf("js/syllable-picker.js") > 0);
assert.ok(read("index.html").indexOf("js/syllable-picker.js") < read("index.html").indexOf("js/modes/a.js"));
assert.ok(read("js/modes/a.js").indexOf("整體認讀") < 0);
assert.ok(read("js/modes/c.js").indexOf("整體認讀") < 0);
assert.ok(read("js/syllable-picker.js").indexOf("整體認讀") < 0);
assert.ok(read("README.md").indexOf("data/book_pinyin_table_v1.json") > 0);
assert.ok(read("js/app.js").indexOf("這個詞組的字詞") < 0);
assert.ok(read("js/app.js").indexOf("選擇要練習的字詞") > 0);
assert.ok(read("js/app.js").indexOf("全選") > 0);
assert.ok(read("js/app.js").indexOf("全不選") > 0);
assert.ok(read("js/app.js").indexOf("開始") > 0);
assert.ok(read("js/tts.js").indexOf("prefetchVoice") > 0);
assert.ok(read("js/tts.js").indexOf("取消下載") > 0);
assert.ok(read("js/tts.js").indexOf("zh_CN-xiao_ya-medium") > 0);
assert.ok(read("js/modes/c.js").indexOf("isModelReady") > 0);
assert.ok(read("index.html").indexOf("js/tts.js") < read("index.html").indexOf("js/modes/c.js"));
assert.ok(read("js/tts.js").indexOf("zh_CN-xiao_ya-medium.onnx") > 0);
assert.ok(read("js/tts.js").indexOf("zh_CN-chaowen-medium.onnx") > 0);
assert.ok(read("js/tts.js").indexOf("huggingface.co/rhasspy/piper-voices") > 0);
assert.ok(!fs.existsSync(path.join(root, "zh_CN-xiao_ya-medium.onnx")));
var manifest = JSON.parse(read("manifest.webmanifest"));
assert.strictEqual(manifest.name, "普通話拼音練習");
assert.strictEqual(manifest.lang, "zh-Hant");
assert.ok(read("worker/src/index.js").indexOf("adminPasswordSha256") < 0);
assert.ok(read("worker/schema.sql").indexOf("CREATE TABLE IF NOT EXISTS sets") > 0);
assert.ok(read("worker/schema.sql").indexOf("CREATE TABLE IF NOT EXISTS words") > 0);
assert.ok(read("worker/schema.sql").indexOf("CREATE TABLE IF NOT EXISTS sessions") > 0);
assert.ok(read("README.md").indexOf("data/pinyin_tables_and_seeds_v1.json") > 0);
assert.ok(read("README.md").indexOf("單元一") > 0);
assert.ok(read("js/modes/a.js").indexOf("copy.name") > 0);
assert.ok(read("js/modes/b.js").indexOf("copy.name") > 0);
assert.ok(read("js/modes/c.js").indexOf("copy.name") > 0);
assert.ok(read("js/modes/a.js").indexOf("即將推出") < 0);
assert.ok(read("js/modes/b.js").indexOf("即將推出") < 0);
assert.ok(read("js/modes/b.js").indexOf('mode: "B"') > 0);
assert.ok(read("js/modes/c.js").indexOf("即將推出") < 0);
assert.ok(read("js/app.js").indexOf("請看拼音作答，字先不顯示") < 0);
var css = read("styles.css");
assert.ok(css.indexOf('"Noto Sans"') > 0 && css.indexOf('"Noto Sans"') < css.indexOf('"WenQuanYi Micro Hei"'), "第三聲字型要排在文泉驛前面");
assert.ok(read("index.html").indexOf("認讀選擇") > 0);
assert.ok(read("index.html").indexOf("admin.html") < 0);
assert.ok(read("js/app.js").indexOf("單元") > 0);
assert.ok(read("README.md").indexOf("仍是「即將推出」") < 0);
assert.ok(read("TECH.md").indexOf("即將推出") < 0);
assert.ok(read("js/modes/c.js").indexOf("speechSynthesis") > 0);
assert.ok(read("js/modes/c.js").indexOf("zh-CN") > 0);
assert.ok(read("js/modes/c.js").indexOf('record.mode = "C"') > 0);
assert.ok(read("js/app.js").indexOf("字和拼音先不顯示") < 0);
assert.ok(read("js/app.js").indexOf("createSession") > 0);
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
