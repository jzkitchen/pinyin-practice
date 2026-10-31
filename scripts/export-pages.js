/* 組出 GitHub Pages 成品。只複製練習站需要的靜態檔。
 * firestore.rules、firebase.json、tests、scripts、worker 留在 git，不進網站。
 */
"use strict";

var fs = require("fs");
var path = require("path");

var ALLOW = [
  ".nojekyll",
  "index.html",
  "admin.html",
  "styles.css",
  "manifest.webmanifest",
  "sw.js",
  "data/pinyin_tables_and_seeds_v1.json",
  "data/book_pinyin_table_v1.json",
  "js/config.js",
  "js/firebase-config.js",
  "js/pinyin-tables.js",
  "js/grade.js",
  "js/syllable-picker.js",
  "js/cloud.js",
  "js/app.js",
  "js/admin.js",
  "js/tts.js",
  "js/modes/a.js",
  "js/modes/b.js",
  "js/modes/c.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png"
];

function main() {
  var destArg = process.argv[2];
  if (!destArg) {
    console.error("用法：node scripts/export-pages.js <目的資料夾>");
    process.exit(1);
  }
  var root = path.join(__dirname, "..");
  var dest = path.resolve(destArg);
  var rootResolved = path.resolve(root);
  if (dest === rootResolved || dest.indexOf(rootResolved + path.sep) === 0) {
    var relative = path.relative(rootResolved, dest);
    if (relative === "" || relative.split(path.sep)[0] !== "_site") {
      console.error("目的資料夾必須在倉庫外，或是倉庫裡的 _site");
      process.exit(1);
    }
  }
  fs.mkdirSync(dest, { recursive: true });
  ALLOW.forEach(function (rel) {
    var from = path.join(root, rel);
    var to = path.join(dest, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  });
  console.log("pages export: " + ALLOW.length + " files -> " + dest);
}

main();
