/* 拼音判定。
 * 歸一規則對齊 data/pinyin_tables_and_seeds_v1.json 的 polyphone_policy：
 * 小寫、去掉空白、ü 與 v 相同、j/q/x 後的 u 與 ü 相同。
 * 對錯只比對詞上的 accept，不拿詞典其他讀音湊對。
 * 聲母韻母表由 PinyinGrade.init(data) 餵入，本檔不另抄一份。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.PinyinGrade = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var TONE_TO_BASE = {
    "ā": "a", "á": "a", "ǎ": "a", "à": "a",
    "ē": "e", "é": "e", "ě": "e", "è": "e",
    "ī": "i", "í": "i", "ǐ": "i", "ì": "i",
    "ō": "o", "ó": "o", "ǒ": "o", "ò": "o",
    "ū": "u", "ú": "u", "ǔ": "u", "ù": "u",
    "ǖ": "ü", "ǘ": "ü", "ǚ": "ü", "ǜ": "ü"
  };

  var MARK = {
    a: ["a", "ā", "á", "ǎ", "à"],
    e: ["e", "ē", "é", "ě", "è"],
    i: ["i", "ī", "í", "ǐ", "ì"],
    o: ["o", "ō", "ó", "ǒ", "ò"],
    u: ["u", "ū", "ú", "ǔ", "ù"],
    "ü": ["ü", "ǖ", "ǘ", "ǚ", "ǜ"]
  };

  var U_TO_UMLAUT = { "u": "ü", "ū": "ǖ", "ú": "ǘ", "ǔ": "ǚ", "ù": "ǜ" };

  var tables = null;
  var spellingMap = null;
  var collisions = [];

  function stripBase(ch) {
    return TONE_TO_BASE[ch] || ch;
  }

  function isJqx(ch) {
    return ch === "j" || ch === "q" || ch === "x";
  }

  function comboAllowed(initial, final) {
    var jqx = isJqx(initial);
    var umlaut = final.charAt(0) === "ü";
    var iSeries = final.charAt(0) === "i";
    if (jqx) return umlaut || iSeries;
    if (umlaut) return initial === "n" || initial === "l" || initial === "";
    return true;
  }

  function zeroInitial(final) {
    if (final === "i") return "yi";
    if (final === "in") return "yin";
    if (final === "ing") return "ying";
    if (final === "iu") return "you";
    if (final.charAt(0) === "i") return "y" + final.slice(1);
    if (final === "u") return "wu";
    if (final === "ui") return "wei";
    if (final === "un") return "wen";
    if (final.charAt(0) === "u") return "w" + final.slice(1);
    if (final === "ü") return "yu";
    if (final === "üe") return "yue";
    if (final === "ün") return "yun";
    if (final === "üan") return "yuan";
    return final;
  }

  function spellFinal(initial, final) {
    var fin = final;
    if (isJqx(initial)) {
      if (fin === "ü") return "u";
      if (fin === "üe") return "ue";
      if (fin === "ün") return "un";
      if (fin === "üan") return "uan";
      return fin;
    }
    if (!initial) return zeroInitial(fin);
    return fin;
  }

  function applyToneMark(written, tone) {
    if (tone !== 1 && tone !== 2 && tone !== 3 && tone !== 4) return written;
    var chars = written.split("");
    var bases = chars.map(stripBase);
    var idx = bases.indexOf("a");
    if (idx < 0) idx = bases.indexOf("e");
    if (idx < 0) {
      var ou = bases.join("").indexOf("ou");
      if (ou >= 0) {
        idx = ou;
      } else {
        var vowels = [];
        for (var i = 0; i < bases.length; i++) {
          if ("aeiouü".indexOf(bases[i]) >= 0) vowels.push(i);
        }
        if (!vowels.length) return written;
        idx = vowels.length >= 2 ? vowels[1] : vowels[0];
      }
    }
    var forms = MARK[bases[idx]];
    if (!forms) return written;
    chars[idx] = forms[tone];
    return chars.join("");
  }

  function spellSyllable(initial, final, tone) {
    var ini = initial || "";
    var written = spellFinal(ini, final);
    var marked = applyToneMark(written, Number(tone) || 0);
    if (!ini) return marked;
    return ini + marked;
  }

  function cleanChars(input) {
    var s = String(input == null ? "" : input).normalize("NFC").trim().toLowerCase();
    s = s.replace(/[\s\u3000'’·]+/g, "");
    s = s.replace(/v/g, "ü");
    return s;
  }

  function jqxUToUmlaut(s) {
    var out = "";
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      var next = s.charAt(i + 1);
      if (isJqx(ch) && U_TO_UMLAUT[next]) {
        out += ch + U_TO_UMLAUT[next];
        i += 1;
        continue;
      }
      out += ch;
    }
    return out;
  }

  function jqxUmlautToU(s) {
    var out = "";
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (isJqx(ch) && s.charAt(i + 1) === "ü") {
        out += ch + "u";
        i += 1;
        continue;
      }
      out += ch;
    }
    return out;
  }

  function normalizePinyin(input) {
    return jqxUToUmlaut(cleanChars(input));
  }

  function toPlain(input) {
    var s = cleanChars(input);
    var out = "";
    for (var i = 0; i < s.length; i++) out += stripBase(s.charAt(i));
    return jqxUmlautToU(out);
  }

  function init(data) {
    if (!data || !data.shengmu || !data.yunmu) throw new Error("拼音表不完整");
    tables = data;
    spellingMap = new Map();
    collisions = [];
    data.shengmu.forEach(function (sm) {
      data.yunmu.forEach(function (ym) {
        var ini = sm.key;
        var fin = ym.key;
        if (!comboAllowed(ini, fin)) return;
        var key = toPlain(spellSyllable(ini, fin, 0));
        var next = { initial: ini, final: fin };
        var prev = spellingMap.get(key);
        if (prev && (prev.initial !== next.initial || prev.final !== next.final)) {
          collisions.push({ key: key, kept: prev, other: next });
          if ((next.initial || "").length > (prev.initial || "").length) spellingMap.set(key, next);
          return;
        }
        spellingMap.set(key, next);
      });
    });
    return api;
  }

  function segment(plain, count) {
    var memo = new Map();
    function rec(pos, left) {
      var memoKey = pos + ":" + left;
      if (memo.has(memoKey)) return memo.get(memoKey);
      var result = null;
      if (left === 0) {
        result = pos === plain.length ? [] : null;
      } else if (pos < plain.length) {
        var maxLen = Math.min(7, plain.length - pos);
        for (var len = maxLen; len >= 1; len--) {
          var slice = plain.slice(pos, pos + len);
          var hit = spellingMap.get(slice);
          if (!hit) continue;
          var rest = rec(pos + len, left - 1);
          if (rest) {
            result = [{ initial: hit.initial, final: hit.final }].concat(rest);
            break;
          }
        }
      }
      memo.set(memoKey, result);
      return result;
    }
    return rec(0, count);
  }

  function validTone(tone) {
    return tone === 0 || tone === 1 || tone === 2 || tone === 3 || tone === 4;
  }

  function splitPinyin(pinyin, tones) {
    if (!spellingMap) throw new Error("請先呼叫 PinyinGrade.init");
    if (!Array.isArray(tones) || !tones.length) return null;
    for (var i = 0; i < tones.length; i++) {
      if (!validTone(tones[i])) return null;
    }
    var plain = toPlain(pinyin);
    if (!plain) return null;
    var parts = segment(plain, tones.length);
    if (!parts || parts.length !== tones.length) return null;
    return parts.map(function (part, index) {
      return { initial: part.initial, final: part.final, tone: tones[index] };
    });
  }

  function spellReadings(readings) {
    return readings.map(function (reading) {
      return spellSyllable(reading.initial, reading.final, reading.tone);
    }).join("");
  }

  function attemptKey(attempt) {
    if (typeof attempt === "string") return normalizePinyin(attempt);
    if (Array.isArray(attempt)) return normalizePinyin(spellReadings(attempt));
    return "";
  }

  function acceptListOf(wordOrList) {
    if (Array.isArray(wordOrList)) return wordOrList;
    if (wordOrList && Array.isArray(wordOrList.accept)) return wordOrList.accept;
    if (wordOrList && Array.isArray(wordOrList.word_accept)) return wordOrList.word_accept;
    return [];
  }

  function gradeAttempt(attempt, wordOrList) {
    var key = attemptKey(attempt);
    var list = acceptListOf(wordOrList);
    var ok = key.length > 0 && list.some(function (item) {
      return normalizePinyin(item) === key;
    });
    return { ok: ok, normalized: key };
  }

  function isAccepted(attempt, wordOrList) {
    return gradeAttempt(attempt, wordOrList).ok;
  }

  function mapSeedWord(seed, setId) {
    var readings = splitPinyin(seed.pinyin, seed.tones);
    if (!readings) return null;
    return {
      id: seed.id,
      setId: setId,
      hanzi: seed.han,
      pinyin: seed.pinyin,
      tones: seed.tones.slice(),
      accept: seed.accept.slice(),
      readings: readings,
      note: ""
    };
  }

  var api = {
    init: init,
    normalizePinyin: normalizePinyin,
    spellSyllable: spellSyllable,
    applyToneMark: applyToneMark,
    splitPinyin: splitPinyin,
    gradeAttempt: gradeAttempt,
    isAccepted: isAccepted,
    mapSeedWord: mapSeedWord,
    collisions: function () { return collisions.slice(); }
  };

  return api;
});
