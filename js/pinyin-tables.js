/* 聲母、韻母、聲調、種子詞、模式文案。
 * 唯一來源：data/pinyin_tables_and_seeds_v1.json（專家交付 v1，2026-10-30）。
 * 本檔只負責載入，不另抄一份表。日後修訂請改 JSON。
 */
var PinyinTables = (function () {
  "use strict";

  var data = null;

  function load(url) {
    return fetch(url, { cache: "no-cache" }).then(function (res) {
      if (!res.ok) throw new Error("無法讀取拼音資料");
      return res.json();
    }).then(function (json) {
      if (!json || !json.shengmu || !json.yunmu || !json.shengdiao || !json.seed_words) {
        throw new Error("拼音資料不完整");
      }
      data = json;
      return json;
    });
  }

  return {
    load: load,
    get: function () { return data; }
  };
})();
