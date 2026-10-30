# 架構備忘

靜態站，給 GitHub Pages 從倉庫根目錄直接發佈。沒有打包步驟。

## 頁面

- `index.html` 練習頁。載入拼音 JSON、必要時寫入「範例」詞組、列出字詞，並把模式 A／B／C 交給 `js/modes/`。三個模式只渲染「即將推出」和 JSON 裡的 `mode_copy`。
- `admin.html` 家長頁。用 SubtleCrypto SHA-256 比對 `js/config.js` 的 `adminPasswordSha256`。通過後在 sessionStorage 做分頁標記。詞組和字詞的新增、修改、刪除走 `js/cloud.js`。

## 資料

唯一來源是 `data/pinyin_tables_and_seeds_v1.json`（專家交付 v1，2026-10-30）。

本機儲存的形狀：

- 詞組：`{ id, name, createdAt, updatedAt }`
- 字詞：`{ id, setId, hanzi, pinyin, tones, accept, readings, note, createdAt, updatedAt }`
- `readings`：`[{ initial, final, tone }]`。`tone` 為 1–4，輕聲為 0。零聲母的 `initial` 是空字串。y、w 不當聲母。
- 多個 `accept` 表示這題常見讀音都算對，例如「媽媽」的 `māma` 與 `māmā`。
- 練習紀錄：`{ id, startedAt, durationMs, mode, setId, total, correct }`

種子詞的 `han` 對應 `hanzi`。顯示用的 `pinyin` 保留 JSON 原文（專名可有大寫）。拆音用聲母表和韻母表，不另做一份種子清單。

## 判定

`js/grade.js` 在比對前：Unicode NFC、小寫、去掉空白和隔音號、`v` 改成 `ü`、j／q／x 緊接的 u 改成 ü（`iu` 不受影響，因為 u 不是緊跟在 j／q／x 後面）。

對錯只看該詞的 `accept`。模式 A、C 以後可以把 `readings` 拼回帶調拼音再送進同一個函式。模式 B 以後比選項 id。玩法本身還沒寫。

標調位置：有 a 標 a，否則有 e 標 e，否則 `ou` 標 o，否則標第二個元音（`iu` 標 u、`ui` 標 i）。輕聲不加調號。j／q／x 後 ü 寫成 u；零聲母的 i、u、ü 寫成 y、w、yu。

## 兩種後端

`storage: "local"` 使用 localStorage 鍵 `pinyin-practice.v1`。第一次開啟會寫入範例；之後就算刪光詞組也不會自動補回，家長頁可以再載入範例。

`storage: "api"` 對 `config.apiBase` 呼叫 `worker/src/index.js`。D1 資料表見 `worker/schema.sql`。讀取公開，改詞組和字詞要標頭 `X-Admin-Password-Sha256`。練習紀錄的寫入不要求家長密碼，因為練習頁沒有登入。

## 快取

`sw.js` 的 `VERSION` 從 `v1` 起算。導覽先走網路，其餘靜態檔先用快取。換檔後要加大版本號。
