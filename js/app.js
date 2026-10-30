/* 練習頁。選詞組、選模式，列出字詞。模式 A／B／C 只顯示骨架。 */
(function () {
  "use strict";

  var MODES = { A: ModeA, B: ModeB, C: ModeC };
  var state = { setId: null, mode: "A", sets: [], words: [] };

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

  function renderTables(data) {
    var box = document.createElement("div");
    box.className = "table-block";

    var smTitle = document.createElement("h3");
    smTitle.textContent = "聲母";
    var sm = document.createElement("div");
    sm.className = "chips";
    data.shengmu.forEach(function (item) {
      var chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = item.label;
      sm.appendChild(chip);
    });

    var ymTitle = document.createElement("h3");
    ymTitle.textContent = "韻母";
    var groups = document.createElement("div");
    var seen = [];
    data.yunmu.forEach(function (item) {
      if (seen.indexOf(item.group) === -1) seen.push(item.group);
    });
    seen.forEach(function (group) {
      var heading = document.createElement("h4");
      heading.textContent = group;
      var row = document.createElement("div");
      row.className = "chips";
      data.yunmu.filter(function (item) { return item.group === group; }).forEach(function (item) {
        var chip = document.createElement("span");
        chip.className = "chip";
        chip.textContent = item.label;
        row.appendChild(chip);
      });
      groups.append(heading, row);
    });

    var sdTitle = document.createElement("h3");
    sdTitle.textContent = "聲調";
    var sd = document.createElement("div");
    sd.className = "chips";
    data.shengdiao.forEach(function (item) {
      var chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = item.label + " " + item.mark;
      sd.appendChild(chip);
    });

    var note = document.createElement("p");
    note.className = "hint";
    note.textContent = "聲母、韻母、聲調依專家交付 v1。其後若有修訂，以 data/pinyin_tables_and_seeds_v1.json 為準。";
    box.append(smTitle, sm, ymTitle, groups, sdTitle, sd, note);
    return box;
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
    MODES[state.mode].mount(panel, { copy: copy, sample: sample, words: state.words });

    var listCard = document.createElement("section");
    listCard.className = "card";
    var heading = document.createElement("h2");
    heading.textContent = "這個詞組的字詞";
    var count = document.createElement("p");
    count.className = "hint";
    count.textContent = state.words.length ? "共 " + state.words.length + " 個" : "這個詞組還沒有字詞。";
    var list = document.createElement("ul");
    list.className = "word-list";
    state.words.forEach(function (word) {
      var item = document.createElement("li");
      item.className = "word-card";
      var han = document.createElement("span");
      han.className = "han";
      han.textContent = word.hanzi;
      var py = document.createElement("span");
      py.className = "py";
      py.textContent = word.pinyin;
      item.append(han, py);
      if (word.accept && word.accept.length > 1) {
        var extras = word.accept.filter(function (itemText) {
          return PinyinGrade.normalizePinyin(itemText) !== PinyinGrade.normalizePinyin(word.pinyin);
        });
        if (extras.length) {
          var alt = document.createElement("span");
          alt.className = "alt";
          alt.textContent = "也可：" + extras.join("、");
          item.appendChild(alt);
        }
      }
      list.appendChild(item);
    });
    listCard.append(heading, count, list);

    var details = document.createElement("details");
    details.className = "card";
    var summary = document.createElement("summary");
    summary.textContent = "拼音表";
    details.append(summary, renderTables(data));

    root.append(tools, panel, listCard, details);
  }

  function loadWords() {
    if (!state.setId) {
      state.words = [];
      render();
      return Promise.resolve();
    }
    return PinyinCloud.listWords(state.setId).then(function (words) {
      state.words = words;
      render();
    });
  }

  function boot() {
    setStatus("載入中…");
    PinyinTables.load(APP_CONFIG.dataUrl).then(function (data) {
      PinyinGrade.init(data);
      PinyinCloud.init(APP_CONFIG, { tables: data });
      return PinyinCloud.seedIfEmpty();
    }).then(function (sets) {
      state.sets = sets;
      var saved = sessionStorage.getItem("practiceSetId");
      var savedMode = sessionStorage.getItem("practiceMode");
      if (savedMode === "A" || savedMode === "B" || savedMode === "C") state.mode = savedMode;
      if (saved && sets.some(function (set) { return set.id === saved; })) state.setId = saved;
      else if (sets[0]) state.setId = sets[0].id;
      setStatus("");
      return loadWords();
    }).catch(function (err) {
      setStatus(err.message || "載入失敗", "bad");
    });
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }

  boot();
})();
