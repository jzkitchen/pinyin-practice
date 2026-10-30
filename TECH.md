# 架構備忘

靜態站。GitHub Pages 不從倉庫根目錄發佈，而由 GitHub Actions（`.github/workflows/pages.yml`）執行 `scripts/export-pages.js`，只上傳練習站檔案。`firestore.rules` 留在倉庫給 `firebase deploy`，不在 Pages 成品裡。Firebase JS 用 compat CDN，由 `js/cloud.js` 在需要時載入，不經打包。

## 頁面

- `index.html` 練習頁。載入拼音 JSON。模式 A 是看字點選拼音。模式 C 用 `speechSynthesis`（`zh-CN`）朗讀詞語，再點聲母、韻母、聲調；作答前不顯示漢字。沒有朗讀時改為看字，並顯示說明。模式 B 仍只渲染「即將推出」和 `mode_copy`。練習頁不登入。
- `admin.html` 家長頁。`signInWithEmailAndPassword(APP_CONFIG.parentEmail, 輸入的密碼)`。帳號是 `parent@pinyin-practice.local`。通過後 Firebase Auth 自己記住登入狀態。詞組和字詞的新增、修改、刪除走 `js/cloud.js`。練習紀錄只有這位家長讀得到；未登入不會向 Firestore 列出 `sessions`。更改密碼會先用目前密碼 `reauthenticateWithCredential`，再 `updatePassword`。

## 資料

唯一來源是 `data/pinyin_tables_and_seeds_v1.json`（專家交付 v1，2026-10-30）。

Firestore（與本機形狀相同）：

- 詞組 `sets`：`{ id, name, createdAt, updatedAt }`
- 字詞 `words`：`{ id, setId, hanzi, pinyin, tones, accept, readings, note, createdAt, updatedAt }`
- `readings`：`[{ initial, final, tone }]`。`tone` 為 1–4，輕聲為 0。零聲母的 `initial` 是空字串。y、w 不當聲母。
- 多個 `accept` 表示這題常見讀音都算對，例如「媽媽」的 `māma` 與 `māmā`。
- 練習紀錄 `sessions`：`{ id, startedAt, durationMs, mode, setId, total, correct }`

文件 id 與欄位 `id` 相同。種子詞的 `han` 對應 `hanzi`。顯示用的 `pinyin` 保留 JSON 原文（專名可有大寫）。拆音用 `PinyinGrade.mapSeedWord`。

## 判定

`js/grade.js` 在比對前：Unicode NFC、小寫、去掉空白和隔音號、`v` 改成 `ü`、j／q／x 緊接的 u 改成 ü（`iu` 不受影響，因為 u 不是緊跟在 j／q／x 後面）。

模式 A 每個音節用點選的聲母、韻母、聲調，經 `PinyinGrade.spellSyllable` 後，對上該詞任一 `accept` 拆出來的同一字。聲母必須相同；j／q／x 後面的 u 與 ü 因拼寫歸一而視為同一。答錯立刻顯示該字首選帶調拼音。整組做完顯示 `set_done`。模式 C 呼叫同一組 `ModeA.gradeSyllable`／`submit`，紀錄的 `mode` 是 `C`。模式 B 以後比選項 id。

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

`sw.js` 的 `VERSION` 目前是 `v4`。導覽先走網路，其餘靜態檔先用快取。換檔後要加大版本號。Firebase SDK 來自 CDN，不進這個快取。語音引擎也不在這個快取裡。
