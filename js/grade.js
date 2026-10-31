/* 拼音判定。
 * 歸一：小寫、去掉空白、ü≡v、iou≡iu、uei≡ui、uen≡un、j／q／x 後 u≡ü。
 * 聲母、韻母、zero_initial_spell、normalize_rules 由 PinyinGrade.init(data) 餵入（書本表）。
 * 點選可以是完整式；寫出和 accept 比對用日常拼寫。對錯只比對該詞的 accept。
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

  var FULL_OF_ABBREV = { iu: "iou", ui: "uei", un: "uen" };

  var KNOWN_RULES = {
    lowercase_trim: true,
    "ü_equiv_v": true,
    iou_equiv_iu: true,
    uei_equiv_ui: true,
    uen_equiv_un: true,
    "jqx_u_equiv_ü": true
  };

  var tables = null;
  var spellingMap = null;
  var collisions = [];

  function ruleOn(name) {
    var list = tables && tables.normalize_rules;
    if (!list) return true;
    for (var i = 0; i < list.length; i++) {
      if (list[i] === name) return true;
    }
    return false;
  }

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

  function canonicalFinalKey(final) {
    var fin = String(final || "").replace(/v/g, "ü");
    return FULL_OF_ABBREV[fin] || fin;
  }

  function findYunmu(final) {
    if (!tables || !tables.yunmu) return null;
    var fin = String(final || "").replace(/v/g, "ü");
    var full = FULL_OF_ABBREV[fin] || fin;
    for (var i = 0; i < tables.yunmu.length; i++) {
      var item = tables.yunmu[i];
      if (item.key === fin || item.key === full || item.label === fin || item.label === full) return item;
    }
    return null;
  }

  function zeroInitial(final) {
    if (final === "i") return "yi";
    if (final === "in") return "yin";
    if (final === "ing") return "ying";
    if (final === "iu" || final === "iou") return "you";
    if (final.charAt(0) === "i") return "y" + final.slice(1);
    if (final === "u") return "wu";
    if (final === "ui" || final === "uei") return "wei";
    if (final === "un" || final === "uen") return "wen";
    if (final.charAt(0) === "u") return "w" + final.slice(1);
    if (final === "ü") return "yu";
    if (final === "üe") return "yue";
    if (final === "ün") return "yun";
    if (final === "üan") return "yuan";
    return final;
  }

  function jqxWrite(initial, written) {
    if (!isJqx(initial) || !ruleOn("jqx_u_equiv_ü")) return written;
    if (written === "ü") return "u";
    if (written === "üe") return "ue";
    if (written === "ün") return "un";
    if (written === "üan") return "uan";
    return written;
  }

  function abbreviateWritten(written) {
    if (written === "iou" && ruleOn("iou_equiv_iu")) return "iu";
    if (written === "uei" && ruleOn("uei_equiv_ui")) return "ui";
    if (written === "uen" && ruleOn("uen_equiv_un")) return "un";
    return written;
  }

  function spellFinal(initial, final) {
    var ym = findYunmu(final);
    var fin = ym ? ym.key : canonicalFinalKey(final);
    var ini = initial || "";
    if (!ini) {
      var spell = tables && tables.zero_initial_spell;
      if (spell && Object.prototype.hasOwnProperty.call(spell, fin)) return spell[fin];
      return zeroInitial(fin);
    }
    var written = ym && ym.write_with_initial ? ym.write_with_initial : fin;
    return jqxWrite(ini, abbreviateWritten(written));
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

  function spellSyllable(initial, final, tone, erhua) {
    var ini = initial || "";
    var written = spellFinal(ini, final);
    var marked = applyToneMark(written, Number(tone) || 0);
    var text = ini ? ini + marked : marked;
    return erhua ? text + "r" : text;
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

  function toneOfChar(ch) {
    var base = stripBase(ch);
    var forms = MARK[base];
    if (!forms) return 0;
    var idx = forms.indexOf(ch);
    return idx > 0 ? idx : 0;
  }

  function rewriteAbbrev(input) {
    var patterns = [];
    if (ruleOn("iou_equiv_iu")) patterns.push(["iou", "iu"]);
    if (ruleOn("uei_equiv_ui")) patterns.push(["uei", "ui"]);
    if (ruleOn("uen_equiv_un")) patterns.push(["uen", "un"]);
    var chars = String(input || "").split("");
    if (!patterns.length) return chars.join("");
    var bases = chars.map(stripBase);
    var toneAt = chars.map(toneOfChar);
    patterns.forEach(function (pair) {
      var pattern = pair[0];
      var replacement = pair[1];
      var baseStr = bases.join("");
      var idx = 0;
      while ((idx = baseStr.indexOf(pattern, idx)) >= 0) {
        if (pattern === "uen" && baseStr.charAt(idx + pattern.length) === "g") {
          idx += 1;
          continue;
        }
        var tone = 0;
        for (var k = 0; k < pattern.length; k++) {
          if (toneAt[idx + k]) tone = toneAt[idx + k];
        }
        var marked = applyToneMark(replacement, tone);
        var newBases = [];
        var newTones = [];
        for (var n = 0; n < marked.length; n++) {
          newBases.push(stripBase(marked.charAt(n)));
          newTones.push(toneOfChar(marked.charAt(n)));
        }
        bases = bases.slice(0, idx).concat(newBases, bases.slice(idx + pattern.length));
        toneAt = toneAt.slice(0, idx).concat(newTones, toneAt.slice(idx + pattern.length));
        baseStr = bases.join("");
        idx += replacement.length;
      }
    });
    var out = "";
    for (var i = 0; i < bases.length; i++) {
      if (!toneAt[i]) out += bases[i];
      else {
        var forms = MARK[bases[i]];
        out += forms ? forms[toneAt[i]] : bases[i];
      }
    }
    return out;
  }

  function normalizePinyin(input) {
    var s = rewriteAbbrev(cleanChars(input));
    if (ruleOn("jqx_u_equiv_ü")) s = jqxUToUmlaut(s);
    return s;
  }

  function toPlain(input) {
    var s = rewriteAbbrev(cleanChars(input));
    var out = "";
    for (var i = 0; i < s.length; i++) out += stripBase(s.charAt(i));
    if (ruleOn("jqx_u_equiv_ü")) return jqxUmlautToU(out);
    return out;
  }

  function init(data) {
    if (!data || !data.shengmu || !data.yunmu) throw new Error("拼音表不完整");
    if (data.normalize_rules) {
      data.normalize_rules.forEach(function (name) {
        if (!KNOWN_RULES[name]) throw new Error("未知歸一規則：" + name);
      });
    }
    tables = data;
    spellingMap = new Map();
    collisions = [];
    var initials = [{ key: "" }];
    data.shengmu.forEach(function (sm) {
      if (!sm || !sm.key || sm.key === "y" || sm.key === "w" || sm.label === "零") return;
      initials.push(sm);
    });
    initials.forEach(function (sm) {
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
      return spellSyllable(reading.initial, reading.final, reading.tone, reading && reading.erhua);
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
