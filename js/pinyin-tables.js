/* 載入拼音資料。
 * 種子詞、模式文案、多音原則：data/pinyin_tables_and_seeds_v1.json
 * 聲母、韻母、聲調、零聲母拼寫、點選文案、歸一規則：data/book_pinyin_table_v1.json
 * 書本表蓋過種子檔裡的同名欄位，點選不另抄一份。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.PinyinTables = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var BOOK_KEYS = ["shengmu", "yunmu", "shengdiao", "zero_initial_spell", "ui_copy", "normalize_rules"];
  var data = null;

  function applyBook(seeds, book) {
    if (!seeds || !book) throw new Error("拼音資料不完整");
    var json = {};
    Object.keys(seeds).forEach(function (key) { json[key] = seeds[key]; });
    BOOK_KEYS.forEach(function (key) {
      if (!Object.prototype.hasOwnProperty.call(book, key)) throw new Error("書本拼音表缺少 " + key);
      json[key] = book[key];
    });
    json.picker_source = "data/book_pinyin_table_v1.json";
    return json;
  }

  function fetchJson(url) {
    return fetch(url, { cache: "no-cache" }).then(function (res) {
      if (!res.ok) throw new Error("無法讀取拼音資料");
      return res.json();
    });
  }

  function load(url, bookUrl) {
    var tableUrl = bookUrl || "data/book_pinyin_table_v1.json";
    return Promise.all([fetchJson(url), fetchJson(tableUrl)]).then(function (pair) {
      var json = applyBook(pair[0], pair[1]);
      if (!json.shengmu || !json.yunmu || !json.shengdiao || !json.seed_words || !json.zero_initial_spell) {
        throw new Error("拼音資料不完整");
      }
      data = json;
      return json;
    });
  }

  return {
    load: load,
    applyBook: applyBook,
    bookKeys: BOOK_KEYS.slice(),
    get: function () { return data; }
  };
});
