/* 儲存後端。
 * storage: "firebase" 用 Firestore（預設）。公開的 Firebase 設定在 js/firebase-config.js。
 * storage: "local" 只用這台裝置的 localStorage，給離線開發和測試。
 * 前端不存放家長密碼，也不存放預期的校驗碼。
 */
var APP_CONFIG = {
  storage: "firebase",
  dataUrl: "data/pinyin_tables_and_seeds_v1.json",
  demoSetId: "set_demo",
  demoSetName: "範例",
  parentEmail: "parent@pinyin-practice.local"
};

if (typeof module === "object" && module.exports) module.exports = APP_CONFIG;
