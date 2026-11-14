# Sports Lab

NBA／MLB 球員、賽程與數據研究網站。採用繁體中文介面、球員中英文姓名與手機版配置，逐筆保留資料來源及觀測時間。

[公開網站](https://lolochen86-jpg.github.io/sports-lab/) · [球員資料庫](https://lolochen86-jpg.github.io/sports-lab/#rosters) · [轉隊與背號](https://lolochen86-jpg.github.io/sports-lab/transfers.html) · [回報問題](https://github.com/lolochen86-jpg/sports-lab/issues)

**專案原創程式碼採 [MIT 授權](LICENSE)。第三方程式、資料、模型、圖片與商標依各自條款，請一併閱讀 [第三方聲明](THIRD_PARTY_NOTICES.md)。**

## 已有功能

- NBA／MLB 賽程、比分及來源比對，保存歷史快照與資料時間。
- 全球員名單、姓名搜尋、球隊／位置篩選、精簡卡片與球員個人頁。
- 球季數據、兩分／三分命中率、逐場紀錄、NBA 每節得分紀錄。
- 球員分級：NBA adj-RAPM 在場影響；MLB 打擊、先發與後援組內百分位。
- 單項／綜合排行、新秀與二年級、進步榜、球隊現況與研究預測頁。
- 球員轉隊歷程每人一排，現隊與前隊背號依資料來源顯示，未知保留待補。
- 原始觀測時間、失敗原因、過期資料與身分不符提示。

資料並非完整即時服務；部分中文譯名、轉隊紀錄及歷史背號仍待補。研究預測與模型評分不等於經獨立校準的投注依據或完整球員能力。

## 快速開始

需要 **Node.js 22 以上**及 Git；沒有第三方 npm 套件，無須 `npm install`。一般瀏覽、測試與建置不需要付費 API、帳號或密鑰。

```sh
git clone https://github.com/lolochen86-jpg/sports-lab.git
cd sports-lab
npm test
npm run build
npm start
```

開啟 **http://127.0.0.1:4180/**。先使用儲存庫所附公開快照；快照有原始時間，不能當成即時資料。`npm start` 會先建置再啟動伺服器。逐場紀錄、圖片等部分功能在瀏覽時另外請求外部來源，需要網路。

更新公開數據時執行：

```sh
npm run collect
npm test
npm run build
```

來源可能拒絕請求或暫時失效；程式會保留原因、來源時間與有限期限的舊資料。介面每分鐘檢查「已發布快照」，不會每分鐘重新蒐集。

Windows 受限制環境的測試替代指令見 [貢獻指南](CONTRIBUTING.md)。

## 專案架構

| 路徑 | 用途 |
| --- | --- |
| `public/` | 原生 JavaScript、HTML、CSS；球員頁、圖表、轉隊頁、手機介面 |
| `lib/` | 資料解析、來源收集、身分／日期驗證、排名與模型邏輯 |
| `scripts/collect.mjs` | 有請求上限與期限的資料蒐集入口 |
| `scripts/build.mjs` | 驗證快照後輸出靜態網站至 `dist/` |
| `scripts/server.mjs` | 本機預覽伺服器 |
| `tests/` | 不依賴即時網路的資料與功能測試 |
| `data/dashboard.json` | 最新提交的公開快照，並非永久新鮮 |
| `data/*LICENSE*` | 保留的第三方授權全文 |
| `.github/workflows/ci.yml` | PR／程式碼修改的測試與建置，不部署 PR |
| `.github/workflows/update.yml` | 蒐集、驗證、GitHub Pages 發布與快照保存 |

純靜態快照架構，不包含可供多人編輯的通用後台或資料庫。`data/cache/`、執行收據、原始回應、`.env` 和本機暫存不應提交。

## 部署自己的版本

### GitHub Pages

1. Fork 此專案，檢查 [第三方資料與素材條款](THIRD_PARTY_NOTICES.md)。
2. 在自己的儲存庫 Settings → Pages 將 Source 設為 GitHub Actions。
3. 允許自己的 Actions 使用內容寫入及 Pages 發布權限；分支保護規則可能另外限制機器人保存快照。
4. 在 Actions 執行 `Collect, verify and publish Sports Lab` 的 Run workflow。
5. 等待測試、建置與 Publish 都成功，再檢查自己的 Pages URL 與資料時間。

既有排程為台灣時間 07:00、14:00、21:00，另有延後 13 分鐘的備援。GitHub 排程可能延遲；Fork 的排程需自行確認啟用且未被平台停用。時間設定在 `.github/workflows/update.yml`，不要把啟動 workflow 當成成功更新。

### Cloudflare Pages 或其他靜態主機

- 建置指令：`npm run build`
- 輸出資料夾：`dist`
- Node.js：22 以上
- 僅建置會發布既有快照。需要新資料時，先在有網路的 CI 執行蒐集、測試與建置，再上傳同一份 `dist`。

部署到其他主機不會自動搬移 GitHub Actions 的定時更新，需自行安排。

### 可選留言功能

留言是獨立的遠端服務，不是啟動網站所需。現有 `public/guest-community.js` 包含公開展示站的服務位址及瀏覽器用 key；Fork 或自架時，請停用留言入口，或先替換為自己的服務並設定資料表權限，再提供訪客使用。不要把自己的管理密鑰或訪客信箱放進 Git。

主站、導覽、品牌及外部連結仍有原作者的網址；發布自己的版本時請檢查 `public/` 中相關連結，不應把展示站的後端當成開源專案提供的公共寫入服務。

## 資料與模型原則

- 來源可能包含 NBA、MLB、ESPN、CBS、FOX、RotoWire、SportsDataverse 及 BoxScore Lab；各功能涵蓋來源不同，請依資料欄位與來源頁查核。
- 相同上游的網站不能當成兩份獨立證據。缺失／過期資料不補零，沒有傷病紀錄不代表確認健康。
- 球員以 ID、聯盟、球隊、球季核對；兩分命中率依投籃與三分出手／命中數計算。
- NBA 位置內 S–D 分級與跨位置 adj-RAPM 數值排序是不同口徑；MLB OPS 與 ERA 的角色內百分位不能當全面實力比較。
- 預測頁會區分外部來源、研究模型、未確認與歷史保存；不要以舊版說明推定現行預測模型或完整性。
- 外部照片與資料可能因服務變動不可用。官方 PDF 索引不等於已解析成球員傷病共識。
- 轉隊及背號資料為部分人工整理內容，與定時賽程收集分開。

## 參與與安全

- [貢獻指南](CONTRIBUTING.md)：開發、資料品質、測試及提交規範。
- [安全回報](SECURITY.md)：避免公開敏感資料。
- [變更紀錄](PROJECT_CHANGELOG.md)：已做的調整與驗證限制。
- [歷史說明](docs/historical-readme.md)：僅作舊版存檔，部分內容已過期。

本專案僅供研究與學習，不構成投注或投資建議。

