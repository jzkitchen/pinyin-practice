/* 儲存後端與管理員校驗。
 * storage: "local" 用這台裝置的 localStorage（GitHub Pages 預設，Worker 未上線也能用）。
 * storage: "api"  呼叫 apiBase 上的 Cloudflare Worker。
 * adminPasswordSha256 是密碼 UTF-8 位元組的 SHA-256 十六進位，不是密碼本身。
 * 更換方式見 README。不要把密碼明文寫進這個檔案。
 */
var APP_CONFIG = {
  storage: "local",
  apiBase: "",
  adminPasswordSha256: "4cc69e6c10d10a0a8172a5a4c34a2b7f94476b447218564ce8a3c109849c43e2",
  dataUrl: "data/pinyin_tables_and_seeds_v1.json",
  demoSetId: "set_demo",
  demoSetName: "範例"
};

if (typeof module === "object" && module.exports) module.exports = APP_CONFIG;
