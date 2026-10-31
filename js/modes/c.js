/* 模式 C 組合拼音：聽詞語，再依每個字點聲母、韻母、聲調。
 * 作答前不顯示漢字。判定走模式 A／PinyinGrade，多音看 accept。
 * 瀏覽器不能朗讀時改為看字，並顯示說明。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ModeC = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var DEFAULT_COPY = {
    before: "請聽一聽，選出正確的聲母、韻母和聲調。選錯會立刻看到正確答案。",
    prompt: "聽一聽，選出正確的聲母、韻母和聲調。",
    prompt_fallback: "請看字，選出正確的聲母、韻母和聲調。",
    replay: "再聽一次",
    syllable: "第 {n} 個字",
    correct: "答對了！",
    wrong: "不對。正確是：{正解帶調拼音}",
    word_done: "完成！",
    set_done: "這組練習完成了，做得好！",
    no_speech: "這個瀏覽器不能朗讀。請改用支援中文語音的瀏覽器，或請旁邊的人讀出詞語。字詞會顯示出來，仍可練習。"
  };

  var SPEECH_RATE_KEY = "pinyinSpeechRate";
  var SPEECH_RATE_MIN = 0.1;
  var SPEECH_RATE_MAX = 10;
  var SPEECH_RATE_OPTIONS = [
    { id: "slow", label: "慢", rate: 0.7 },
    { id: "normal", label: "正常", rate: 1 },
    { id: "fast", label: "快", rate: 1.3 }
  ];

  function speechRateOption(id) {
    var i;
    for (i = 0; i < SPEECH_RATE_OPTIONS.length; i++) {
      if (SPEECH_RATE_OPTIONS[i].id === id) return SPEECH_RATE_OPTIONS[i];
    }
    return null;
  }

  function clampSpeechRate(rate) {
    var n = Number(rate);
    if (!isFinite(n)) return 1;
    if (n < SPEECH_RATE_MIN) return SPEECH_RATE_MIN;
    if (n > SPEECH_RATE_MAX) return SPEECH_RATE_MAX;
    return n;
  }

  function readSpeechRateId(storage) {
    try {
      if (!storage || typeof storage.getItem !== "function") return "normal";
      var raw = storage.getItem(SPEECH_RATE_KEY);
      if (speechRateOption(raw)) return raw;
    } catch (err) {}
    return "normal";
  }

  function readSpeechRate(storage) {
    return clampSpeechRate(speechRateOption(readSpeechRateId(storage)).rate);
  }

  function writeSpeechRateId(storage, id) {
    var chosen = speechRateOption(id) ? id : "normal";
    try {
      if (storage && typeof storage.setItem === "function") storage.setItem(SPEECH_RATE_KEY, chosen);
    } catch (err) {}
    return chosen;
  }

  function modeA() {
    if (typeof ModeA !== "undefined" && ModeA && typeof ModeA.gradeSyllable === "function") return ModeA;
    if (typeof require === "function") return require("./a.js");
    throw new Error("模式 A 尚未載入");
  }

  function gradeApi() {
    if (typeof PinyinGrade === "undefined" || !PinyinGrade) throw new Error("判定模組尚未載入");
    return PinyinGrade;
  }

  function fill(template, token, value) {
    return String(template || "").split(token).join(value == null ? "" : String(value));
  }

  function textOf(copy, key) {
    if (copy && copy[key]) return copy[key];
    return DEFAULT_COPY[key] || "";
  }

  function syllableLine(copy, n) {
    return fill(textOf(copy, "syllable"), "{n}", n);
  }

  function wrongLine(copy, pinyin) {
    return fill(textOf(copy, "wrong"), "{正解帶調拼音}", pinyin);
  }

  function gradeSyllable(word, index, choice) {
    return modeA().gradeSyllable(word, index, choice);
  }

  function createRun(words, copy) {
    return modeA().createRun(words, copy);
  }

  function submit(run, choice) {
    return modeA().submit(run, choice);
  }

  function sessionRecord(run, extra) {
    var record = modeA().sessionRecord(run, extra);
    record.mode = "C";
    return record;
  }

  function normLang(lang) {
    return String(lang || "").toLowerCase().replace(/_/g, "-");
  }

  function isZhCN(lang) {
    var n = normLang(lang);
    return n === "zh-cn" || n.indexOf("zh-cn-") === 0 ||
      n === "cmn-cn" || n.indexOf("cmn-cn-") === 0 || n.indexOf("cmn-hans-cn") === 0;
  }

  function isZh(lang) {
    var n = normLang(lang);
    return n === "zh" || n.indexOf("zh-") === 0 || n.indexOf("cmn") === 0;
  }

  function voiceList(synth) {
    try {
      var list = synth && synth.getVoices ? synth.getVoices() : [];
      return list || [];
    } catch (err) {
      return [];
    }
  }

  function chooseVoice(synth) {
    var voices = voiceList(synth);
    var i;
    for (i = 0; i < voices.length; i++) {
      if (isZhCN(voices[i].lang)) return voices[i];
    }
    for (i = 0; i < voices.length; i++) {
      if (isZh(voices[i].lang)) return voices[i];
    }
    return null;
  }

  function charsOf(text) {
    return Array.from(String(text || ""));
  }

  function spacedPinyin(word) {
    return word.readings.map(function (reading) {
      return gradeApi().spellSyllable(reading.initial, reading.final, reading.tone);
    }).join(" ");
  }

  function mount(rootEl, ctx) {
    var copy = ctx.copy || {};
    var words = ctx.words || [];
    var tables = ctx.tables;
    if (!tables && typeof PinyinTables !== "undefined" && PinyinTables.get) tables = PinyinTables.get();
    var run = createRun(words, copy);
    var phase = "pick";
    var last = null;
    var reported = false;
    var speechFailed = false;
    var voiceSettled = false;
    var announcedKey = "";
    var picked = { initial: null, final: null, tone: null, hasInitial: false };
    var speechStore = storageOf();
    var rateId = readSpeechRateId(speechStore);

    function synthOf() {
      if (ctx && Object.prototype.hasOwnProperty.call(ctx, "speechSynthesis")) return ctx.speechSynthesis;
      if (typeof window !== "undefined" && window.speechSynthesis) return window.speechSynthesis;
      return null;
    }

    function storageOf() {
      if (ctx && Object.prototype.hasOwnProperty.call(ctx, "storage")) return ctx.storage;
      try {
        if (typeof localStorage !== "undefined") return localStorage;
      } catch (err) {}
      return null;
    }

    function utteranceCtor() {
      if (ctx && ctx.Utterance) return ctx.Utterance;
      if (typeof SpeechSynthesisUtterance === "function") return SpeechSynthesisUtterance;
      return null;
    }

    function canSpeak() {
      var synth = synthOf();
      var Ctor = utteranceCtor();
      return !!(synth && Ctor && typeof synth.speak === "function");
    }

    function listening() {
      return canSpeak() && !speechFailed;
    }

    function speak(text) {
      var synth = synthOf();
      var Ctor = utteranceCtor();
      if (!synth || !Ctor || typeof synth.speak !== "function") return false;
      var utter;
      try {
        utter = new Ctor(String(text || ""));
      } catch (err) {
        return false;
      }
      utter.lang = "zh-CN";
      try {
        utter.rate = clampSpeechRate(speechRateOption(rateId).rate);
      } catch (err) {}
      var voice = chooseVoice(synth);
      if (voice) {
        try {
          utter.voice = voice;
          if (isZhCN(voice.lang)) voiceSettled = true;
        } catch (err) {
          voice = null;
        }
      }
      try {
        if (typeof synth.cancel === "function") synth.cancel();
        synth.speak(utter);
      } catch (err) {
        return false;
      }
      return true;
    }

    function activeWord() {
      if (!run.words.length) return null;
      if (phase === "feedback" && last && last.wordDone) return run.words[run.index - 1] || null;
      if (phase === "done") return null;
      return run.words[run.index] || null;
    }

    function announceCurrent() {
      if (phase !== "pick" || speechFailed || !canSpeak()) return;
      if (!words.length || !tables || run.syllable !== 0) return;
      var word = run.words[run.index];
      if (!word) return;
      var key = String(run.index);
      if (announcedKey === key) return;
      announcedKey = key;
      if (!speak(word.hanzi)) speechFailed = true;
    }

    function hookVoices() {
      var synth = synthOf();
      if (!synth || !canSpeak()) return;
      var onVoices = function () {
        if (voiceSettled || speechFailed) return;
        if (phase !== "pick" || run.syllable !== 0) return;
        var word = run.words[run.index];
        if (!word) return;
        if (!speak(word.hanzi)) {
          speechFailed = true;
          draw();
          return;
        }
        if (!voiceSettled && voiceList(synthOf()).length) voiceSettled = true;
      };
      if (typeof synth.addEventListener === "function") synth.addEventListener("voiceschanged", onVoices);
      else synth.onvoiceschanged = onVoices;
    }

    function shown() {
      if (phase === "feedback" && last && last.wordDone) {
        var idx = Math.max(0, run.index - 1);
        var answered = run.words[idx];
        return {
          word: answered,
          syllable: answered.readings.length - 1,
          progress: idx + 1
        };
      }
      if (phase === "feedback" && last) {
        return {
          word: run.words[run.index],
          syllable: Math.max(0, run.syllable - 1),
          progress: run.index + 1
        };
      }
      return {
        word: run.words[run.index],
        syllable: run.syllable,
        progress: run.index + 1
      };
    }

    function readyToCheck() {
      return picked.hasInitial && picked.final != null && picked.tone != null;
    }

    function report() {
      if (reported || !run.done || typeof ctx.onDone !== "function") return;
      reported = true;
      ctx.onDone(sessionRecord(run, { setId: ctx.setId }));
    }

    function button(label, part, value, pressed) {
      var node = document.createElement("button");
      node.type = "button";
      node.className = "pick";
      node.setAttribute("data-part", part);
      node.setAttribute("data-value", value);
      node.setAttribute("aria-pressed", pressed ? "true" : "false");
      node.textContent = label;
      return node;
    }

    function choose(part, value) {
      if (phase !== "pick") return;
      if (part === "initial") {
        picked.initial = value;
        picked.hasInitial = true;
      } else if (part === "final") {
        picked.final = value;
      } else {
        picked.tone = Number(value);
      }
      draw();
    }

    function pickerBlock(titleText, part, items, current) {
      var block = document.createElement("div");
      block.className = "picker-block";
      var heading = document.createElement("h3");
      heading.textContent = titleText;
      var row = document.createElement("div");
      row.className = "chips";
      items.forEach(function (item) {
        var pressed = current != null && String(current) === String(item.value);
        var node = button(item.label, part, item.value, pressed);
        node.addEventListener("click", function () { choose(part, item.value); });
        row.appendChild(node);
      });
      block.append(heading, row);
      return block;
    }

    function pickerGroups(yunmu) {
      var block = document.createElement("div");
      block.className = "picker-block";
      var heading = document.createElement("h3");
      heading.textContent = "韻母";
      block.appendChild(heading);
      var seen = [];
      yunmu.forEach(function (item) {
        if (seen.indexOf(item.group) === -1) seen.push(item.group);
      });
      seen.forEach(function (group) {
        var sub = document.createElement("h4");
        sub.textContent = group;
        var row = document.createElement("div");
        row.className = "chips";
        yunmu.filter(function (item) { return item.group === group; }).forEach(function (item) {
          var pressed = picked.final != null && picked.final === item.key;
          var node = button(item.label, "final", item.key, pressed);
          node.addEventListener("click", function () { choose("final", item.key); });
          row.appendChild(node);
        });
        block.append(sub, row);
      });
      return block;
    }

    function toneBlock(shengdiao) {
      return pickerBlock("聲調", "tone", shengdiao.map(function (item) {
        return { label: item.label + " " + item.mark, value: String(item.tone) };
      }), picked.tone == null ? null : String(picked.tone));
    }

    function hanziLine(word, syllable, markCurrent) {
      var han = document.createElement("p");
      han.className = "practice-han";
      charsOf(word.hanzi).forEach(function (ch, index) {
        var span = document.createElement("span");
        if (markCurrent && index === syllable) span.className = "current-char";
        span.textContent = ch;
        han.appendChild(span);
      });
      return han;
    }

    function replayButton(word) {
      var replay = document.createElement("button");
      replay.type = "button";
      replay.className = "secondary";
      replay.id = "replay-speech";
      replay.textContent = textOf(copy, "replay");
      replay.disabled = !listening();
      replay.addEventListener("click", function () {
        if (!listening() || !word) return;
        if (!speak(word.hanzi)) {
          speechFailed = true;
          draw();
        }
      });
      var rates = document.createElement("div");
      rates.className = "chips rate-controls";
      rates.setAttribute("role", "group");
      rates.setAttribute("aria-label", "朗讀速度");
      SPEECH_RATE_OPTIONS.forEach(function (item) {
        var node = document.createElement("button");
        node.type = "button";
        node.className = "pick";
        node.setAttribute("data-rate", item.id);
        node.setAttribute("aria-pressed", item.id === rateId ? "true" : "false");
        node.textContent = item.label;
        node.addEventListener("click", function () {
          rateId = writeSpeechRateId(speechStore, item.id);
          draw();
        });
        rates.appendChild(node);
      });
      var row = document.createElement("div");
      row.className = "listen-row";
      row.append(replay, rates);
      return row;
    }

    function draw() {
      announceCurrent();
      rootEl.replaceChildren();
      var title = document.createElement("h2");
      title.textContent = copy.name || "";
      var intro = document.createElement("p");
      intro.textContent = copy.intro || "";
      rootEl.append(title, intro);

      if (!words.length) {
        var empty = document.createElement("p");
        empty.className = "prompt";
        empty.textContent = "請先選擇有字詞的詞組。";
        rootEl.appendChild(empty);
        return;
      }
      if (!tables) {
        var missing = document.createElement("p");
        missing.className = "hint";
        missing.textContent = "拼音表尚未載入。";
        rootEl.appendChild(missing);
        return;
      }
      if (phase === "done" || (run.done && phase !== "feedback")) {
        var done = document.createElement("p");
        done.className = "prompt";
        done.textContent = textOf(copy, "set_done");
        var score = document.createElement("p");
        score.className = "hint";
        score.textContent = "答對 " + run.correctWords + "／" + run.total + " 題";
        rootEl.append(done, score);
        report();
        return;
      }

      var view = shown();
      var word = view.word;
      var hear = listening();
      var revealWord = phase === "feedback" && last && last.wordDone;
      var showHanzi = !hear || revealWord;
      var prompt = document.createElement("p");
      prompt.className = "prompt";
      prompt.textContent = hear ? textOf(copy, "prompt") : textOf(copy, "prompt_fallback");
      var step = document.createElement("p");
      step.className = "syllable";
      step.textContent = syllableLine(copy, view.syllable + 1);
      var progress = document.createElement("p");
      progress.className = "hint";
      progress.textContent = "第 " + view.progress + " 題，共 " + run.total + " 題";

      if (phase === "pick" && hear) {
        var before = document.createElement("p");
        before.className = "hint";
        before.textContent = textOf(copy, "before");
        rootEl.appendChild(before);
      }
      if (!hear) {
        var quiet = document.createElement("p");
        quiet.className = "hint";
        quiet.textContent = textOf(copy, "no_speech");
        rootEl.appendChild(quiet);
      }
      rootEl.appendChild(prompt);
      if (showHanzi) rootEl.appendChild(hanziLine(word, view.syllable, !revealWord));
      if (revealWord) {
        var py = document.createElement("p");
        py.className = "reveal-py";
        py.textContent = spacedPinyin(word);
        rootEl.appendChild(py);
      }
      rootEl.append(step, progress, replayButton(activeWord() || word));

      if (phase === "feedback" && last) {
        var feedback = document.createElement("p");
        feedback.id = "answer-feedback";
        feedback.className = last.ok ? "feedback good" : "feedback bad";
        feedback.textContent = last.feedback;
        var next = document.createElement("button");
        next.type = "button";
        next.id = "next-step";
        next.textContent = "繼續";
        next.addEventListener("click", function () {
          if (run.done) phase = "done";
          else phase = "pick";
          picked = { initial: null, final: null, tone: null, hasInitial: false };
          draw();
        });
        var actions = document.createElement("div");
        actions.className = "practice-actions";
        actions.appendChild(next);
        rootEl.append(feedback, actions);
        return;
      }

      rootEl.append(
        pickerBlock("聲母", "initial", tables.shengmu.map(function (item) {
          return { label: item.label, value: item.key };
        }), picked.hasInitial ? picked.initial : null),
        pickerGroups(tables.yunmu),
        toneBlock(tables.shengdiao)
      );

      var check = document.createElement("button");
      check.type = "button";
      check.id = "check-answer";
      check.textContent = "確定";
      check.disabled = !readyToCheck();
      check.addEventListener("click", function () {
        if (!readyToCheck()) return;
        last = submit(run, {
          initial: picked.initial,
          final: picked.final,
          tone: picked.tone
        });
        phase = "feedback";
        draw();
        var node = document.getElementById("answer-feedback");
        if (node && node.scrollIntoView) node.scrollIntoView({ block: "nearest" });
      });
      var checkRow = document.createElement("div");
      checkRow.className = "practice-actions";
      checkRow.appendChild(check);
      rootEl.appendChild(checkRow);
    }

    hookVoices();
    draw();
  }

  return {
    id: "C",
    mount: mount,
    syllableLine: syllableLine,
    wrongLine: wrongLine,
    gradeSyllable: gradeSyllable,
    createRun: createRun,
    submit: submit,
    sessionRecord: sessionRecord,
    speechRateKey: SPEECH_RATE_KEY,
    speechRateOptions: SPEECH_RATE_OPTIONS,
    clampSpeechRate: clampSpeechRate,
    readSpeechRateId: readSpeechRateId,
    readSpeechRate: readSpeechRate,
    writeSpeechRateId: writeSpeechRateId
  };
});
