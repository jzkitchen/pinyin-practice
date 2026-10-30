# 普通話拼音練習

給小朋友的普通話拼音網頁。純 HTML、CSS、JavaScript，沒有框架，也沒有建置步驟。GitHub Pages 從 `main` 根目錄發佈。

線上位置（啟用 Pages 之後）：<https://jzkitchen.github.io/pinyin-practice/>

## 現在有什麼

- 練習頁 `index.html`：選詞組，再選練習方式。
  - A 點選拼音：看字詞，依每個字點聲母、韻母、聲調。答錯立刻看到帶調拼音，做完選定的詞組就結束。
  - B 認讀選擇、C 組合拼音：仍是「即將推出」。
- 家長頁 `admin.html`：用 Firebase 家長帳號登入後，可以新增、修改、刪除詞組和字詞。
- 練習頁不登入。字詞讀取和練習紀錄的新增都不需要家長密碼。

請用靜態伺服器或 GitHub Pages 開啟，不要直接點開檔案。瀏覽器會擋住讀取 JSON，Firebase 也需要 HTTPS 或 localhost。

```bash
python3 -m http.server 8080
```

然後開啟 <http://localhost:8080/>。

## 資料來源

聲母（22，含零聲母）、韻母（35）、聲調（5，含輕聲）、40 個種子詞、模式文案、多音規則，都以這個檔為準：

`data/pinyin_tables_and_seeds_v1.json`

這是 2026-10-30 的專家交付 v1。`js/pinyin-tables.js` 只負責載入，不另抄一份表。

判定規則在 `js/grade.js`：比對前轉成小寫、去掉空白、ü 與 v 相同、j／q／x 後面的 u 與 ü 相同。常見讀音都在該詞的 `accept` 裡，答對其中一個就算對。模式 A 把點選結果送進同一個 `PinyinGrade`，不另寫一套判定。

## Firebase

`js/config.js` 的 `storage` 預設是 `"firebase"`。公開的 client 設定在 `js/firebase-config.js`（不是密鑰）：

- 專案 `pinyin-practice-eabd1`
- Firestore 區域 asia-east1
- Auth 已開啟 Email／Password

家長帳號固定為 `parent@pinyin-practice.local`（`APP_CONFIG.parentEmail`）。家長頁只讓人輸入密碼，再呼叫 `signInWithEmailAndPassword`。練習頁不載入 Auth，維持未登入。

集合跟字詞形狀：

| 集合 | 誰可以讀 | 誰可以寫 |
| --- | --- | --- |
| `sets` | 所有人 | 已登入家長 |
| `words` | 所有人 | 已登入家長 |
| `sessions` | 所有人 | 所有人可新增；不可改、不可刪 |

規則在 `firestore.rules`。其他路徑預設拒絕。部署：

```bash
npx firebase-tools deploy --only firestore:rules --project pinyin-practice-eabd1
```

`firebase.json` 已指向這份規則。需要先 `npx firebase-tools login`。

在規則部署、範例詞組寫入之前，練習頁若讀不到雲端詞組，會改用內建範例，讓點選拼音仍可練習。雲端有詞組之後，練習頁改讀 Firestore。

離線開發可把 `js/config.js` 的 `storage` 改成 `"local"`，資料只留在這台裝置。測試也用這個覆寫。不要把家長密碼寫進版本庫。

## 家長帳號與密碼

1. Firebase 主控台 → Authentication → Sign-in method → 啟用 Email／Password。
2. Users → Add user。電郵用 `parent@pinyin-practice.local`，密碼自己訂，不要提交到 git。
3. 開啟 `admin.html`，輸入該密碼。

更改密碼：登入家長頁後用「更改密碼」，或在主控台的該使用者上重設。前端沒有預期的校驗碼。

## 種入範例詞組

40 個種子詞經 `PinyinGrade.mapSeedWord` 拆成 `readings`，放進名為「範例」的詞組（id `set_demo`）。

登入家長頁，按「載入範例詞組」。已有同一 id 就不會覆寫。

或在終端機執行（密碼只放環境變數）：

```bash
PINYIN_PARENT_PASSWORD='你的密碼' node scripts/seed-firestore.js
```

只列印將寫入的文件、不連線：

```bash
node scripts/seed-firestore.js --print
```

規則尚未部署時，寫入會被拒絕。

## 已停用的 Worker

`worker/` 是舊草稿，標成 DEPRECATED，不要部署。靜態網站不呼叫它。

## 離線

`sw.js` 的 `VERSION` 目前是 `v2`。改了頁面、腳本或拼音資料後，請把版本加一，已經安裝的 App 下次開啟才會換掉舊快取。

## 測試

```bash
node tests/grade.test.js
node tests/cloud.test.js
node tests/mode-a.test.js
node tests/static.test.js
```
