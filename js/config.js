/* 練習頁設定。字詞在 data/units/。練習紀錄只用這台裝置的 localStorage。 */
var APP_CONFIG = {
  dataUrl: "data/pinyin_tables_and_seeds_v1.json",
  bookTableUrl: "data/book_pinyin_table_v1.json"
};

if (typeof module === "object" && module.exports) module.exports = APP_CONFIG;
