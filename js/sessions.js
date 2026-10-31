/* 練習紀錄只存在這台裝置。
 * localStorage 鍵 pinyin-practice.sessions.v1。不讀、不寫雲端。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.PinyinSessions = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var STORAGE_KEY = "pinyin-practice.sessions.v1";

  function storageOf(storage) {
    if (storage) return storage;
    if (typeof localStorage !== "undefined") return localStorage;
    throw new Error("這台裝置無法使用本機儲存");
  }

  function read(storage) {
    var raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function write(storage, list) {
    storage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function uid() {
    return "session_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function createSession(input, storage) {
    input = input || {};
    var mode = input.mode;
    var setId = input.setId != null ? String(input.setId).trim() : "";
    if ((mode !== "A" && mode !== "B" && mode !== "C") || !setId) {
      return Promise.reject(new Error("練習紀錄不完整"));
    }
    var total = Number(input.total);
    var correct = Number(input.correct);
    var durationMs = Number(input.durationMs);
    if (!isFinite(total) || total < 0) total = 0;
    if (!isFinite(correct) || correct < 0) correct = 0;
    if (correct > total) correct = total;
    if (!isFinite(durationMs) || durationMs < 0) durationMs = 0;
    var session = {
      id: input.id || uid(),
      startedAt: input.startedAt || new Date().toISOString(),
      durationMs: Math.round(durationMs),
      mode: mode,
      setId: setId,
      total: Math.round(total),
      correct: Math.round(correct)
    };
    try {
      var box = storageOf(storage);
      var list = read(box);
      list.push(session);
      write(box, list);
    } catch (err) {
      return Promise.reject(err);
    }
    return Promise.resolve(session);
  }

  function listSessions(storage) {
    try {
      var list = read(storageOf(storage)).slice();
      list.sort(function (a, b) {
        if (a.startedAt === b.startedAt) return 0;
        return a.startedAt < b.startedAt ? 1 : -1;
      });
      return Promise.resolve(list);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  return {
    storageKey: STORAGE_KEY,
    createSession: createSession,
    listSessions: listSessions
  };
});
