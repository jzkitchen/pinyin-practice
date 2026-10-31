/* 練習頁。選詞組、選模式。模式 A 看字點選；模式 B 看拼音輸入繁體字；模式 C 聽讀後點選。練習頁不登入。 */
(function () {
  "use strict";

  var MODES = { A: ModeA, B: ModeB, C: ModeC };
  var state = { setId: null, mode: "A", sets: [], words: [], preview: false, previewMessage: "" };

  var root = document.getElementById("practice-root");
  var statusNode = document.getElementById("status");

  function setStatus(message, kind) {
    statusNode.textContent = message || "";
    statusNode.className = kind ? "status " + kind : "status";
  }

  function option(value, label) {
    var node = document.createElement("option");
    node.value = value;
    node.textContent = label;
    return node;
  }

  function render() {
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
      sessionStorage.setItem("practiceSetId", state.setId);
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
        state.mode = id;
        sessionStorage.setItem("practiceMode", id);
        render();
      });
      modes.appendChild(button);
    });

    tools.append(setLabel, setSelect, modeLabel, modes);

    var panel = document.createElement("section");
    panel.className = "card mode-panel";
    panel.setAttribute("aria-live", "polite");
    var sample = state.words[0] || null;
    MODES[state.mode].mount(panel, {
      copy: copy,
      sample: sample,
      words: state.words,
      tables: data,
      setId: state.setId,
      onDone: function (record) {
        if (!record || !record.setId) return Promise.resolve();
        return PinyinCloud.createSession(record).catch(function () {});
      }
    });

    var listCard = document.createElement("section");
    listCard.className = "card";
    var heading = document.createElement("h2");
    heading.textContent = "這個詞組的字詞";
    var count = document.createElement("p");
    count.className = "hint";
    if (!state.words.length) {
      count.textContent = "這個詞組還沒有字詞。";
    } else if (state.mode === "C") {
      count.textContent = "共 " + state.words.length + " 個。請聽聲音作答，字和拼音先不顯示。";
    } else if (state.mode === "A") {
      count.textContent = "共 " + state.words.length + " 個。拼音在練習裡作答。";
    } else if (state.mode === "B") {
      count.textContent = "共 " + state.words.length + " 個。請看拼音作答，字先不顯示。";
    } else {
      count.textContent = "共 " + state.words.length + " 個";
    }
    var list = document.createElement("ul");
    list.className = "word-list";
    if (state.mode === "A") {
      state.words.forEach(function (word) {
        var item = document.createElement("li");
        item.className = "word-card";
        var han = document.createElement("span");
        han.className = "han";
        han.textContent = word.hanzi;
        item.appendChild(han);
        list.appendChild(item);
      });
    } else if (state.mode === "B") {
      state.words.forEach(function (word) {
        var item = document.createElement("li");
        item.className = "word-card";
        var py = document.createElement("span");
        py.className = "py";
        py.textContent = ModeB.displayPinyin(word);
        item.appendChild(py);
        list.appendChild(item);
      });
    }
    if (state.mode === "C") listCard.append(heading, count);
    else listCard.append(heading, count, list);

    root.append(tools, panel, listCard);
  }

  function loadWords() {
    if (!state.setId) {
      state.words = [];
      render();
      return Promise.resolve();
    }
    if (state.preview) {
      var catalog = PinyinCloud.demoCatalog();
      state.words = state.setId === catalog.set.id ? catalog.words : [];
      render();
      return Promise.resolve();
    }
    return PinyinCloud.listWords(state.setId).then(function (words) {
      state.words = words;
      render();
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
    PinyinTables.load(APP_CONFIG.dataUrl).then(function (data) {
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
      var saved = sessionStorage.getItem("practiceSetId");
      var savedMode = sessionStorage.getItem("practiceMode");
      if (savedMode === "A" || savedMode === "B" || savedMode === "C") state.mode = savedMode;
      if (saved && sets.some(function (set) { return set.id === saved; })) state.setId = saved;
      else if (sets[0]) state.setId = sets[0].id;
      setStatus(state.preview ? state.previewMessage : "");
      return loadWords();
    }).catch(function (err) {
      setStatus(err.message || "載入失敗", "bad");
    });
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").then(function (registration) {
      if (registration && registration.update) registration.update();
    }).catch(function () {});
  }

  boot();
})();
