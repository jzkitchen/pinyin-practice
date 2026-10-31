/* 練習頁。選詞組、選模式，勾選字詞後才開始。
 * 模式 A 看字點選；模式 B 看拼音輸入繁體字；模式 C 聽讀後點選。
 * 練習進行中不列出詞組字詞。練習頁不登入。
 */
(function () {
  "use strict";

  var MODES = {
    A: typeof ModeA === "undefined" ? null : ModeA,
    B: typeof ModeB === "undefined" ? null : ModeB,
    C: typeof ModeC === "undefined" ? null : ModeC
  };
  var state = {
    setId: null,
    mode: "A",
    sets: [],
    words: [],
    selected: {},
    practicing: false,
    preview: false,
    previewMessage: ""
  };

  var root = typeof document === "undefined" ? null : document.getElementById("practice-root");
  var statusNode = typeof document === "undefined" ? null : document.getElementById("status");
  var stopDownloadBar = function () {};
  var rendering = false;

  function wordKey(word, index) {
    if (word && word.id != null && String(word.id) !== "") return String(word.id);
    return "idx-" + index;
  }

  function defaultSelection(words) {
    var next = {};
    (words || []).forEach(function (word, index) {
      next[wordKey(word, index)] = true;
    });
    return next;
  }

  function selectedWords(words, selected) {
    return (words || []).filter(function (word, index) {
      return !!(selected && selected[wordKey(word, index)]);
    });
  }

  function canStart(words, selected) {
    return selectedWords(words, selected).length > 0;
  }

  function setStatus(message, kind) {
    if (!statusNode) return;
    statusNode.textContent = message || "";
    statusNode.className = kind ? "status " + kind : "status";
  }

  function option(value, label) {
    var node = document.createElement("option");
    node.value = value;
    node.textContent = label;
    return node;
  }

  function speechPrefs() {
    if (typeof PinyinTts === "undefined" || !PinyinTts) {
      return { engine: "builtin", voice: "female" };
    }
    try {
      if (typeof localStorage === "undefined") return PinyinTts.readPrefs(null);
      return PinyinTts.readPrefs(localStorage);
    } catch (err) {
      return PinyinTts.readPrefs(null);
    }
  }

  function startModeCDownloads(force) {
    if (typeof PinyinTts === "undefined" || !PinyinTts) return;
    var run = force ? PinyinTts.prefetchVoice : PinyinTts.warmupVoice;
    var prefs = speechPrefs();
    run("female");
    if (prefs.engine === "neural" && prefs.voice === "male") run("male");
  }

  function pickFace(word) {
    if (state.mode === "B" && typeof ModeB !== "undefined" && ModeB && typeof ModeB.displayPinyin === "function") {
      return { className: "py", text: ModeB.displayPinyin(word) };
    }
    if (state.mode === "B") return { className: "py", text: word && word.pinyin ? word.pinyin : "" };
    return { className: "han", text: word && word.hanzi ? word.hanzi : "" };
  }

  function render() {
    if (rendering || !root) return;
    rendering = true;
    stopDownloadBar();
    stopDownloadBar = function () {};
    try {
      var data = PinyinTables.get();
      var copy = data.mode_copy[state.mode];
      root.replaceChildren();

      var tools = document.createElement("section");
      tools.className = "card";

      var setLabel = document.createElement("label");
      setLabel.setAttribute("for", "set-select");
      setLabel.textContent = "詞組";
      var setSelect = document.createElement("select");
      setSelect.id = "set-select";
      if (!state.sets.length) {
        setSelect.appendChild(option("", "還沒有詞組"));
      } else {
        state.sets.forEach(function (set) {
          setSelect.appendChild(option(set.id, set.name));
        });
        setSelect.value = state.setId || "";
      }
      setSelect.addEventListener("change", function () {
        state.setId = setSelect.value;
        state.practicing = false;
        try { sessionStorage.setItem("practiceSetId", state.setId); } catch (err) {}
        loadWords();
      });

      var modeLabel = document.createElement("p");
      modeLabel.className = "field-label";
      modeLabel.textContent = "練習方式";
      var modes = document.createElement("div");
      modes.className = "modes";
      ["A", "B", "C"].forEach(function (id) {
        var button = document.createElement("button");
        button.type = "button";
        button.setAttribute("aria-pressed", id === state.mode ? "true" : "false");
        var modeCopy = data.mode_copy[id];
        button.append(document.createTextNode(modeCopy.name));
        var small = document.createElement("small");
        small.textContent = id;
        button.appendChild(small);
        button.addEventListener("click", function () {
          if (state.mode === id) return;
          state.mode = id;
          state.practicing = false;
          try { sessionStorage.setItem("practiceMode", id); } catch (err) {}
          if (id === "C") startModeCDownloads(true);
          render();
        });
        modes.appendChild(button);
      });

      tools.append(setLabel, setSelect, modeLabel, modes);

      var chosen = selectedWords(state.words, state.selected);
      if (!state.practicing || !chosen.length) {
        root.append(tools, buildPicker());
        return;
      }

      var panel = document.createElement("section");
      panel.className = "card mode-panel";
      panel.setAttribute("aria-live", "polite");
      MODES[state.mode].mount(panel, {
        copy: copy,
        sample: chosen[0] || null,
        words: chosen,
        tables: data,
        setId: state.setId,
        onDone: function (record) {
          if (!record || !record.setId) return Promise.resolve();
          return PinyinCloud.createSession(record).catch(function () {});
        }
      });
      root.append(tools, panel);
    } finally {
      rendering = false;
    }
  }

  function buildPicker() {
    var card = document.createElement("section");
    card.className = "card";
    card.id = "word-picker";

    var heading = document.createElement("h2");
    heading.textContent = "選擇要練習的字詞";
    var count = document.createElement("p");
    count.className = "hint";
    count.id = "pick-count";

    var bulk = document.createElement("div");
    bulk.className = "actions";
    var allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.id = "select-all";
    allBtn.className = "secondary";
    allBtn.textContent = "全選";
    var noneBtn = document.createElement("button");
    noneBtn.type = "button";
    noneBtn.id = "select-none";
    noneBtn.className = "secondary";
    noneBtn.textContent = "全不選";
    bulk.append(allBtn, noneBtn);

    var list = document.createElement("ul");
    list.className = "word-list";
    list.setAttribute("aria-label", "選擇要練習的字詞");
    var boxes = [];

    var need = document.createElement("p");
    need.id = "pick-need";
    need.className = "hint";
    need.textContent = "請至少勾選一個字詞。";

    var start = document.createElement("button");
    start.type = "button";
    start.id = "start-practice";
    start.textContent = "開始";

    function syncChrome() {
      var total = state.words.length;
      var picked = selectedWords(state.words, state.selected).length;
      if (!total) count.textContent = "這個詞組還沒有字詞。";
      else count.textContent = "共 " + total + " 個，已選 " + picked + " 個。";
      var blocked = picked < 1;
      start.disabled = blocked;
      allBtn.disabled = !total;
      noneBtn.disabled = !total;
      need.hidden = !blocked || !total;
    }

    function setAll(on) {
      state.words.forEach(function (word, index) {
        state.selected[wordKey(word, index)] = on;
      });
      boxes.forEach(function (box) { box.checked = on; });
      syncChrome();
    }

    state.words.forEach(function (word, index) {
      var key = wordKey(word, index);
      var item = document.createElement("li");
      item.className = "word-card";
      var label = document.createElement("label");
      label.className = "word-pick";
      var box = document.createElement("input");
      box.type = "checkbox";
      box.checked = !!state.selected[key];
      box.setAttribute("data-word-key", key);
      var face = pickFace(word);
      var text = document.createElement("span");
      text.className = face.className;
      text.textContent = face.text;
      box.addEventListener("change", function () {
        state.selected[key] = box.checked;
        syncChrome();
      });
      boxes.push(box);
      label.append(box, text);
      item.appendChild(label);
      list.appendChild(item);
    });

    allBtn.addEventListener("click", function () { setAll(true); });
    noneBtn.addEventListener("click", function () { setAll(false); });
    start.addEventListener("click", function () {
      if (!canStart(state.words, state.selected)) return;
      state.practicing = true;
      render();
    });

    card.append(heading);
    if (state.mode === "C" && typeof PinyinTts !== "undefined" && PinyinTts && PinyinTts.mountDownloadBar) {
      var downloads = document.createElement("div");
      downloads.className = "piper-downloads";
      stopDownloadBar = PinyinTts.mountDownloadBar(downloads, function () { render(); }) || function () {};
      if (downloads.children && downloads.children.length) card.appendChild(downloads);
    }
    card.append(count, bulk);
    if (state.words.length) card.appendChild(list);
    var startRow = document.createElement("div");
    startRow.className = "actions";
    startRow.appendChild(start);
    card.append(need, startRow);
    syncChrome();
    return card;
  }

  function applyWords(words) {
    state.words = words || [];
    state.selected = defaultSelection(state.words);
    state.practicing = false;
    render();
  }

  function loadWords() {
    if (!state.setId) {
      applyWords([]);
      return Promise.resolve();
    }
    if (state.preview) {
      var catalog = PinyinCloud.demoCatalog();
      applyWords(state.setId === catalog.set.id ? catalog.words : []);
      return Promise.resolve();
    }
    return PinyinCloud.listWords(state.setId).then(function (words) {
      applyWords(words);
    });
  }

  function settleSets(sets) {
    if (sets && sets.length) {
      state.preview = false;
      state.previewMessage = "";
      return sets;
    }
    if (!APP_CONFIG || APP_CONFIG.storage !== "firebase") {
      state.preview = false;
      state.previewMessage = "";
      return sets || [];
    }
    state.preview = true;
    state.previewMessage = "雲端詞組尚未就緒，現在練習內建範例。";
    return [PinyinCloud.demoCatalog().set];
  }

  function boot() {
    setStatus("載入中…");
    PinyinTables.load(APP_CONFIG.dataUrl, APP_CONFIG.bookTableUrl).then(function (data) {
      PinyinGrade.init(data);
      PinyinCloud.init(APP_CONFIG, { tables: data });
      return PinyinCloud.connect();
    }).then(function () {
      return PinyinCloud.seedIfEmpty();
    }).then(function (sets) {
      return settleSets(sets);
    }).catch(function () {
      return settleSets(null);
    }).then(function (sets) {
      state.sets = sets;
      var saved = null;
      var savedMode = null;
      try {
        saved = sessionStorage.getItem("practiceSetId");
        savedMode = sessionStorage.getItem("practiceMode");
      } catch (err) {}
      if (savedMode === "A" || savedMode === "B" || savedMode === "C") state.mode = savedMode;
      if (saved && sets.some(function (set) { return set.id === saved; })) state.setId = saved;
      else if (sets[0]) state.setId = sets[0].id;
      setStatus(state.preview ? state.previewMessage : "");
      if (state.mode === "C") startModeCDownloads(true);
      return loadWords();
    }).catch(function (err) {
      setStatus(err.message || "載入失敗", "bad");
    });
  }

  if (typeof module === "object" && module.exports) {
    module.exports = {
      wordKey: wordKey,
      defaultSelection: defaultSelection,
      selectedWords: selectedWords,
      canStart: canStart
    };
  }

  if (root) {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").then(function (registration) {
        if (registration && registration.update) registration.update();
      }).catch(function () {});
    }
    boot();
  }
})();
