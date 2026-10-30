/* 家長管理。密碼只在這台瀏覽器裡做 SHA-256 比對，明文不留下。 */
(function () {
  "use strict";

  var UNLOCK_KEY = "pinyinAdminUnlocked";
  var SHA_KEY = "pinyinAdminSha";
  var state = {
    sets: [],
    words: [],
    sessions: [],
    currentSetId: null,
    editingSetId: null,
    editingWordId: null
  };

  var gate = document.getElementById("gate");
  var app = document.getElementById("admin-app");
  var statusNode = document.getElementById("status");

  function setStatus(message, kind) {
    statusNode.textContent = message || "";
    statusNode.className = kind ? "status " + kind : "status";
  }

  function hashPassword(password) {
    var bytes = new TextEncoder().encode(password);
    return crypto.subtle.digest("SHA-256", bytes).then(function (buffer) {
      return Array.from(new Uint8Array(buffer)).map(function (byte) {
        return byte.toString(16).padStart(2, "0");
      }).join("");
    });
  }

  function expectedHash() {
    return String(APP_CONFIG.adminPasswordSha256 || "").trim().toLowerCase();
  }

  function unlocked() {
    return sessionStorage.getItem(UNLOCK_KEY) === "1";
  }

  function parseTones(text) {
    var parts = String(text || "").split(/[,，、\s]+/).filter(Boolean);
    if (!parts.length) return null;
    var tones = [];
    for (var i = 0; i < parts.length; i++) {
      if (!/^[0-4]$/.test(parts[i])) return null;
      tones.push(Number(parts[i]));
    }
    return tones;
  }

  function parseAccept(text) {
    return String(text || "").split(/\n+/).map(function (line) { return line.trim(); }).filter(Boolean);
  }

  function tonePreview(pinyin, tones) {
    var readings = PinyinGrade.splitPinyin(pinyin, tones);
    if (!readings) return { ok: false, text: "還不能拆開。請核對帶調拼音和聲調個數。" };
    var data = PinyinTables.get();
    var text = readings.map(function (reading) {
      var sm = data.shengmu.find(function (item) { return item.key === reading.initial; });
      var ym = data.yunmu.find(function (item) { return item.key === reading.final; });
      var sd = data.shengdiao.find(function (item) { return item.tone === reading.tone; });
      var spelled = PinyinGrade.spellSyllable(reading.initial, reading.final, reading.tone);
      return (sm ? sm.label : "零") + " + " + (ym ? ym.label : reading.final) + " · " + (sd ? sd.label : reading.tone) + "（" + spelled + "）";
    }).join("　");
    return { ok: true, readings: readings, text: text };
  }

  function storageLabel() {
    if (APP_CONFIG.storage === "api") {
      return APP_CONFIG.apiBase ? "雲端 API" : "雲端 API（尚未填 apiBase）";
    }
    return "本機";
  }

  function render() {
    app.replaceChildren();
    var intro = document.createElement("p");
    intro.className = "hint";
    intro.textContent = "儲存位置：" + storageLabel() + "。練習方式尚未上線，這裡先管理詞組和字詞。";

    var logout = document.createElement("button");
    logout.type = "button";
    logout.className = "secondary";
    logout.textContent = "登出";
    logout.addEventListener("click", function () {
      sessionStorage.removeItem(UNLOCK_KEY);
      sessionStorage.removeItem(SHA_KEY);
      gate.hidden = false;
      app.hidden = true;
      app.replaceChildren();
      setStatus("已登出。");
    });

    app.append(intro, logout, renderSets(), renderWords(), renderSessions());
  }

  function renderSets() {
    var card = document.createElement("section");
    card.className = "card";
    var title = document.createElement("h2");
    title.textContent = "詞組";
    var form = document.createElement("form");
    var label = document.createElement("label");
    label.setAttribute("for", "set-name");
    label.textContent = state.editingSetId ? "修改詞組名稱" : "新詞組名稱";
    var input = document.createElement("input");
    input.id = "set-name";
    input.maxLength = "40";
    input.required = true;
    if (state.editingSetId) {
      var editing = state.sets.find(function (set) { return set.id === state.editingSetId; });
      input.value = editing ? editing.name : "";
    }
    var actions = document.createElement("div");
    actions.className = "actions";
    var save = document.createElement("button");
    save.type = "submit";
    save.textContent = state.editingSetId ? "儲存詞組" : "新增詞組";
    actions.appendChild(save);
    if (state.editingSetId) {
      var cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "secondary";
      cancel.textContent = "取消";
      cancel.addEventListener("click", function () {
        state.editingSetId = null;
        render();
      });
      actions.appendChild(cancel);
    }
    var restore = document.createElement("button");
    restore.type = "button";
    restore.className = "secondary";
    restore.textContent = "載入範例詞組";
    restore.addEventListener("click", function () {
      setStatus("載入範例…");
      PinyinCloud.importDemoSet().then(function (result) {
        setStatus(result && result.created === false ? "範例詞組已存在。" : "已載入範例詞組。");
        return refresh();
      }).catch(function (err) {
        setStatus(err.message || "載入失敗", "bad");
      });
    });
    actions.appendChild(restore);
    form.append(label, input, actions);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var name = input.value;
      var task = state.editingSetId
        ? PinyinCloud.updateSet(state.editingSetId, { name: name })
        : PinyinCloud.createSet(name);
      task.then(function () {
        state.editingSetId = null;
        setStatus("已儲存。");
        return refresh();
      }).catch(function (err) {
        setStatus(err.message || "儲存失敗", "bad");
      });
    });

    var list = document.createElement("div");
    list.className = "stack";
    if (!state.sets.length) {
      var empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = "還沒有詞組。";
      list.appendChild(empty);
    }
    state.sets.forEach(function (set) {
      var row = document.createElement("div");
      row.className = "row";
      var name = document.createElement("button");
      name.type = "button";
      name.className = "text-button" + (set.id === state.currentSetId ? " current" : "");
      name.textContent = set.name;
      name.addEventListener("click", function () {
        state.currentSetId = set.id;
        state.editingWordId = null;
        refreshWords().then(render);
      });
      var buttons = document.createElement("div");
      buttons.className = "actions";
      var edit = document.createElement("button");
      edit.type = "button";
      edit.className = "secondary";
      edit.textContent = "修改";
      edit.addEventListener("click", function () {
        state.editingSetId = set.id;
        render();
      });
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "danger";
      remove.textContent = "刪除";
      remove.addEventListener("click", function () {
        if (!window.confirm("確定刪除這個詞組？組內字詞會一併刪除。")) return;
        PinyinCloud.deleteSet(set.id).then(function () {
          if (state.currentSetId === set.id) state.currentSetId = null;
          if (state.editingSetId === set.id) state.editingSetId = null;
          setStatus("已刪除詞組。");
          return refresh();
        }).catch(function (err) {
          setStatus(err.message || "刪除失敗", "bad");
        });
      });
      buttons.append(edit, remove);
      row.append(name, buttons);
      list.appendChild(row);
    });
    card.append(title, form, list);
    return card;
  }

  function renderWords() {
    var card = document.createElement("section");
    card.className = "card";
    var title = document.createElement("h2");
    title.textContent = "字詞";
    var current = state.sets.find(function (set) { return set.id === state.currentSetId; });
    var which = document.createElement("p");
    which.className = "hint";
    which.textContent = current ? "正在編輯：「" + current.name + "」" : "請先在上面點一個詞組。";
    card.append(title, which);
    if (!current) return card;

    var editing = state.words.find(function (word) { return word.id === state.editingWordId; });
    var form = document.createElement("form");
    form.append(
      field("word-hanzi", "漢字", "input", editing ? editing.hanzi : ""),
      field("word-pinyin", "帶調拼音", "input", editing ? editing.pinyin : ""),
      field("word-tones", "聲調", "input", editing ? editing.tones.join(",") : ""),
      field("word-accept", "可接受讀音", "textarea", editing ? editing.accept.join("\n") : ""),
      field("word-note", "備註（可留空）", "input", editing ? (editing.note || "") : "")
    );
    var toneHelp = document.createElement("p");
    toneHelp.className = "hint";
    toneHelp.textContent = "每個字一個聲調，用逗號分開。1 到 4 是四聲，0 是輕聲。例如媽媽：1,0。可接受讀音一行一個，常見讀音都算對。";
    var preview = document.createElement("p");
    preview.className = "preview";
    preview.id = "reading-preview";
    form.insertBefore(toneHelp, form.children[3]);
    form.insertBefore(preview, form.children[4]);

    function refreshPreview() {
      var pinyin = form.querySelector("#word-pinyin").value.trim();
      var tones = parseTones(form.querySelector("#word-tones").value);
      if (!pinyin || !tones) {
        preview.textContent = "";
        return;
      }
      preview.textContent = tonePreview(pinyin, tones).text;
    }
    form.addEventListener("input", refreshPreview);

    var actions = document.createElement("div");
    actions.className = "actions";
    var save = document.createElement("button");
    save.type = "submit";
    save.textContent = editing ? "儲存變更" : "新增字詞";
    actions.appendChild(save);
    if (editing) {
      var cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "secondary";
      cancel.textContent = "取消";
      cancel.addEventListener("click", function () {
        state.editingWordId = null;
        render();
      });
      actions.appendChild(cancel);
    }
    form.appendChild(actions);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var hanzi = form.querySelector("#word-hanzi").value;
      var pinyin = form.querySelector("#word-pinyin").value.trim();
      var tones = parseTones(form.querySelector("#word-tones").value);
      var accept = parseAccept(form.querySelector("#word-accept").value);
      var note = form.querySelector("#word-note").value;
      if (!tones) {
        setStatus("聲調請用 0 到 4，以逗號分開。", "bad");
        return;
      }
      var split = tonePreview(pinyin, tones);
      if (!split.ok) {
        setStatus(split.text, "bad");
        return;
      }
      var spelled = split.readings.map(function (reading) {
        return PinyinGrade.spellSyllable(reading.initial, reading.final, reading.tone);
      }).join("");
      if (PinyinGrade.normalizePinyin(spelled) !== PinyinGrade.normalizePinyin(pinyin)) {
        setStatus("帶調拼音和聲調對不上。依聲調拼出來是「" + spelled + "」。", "bad");
        return;
      }
      var payload = {
        setId: state.currentSetId,
        hanzi: hanzi,
        pinyin: pinyin,
        tones: tones,
        accept: accept.length ? accept : [pinyin],
        readings: split.readings,
        note: note,
        createdAt: editing ? editing.createdAt : undefined
      };
      var task = editing
        ? PinyinCloud.updateWord(editing.id, payload)
        : PinyinCloud.createWord(payload);
      task.then(function () {
        state.editingWordId = null;
        setStatus("已儲存。");
        return refreshWords();
      }).then(render).catch(function (err) {
        setStatus(err.message || "儲存失敗", "bad");
      });
    });
    card.appendChild(form);
    refreshPreview();

    var list = document.createElement("div");
    list.className = "stack";
    if (!state.words.length) {
      var empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = "這個詞組還沒有字詞。";
      list.appendChild(empty);
    }
    state.words.forEach(function (word) {
      var row = document.createElement("div");
      row.className = "row";
      var text = document.createElement("div");
      var han = document.createElement("strong");
      han.textContent = word.hanzi + " ";
      var py = document.createElement("span");
      py.textContent = word.pinyin;
      var acc = document.createElement("div");
      acc.className = "hint";
      acc.textContent = "可接受：" + word.accept.join("、");
      text.append(han, py, acc);
      var buttons = document.createElement("div");
      buttons.className = "actions";
      var edit = document.createElement("button");
      edit.type = "button";
      edit.className = "secondary";
      edit.textContent = "修改";
      edit.addEventListener("click", function () {
        state.editingWordId = word.id;
        render();
      });
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "danger";
      remove.textContent = "刪除";
      remove.addEventListener("click", function () {
        if (!window.confirm("確定刪除「" + word.hanzi + "」？")) return;
        PinyinCloud.deleteWord(word.id).then(function () {
          if (state.editingWordId === word.id) state.editingWordId = null;
          setStatus("已刪除字詞。");
          return refreshWords();
        }).then(render).catch(function (err) {
          setStatus(err.message || "刪除失敗", "bad");
        });
      });
      buttons.append(edit, remove);
      row.append(text, buttons);
      list.appendChild(row);
    });
    card.appendChild(list);
    return card;
  }

  function field(id, labelText, kind, value) {
    var label = document.createElement("label");
    label.setAttribute("for", id);
    label.textContent = labelText;
    var input = document.createElement(kind === "textarea" ? "textarea" : "input");
    input.id = id;
    if (kind !== "textarea") input.type = "text";
    input.value = value || "";
    if (id === "word-hanzi") input.maxLength = "32";
    if (id === "word-pinyin" || id === "word-tones") input.autocomplete = "off";
    var wrap = document.createElement("div");
    wrap.append(label, input);
    return wrap;
  }

  function renderSessions() {
    var card = document.createElement("section");
    card.className = "card";
    var title = document.createElement("h2");
    title.textContent = "練習紀錄";
    var note = document.createElement("p");
    note.className = "hint";
    note.textContent = state.sessions.length
      ? "共 " + state.sessions.length + " 筆。"
      : "尚無練習紀錄。模式上線後會寫入這裡。";
    card.append(title, note);
    state.sessions.forEach(function (session) {
      var row = document.createElement("p");
      row.textContent = session.startedAt + " · 模式 " + session.mode + " · " + session.correct + "/" + session.total;
      card.appendChild(row);
    });
    return card;
  }

  function refreshWords() {
    if (!state.currentSetId) {
      state.words = [];
      return Promise.resolve();
    }
    return PinyinCloud.listWords(state.currentSetId).then(function (words) {
      state.words = words;
    });
  }

  function refresh() {
    return PinyinCloud.listSets().then(function (sets) {
      state.sets = sets;
      if (!state.currentSetId || !sets.some(function (set) { return set.id === state.currentSetId; })) {
        state.currentSetId = sets.length ? sets[0].id : null;
      }
      return refreshWords();
    }).then(function () {
      return PinyinCloud.listSessions();
    }).then(function (sessions) {
      state.sessions = sessions;
      render();
    });
  }

  function showApp() {
    gate.hidden = true;
    app.hidden = false;
    setStatus("");
    refresh().catch(function (err) {
      setStatus(err.message || "載入失敗", "bad");
    });
  }

  document.getElementById("login-form").addEventListener("submit", function (event) {
    event.preventDefault();
    var password = document.getElementById("password").value;
    if (!password) {
      setStatus("請輸入密碼。", "bad");
      return;
    }
    if (!crypto.subtle) {
      setStatus("這個環境無法計算校驗碼。請用 HTTPS 或 localhost 開啟。", "bad");
      return;
    }
    setStatus("核對中…");
    hashPassword(password).then(function (hex) {
      document.getElementById("password").value = "";
      if (hex !== expectedHash()) {
        setStatus("密碼不正確。", "bad");
        return;
      }
      sessionStorage.setItem(UNLOCK_KEY, "1");
      sessionStorage.setItem(SHA_KEY, hex);
      showApp();
    }).catch(function () {
      setStatus("無法計算校驗碼。", "bad");
    });
  });

  function boot() {
    PinyinTables.load(APP_CONFIG.dataUrl).then(function (data) {
      PinyinGrade.init(data);
      PinyinCloud.init(APP_CONFIG, { tables: data });
      return PinyinCloud.seedIfEmpty();
    }).then(function () {
      var button = document.getElementById("login-button");
      if (button) button.disabled = false;
      if (unlocked()) showApp();
    }).catch(function (err) {
      setStatus(err.message || "載入失敗", "bad");
    });
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }

  boot();
})();
