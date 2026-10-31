# 架構備忘

靜態站。GitHub Pages 不從倉庫根目錄發佈，而由 GitHub Actions（`.github/workflows/pages.yml`）執行 `scripts/export-pages.js`，只上傳練習站檔案。`firestore.rules` 留在倉庫給 `firebase deploy`，不在 Pages 成品裡。Firebase JS 用 compat CDN，由 `js/cloud.js` 在需要時載入，不經打包。

## 頁面

- `index.html` 練習頁。載入拼音 JSON。先選詞組和模式，勾選字詞（預設全選，至少一個）後才開始；題序沿用原本順序，只含已勾選的詞。練習進行中不顯示詞組字詞列表。家長頁的字詞管理不變。模式 A 是看字點選拼音。模式 B 看帶調拼音，輸入繁體字詞；作答前不顯示漢字，答錯立刻顯示正確的字和拼音。模式 C 用系統內建 `speechSynthesis`（`zh-CN`）或 Piper 神經模型朗讀詞語，再點聲母、韻母、聲調；作答前不顯示漢字。進入模式 C 會背景下載預設女聲 `zh_CN-xiao_ya-medium`，有進度、可取消；未完成前朗讀走系統內建。男聲 `zh_CN-chaowen-medium` 只在神經模型且選男聲時下載。引擎、聲線、語速存在 `localStorage` 的 `pinyinSpeechEngine`、`pinyinSpeechVoice`、`pinyinSpeechRate`。神經模型是 pinyin 音素，不是 espeak，從 Hugging Face 下載並放進 Cache API，不進 git。沒有朗讀時改為看字，並顯示說明。練習頁不登入。
- `admin.html` 家長頁。`signInWithEmailAndPassword(APP_CONFIG.parentEmail, 輸入的密碼)`。帳號是 `parent@pinyin-practice.local`。通過後 Firebase Auth 自己記住登入狀態。詞組和字詞的新增、修改、刪除走 `js/cloud.js`。練習紀錄只有這位家長讀得到；未登入不會向 Firestore 列出 `sessions`。更改密碼會先用目前密碼 `reauthenticateWithCredential`，再 `updatePassword`。

## 資料

種子詞、模式文案、多音原則在 `data/pinyin_tables_and_seeds_v1.json`（2026-10-30）。點選表是 `data/book_pinyin_table_v1.json`（2026-10-31，聲母 21、韻母 35）。`js/pinyin-tables.js` 載入後以書本表蓋過聲母、韻母、聲調、`zero_initial_spell`、`ui_copy`、`normalize_rules`。韻母 key 用書本完整式（iou、uei、uen）。舊資料裡的 iu、ui、un 仍判成同一個韻母。

Firestore（與本機形狀相同）：

- 詞組 `sets`：`{ id, name, createdAt, updatedAt }`
- 字詞 `words`：`{ id, setId, hanzi, pinyin, tones, accept, readings, note, createdAt, updatedAt }`
- `readings`：`[{ initial, final, tone }]`。`tone` 為 1–4，輕聲為 0。零聲母的 `initial` 是空字串。y、w 不當聲母。
- 多個 `accept` 表示這題常見讀音都算對，例如「媽媽」的 `māma` 與 `māmā`。
- 練習紀錄 `sessions`：`{ id, startedAt, durationMs, mode, setId, total, correct }`

文件 id 與欄位 `id` 相同。種子詞的 `han` 對應 `hanzi`。顯示用的 `pinyin` 保留 JSON 原文（專名可有大寫）。拆音用 `PinyinGrade.mapSeedWord`。

## 判定

`js/grade.js` 在比對前：Unicode NFC、小寫、去掉空白和隔音號、`v` 改成 `ü`、完整式收成省略式（iou→iu、uei→ui、uen→un，聲調留在省略式該標的字母上）、j／q／x 緊接的 u 改成 ü（`iu` 不受影響，因為 u 不是緊跟在 j／q／x 後面）。聲母留空時，音節拼寫走書本表的 `zero_initial_spell`。

模式 A、C 一次送出整詞：畫面上每個字一格，共用一組聲母、韻母、聲調，選滿才可按「確定」。整詞用 `PinyinGrade.gradeAttempt` 對上該詞的 `accept`（含多音）。答錯立刻顯示整詞帶調拼音；模式 C 同時顯示繁體字。`gradeSyllable` 仍可用來檢查單一音節。整組做完顯示 `set_done`。模式 C 的 `submit` 走模式 A，紀錄的 `mode` 是 `C`。模式 B 把輸入的字串先 trim、再去掉空白（含全形空格），然後和該詞的 `han`（練習資料為 `hanzi`）做完全比對。不把簡體或異體算對，也不用 `accept` 當字形答案。題幹是詞上的帶調拼音；有 `readings` 時以空格分開的音節顯示。紀錄的 `mode` 是 `B`，欄位與 A、C 相同。

標調位置：有 a 標 a，否則有 e 標 e，否則 `ou` 標 o，否則標第二個元音（`iu` 標 u、`ui` 標 i）。輕聲不加調號。j／q／x 後 ü 寫成 u；零聲母的 i、u、ü 寫成 y、w、yu。

## Firebase

`storage: "firebase"` 對專案 `pinyin-practice-eabd1`（asia-east1）讀寫。公開設定在 `js/firebase-config.js`。`storage: "local"` 使用 localStorage 鍵 `pinyin-practice.v1`，只給測試和單機開發。

規則見 `firestore.rules`：

- `sets`、`words` 可公開讀。新增、修改、刪除要 `request.auth.token.email == parent@pinyin-practice.local`。
- `sessions` 只有該家長能讀。任何人可新增，但文件只能有 `id`、`startedAt`、`durationMs`、`mode`、`setId`、`total`、`correct`，型別與範圍寫在規則裡（`mode` 為 A／B／C，`total`／`correct` 為 0–500，`durationMs` 為 0–86400000）。不可更新或刪除。
- 家長頁列出練習紀錄前，客戶端會先確認目前使用者就是 `parentEmail`。
- 其餘路徑拒絕。

客戶端判定需要字詞裡的拼音，所以 `words` 必須能被未登入的練習頁讀到。

詞組查詢用 `where("setId", "==", id)`，排序在瀏覽器做，不必另外建複合索引。

`worker/` 已停用，不是這條路徑。

## 快取

`sw.js` 的 `VERSION` 目前是 `v11`。頁面、腳本和樣式改為網路優先，離線才用快取；啟動時會 `skipWaiting`、`clients.claim`，並刪掉舊的 `pinyin-practice-*` 快取。練習頁載入時會呼叫 `registration.update()`。換檔後仍要加大版本號。一般重新整理就會拿到新檔，不必先清網站資料。Firebase SDK 來自 CDN，不進這個快取。語音引擎也不在這個快取裡。
