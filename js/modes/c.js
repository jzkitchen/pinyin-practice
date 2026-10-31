/* 模式 C 組合拼音：聽整詞，每個字一格，一次送出整詞。
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

  function ttsApi() {
    if (typeof PinyinTts !== "undefined" && PinyinTts && PinyinTts.readPrefs) return PinyinTts;
    if (typeof require === "function") return require("../tts.js");
    throw new Error("語音模組尚未載入");
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

  function submit(run, choices) {
    var result = modeA().submit(run, choices);
    if (result && !result.ok && result.hanzi) {
      result.feedback = result.feedback + "（" + result.hanzi + "）";
    }
    return result;
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

  function voiceList(synth) {
    try {
      var list = synth && synth.getVoices ? synth.getVoices() : [];
      return list || [];
    } catch (err) {
      return [];
    }
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
    var active = 0;
    var slots = [];
    var slotWord = null;
    var Tts = ttsApi();
    var speechStore = storageOf();
    var prefs0 = Tts.readPrefs(speechStore);
    var rateId = prefs0.rateId;
    var engineId = prefs0.engine;
    var voiceId = prefs0.voice;
    var speechNote = "";
    var stopDownloadBar = function () {};
    var drawing = false;

    function neuralUsable() {
      return engineId === "neural" && Tts.isModelReady(voiceId);
    }

    function requestPrefetch(voice, how) {
      if (ctx && typeof ctx.prefetchVoice === "function") {
        ctx.prefetchVoice(voice, how);
        return;
      }
      if (typeof window === "undefined") return;
      if (how === "force") Tts.prefetchVoice(voice);
      else Tts.warmupVoice(voice);
    }

    function syncPrefetch(how) {
      var mode = how || "warmup";
      requestPrefetch("female", mode);
      if (engineId === "neural" && voiceId === "male") requestPrefetch("male", mode);
    }

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

    function canUseBuiltin() {
      var synth = synthOf();
      var Ctor = utteranceCtor();
      return !!(synth && Ctor && typeof synth.speak === "function");
    }

    function listening() {
      if (speechFailed) return false;
      if (neuralUsable()) return true;
      return canUseBuiltin();
    }

    function setSpeechNote(text) {
      speechNote = text || "";
      var node = document.getElementById("speech-status");
      if (!node) return;
      node.textContent = speechNote;
      node.hidden = !speechNote;
    }

    function speakBuiltin(text) {
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
        utter.rate = Tts.clampSpeechRate(Tts.rateById(rateId));
      } catch (err) {}
      var voice = Tts.chooseBuiltinVoice(voiceList(synth), voiceId);
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

    function speak(word) {
      Tts.cancel();
      if (neuralUsable()) {
        var phonemes = Tts.phonemesForReadings(word && word.readings);
        var request = {
          hanzi: word && word.hanzi,
          voice: voiceId,
          rate: Tts.rateById(rateId),
          lengthScale: Tts.lengthScaleForRate(Tts.rateById(rateId)),
          phonemes: phonemes,
          onProgress: function (loaded, total, label) {
            setSpeechNote(Tts.progressText(label, loaded, total));
          },
          onStatus: function (text) { setSpeechNote(text); }
        };
        if (!phonemes) {
          setSpeechNote(Tts.neuralFallback);
          return speakBuiltin(word && word.hanzi);
        }
        var run = ctx && typeof ctx.neuralSpeak === "function" ? ctx.neuralSpeak(request) : Tts.speakNeural(request);
        Promise.resolve(run).then(function (ok) {
          if (ok === false) return;
          if (!ok) throw new Error("neural");
          setSpeechNote("");
        }).catch(function () {
          setSpeechNote(Tts.neuralFallback);
          if (!speakBuiltin(word && word.hanzi)) {
            speechFailed = true;
            draw();
          }
        });
        return true;
      }
      return speakBuiltin(word && word.hanzi);
    }

    function activeWord() {
      if (!run.words.length) return null;
      if (phase === "feedback" && last && last.wordDone) return run.words[run.index - 1] || null;
      if (phase === "done") return null;
      return run.words[run.index] || null;
    }

    function announceCurrent() {
      if (phase !== "pick" || speechFailed) return;
      if (!canUseBuiltin() && !neuralUsable()) return;
      if (!words.length || !tables) return;
      var word = run.words[run.index];
      if (!word) return;
      var key = String(run.index);
      if (announcedKey === key) return;
      announcedKey = key;
      if (!speak(word)) speechFailed = true;
    }

    function hookVoices() {
      var synth = synthOf();
      if (!synth || !canUseBuiltin()) return;
      var onVoices = function () {
        if (neuralUsable() || voiceSettled || speechFailed) return;
        if (phase !== "pick") return;
        var word = run.words[run.index];
        if (!word) return;
        if (!speak(word)) {
          speechFailed = true;
          draw();
          return;
        }
        if (!voiceSettled && voiceList(synthOf()).length) voiceSettled = true;
      };
      if (typeof synth.addEventListener === "function") synth.addEventListener("voiceschanged", onVoices);
      else synth.onvoiceschanged = onVoices;
    }

    function blankSlot() {
      return { initial: null, final: null, tone: null, hasInitial: false };
    }

    function syncSlots(word) {
      if (!word) return;
      if (slotWord === word && slots.length === word.readings.length) return;
      slotWord = word;
      active = 0;
      slots = [];
      for (var i = 0; i < word.readings.length; i++) slots.push(blankSlot());
    }

    function activeSlot() {
      return slots[active] || blankSlot();
    }

    function slotDone(slot) {
      return !!(slot && slot.hasInitial && slot.final != null && slot.tone != null);
    }

    function shown() {
      if (phase === "feedback" && last && last.wordDone) {
        var idx = Math.max(0, run.index - 1);
        return { word: run.words[idx], progress: idx + 1 };
      }
      return { word: run.words[run.index], progress: run.index + 1 };
    }

    function readyToCheck() {
      return slots.length > 0 && slots.every(slotDone);
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
      var slot = slots[active];
      if (!slot) return;
      if (part === "initial") {
        slot.initial = value;
        slot.hasInitial = true;
      } else if (part === "final") {
        slot.final = value;
      } else {
        slot.tone = Number(value);
      }
      draw();
    }

    function slotSpell(slot) {
      if (!slotDone(slot)) return "？";
      return gradeApi().spellSyllable(slot.initial, slot.final, slot.tone);
    }

    function slotRow(word, showHanzi) {
      var row = document.createElement("div");
      row.className = "slots";
      var chars = charsOf(word.hanzi);
      chars.forEach(function (ch, index) {
        var node = document.createElement("button");
        node.type = "button";
        node.className = "slot" + (index === active ? " current" : "");
        node.setAttribute("data-slot", String(index));
        node.setAttribute("aria-pressed", index === active ? "true" : "false");
        var label = document.createElement("span");
        label.className = "slot-han";
        label.textContent = showHanzi ? ch : String(index + 1);
        var py = document.createElement("span");
        py.className = "slot-py";
        py.textContent = slotSpell(slots[index]);
        node.append(label, py);
        node.addEventListener("click", function () {
          if (phase !== "pick") return;
          active = index;
          draw();
        });
        row.appendChild(node);
      });
      return row;
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
          var pressed = activeSlot().final != null && activeSlot().final === item.key;
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
      }), activeSlot().tone == null ? null : String(activeSlot().tone));
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
        if (!speak(word)) {
          speechFailed = true;
          draw();
        }
      });
      function optionGroup(label, options, current, field) {
        var wrap = document.createElement("div");
        wrap.className = "listen-option";
        var name = document.createElement("span");
        name.className = "listen-option-label";
        name.textContent = label;
        var chips = document.createElement("div");
        chips.className = "chips";
        chips.setAttribute("role", "group");
        chips.setAttribute("aria-label", label);
        options.forEach(function (item) {
          var node = document.createElement("button");
          node.type = "button";
          node.className = "pick";
          node.setAttribute("data-tts", field);
          node.setAttribute("data-value", item.id);
          node.setAttribute("aria-pressed", item.id === current ? "true" : "false");
          node.textContent = item.label;
          node.addEventListener("click", function () {
            if (field === "rate") rateId = Tts.writePref(speechStore, "rate", item.id);
            else if (field === "engine") engineId = Tts.writePref(speechStore, "engine", item.id);
            else voiceId = Tts.writePref(speechStore, "voice", item.id);
            if (field === "engine" && engineId === "neural") requestPrefetch("female", "force");
            if (field === "voice" && voiceId === "female") requestPrefetch("female", "force");
            if (engineId === "neural" && voiceId === "male") requestPrefetch("male", "force");
            draw();
          });
          chips.appendChild(node);
        });
        wrap.append(name, chips);
        return wrap;
      }
      var note = document.createElement("p");
      note.id = "speech-status";
      note.className = "hint";
      note.textContent = speechNote;
      note.hidden = !speechNote;
      var panel = document.createElement("div");
      panel.className = "listen-panel";
      panel.append(
        replay,
        optionGroup("引擎", Tts.engines, engineId, "engine"),
        optionGroup("聲線", Tts.voices, voiceId, "voice"),
        optionGroup("語速", Tts.speechRateOptions, rateId, "rate"),
        note
      );
      return panel;
    }

    function draw() {
      if (drawing) return;
      drawing = true;
      stopDownloadBar();
      stopDownloadBar = function () {};
      try {
      announceCurrent();
      rootEl.replaceChildren();
      var title = document.createElement("h2");
      title.textContent = copy.name || "";
      var intro = document.createElement("p");
      intro.textContent = copy.intro || "";
      rootEl.append(title, intro);
      var downloads = document.createElement("div");
      downloads.className = "piper-downloads";
      stopDownloadBar = Tts.mountDownloadBar(downloads, function () { draw(); }) || function () {};
      if (downloads.children && downloads.children.length) rootEl.appendChild(downloads);

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
      if (phase === "pick") syncSlots(word);
      var hear = listening();
      var revealWord = phase === "feedback" && last && last.wordDone;
      var showHanzi = !hear || revealWord;
      var prompt = document.createElement("p");
      prompt.className = "prompt";
      prompt.textContent = hear ? textOf(copy, "prompt") : textOf(copy, "prompt_fallback");
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
      if (showHanzi) rootEl.appendChild(hanziLine(word, active, phase === "pick"));
      if (phase === "pick") rootEl.appendChild(slotRow(word, showHanzi));
      if (revealWord) {
        var py = document.createElement("p");
        py.className = "reveal-py";
        py.textContent = spacedPinyin(word);
        rootEl.appendChild(py);
      }
      rootEl.append(progress, replayButton(activeWord() || word));

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
          draw();
        });
        var actions = document.createElement("div");
        actions.className = "practice-actions";
        actions.appendChild(next);
        rootEl.append(feedback, actions);
        return;
      }

      var current = activeSlot();
      rootEl.append(
        pickerBlock("聲母", "initial", tables.shengmu.map(function (item) {
          return { label: item.label, value: item.key };
        }), current.hasInitial ? current.initial : null),
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
        last = submit(run, slots.map(function (slot) {
          return { initial: slot.initial, final: slot.final, tone: slot.tone };
        }));
        phase = "feedback";
        draw();
        var node = document.getElementById("answer-feedback");
        if (node && node.scrollIntoView) node.scrollIntoView({ block: "nearest" });
      });
      var checkRow = document.createElement("div");
      checkRow.className = "practice-actions";
      checkRow.appendChild(check);
      rootEl.appendChild(checkRow);
      } finally {
        drawing = false;
      }
    }

    syncPrefetch("warmup");
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
    speechRateKey: ttsApi().speechRateKey,
    speechRateOptions: ttsApi().speechRateOptions,
    clampSpeechRate: function (rate) { return ttsApi().clampSpeechRate(rate); },
    readSpeechRateId: function (storage) { return ttsApi().readSpeechRateId(storage); },
    readSpeechRate: function (storage) { return ttsApi().readSpeechRate(storage); },
    writeSpeechRateId: function (storage, id) { return ttsApi().writePref(storage, "rate", id); }
  };
});
