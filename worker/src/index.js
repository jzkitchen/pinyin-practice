/* Cloudflare Worker。GitHub Pages 不執行這個檔。
 * 讀取詞組不必登入，讓練習頁在 api 模式可以開。
 * 新增、修改、刪除要帶標頭 X-Admin-Password-Sha256，
 * 值必須等於環境變數 ADMIN_PASSWORD_SHA256（與 js/config.js 同一個校驗碼）。
 * 練習紀錄的寫入不要求家長密碼，練習頁沒有登入。
 */

var ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password-Sha256",
    "Access-Control-Max-Age": "86400"
  };
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ "Content-Type": "application/json; charset=utf-8" }, corsHeaders())
  });
}

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function authorize(request, env) {
  var expected = String(env.ADMIN_PASSWORD_SHA256 || "").trim().toLowerCase();
  if (!expected) return { ok: false, status: 503, error: "伺服器尚未設定管理員校驗" };
  var got = String(request.headers.get("X-Admin-Password-Sha256") || "").trim().toLowerCase();
  if (!safeEqual(got, expected)) return { ok: false, status: 401, error: "未授權" };
  return { ok: true };
}

function nowIso() {
  return new Date().toISOString();
}

function newId() {
  return crypto.randomUUID();
}

function validId(id) {
  return typeof id === "string" && ID_RE.test(id);
}

function parseJson(text, fallback) {
  try { return JSON.parse(text); }
  catch (err) { return fallback; }
}

function wordFromRow(row) {
  return {
    id: row.id,
    setId: row.set_id,
    hanzi: row.hanzi,
    pinyin: row.pinyin,
    tones: parseJson(row.tones_json, []),
    accept: parseJson(row.accept_json, []),
    readings: parseJson(row.readings_json, []),
    note: row.note || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function setFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function sessionFromRow(row) {
  return {
    id: row.id,
    startedAt: row.started_at,
    durationMs: row.duration_ms,
    mode: row.mode,
    setId: row.set_id,
    total: row.total,
    correct: row.correct
  };
}

function cleanWord(body, fallbackId) {
  if (!body || typeof body !== "object") return { error: "資料不完整" };
  var hanzi = String(body.hanzi || "").trim();
  var pinyin = String(body.pinyin || "").trim();
  var setId = body.setId;
  if (!hanzi || hanzi.length > 32) return { error: "請填漢字" };
  if (!pinyin || pinyin.length > 80) return { error: "請填帶調拼音" };
  if (!validId(setId)) return { error: "找不到詞組" };
  if (!Array.isArray(body.tones) || !body.tones.length || body.tones.length > 16) return { error: "請填聲調" };
  for (var i = 0; i < body.tones.length; i++) {
    if ([0, 1, 2, 3, 4].indexOf(body.tones[i]) < 0) return { error: "聲調需為 0 到 4" };
  }
  if (!Array.isArray(body.accept) || !body.accept.length) return { error: "請至少填一個可接受讀音" };
  var accept = body.accept.map(function (item) { return String(item || "").trim(); }).filter(Boolean);
  if (!accept.length || accept.length > 12) return { error: "可接受讀音不正確" };
  if (!Array.isArray(body.readings) || body.readings.length !== body.tones.length) return { error: "拼音與聲調無法對上" };
  var readings = body.readings.map(function (reading, index) {
    return {
      initial: String(reading && reading.initial || ""),
      final: String(reading && reading.final || ""),
      tone: body.tones[index]
    };
  });
  var id = validId(body.id) ? body.id : (validId(fallbackId) ? fallbackId : newId());
  return {
    word: {
      id: id,
      setId: setId,
      hanzi: hanzi,
      pinyin: pinyin,
      tones: body.tones.slice(),
      accept: accept,
      readings: readings,
      note: String(body.note || "").trim().slice(0, 200)
    }
  };
}

async function readBody(request) {
  var text = await request.text();
  if (!text) return {};
  try { return JSON.parse(text); }
  catch (err) { return null; }
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
    var url = new URL(request.url);
    var path = url.pathname.replace(/\/$/, "") || "/";
    var method = request.method;

    try {
      if (method === "GET" && path === "/api/health") {
        return json({ ok: true, storage: "d1" });
      }

      if (method === "GET" && path === "/api/sets") {
        var sets = await env.DB.prepare("SELECT * FROM sets ORDER BY created_at").all();
        return json((sets.results || []).map(setFromRow));
      }

      if (method === "POST" && path === "/api/sets") {
        var auth = authorize(request, env);
        if (!auth.ok) return json({ error: auth.error }, auth.status);
        var body = await readBody(request);
        if (body == null) return json({ error: "資料不是 JSON" }, 400);
        var name = String(body.name || "").trim();
        if (!name || name.length > 40) return json({ error: "請填詞組名稱" }, 400);
        var at = nowIso();
        var set = { id: validId(body.id) ? body.id : newId(), name: name, createdAt: at, updatedAt: at };
        await env.DB.prepare("INSERT INTO sets (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
          .bind(set.id, set.name, set.createdAt, set.updatedAt).run();
        return json(set, 201);
      }

      var setMatch = path.match(/^\/api\/sets\/([A-Za-z0-9_-]+)$/);
      if (setMatch && (method === "PATCH" || method === "DELETE")) {
        var setAuth = authorize(request, env);
        if (!setAuth.ok) return json({ error: setAuth.error }, setAuth.status);
        var setId = setMatch[1];
        if (method === "DELETE") {
          await env.DB.batch([
            env.DB.prepare("DELETE FROM words WHERE set_id = ?").bind(setId),
            env.DB.prepare("DELETE FROM sets WHERE id = ?").bind(setId)
          ]);
          return json({ ok: true });
        }
        var patch = await readBody(request);
        if (patch == null) return json({ error: "資料不是 JSON" }, 400);
        var nextName = String(patch.name || "").trim();
        if (!nextName || nextName.length > 40) return json({ error: "請填詞組名稱" }, 400);
        var updated = nowIso();
        var result = await env.DB.prepare("UPDATE sets SET name = ?, updated_at = ? WHERE id = ?")
          .bind(nextName, updated, setId).run();
        if (!result.meta || result.meta.changes === 0) return json({ error: "找不到詞組" }, 404);
        var row = await env.DB.prepare("SELECT * FROM sets WHERE id = ?").bind(setId).first();
        return json(setFromRow(row));
      }

      if (method === "GET" && path === "/api/words") {
        var filter = url.searchParams.get("setId");
        var words;
        if (filter) {
          words = await env.DB.prepare("SELECT * FROM words WHERE set_id = ? ORDER BY created_at").bind(filter).all();
        } else {
          words = await env.DB.prepare("SELECT * FROM words ORDER BY created_at").all();
        }
        return json((words.results || []).map(wordFromRow));
      }

      if (method === "POST" && path === "/api/words") {
        var wordAuth = authorize(request, env);
        if (!wordAuth.ok) return json({ error: wordAuth.error }, wordAuth.status);
        var wordBody = await readBody(request);
        if (wordBody == null) return json({ error: "資料不是 JSON" }, 400);
        var cleaned = cleanWord(wordBody);
        if (cleaned.error) return json({ error: cleaned.error }, 400);
        var parent = await env.DB.prepare("SELECT id FROM sets WHERE id = ?").bind(cleaned.word.setId).first();
        if (!parent) return json({ error: "找不到詞組" }, 404);
        var created = wordBody.createdAt || nowIso();
        await env.DB.prepare(
          "INSERT INTO words (id, set_id, hanzi, pinyin, tones_json, accept_json, readings_json, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(
          cleaned.word.id,
          cleaned.word.setId,
          cleaned.word.hanzi,
          cleaned.word.pinyin,
          JSON.stringify(cleaned.word.tones),
          JSON.stringify(cleaned.word.accept),
          JSON.stringify(cleaned.word.readings),
          cleaned.word.note,
          created,
          nowIso()
        ).run();
        cleaned.word.createdAt = created;
        cleaned.word.updatedAt = nowIso();
        return json(cleaned.word, 201);
      }

      var wordMatch = path.match(/^\/api\/words\/([A-Za-z0-9_-]+)$/);
      if (wordMatch && (method === "PATCH" || method === "DELETE")) {
        var wordWrite = authorize(request, env);
        if (!wordWrite.ok) return json({ error: wordWrite.error }, wordWrite.status);
        var wordId = wordMatch[1];
        if (method === "DELETE") {
          await env.DB.prepare("DELETE FROM words WHERE id = ?").bind(wordId).run();
          return json({ ok: true });
        }
        var existing = await env.DB.prepare("SELECT * FROM words WHERE id = ?").bind(wordId).first();
        if (!existing) return json({ error: "找不到字詞" }, 404);
        var editBody = await readBody(request);
        if (editBody == null) return json({ error: "資料不是 JSON" }, 400);
        var edited = cleanWord(Object.assign({}, editBody, { id: wordId }));
        if (edited.error) return json({ error: edited.error }, 400);
        var editedAt = nowIso();
        await env.DB.prepare(
          "UPDATE words SET set_id = ?, hanzi = ?, pinyin = ?, tones_json = ?, accept_json = ?, readings_json = ?, note = ?, updated_at = ? WHERE id = ?"
        ).bind(
          edited.word.setId,
          edited.word.hanzi,
          edited.word.pinyin,
          JSON.stringify(edited.word.tones),
          JSON.stringify(edited.word.accept),
          JSON.stringify(edited.word.readings),
          edited.word.note,
          editedAt,
          wordId
        ).run();
        edited.word.createdAt = existing.created_at;
        edited.word.updatedAt = editedAt;
        return json(edited.word);
      }

      if (method === "GET" && path === "/api/sessions") {
        var sessions = await env.DB.prepare("SELECT * FROM sessions ORDER BY started_at DESC").all();
        return json((sessions.results || []).map(sessionFromRow));
      }

      if (method === "POST" && path === "/api/sessions") {
        var sessionBody = await readBody(request);
        if (sessionBody == null) return json({ error: "資料不是 JSON" }, 400);
        if (!sessionBody.mode || !validId(sessionBody.setId)) return json({ error: "練習紀錄不完整" }, 400);
        var session = {
          id: validId(sessionBody.id) ? sessionBody.id : newId(),
          startedAt: sessionBody.startedAt || nowIso(),
          durationMs: Number(sessionBody.durationMs) || 0,
          mode: String(sessionBody.mode),
          setId: sessionBody.setId,
          total: Number(sessionBody.total) || 0,
          correct: Number(sessionBody.correct) || 0
        };
        await env.DB.prepare(
          "INSERT INTO sessions (id, started_at, duration_ms, mode, set_id, total, correct) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).bind(session.id, session.startedAt, session.durationMs, session.mode, session.setId, session.total, session.correct).run();
        return json(session, 201);
      }

      if (method === "POST" && path === "/api/seed") {
        var seedAuth = authorize(request, env);
        if (!seedAuth.ok) return json({ error: seedAuth.error }, seedAuth.status);
        var seedBody = await readBody(request);
        if (seedBody == null || !seedBody.set || !Array.isArray(seedBody.words)) {
          return json({ error: "資料不完整" }, 400);
        }
        var seedName = String(seedBody.set.name || "").trim();
        var seedId = seedBody.set.id;
        if (!validId(seedId) || !seedName) return json({ error: "詞組資料不完整" }, 400);
        var already = await env.DB.prepare("SELECT id FROM sets WHERE id = ?").bind(seedId).first();
        if (already) return json({ created: false });
        var seedAt = seedBody.set.createdAt || nowIso();
        var statements = [
          env.DB.prepare("INSERT INTO sets (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)")
            .bind(seedId, seedName, seedAt, seedBody.set.updatedAt || seedAt)
        ];
        for (var n = 0; n < seedBody.words.length; n++) {
          var one = cleanWord(Object.assign({}, seedBody.words[n], { setId: seedId }));
          if (one.error) return json({ error: one.error }, 400);
          var wordAt = seedBody.words[n].createdAt || nowIso();
          statements.push(env.DB.prepare(
            "INSERT INTO words (id, set_id, hanzi, pinyin, tones_json, accept_json, readings_json, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
          ).bind(
            one.word.id,
            seedId,
            one.word.hanzi,
            one.word.pinyin,
            JSON.stringify(one.word.tones),
            JSON.stringify(one.word.accept),
            JSON.stringify(one.word.readings),
            one.word.note,
            wordAt,
            seedBody.words[n].updatedAt || wordAt
          ));
        }
        await env.DB.batch(statements);
        return json({ created: true }, 201);
      }

      return json({ error: "找不到" }, 404);
    } catch (err) {
      return json({ error: "伺服器忙碌" }, 500);
    }
  }
};
