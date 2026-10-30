/* 模式 A 點選拼音。
 * 看到詞，依音節點聲母、韻母、聲調。對錯只走 PinyinGrade 和該詞 accept。
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

  function submit(run, choice) {
    var word = run.words[run.index];
    var graded = gradeSyllable(word, run.syllable, choice);
    var copy = run.copy;
    var wordDone = run.syllable + 1 >= word.readings.length;
    if (!graded.ok) run.wordMiss = true;
    var allCorrect = false;
    var feedback = graded.ok ? textOf(copy, "correct") : wrongLine(copy, graded.correctPinyin);
    if (wordDone) {
      allCorrect = !run.wordMiss;
      if (allCorrect) {
        run.correctWords += 1;
        feedback = textOf(copy, "word_done") + " " + spacedPinyin(word);
      }
      run.index += 1;
      run.syllable = 0;
      run.wordMiss = false;
      if (run.index >= run.words.length) run.done = true;
    } else {
      run.syllable += 1;
    }
    return {
      ok: graded.ok,
      correctPinyin: graded.correctPinyin,
      wordDone: wordDone,
      allCorrect: wordDone ? allCorrect : false,
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

  function mount(root, ctx) {
    var copy = ctx.copy || {};
    var words = ctx.words || [];
    var tables = ctx.tables;
    if (!tables && typeof PinyinTables !== "undefined" && PinyinTables.get) tables = PinyinTables.get();
    var run = createRun(words, copy);
    var phase = "pick";
    var last = null;
    var reported = false;
    var picked = { initial: null, final: null, tone: null, hasInitial: false };

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
        if (index === view.syllable) span.className = "current-char";
        span.textContent = ch;
        han.appendChild(span);
      });
      var step = document.createElement("p");
      step.className = "syllable";
      step.textContent = syllableLine(copy, view.syllable + 1);
      var progress = document.createElement("p");
      progress.className = "hint";
      progress.textContent = "第 " + view.progress + " 題，共 " + run.total + " 題";
      if (phase === "feedback") root.append(prompt, han, step, progress);
      else root.append(before, prompt, han, step, progress);

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
        root.append(feedback, actions);
        return;
      }

      root.append(pickerBlock("聲母", "initial", tables.shengmu.map(function (item) {
        return { label: item.label, value: item.key };
      }), picked.hasInitial ? picked.initial : null), pickerGroups(tables.yunmu), toneBlock(tables.shengdiao));

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
      var actions = document.createElement("div");
      actions.className = "practice-actions";
      actions.appendChild(check);
      root.appendChild(actions);
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
