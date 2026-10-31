/* 模式 A 點選拼音。
 * 看到整詞，每個字一格，一次送出整詞。對錯只走 PinyinGrade 和該詞 accept。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ModeA = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var TONE_MARK = {
    "ā": 1, "á": 2, "ǎ": 3, "à": 4,
    "ē": 1, "é": 2, "ě": 3, "è": 4,
    "ī": 1, "í": 2, "ǐ": 3, "ì": 4,
    "ō": 1, "ó": 2, "ǒ": 3, "ò": 4,
    "ū": 1, "ú": 2, "ǔ": 3, "ù": 4,
    "ǖ": 1, "ǘ": 2, "ǚ": 3, "ǜ": 4
  };

  var DEFAULT_COPY = {
    before: "請選出正確的聲母、韻母和聲調。選錯會立刻看到正確答案。",
    prompt: "請為「{詞}」選出拼音。",
    syllable: "第 {n} 個字",
    correct: "答對了！",
    wrong: "不對。正確是：{正解帶調拼音}",
    word_done: "完成！",
    set_done: "這組練習完成了，做得好！"
  };

  function fill(template, token, value) {
    return String(template || "").split(token).join(value == null ? "" : String(value));
  }

  function textOf(copy, key) {
    if (copy && copy[key]) return copy[key];
    return DEFAULT_COPY[key] || "";
  }

  function gradeApi() {
    if (typeof PinyinGrade === "undefined" || !PinyinGrade) throw new Error("判定模組尚未載入");
    return PinyinGrade;
  }

  function syllableLine(copy, n) {
    return fill(textOf(copy, "syllable"), "{n}", n);
  }

  function wrongLine(copy, pinyin) {
    return fill(textOf(copy, "wrong"), "{正解帶調拼音}", pinyin);
  }

  function zeros(count) {
    var tones = [];
    for (var i = 0; i < count; i++) tones.push(0);
    return tones;
  }

  function toneIn(text) {
    for (var i = 0; i < text.length; i++) {
      var tone = TONE_MARK[text.charAt(i)];
      if (tone) return tone;
    }
    return 0;
  }

  function decomposeAccept(pinyin, count) {
    var grade = gradeApi();
    var norm = grade.normalizePinyin(pinyin);
    var parts = grade.splitPinyin(norm, zeros(count));
    if (!parts || parts.length !== count) return null;
    var pos = 0;
    var readings = [];
    for (var i = 0; i < parts.length; i++) {
      var plain = grade.spellSyllable(parts[i].initial, parts[i].final, 0);
      if (pos + plain.length > norm.length) return null;
      var slice = norm.slice(pos, pos + plain.length);
      var tone = toneIn(slice);
      var spelled = grade.spellSyllable(parts[i].initial, parts[i].final, tone);
      if (grade.normalizePinyin(spelled) !== grade.normalizePinyin(slice)) return null;
      readings.push({
        initial: parts[i].initial || "",
        final: parts[i].final,
        tone: tone
      });
      pos += plain.length;
    }
    if (pos !== norm.length) return null;
    return readings;
  }

  function pathsFor(word) {
    var count = word.readings.length;
    var paths = [];
    (word.accept || []).forEach(function (alt) {
      var path = decomposeAccept(alt, count);
      if (path) paths.push(path);
    });
    paths.push(word.readings.map(function (reading) {
      return {
        initial: reading.initial || "",
        final: reading.final,
        tone: reading.tone
      };
    }));
    return paths;
  }

  function sameSyllable(choice, expected) {
    var grade = gradeApi();
    var leftInitial = choice.initial || "";
    var rightInitial = expected.initial || "";
    if (leftInitial !== rightInitial) return false;
    var left = grade.normalizePinyin(grade.spellSyllable(leftInitial, choice.final, Number(choice.tone)));
    var right = grade.normalizePinyin(grade.spellSyllable(rightInitial, expected.final, Number(expected.tone)));
    return left.length > 0 && left === right;
  }

  function preferredPinyin(word, index) {
    var reading = word.readings[index];
    return gradeApi().spellSyllable(reading.initial, reading.final, reading.tone);
  }

  function spacedPinyin(word) {
    return word.readings.map(function (reading, index) {
      return preferredPinyin(word, index);
    }).join(" ");
  }

  function gradeSyllable(word, index, choice) {
    var correctPinyin = preferredPinyin(word, index);
    var ok = pathsFor(word).some(function (path) {
      return path[index] && sameSyllable(choice, path[index]);
    });
    return { ok: ok, correctPinyin: correctPinyin };
  }

  function createRun(words, copy) {
    var list = Array.isArray(words) ? words.filter(Boolean) : [];
    return {
      words: list,
      index: 0,
      syllable: 0,
      correctWords: 0,
      total: list.length,
      wordMiss: false,
      done: false,
      copy: copy || null,
      startedAt: new Date().toISOString(),
      startedMs: Date.now()
    };
  }

  function choiceComplete(choice) {
    return !!(choice && choice.initial != null && choice.final != null && choice.tone != null);
  }

  function gradeWord(word, choices) {
    var correctPinyin = spacedPinyin(word);
    var ready = word && choices && choices.length === word.readings.length &&
      choices.every(choiceComplete);
    var ok = false;
    if (ready) {
      var attempt = choices.map(function (choice) {
        return {
          initial: choice.initial || "",
          final: choice.final,
          tone: Number(choice.tone)
        };
      });
      ok = gradeApi().gradeAttempt(attempt, word).ok;
    }
    return { ok: ok, correctPinyin: correctPinyin, hanzi: word ? word.hanzi : "" };
  }

  function submit(run, choices) {
    var word = run.words[run.index];
    var graded = gradeWord(word, choices);
    var copy = run.copy;
    var feedback = graded.ok
      ? textOf(copy, "word_done") + " " + graded.correctPinyin
      : wrongLine(copy, graded.correctPinyin);
    if (graded.ok) run.correctWords += 1;
    run.wordMiss = !graded.ok;
    run.index += 1;
    run.syllable = 0;
    if (run.index >= run.words.length) run.done = true;
    return {
      ok: graded.ok,
      correctPinyin: graded.correctPinyin,
      hanzi: graded.hanzi,
      wordDone: true,
      allCorrect: graded.ok,
      setDone: run.done,
      feedback: feedback
    };
  }

  function sessionRecord(run, extra) {
    extra = extra || {};
    return {
      mode: "A",
      setId: extra.setId,
      total: run.total,
      correct: run.correctWords,
      startedAt: extra.startedAt || run.startedAt,
      durationMs: extra.durationMs != null ? extra.durationMs : Math.max(0, Date.now() - run.startedMs)
    };
  }

  function charsOf(text) {
    return Array.from(String(text || ""));
  }

  function pickerApi() {
    if (typeof SyllablePicker !== "undefined" && SyllablePicker && typeof SyllablePicker.append === "function") {
      return SyllablePicker;
    }
    if (typeof require === "function") return require("../syllable-picker.js");
    throw new Error("點選表尚未載入");
  }

  function mount(root, ctx) {
    var copy = ctx.copy || {};
    var words = ctx.words || [];
    var tables = ctx.tables;
    if (!tables && typeof PinyinTables !== "undefined" && PinyinTables.get) tables = PinyinTables.get();
    var run = createRun(words, copy);
    var phase = "pick";
    var last = null;
    var reported = false;
    var active = 0;
    var slots = [];
    var slotWord = null;

    function blankSlot() {
      return { initial: null, final: null, tone: null };
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
      return !!(slot && slot.final != null && slot.tone != null);
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

    function draw() {
      root.replaceChildren();
      var title = document.createElement("h2");
      title.textContent = copy.name || "";
      var intro = document.createElement("p");
      intro.textContent = copy.intro || "";
      root.append(title, intro);

      if (!words.length) {
        var empty = document.createElement("p");
        empty.className = "prompt";
        empty.textContent = "請先選擇有字詞的詞組。";
        root.appendChild(empty);
        return;
      }
      if (!tables) {
        var missing = document.createElement("p");
        missing.className = "hint";
        missing.textContent = "拼音表尚未載入。";
        root.appendChild(missing);
        return;
      }
      if (phase === "done" || (run.done && phase !== "feedback")) {
        var done = document.createElement("p");
        done.className = "prompt";
        done.textContent = textOf(copy, "set_done");
        var score = document.createElement("p");
        score.className = "hint";
        score.textContent = "答對 " + run.correctWords + "／" + run.total + " 題";
        root.append(done, score);
        report();
        return;
      }

      var view = shown();
      var word = view.word;
      if (phase === "pick") syncSlots(word);
      var before = document.createElement("p");
      before.className = "hint";
      before.textContent = textOf(copy, "before");
      var prompt = document.createElement("p");
      prompt.className = "prompt";
      prompt.textContent = fill(textOf(copy, "prompt"), "{詞}", word.hanzi);
      var han = document.createElement("p");
      han.className = "practice-han";
      charsOf(word.hanzi).forEach(function (ch, index) {
        var span = document.createElement("span");
        if (phase === "pick" && index === active) span.className = "current-char";
        span.textContent = ch;
        han.appendChild(span);
      });
      var progress = document.createElement("p");
      progress.className = "hint";
      progress.textContent = "第 " + view.progress + " 題，共 " + run.total + " 題";
      if (phase === "feedback") root.append(prompt, han, progress);
      else root.append(before, prompt, han, slotRow(word), progress);

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
        root.append(feedback, actions);
        return;
      }

      pickerApi().append(root, {
        tables: tables,
        slot: activeSlot(),
        onChoose: choose
      });

      var check = document.createElement("button");
      check.type = "button";
      check.id = "check-answer";
      check.textContent = "確定";
      check.disabled = !readyToCheck();
      check.addEventListener("click", function () {
        if (!readyToCheck()) return;
        last = submit(run, slots.map(function (slot) {
          return { initial: slot.initial || "", final: slot.final, tone: slot.tone };
        }));
        phase = "feedback";
        draw();
        var node = document.getElementById("answer-feedback");
        if (node && node.scrollIntoView) node.scrollIntoView({ block: "nearest" });
      });
      var actions = document.createElement("div");
      actions.className = "practice-actions";
      actions.appendChild(check);
      root.appendChild(actions);
    }

    function choose(part, value) {
      if (phase !== "pick") return;
      var slot = slots[active];
      if (!slot) return;
      if (part === "initial") {
        slot.initial = value ? value : null;
      } else if (part === "final") {
        slot.final = value;
      } else {
        slot.tone = Number(value);
      }
      draw();
    }

    function slotSpell(slot) {
      if (!slotDone(slot)) return "？";
      return gradeApi().spellSyllable(slot.initial || "", slot.final, slot.tone);
    }

    function slotRow(word) {
      var row = document.createElement("div");
      row.className = "slots";
      charsOf(word.hanzi).forEach(function (ch, index) {
        var node = document.createElement("button");
        node.type = "button";
        node.className = "slot" + (index === active ? " current" : "");
        node.setAttribute("data-slot", String(index));
        node.setAttribute("aria-pressed", index === active ? "true" : "false");
        var label = document.createElement("span");
        label.className = "slot-han";
        label.textContent = ch;
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

    draw();
  }

  return {
    id: "A",
    mount: mount,
    syllableLine: syllableLine,
    wrongLine: wrongLine,
    gradeSyllable: gradeSyllable,
    createRun: createRun,
    submit: submit,
    sessionRecord: sessionRecord
  };
});
