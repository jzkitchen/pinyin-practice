# 普通話拼音練習

給小朋友的普通話拼音網頁。純 HTML、CSS、JavaScript，沒有框架，也沒有建置步驟。GitHub Pages 從 `main` 根目錄發佈。

線上位置（啟用 Pages 之後）：<https://jzkitchen.github.io/pinyin-practice/>

## 現在有什麼

- 練習頁 `index.html`：選詞組、選模式，並列出字詞。
  - A 點選拼音
  - B 認讀選擇（看拼音或聽讀音後選字，不是自由打字）
  - C 組合拼音
  - 三種玩法都還是「即將推出」。
- 家長頁 `admin.html`：輸入密碼後，可以新增、修改、刪除詞組和字詞。
- 預設把資料放在這台裝置。Worker 還沒部署，Pages 一樣開得了。

請用靜態伺服器或 GitHub Pages 開啟，不要直接點開檔案。瀏覽器會擋住讀取 JSON，密碼校驗也需要 HTTPS 或 localhost。

```bash
python3 -m http.server 8080
```

然後開啟 <http://localhost:8080/>。

## 資料來源

聲母（22，含零聲母）、韻母（35）、聲調（5，含輕聲）、40 個種子詞、模式文案、多音規則，都以這個檔為準：

`data/pinyin_tables_and_seeds_v1.json`

這是 2026-10-30 的專家交付 v1。`js/pinyin-tables.js` 只負責載入，不另抄一份表。第一次在本機模式開啟時，種子詞會放進名為「範例」的詞組。

判定規則在 `js/grade.js`：比對前轉成小寫、去掉空白、ü 與 v 相同、j／q／x 後面的 u 與 ü 相同。常見讀音都在該詞的 `accept` 裡，答對其中一個就算對。不拿詞典裡的其他讀音湊對。

## 本機與雲端

`js/config.js` 的 `storage`：

- `local`（預設）：詞組、字詞、練習紀錄存在這台裝置的 localStorage。
- `api`：向 `apiBase` 呼叫 Cloudflare Worker。`apiBase` 不要加結尾斜線。

## 更換管理密碼

倉庫裡只有 SHA-256 校驗碼，沒有密碼。校驗碼寫在 `js/config.js` 的 `adminPasswordSha256`。

終端機請用 UTF-8。這段從標準輸入讀密碼，不會把密碼留在命令列參數裡：

```bash
read -rs PW
printf '%s' "$PW" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const {createHash}=require("crypto");process.stdout.write(createHash("sha256").update(d,"utf8").digest("hex")+"\n")})'
unset PW
```

把印出的 64 位十六進位貼上，取代 `adminPasswordSha256` 的舊值。不要把密碼寫進檔案，也不要提交。

登入時，瀏覽器用 Web Crypto 對剛輸入的密碼做 SHA-256，再和上面的校驗碼比較。成功後只在這個分頁的 sessionStorage 記下已解鎖，關掉分頁就要再輸入。

這個校驗碼現在放在前端，只能擋隨手打開。Worker 上線後，寫入會再跟環境變數比一次。兩邊用同一個校驗碼。仍然不要把密碼放進版本庫。

## 部署 Cloudflare Worker

Pages 不執行 `worker/`。要改走雲端時：

1. 用 `npx wrangler`（不必為這個靜態站加套件或建置）。
2. `npx wrangler d1 create pinyin-practice`
3. 把 `worker/wrangler.toml.example` 複製成 `worker/wrangler.toml`，填上 `database_id`。正式的 toml 不會被提交。
4. 在 `worker/` 目錄執行：`npx wrangler d1 execute pinyin-practice --remote --file=schema.sql`
5. `npx wrangler secret put ADMIN_PASSWORD_SHA256`，貼上與 `js/config.js` 相同的校驗碼。
6. `npx wrangler deploy`
7. 把 `js/config.js` 的 `storage` 改成 `"api"`，`apiBase` 改成 Worker 的網址。

資料表在 `worker/schema.sql`：`sets`、`words`、`sessions`。

| 方法 | 路徑 | 誰可以呼叫 |
| --- | --- | --- |
| GET | `/api/sets`、`/api/words?setId=`、`/api/sessions`、`/api/health` | 練習頁 |
| POST | `/api/sessions` | 練習頁（尚無登入） |
| POST、PATCH、DELETE | `/api/sets`、`/api/words` | 家長。標頭 `X-Admin-Password-Sha256` 要等於環境變數 |
| POST | `/api/seed` | 家長。用來載入範例詞組 |

`api` 模式不會在練習頁自動寫入。請到家長頁按「載入範例詞組」，或自己建詞組。

## 離線

`sw.js` 的 `VERSION` 目前是 `v1`。改了頁面、腳本或拼音資料後，請把版本加一（例如 `v2`），已經安裝的 App 下次開啟才會換掉舊快取。

## 測試

```bash
node tests/grade.test.js
node tests/cloud.test.js
node tests/static.test.js
```
