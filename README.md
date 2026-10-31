# 普通話拼音練習

給小朋友的普通話拼音網頁。純 HTML、CSS、JavaScript，沒有框架。GitHub Pages 由 GitHub Actions 部署一份靜態檔清單，不是把倉庫根目錄整包公開。

線上位置（啟用 Pages 之後）：<https://jzkitchen.github.io/pinyin-practice/>

## 現在有什麼

- 練習頁 `index.html`：選單元和練習方式後，先勾選要練的字詞（預設全選，至少一個）再按「開始」。練習進行中不再顯示單元字詞清單。
  - A 點選拼音：看字詞，依每個音節點聲母、韻母、聲調。答錯立刻看到帶調拼音，做完勾選的字詞就結束。開練前的清單顯示漢字。兒化音節（如「信兒」）選完後可按「兒化」，在該音節末尾加 r。
  - C 組合拼音：先聽詞語，再依每個音節點聲母、韻母、聲調。作答前不顯示漢字；答完該詞才顯示字和帶調拼音。答錯立刻看到正確拼音。兒化開關與模式 A 相同。開練前的清單顯示漢字，方便選詞。
  - B 認讀選擇：看帶調拼音，輸入繁體字詞。答錯立刻看到正確的字和拼音。做完勾選的字詞就結束。開練前的清單只顯示拼音，避免先看到漢字。口信兒要輸入「口信兒」。
- 字詞寫在倉庫的 `data/units/`。要改詞，更新這些 JSON 再發佈練習頁。沒有家長登入，也沒有線上改詞頁。
- 練習紀錄（答對題數、用時等）只存在這台裝置的 `localStorage`（鍵 `pinyin-practice.sessions.v1`）。

請用靜態伺服器或 GitHub Pages 開啟，不要直接點開檔案。瀏覽器會擋住讀取 JSON。

```bash
python3 -m http.server 8080
```

然後開啟 <http://localhost:8080/>。

## 資料來源

目前練習的字詞只有單元一，檔案是：

`data/units/unit-01.json`

單元選擇顯示「單元一」。九個詞保留審核欄位（`accept`、`syllables`、兒化、聲調、筆記）。之後要加單元，在 `js/units.js` 的清單加一筆，並放上對應 JSON。

模式文案、多音規則，以及被書本表蓋過的舊拼音表，仍在：

`data/pinyin_tables_and_seeds_v1.json`

練習頁不再把那 40 個種子詞當成詞組。

模式 A、C 的點選表以書本聲母／韻母為準（2026-10-31）：

`data/book_pinyin_table_v1.json`

聲母 21 個，依書本分六組，不放 y、w，也不放「零」按鈕；沒有輔音就留空。韻母 35 個，分開口、齊齒、合口、撮口四欄，按鈕用書上的完整式（iou、uei、uen，以及 ü、üe、üan、ün）。不另設整體認讀區，點選區暫不放 er。`js/pinyin-tables.js` 載入時用書本表蓋過種子檔的聲母、韻母、聲調、`zero_initial_spell`、`ui_copy`、`normalize_rules`。

判定規則在 `js/grade.js`：比對前轉成小寫、去掉空白、ü 與 v 相同、iou 與 iu、uei 與 ui、uen 與 un 相同、j／q／x 後面的 u 與 ü 相同。有聲母時寫成 iu、ui、un；j／q／x 後的 ü 寫成 u；聲母留空時依 `zero_initial_spell` 寫成 yi、wu、yu 等。常見讀音都在該詞的 `accept` 裡，答對其中一個就算對。模式 A 與模式 C 都把點選結果送進同一個 `PinyinGrade`，不另寫一套判定。模式 B 不比拼音：輸入的繁體字去掉空白後，要和該詞的漢字完全相同（種子欄位 `han`，練習資料裡是 `hanzi`）。不另收簡體或異體。`accept` 仍只表示可接受的拼音，題幹用詞上的帶調拼音。

## 練習紀錄

做完一輪，練習頁把 `{ id, startedAt, durationMs, mode, setId, total, correct }` 寫進這個瀏覽器的 `localStorage`。重新整理還在。清除網站資料才會不見。不把舊的雲端紀錄搬過來。

## 已停用的 Worker

`worker/` 是舊草稿，標成 DEPRECATED，不要部署。靜態網站不呼叫它。

## GitHub Pages

線上站只應包含練習頁需要的 HTML、CSS、JS、圖示、拼音表和單元 JSON。`tests/`、`scripts/`、`worker/` 留在 git，不進 Pages 成品。

`.github/workflows/pages.yml` 在推上 `main` 時執行 `node scripts/export-pages.js`，把允許的檔案複製到 `_site`，再用 GitHub Pages 的 artifact 部署。

倉庫設定只需做一次：Settings → Pages → Build and deployment → Source 選 **GitHub Actions**。在改成 Actions 之前，舊設定（分支 `main`、資料夾 `/`）會把整個倉庫放到網站上。若那次推送的部署沒跑成，到 Actions 重跑 Deploy GitHub Pages。

本機預覽仍用靜態伺服器，不經過這份清單。

## 離線

`sw.js` 的 `VERSION` 目前是 `v12`。改了頁面、腳本或拼音資料（含 `data/units/`）後，請把版本加一。靜態檔走網路優先，離線才用快取；一般重新整理就會換上新版本。練習頁底部不再放拼音表，練習進行中也不再列出單元字詞。模式 A、C 一次送出整詞（每個音節一格；兒化的「信兒」是一格）。模式 B 仍是輸入整詞繁體字。

## 聽讀（模式 C）

模式 C 可以選引擎、聲線和語速。三項都記在這個瀏覽器的 `localStorage`（練習頁不登入）：`pinyinSpeechEngine`（`builtin`／`neural`，預設系統內建）、`pinyinSpeechVoice`（`female`／`male`，預設女聲）、`pinyinSpeechRate`（`slow`／`normal`／`fast`，預設正常）。自動朗讀和「再聽一次」都用這組設定。

系統內建用瀏覽器的 `speechSynthesis`，語句語言固定為 `zh-CN`。聲線清單裡若有普通話（`zh-CN`，或標成 `cmn-Hans-CN`）會優先用它，並盡量配合女聲或男聲（看 `voice.gender` 或聲線名稱）；對不上就用任一普通話聲線，再不成就用其他中文聲線。沒有中文聲線時不改掛英文聲線，仍以 `zh-CN` 請瀏覽器朗讀。語速「慢」「正常」「快」對應 `SpeechSynthesisUtterance.rate` 的 `0.7`、`1.0`、`1.3`（超出時夾在 0.1–10）。有的聲線或瀏覽器會忽略 `rate`。

神經模型是 Piper 的 `zh_CN-xiao_ya-medium`（女聲）和 `zh_CN-chaowen-medium`（男聲），各約 63MB，第一次用到該聲線才從 [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices) 下載，並放進 Cache API（沒有 Cache API 時改放 IndexedDB）。清除網站資料才會再下載。模型不進 git，也不進 Service Worker 的預快取。這兩個聲線的 `phoneme_type` 是 `pinyin`，不是舊的 espeak／`huayan` 路徑，也不另外下載 g2pW。練習詞已經有聲母、韻母、聲調，就照 Piper 的拼音切分轉成音素（輕聲是 `5`，ü 寫成 `v`）。語速用 `length_scale = 1 / rate`，所以慢約 `1.43`、正常 `1`、快約 `0.77`。下載或合成失敗時會顯示一句說明，並改用系統內建。推論用 onnxruntime-web 1.18 的單執行緒 WASM（`numThreads = 1`），這樣 GitHub Pages 不必送 COOP／COEP。

- 有的瀏覽器要使用者先按一下才出聲（尤其 iPhone／iPad 的 Safari）。畫面有「再聽一次」。神經模型還要 `AudioContext.resume()`，同樣可能被手勢擋住。
- 聲線清單可能晚一點才到。系統內建第一次若還沒有普通話聲線，`voiceschanged` 之後會再讀一次。神經模型不看這份清單。
- 系統內建的多音字讀哪一個音由語音引擎決定，可能和詞義不一致。神經模型跟該詞存好的讀音走。判定仍只看該詞的 `accept`。
- 很長的句子有時會被瀏覽器中途暫停。這裡每次只讀一個詞。
- 進入模式 C 後會背景下載 Piper 預設女聲 `zh_CN-xiao_ya-medium`（約 63MB，不進 git）。畫面顯示下載進度，可以取消。下載完成前，「再聽一次」和自動朗讀都走系統內建 `zh-CN`。下載完成且引擎選「神經模型」才用 Piper。男聲 `zh_CN-chaowen-medium` 只在選了神經模型的男聲時才下載。取消後，再選「神經模型」或「女聲」，或離開再進入模式 C，會重新下載。模式 A、B 和不在模式 C 的首頁不會預載。
- 這個瀏覽器完全不能朗讀、神經模型也失敗時，會顯示繁體說明，並把字顯示出來，練習可以繼續。練習進行中不列出詞組字詞。
- 小雅、朝文的訓練資料授權見各模型卡（小雅來自標貝 BZNSYP，卡上寫非商業使用）。這裡只在使用者選擇神經模型時連到 Hugging Face 取檔。

## 測試

```bash
node tests/grade.test.js
node tests/unit-words.test.js
node tests/sessions.test.js
node tests/mode-a.test.js
node tests/mode-b.test.js
node tests/mode-c.test.js
node tests/tts.test.js
node tests/practice-select.test.js
node tests/static.test.js
node tests/book-table.test.js
```
