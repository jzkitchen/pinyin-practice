# 架構備忘

靜態站。GitHub Pages 不從倉庫根目錄發佈，而由 GitHub Actions（`.github/workflows/pages.yml`）執行 `scripts/export-pages.js`，只上傳練習站檔案。字詞是倉庫裡的 JSON，練習紀錄只在瀏覽器的 localStorage。

## 頁面

- `index.html` 練習頁。先選單元和模式，勾選字詞（預設全選，至少一個）後才開始；題序沿用原本順序，只含已勾選的詞。練習進行中不顯示單元字詞列表。字詞來自 `js/units.js` 列出的靜態 JSON，目前只有 `data/units/unit-01.json`（單元一，九個詞）。模式 A 是看字點選拼音。模式 B 看帶調拼音，輸入繁體字詞；作答前不顯示漢字，答錯立刻顯示正確的字和拼音。模式 C 用系統內建 `speechSynthesis`（`zh-CN`）或 Piper 神經模型朗讀詞語，再點聲母、韻母、聲調；作答前不顯示漢字。進入模式 C 會背景下載預設女聲 `zh_CN-xiao_ya-medium`，有進度、可取消；未完成前朗讀走系統內建。男聲 `zh_CN-chaowen-medium` 只在神經模型且選男聲時下載。引擎、聲線、語速存在 `localStorage` 的 `pinyinSpeechEngine`、`pinyinSpeechVoice`、`pinyinSpeechRate`。神經模型是 pinyin 音素，不是 espeak，從 Hugging Face 下載並放進 Cache API，不進 git。沒有朗讀時改為看字，並顯示說明。做完一輪的練習紀錄由 `js/sessions.js` 寫入 `localStorage` 鍵 `pinyin-practice.sessions.v1`。

## 資料

模式文案、多音原則在 `data/pinyin_tables_and_seeds_v1.json`（2026-10-30）。點選表是 `data/book_pinyin_table_v1.json`（2026-10-31，聲母 21、韻母 35）。`js/pinyin-tables.js` 載入後以書本表蓋過聲母、韻母、聲調、`zero_initial_spell`、`ui_copy`、`normalize_rules`。韻母 key 用書本完整式（iou、uei、uen）。舊資料裡的 iu、ui、un 仍判成同一個韻母。點選表不另放兒化鍵。

練習字詞在 `data/units/unit-01.json`。`js/units.js` 把每個音節的 `shengmu`、`yunmu`、`tone` 收成 `readings`。`han` 對應練習資料的 `hanzi`。兒化音節不拆成「信」加 er：`erhua: true` 的音節在拼寫末尾加 r。展示拼音用 `pinyin_display`。整詞 `accept` 仍是可接受的拼音。專家欄位（音節 `accept`、`base_pinyin`、`tone_sandhi`、`citation`、`notes`）留在 JSON 和對應的 `syllables` 上。

練習紀錄 `sessions`：`{ id, startedAt, durationMs, mode, setId, total, correct }`，只存在 localStorage。

## 判定

`js/grade.js` 在比對前：Unicode NFC、小寫、去掉空白和隔音號、`v` 改成 `ü`、完整式收成省略式（iou→iu、uei→ui、uen→un，聲調留在省略式該標的字母上）、j／q／x 緊接的 u 改成 ü（`iu` 不受影響，因為 u 不是緊跟在 j／q／x 後面）。聲母留空時，音節拼寫走書本表的 `zero_initial_spell`。

模式 A、C 一次送出整詞：畫面上每個音節一格（兒化的「信兒」是一格，不是「信」和「兒」兩格），共用一組聲母、韻母、聲調，選滿才可按「確定」。兒化音節選完後出現「兒化」開關，按下就為該音節的拼寫加 r（E1：不加獨立 er 音節）。整詞用 `PinyinGrade.gradeAttempt` 對上該詞的 `accept`。答錯立刻顯示整詞帶調拼音；模式 C 同時顯示繁體字。`gradeSyllable` 仍可用來檢查單一音節。整組做完顯示 `set_done`。模式 C 的 `submit` 走模式 A，紀錄的 `mode` 是 `C`。模式 B 把輸入的字串先 trim、再去掉空白（含全形空格），然後和該詞的 `han`（練習資料為 `hanzi`）做完全比對。不把簡體或異體算對，也不用 `accept` 當字形答案。題幹是詞上的帶調拼音；有 `readings` 時以空格分開的音節顯示，兒化音節帶 r。紀錄的 `mode` 是 `B`，欄位與 A、C 相同。

標調位置：有 a 標 a，否則有 e 標 e，否則 `ou` 標 o，否則標第二個元音（`iu` 標 u、`ui` 標 i）。輕聲不加調號。j／q／x 後 ü 寫成 u；零聲母的 i、u、ü 寫成 y、w、yu。

## 本機紀錄

`js/sessions.js` 只用 localStorage。沒有登入，也不讀寫遠端。`worker/` 已停用，不是這條路徑。

## 快取

`sw.js` 的 `VERSION` 目前是 `v12`。頁面、腳本和樣式改為網路優先，離線才用快取；啟動時會 `skipWaiting`、`clients.claim`，並刪掉舊的 `pinyin-practice-*` 快取。練習頁載入時會呼叫 `registration.update()`。換檔後仍要加大版本號。一般重新整理就會拿到新檔，不必先清網站資料。單元 JSON 在預快取清單裡。語音引擎不在這個快取裡。
