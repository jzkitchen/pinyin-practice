/* 模式 B 認讀選擇：看帶調拼音，輸入繁體字詞。
 * 對錯只比對該詞的漢字（有 han 用 han，否則用 hanzi）。
 * 先 trim，再去掉空白後必須完全相同。不另收簡體或異體。
 * accept 只供拼音變體；題幹用詞上的讀音，不拿來當字形答案。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ModeB = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var DEFAULT_COPY = {
    name: "認讀選擇",
    intro: "看帶調拼音，輸入正確的繁體字詞。",
    prompt: "請寫出讀作 {帶調拼音} 的字詞。",
    correct: "答對了！",
    wrong: "不對。正確是：{漢字}（{帶調拼音}）",
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
    if (typeof PinyinGrade !== "undefined" && PinyinGrade && typeof PinyinGrade.spellSyllable === "function") {
      return PinyinGrade;
    }
    return null;
  }

  function normalizeHan(text) {
    return String(text == null ? "" : text).normalize("NFC").replace(/[\s\u3000\u00a0\ufeff]+/g, "");
  }

  function answerHan(word) {
    if (!word) return "";
    if (word.han != null && String(word.han).trim()) return String(word.han);
    if (word.hanzi != null && String(word.hanzi).trim()) return String(word.hanzi);
    return "";
  }

  function displayHan(word) {
    return answerHan(word).trim();
  }

  function displayPinyin(word) {
    if (!word) return "";
    var grade = gradeApi();
    if (grade && Array.isArray(word.readings) && word.readings.length) {
      return word.readings.map(function (reading) {
        return grade.spellSyllable(reading.initial || "", reading.final, reading.tone, reading.erhua);
      }).join(" ");
    }
    return String(word.pinyin || "");
  }

  function promptLine(copy, pinyin) {
    return fill(textOf(copy, "prompt"), "{帶調拼音}", pinyin);
  }

  function wrongLine(copy, han, pinyin) {
    return fill(fill(textOf(copy, "wrong"), "{漢字}", han), "{帶調拼音}", pinyin);
  }

  function gradeAnswer(word, typed) {
    var han = displayHan(word);
    var pinyin = displayPinyin(word);
    var expected = normalizeHan(han);
    var attempt = normalizeHan(typed);
    return {
      ok: expected.length > 0 && attempt === expected,
      han: han,
      pinyin: pinyin
    };
  }

  function createRun(words, copy) {
    var list = Array.isArray(words) ? words.filter(Boolean) : [];
    return {
      words: list,
      index: 0,
      correctWords: 0,
      total: list.length,
      done: false,
      copy: copy || null,
      startedAt: new Date().toISOString(),
      startedMs: Date.now()
    };
  }

  function submit(run, typed) {
    var word = run.words[run.index];
    var graded = gradeAnswer(word, typed);
    var feedback = graded.ok
      ? textOf(run.copy, "correct")
      : wrongLine(run.copy, graded.han, graded.pinyin);
    if (graded.ok) run.correctWords += 1;
    run.index += 1;
    if (run.index >= run.words.length) run.done = true;
    return {
      ok: graded.ok,
      han: graded.han,
      pinyin: graded.pinyin,
      wordDone: true,
      allCorrect: graded.ok,
      setDone: run.done,
      feedback: feedback
    };
  }

  function sessionRecord(run, extra) {
    extra = extra || {};
    return {
      mode: "B",
      setId: extra.setId,
      total: run.total,
      correct: run.correctWords,
      startedAt: extra.startedAt || run.startedAt,
      durationMs: extra.durationMs != null ? extra.durationMs : Math.max(0, Date.now() - run.startedMs)
    };
  }

  function mount(root, ctx) {
    var copy = ctx.copy || {};
    var words = ctx.words || [];
    var run = createRun(words, copy);
    var phase = "pick";
    var last = null;
    var reported = false;

    function report() {
      if (reported || !run.done || typeof ctx.onDone !== "function") return;
      reported = true;
      ctx.onDone(sessionRecord(run, { setId: ctx.setId }));
    }

    function currentWord() {
      if (phase === "feedback" && last) return run.words[run.index - 1] || null;
      return run.words[run.index] || null;
    }

    function progressNumber() {
      if (phase === "feedback") return run.index;
      return run.index + 1;
    }

    function draw() {
      root.replaceChildren();
      var title = document.createElement("h2");
      title.textContent = copy.name || textOf(copy, "name");
      var intro = document.createElement("p");
      intro.textContent = copy.intro || textOf(copy, "intro");
      root.append(title, intro);

      if (!words.length) {
        var empty = document.createElement("p");
        empty.className = "prompt";
        empty.textContent = "請先選擇有字詞的單元。";
        root.appendChild(empty);
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

      var word = currentWord();
      var pinyin = displayPinyin(word);
      var progress = document.createElement("p");
      progress.className = "hint";
      progress.textContent = "第 " + progressNumber() + " 題，共 " + run.total + " 題";
      var prompt = document.createElement("p");
      prompt.className = "prompt";
      prompt.textContent = promptLine(copy, pinyin);
      var stem = document.createElement("p");
      stem.className = "practice-pinyin";
      stem.textContent = pinyin;
      root.append(progress, prompt, stem);

      if (phase === "feedback" && last) {
        if (!last.ok) {
          var han = document.createElement("p");
          han.className = "practice-han";
          han.textContent = last.han;
          root.appendChild(han);
        }
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
        var node = document.getElementById("answer-feedback");
        if (node && node.scrollIntoView) node.scrollIntoView({ block: "nearest" });
        return;
      }

      var form = document.createElement("form");
      form.className = "han-form";
      var label = document.createElement("label");
      label.setAttribute("for", "han-answer");
      label.textContent = "繁體字詞";
      var input = document.createElement("input");
      input.type = "text";
      input.id = "han-answer";
      input.className = "han-input";
      input.lang = "zh-Hant";
      input.setAttribute("lang", "zh-Hant");
      input.setAttribute("autocomplete", "off");
      input.setAttribute("autocapitalize", "off");
      input.setAttribute("autocorrect", "off");
      input.setAttribute("enterkeyhint", "done");
      input.setAttribute("inputmode", "text");
      input.setAttribute("aria-label", "繁體字詞");
      input.autocomplete = "off";
      input.spellcheck = false;
      input.maxLength = 32;
      input.enterKeyHint = "done";
      form.addEventListener("submit", function (event) {
        if (event && event.preventDefault) event.preventDefault();
        if (phase !== "pick") return;
        if (!normalizeHan(input.value)) return;
        last = submit(run, input.value);
        phase = "feedback";
        draw();
      });
      var check = document.createElement("button");
      check.type = "submit";
      check.id = "check-answer";
      check.textContent = "確定";
      var row = document.createElement("div");
      row.className = "practice-actions";
      row.appendChild(check);
      form.append(label, input, row);
      root.appendChild(form);
      if (typeof input.focus === "function") input.focus();
    }

    draw();
  }

  return {
    id: "B",
    mount: mount,
    displayPinyin: displayPinyin,
    promptLine: promptLine,
    wrongLine: wrongLine,
    gradeAnswer: gradeAnswer,
    createRun: createRun,
    submit: submit,
    sessionRecord: sessionRecord
  };
});
