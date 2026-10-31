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
  "admin.html",
  "styles.css",
  "manifest.webmanifest",
  "sw.js",
  ".nojekyll",
  "data/pinyin_tables_and_seeds_v1.json",
  "data/book_pinyin_table_v1.json",
  "js/config.js",
  "js/cloud.js",
  "js/app.js",
  "js/admin.js",
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
var parentEmail = require(path.join(root, "js/config.js")).parentEmail;
assert.strictEqual(parentEmail, "parent@pinyin-practice.local");
assert.ok(rules.indexOf("request.auth") > 0);
assert.ok(rules.indexOf("request.auth.token.email") > 0);
assert.ok(rules.indexOf(parentEmail) > 0);
assert.ok(/function isParent\(\)/.test(rules));
assert.ok(/function validSession\(docId\)/.test(rules));
assert.ok(rules.indexOf("allow write: if request.auth != null") < 0, "不能只靠已登入就寫入");

function rulesBlock(collection) {
  var marker = "match /" + collection + "/{id}";
  var start = rules.indexOf(marker);
  assert.ok(start >= 0, marker);
  var open = rules.indexOf("{", start + marker.length);
  var depth = 0;
  for (var i = open; i < rules.length; i++) {
    if (rules[i] === "{") depth++;
    else if (rules[i] === "}") {
      depth--;
      if (depth === 0) return rules.slice(open + 1, i);
    }
  }
  throw new Error("未閉合的 " + marker);
}

["sets", "words"].forEach(function (collection) {
  var block = rulesBlock(collection);
  assert.ok(/allow read:\s*if true;/.test(block), collection + " 仍可公開讀");
  assert.ok(/allow create, update, delete:\s*if isParent\(\);/.test(block), collection + " 寫入只限家長");
  assert.ok(!/request\.auth\s*!=\s*null\s*;/.test(block), collection);
});

var sessions = rulesBlock("sessions");
assert.ok(/allow read:\s*if isParent\(\);/.test(sessions), "sessions 只有家長能讀");
assert.ok(!/allow read:\s*if true/.test(sessions), "匿名者不能讀 sessions");
assert.ok(/allow create:\s*if validSession\(id\);/.test(sessions));
assert.ok(!/request\.auth\s*==\s*null/.test(sessions), "已登入家長在練習頁仍可建立紀錄");
assert.ok(/allow update, delete:\s*if false;/.test(sessions));
["id", "startedAt", "durationMs", "mode", "setId", "total", "correct"].forEach(function (key) {
  assert.ok(rules.indexOf("'" + key + "'") > 0, key);
});
assert.ok(rules.indexOf("hasOnly") > 0);
assert.ok(rules.indexOf("hasAll") > 0);
assert.ok(rules.indexOf("86400000") > 0);
assert.ok(rules.indexOf("<= 500") > 0);
assert.ok(/mode\.matches\('(\^\(A\|B\|C\)\$|\^\[ABC\]\$)'\)/.test(rules));
assert.ok(rules.indexOf("startedAt.size() == 24") > 0);
assert.ok(rules.indexOf("data.correct <= data.total") > 0);
assert.ok(rules.indexOf("is int") > 0);

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
  "admin.html",
  "styles.css",
  "manifest.webmanifest",
  "sw.js",
  ".nojekyll",
  "data/pinyin_tables_and_seeds_v1.json",
  "data/book_pinyin_table_v1.json",
  "js/config.js",
  "js/firebase-config.js",
  "js/cloud.js",
  "js/app.js",
  "js/admin.js",
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
["firestore.rules", "firebase.json", "README.md", "TECH.md"].forEach(function (rel) {
  assert.ok(!fs.existsSync(path.join(site, rel)), "Pages 不應包含 " + rel);
});
["tests", "scripts", "worker", ".github"].forEach(function (rel) {
  assert.ok(!fs.existsSync(path.join(site, rel)), "Pages 不應包含 " + rel);
});
assert.ok(read("README.md").indexOf("GitHub Actions") > 0);
assert.ok(read("README.md").indexOf("根目錄發佈") < 0);
assert.ok(read("TECH.md").indexOf("GitHub Actions") > 0);
assert.ok(read("js/cloud.js").indexOf("reauthenticateWithCredential") > 0);
assert.ok(read("js/admin.js").indexOf("目前密碼") > 0);
assert.ok(read("js/app.js").indexOf("listSessions") < 0);
assert.ok(read("js/admin.js").indexOf("listSessions") > 0);
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

assert.ok(read("sw.js").indexOf('var VERSION = "v11"') > 0);
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
assert.ok(read("README.md").indexOf("`v11`") > 0);
assert.ok(read("TECH.md").indexOf("`v11`") > 0);
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
assert.ok(read("js/admin.js").indexOf("點選拼音（模式 A）、認讀選擇（模式 B）與組合拼音（模式 C）皆可練習。") > 0);
assert.ok(read("js/admin.js").indexOf("尚未開放") < 0);
assert.ok(read("js/admin.js").indexOf("認讀選擇和組合拼音尚未開放") < 0);
assert.ok(read("js/admin.js").indexOf("組合拼音尚未開放") < 0);
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
assert.ok(read("js/modes/b.js").indexOf("即將推出") < 0);
assert.ok(read("js/modes/b.js").indexOf('mode: "B"') > 0);
assert.ok(read("js/modes/c.js").indexOf("即將推出") < 0);
assert.ok(read("js/app.js").indexOf("請看拼音作答，字先不顯示") < 0);
var css = read("styles.css");
assert.ok(css.indexOf('"Noto Sans"') > 0 && css.indexOf('"Noto Sans"') < css.indexOf('"WenQuanYi Micro Hei"'), "第三聲字型要排在文泉驛前面");
assert.ok(read("index.html").indexOf("認讀選擇") > 0);
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
