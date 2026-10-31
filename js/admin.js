/* 家長管理。用 Firebase Auth 登入固定家長帳號，密碼不寫進網頁。 */
(function () {
  "use strict";

  var state = {
    sets: [],
    words: [],
    sessions: [],
    sessionsError: "",
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
      var sm = reading.initial ? data.shengmu.find(function (item) { return item.key === reading.initial; }) : null;
      var full = reading.final === "iu" ? "iou" : reading.final === "ui" ? "uei" : reading.final === "un" ? "uen" : reading.final;
      var ym = data.yunmu.find(function (item) {
        return item.key === reading.final || item.key === full || item.label === reading.final || item.label === full;
      });
      var sd = data.shengdiao.find(function (item) { return item.tone === reading.tone; });
      var spelled = PinyinGrade.spellSyllable(reading.initial, reading.final, reading.tone);
      return (sm ? sm.label : "無聲母") + " + " + (ym ? ym.label : reading.final) + " · " + (sd ? sd.label : reading.tone) + "（" + spelled + "）";
    }).join("　");
    return { ok: true, readings: readings, text: text };
  }

  function storageLabel() {
    if (APP_CONFIG.storage === "firebase") {
      return PinyinCloud.firebaseConfigured() ? "Firebase" : "Firebase（尚未填設定）";
    }
    return "本機";
  }

  function render() {
    app.replaceChildren();
    var intro = document.createElement("p");
    intro.className = "hint";
    intro.textContent = "儲存位置：" + storageLabel() + "。點選拼音（模式 A）、認讀選擇（模式 B）與組合拼音（模式 C）皆可練習。";

    var logout = document.createElement("button");
    logout.type = "button";
    logout.className = "secondary";
    logout.textContent = "登出";
    logout.addEventListener("click", function () {
      PinyinCloud.signOut().then(function () {
        gate.hidden = false;
        app.hidden = true;
        app.replaceChildren();
        setStatus("已登出。");
      }).catch(function (err) {
        setStatus(err.message || "無法登出", "bad");
      });
    });

    app.append(intro, logout, renderSets(), renderWords(), renderPassword(), renderSessions());
  }

  function renderPassword() {
    var card = document.createElement("section");
    card.className = "card";
    var title = document.createElement("h2");
    title.textContent = "更改密碼";
    var form = document.createElement("form");
    var currentLabel = document.createElement("label");
    currentLabel.setAttribute("for", "current-password");
    currentLabel.textContent = "目前密碼";
    var current = document.createElement("input");
    current.id = "current-password";
    current.type = "password";
    current.autocomplete = "current-password";
    current.required = true;
    var label = document.createElement("label");
    label.setAttribute("for", "next-password");
    label.textContent = "新密碼";
    var input = document.createElement("input");
    input.id = "next-password";
    input.type = "password";
    input.autocomplete = "new-password";
    input.required = true;
    var save = document.createElement("button");
    save.type = "submit";
    save.textContent = "更改密碼";
    form.append(currentLabel, current, label, input, save);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      PinyinCloud.changePassword(input.value, current.value).then(function () {
        input.value = "";
        current.value = "";
        setStatus("已更改密碼。");
      }).catch(function (err) {
        setStatus(err.message || "無法更改密碼", "bad");
      });
    });
    var hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = "至少 6 個字元。送出前會用目前密碼再向 Firebase 確認一次。也可以在主控台的 Authentication 裡重設。";
    card.append(title, hint, form);
    return card;
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
    if (state.sessionsError) {
      note.textContent = state.sessionsError;
    } else {
      note.textContent = state.sessions.length
        ? "共 " + state.sessions.length + " 筆。只有已登入的家長看得到。"
        : "尚無練習紀錄。做完一組練習後會寫在這裡。只有已登入的家長看得到。";
    }
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
      return PinyinCloud.listSessions().then(function (sessions) {
        state.sessions = sessions;
        state.sessionsError = "";
      }).catch(function (err) {
        state.sessions = [];
        state.sessionsError = err.message || "無法讀取練習紀錄";
      });
    }).then(function () {
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
    if (!PinyinCloud.firebaseConfigured()) {
      setStatus("雲端尚未設定，暫時不能進入家長管理。", "bad");
      return;
    }
    if (!password) {
      setStatus("請輸入密碼。", "bad");
      return;
    }
    setStatus("核對中…");
    PinyinCloud.signIn(APP_CONFIG.parentEmail, password).then(function () {
      document.getElementById("password").value = "";
      showApp();
    }).catch(function (err) {
      setStatus(err.message || "無法登入。", "bad");
    });
  });

  function showUnconfigured() {
    var form = document.getElementById("login-form");
    var note = document.getElementById("gate-unconfigured");
    if (form) form.hidden = true;
    if (note) note.hidden = false;
    setStatus("雲端尚未設定，暫時不能進入家長管理。");
  }

  function boot() {
    var emailNode = document.getElementById("parent-email");
    if (emailNode) emailNode.textContent = APP_CONFIG.parentEmail || "";
    try {
      sessionStorage.removeItem("pinyinAdminUnlocked");
      sessionStorage.removeItem("pinyinAdminSha");
    } catch (err) { /* ignore */ }
    PinyinTables.load(APP_CONFIG.dataUrl, APP_CONFIG.bookTableUrl).then(function (data) {
      PinyinGrade.init(data);
      PinyinCloud.init(APP_CONFIG, { tables: data });
      if (!PinyinCloud.firebaseConfigured()) {
        showUnconfigured();
        return null;
      }
      return PinyinCloud.connect({ auth: true });
    }).then(function (connected) {
      if (!PinyinCloud.firebaseConfigured()) return null;
      var button = document.getElementById("login-button");
      if (button) button.disabled = false;
      if (!connected) return null;
      return PinyinCloud.currentUser();
    }).then(function (user) {
      if (user) showApp();
    }).catch(function (err) {
      setStatus(err.message || "載入失敗", "bad");
    });
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }

  boot();
})();
