/* 練習字詞。每個單元一份靜態 JSON（data/units/unit-01.json）。
 * 再加單元時，在 CATALOG 加一筆，並放上對應的 JSON。練習頁不讀雲端。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.PinyinUnits = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var CATALOG = [
    { id: "unit-01", url: "data/units/unit-01.json" }
  ];

  function copy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function mapWord(raw, setId) {
    if (!raw || !raw.han || !Array.isArray(raw.syllables) || !raw.syllables.length) return null;
    var syllables = raw.syllables.map(copy);
    var readings = syllables.map(function (syl) {
      return {
        initial: syl.shengmu || "",
        final: syl.yunmu,
        tone: Number(syl.tone),
        erhua: !!syl.erhua
      };
    });
    return {
      id: raw.id,
      setId: setId,
      han: raw.han,
      hanzi: raw.han,
      pinyin: raw.pinyin,
      pinyinDisplay: raw.pinyin_display || raw.pinyin,
      tones: Array.isArray(raw.tones) ? raw.tones.slice() : readings.map(function (reading) { return reading.tone; }),
      accept: Array.isArray(raw.accept) ? raw.accept.slice() : [],
      readings: readings,
      syllables: syllables,
      note: raw.notes || "",
      tags: Array.isArray(raw.tags) ? raw.tags.slice() : [],
      erhua: !!raw.erhua
    };
  }

  function mapUnit(doc, setId) {
    var id = setId || (doc && doc.id) || "unit";
    var source = doc || {};
    var words = (source.words || []).map(function (raw) {
      return mapWord(raw, id);
    }).filter(Boolean);
    return {
      id: id,
      name: source.unit || id,
      words: words
    };
  }

  function catalog() {
    return CATALOG.map(function (item) {
      return { id: item.id, url: item.url };
    });
  }

  function fetchJson(url) {
    if (typeof fetch !== "function") return Promise.reject(new Error("無法讀取單元"));
    return fetch(url, { cache: "no-cache" }).then(function (res) {
      if (!res.ok) throw new Error("讀不到單元字詞");
      return res.json();
    });
  }

  function loadAll(loader) {
    var read = loader || fetchJson;
    return Promise.all(catalog().map(function (item) {
      return Promise.resolve(read(item.url)).then(function (doc) {
        return mapUnit(doc, item.id);
      });
    }));
  }

  return {
    catalog: catalog,
    mapWord: mapWord,
    mapUnit: mapUnit,
    loadAll: loadAll
  };
});
