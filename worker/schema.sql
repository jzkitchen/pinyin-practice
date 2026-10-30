-- 普通話拼音練習 · Cloudflare D1
-- 詞組、字詞、練習紀錄。拼音表本身留在靜態 JSON，不進資料庫。

CREATE TABLE IF NOT EXISTS sets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS words (
  id TEXT PRIMARY KEY,
  set_id TEXT NOT NULL,
  hanzi TEXT NOT NULL,
  pinyin TEXT NOT NULL DEFAULT '',
  tones_json TEXT NOT NULL DEFAULT '[]',
  accept_json TEXT NOT NULL DEFAULT '[]',
  readings_json TEXT NOT NULL DEFAULT '[]',
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_words_set ON words(set_id);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  mode TEXT NOT NULL,
  set_id TEXT NOT NULL,
  total INTEGER NOT NULL,
  correct INTEGER NOT NULL
);
