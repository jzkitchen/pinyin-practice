/* 普通話拼音練習 — Service Worker。
 * 換了頁面、腳本或拼音資料後，把 VERSION 加一（例如 "v1" → "v2"），
 * 已安裝的 App 下次開啟會改用新快取。
 */
var VERSION = "v8";
var CACHE = "pinyin-practice-" + VERSION;

var CORE = [
  "./",
  "index.html",
  "admin.html",
  "styles.css",
  "manifest.webmanifest",
  "data/pinyin_tables_and_seeds_v1.json",
  "js/config.js",
  "js/firebase-config.js",
  "js/pinyin-tables.js",
  "js/grade.js",
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

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      var reload = function (url) { return new Request(url, { cache: "reload" }); };
      return cache.addAll(CORE.map(reload));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) {
        return key.indexOf("pinyin-practice-") === 0 && key !== CACHE;
      }).map(function (key) { return caches.delete(key); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isCorePath(pathname) {
  var path = pathname || "";
  return CORE.some(function (item) {
    if (item === "./") return /\/$/.test(path) || /\/index\.html$/.test(path);
    return path === "/" + item || path.slice(-item.length - 1) === "/" + item || path.slice(-item.length) === item;
  });
}

function putCache(req, res) {
  if (!res || res.status !== 200 || res.type !== "basic") return;
  var copy = res.clone();
  caches.open(CACHE).then(function (cache) { cache.put(req, copy); }).catch(function () {});
}

function networkFirst(req) {
  return fetch(req).then(function (res) {
    putCache(req, res);
    return res;
  }).catch(function () {
    return caches.match(req, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      if (req.mode === "navigate") return caches.match("./index.html");
      return Promise.reject(new Error("offline"));
    });
  });
}

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.indexOf("/api/") !== -1) return;
  if (req.mode !== "navigate" && !isCorePath(url.pathname)) return;

  event.respondWith(networkFirst(req));
});
