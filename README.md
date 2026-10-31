# 普通話拼音練習

給小朋友的普通話拼音網頁。純 HTML、CSS、JavaScript，沒有框架。GitHub Pages 由 GitHub Actions 部署一份靜態檔清單，不是把倉庫根目錄整包公開。

線上位置（啟用 Pages 之後）：<https://jzkitchen.github.io/pinyin-practice/>

## 現在有什麼

- 練習頁 `index.html`：選詞組，再選練習方式。
  - A 點選拼音：看字詞，依每個字點聲母、韻母、聲調。答錯立刻看到帶調拼音，做完選定的詞組就結束。
  - C 組合拼音：先聽詞語，再依每個字點聲母、韻母、聲調。作答前不顯示漢字；答完該詞才顯示字和帶調拼音。答錯立刻看到正確拼音。
  - B 認讀選擇：看帶調拼音，輸入繁體字詞。答錯立刻看到正確的字和拼音。做完選定的詞組就結束。詞組清單只顯示拼音，避免先看到漢字。
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

判定規則在 `js/grade.js`：比對前轉成小寫、去掉空白、ü 與 v 相同、j／q／x 後面的 u 與 ü 相同。常見讀音都在該詞的 `accept` 裡，答對其中一個就算對。模式 A 與模式 C 都把點選結果送進同一個 `PinyinGrade`，不另寫一套判定。模式 B 不比拼音：輸入的繁體字去掉空白後，要和該詞的漢字完全相同（種子欄位 `han`，練習資料裡是 `hanzi`）。不另收簡體或異體。`accept` 仍只表示可接受的拼音，題幹用詞上的帶調拼音。

## Firebase

`js/config.js` 的 `storage` 預設是 `"firebase"`。公開的 client 設定在 `js/firebase-config.js`（不是密鑰）：

- 專案 `pinyin-practice-eabd1`
- Firestore 區域 asia-east1
- Auth 已開啟 Email／Password

家長帳號固定為 `parent@pinyin-practice.local`（`APP_CONFIG.parentEmail`）。家長頁只讓人輸入密碼，再呼叫 `signInWithEmailAndPassword`。練習頁不載入 Auth，維持未登入。

集合跟字詞形狀：

| 集合 | 誰可以讀 | 誰可以寫 |
| --- | --- | --- |
| `sets` | 所有人 | 只有已登入、且電郵為 `parent@pinyin-practice.local` 的家長可新增、修改、刪除 |
| `words` | 所有人 | 同上 |
| `sessions` | 只有該家長 | 任何人可新增，但只能寫規定欄位與範圍；不可改、不可刪 |

`sessions` 新增時只接受 `id`、`startedAt`（`toISOString()` 的 24 字）、`durationMs`（0–86400000 的整數）、`mode`（`A`、`B` 或 `C`）、`setId`、`total`、`correct`（0–500，且 `correct` 不大於 `total`）。練習頁不登入也能新增。家長若在同一個瀏覽器仍登入著，練習頁一樣可以新增，因為規則看的是欄位，不是「必須未登入」。

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

更改密碼：登入家長頁後用「更改密碼」。表單會先問目前密碼，呼叫 `reauthenticateWithCredential`，成功後才 `updatePassword`。也可以在主控台的該使用者上重設。前端沒有預期的校驗碼。

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

## GitHub Pages

線上站只應包含練習頁需要的 HTML、CSS、JS、圖示和拼音 JSON。`firestore.rules`、`firebase.json`、`tests/`、`scripts/`、`worker/` 留在 git（給 `firebase deploy` 和測試），不進 Pages 成品。

`.github/workflows/pages.yml` 在推上 `main` 時執行 `node scripts/export-pages.js`，把允許的檔案複製到 `_site`，再用 GitHub Pages 的 artifact 部署。

倉庫設定只需做一次：Settings → Pages → Build and deployment → Source 選 **GitHub Actions**。在改成 Actions 之前，舊設定（分支 `main`、資料夾 `/`）仍會把整個倉庫，包括 `firestore.rules`，放到網站上。合併後請改來源；若那次推送的部署沒跑成，到 Actions 重跑 Deploy GitHub Pages。

本機預覽仍用靜態伺服器，不經過這份清單。

## 離線

`sw.js` 的 `VERSION` 目前是 `v8`。改了頁面、腳本或拼音資料（含 `js/firebase-config.js`）後，請把版本加一。靜態檔走網路優先，離線才用快取；一般重新整理就會換上新版本。練習頁底部不再放拼音表。模式 A、C 一次送出整詞（每個字一格），模式 B 仍是輸入整詞繁體字。

## 聽讀（模式 C）

模式 C 可以選引擎、聲線和語速。三項都記在這個瀏覽器的 `localStorage`（練習頁不登入）：`pinyinSpeechEngine`（`builtin`／`neural`，預設系統內建）、`pinyinSpeechVoice`（`female`／`male`，預設女聲）、`pinyinSpeechRate`（`slow`／`normal`／`fast`，預設正常）。自動朗讀和「再聽一次」都用這組設定。

系統內建用瀏覽器的 `speechSynthesis`，語句語言固定為 `zh-CN`。聲線清單裡若有普通話（`zh-CN`，或標成 `cmn-Hans-CN`）會優先用它，並盡量配合女聲或男聲（看 `voice.gender` 或聲線名稱）；對不上就用任一普通話聲線，再不成就用其他中文聲線。沒有中文聲線時不改掛英文聲線，仍以 `zh-CN` 請瀏覽器朗讀。語速「慢」「正常」「快」對應 `SpeechSynthesisUtterance.rate` 的 `0.7`、`1.0`、`1.3`（超出時夾在 0.1–10）。有的聲線或瀏覽器會忽略 `rate`。

神經模型是 Piper 的 `zh_CN-xiao_ya-medium`（女聲）和 `zh_CN-chaowen-medium`（男聲），各約 63MB，第一次用到該聲線才從 [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices) 下載，並放進 Cache API（沒有 Cache API 時改放 IndexedDB）。清除網站資料才會再下載。模型不進 git，也不進 Service Worker 的預快取。這兩個聲線的 `phoneme_type` 是 `pinyin`，不是舊的 espeak／`huayan` 路徑，也不另外下載 g2pW。練習詞已經有聲母、韻母、聲調，就照 Piper 的拼音切分轉成音素（輕聲是 `5`，ü 寫成 `v`）。語速用 `length_scale = 1 / rate`，所以慢約 `1.43`、正常 `1`、快約 `0.77`。下載或合成失敗時會顯示一句說明，並改用系統內建。推論用 onnxruntime-web 1.18 的單執行緒 WASM（`numThreads = 1`），這樣 GitHub Pages 不必送 COOP／COEP。

- 有的瀏覽器要使用者先按一下才出聲（尤其 iPhone／iPad 的 Safari）。畫面有「再聽一次」。神經模型還要 `AudioContext.resume()`，同樣可能被手勢擋住。
- 聲線清單可能晚一點才到。系統內建第一次若還沒有普通話聲線，`voiceschanged` 之後會再讀一次。神經模型不看這份清單。
- 系統內建的多音字讀哪一個音由語音引擎決定，可能和詞義不一致。神經模型跟該詞存好的讀音走。判定仍只看該詞的 `accept`。
- 很長的句子有時會被瀏覽器中途暫停。這裡每次只讀一個詞。
- 這個瀏覽器完全不能朗讀、神經模型也失敗時，會顯示繁體說明，並把字顯示出來，練習可以繼續。詞組清單在模式 C 不列出字和拼音，避免作答前看到答案。
- 小雅、朝文的訓練資料授權見各模型卡（小雅來自標貝 BZNSYP，卡上寫非商業使用）。這裡只在使用者選擇神經模型時連到 Hugging Face 取檔。

## 測試

```bash
node tests/grade.test.js
node tests/cloud.test.js
node tests/mode-a.test.js
node tests/mode-b.test.js
node tests/mode-c.test.js
node tests/tts.test.js
node tests/static.test.js
```
