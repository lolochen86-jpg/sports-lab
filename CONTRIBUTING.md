# 參與開發

歡迎透過 [Issues](https://github.com/lolochen86-jpg/sports-lab/issues) 回報問題或提交 Pull Request。請先搜尋是否已有相同問題；較大的功能可先開 Issue 討論範圍。

## 本機開發

使用 Node.js 22 以上。專案沒有 npm 外部套件，無須 `npm install`。

```sh
git clone https://github.com/lolochen86-jpg/sports-lab.git
cd sports-lab
npm test
npm run build
npm start
```

開啟 http://127.0.0.1:4180/。這會使用儲存庫內的資料快照，不會自動請求所有上游來源。需要更新時才執行 `npm run collect`。

## 修改與驗證

1. 從最新 main 建立功能分支，一個 PR 聚焦一件事情。
2. 延續 `AGENTS.md` 的繁體中文／英文姓名要求，保留既有功能和歷史紀錄。
3. 資料處理需驗證球員 ID、球隊、球季、時區和來源時間；缺失顯示待補，不能當成零。
4. 不繞過 401／403、驗證碼或付費限制，不以更多請求掩蓋來源問題。
5. 重要資料邏輯請補可重現測試，使用固定測試資料，不以即時網路作為單元測試條件。
6. 執行 `npm test` 與 `npm run build`，在 `PROJECT_CHANGELOG.md` 記錄實質變更、驗證與限制。
7. PR 說明問題、修改效果、驗證方式；介面修改請附電腦或手機畫面。

Windows 沙箱若遇到暫存檔或子程序權限問題，可使用專案內的暫存目錄及單程序測試：

```powershell
New-Item -ItemType Directory -Force .tmp | Out-Null
$env:TEMP=(Resolve-Path .tmp).Path
$env:TMP=$env:TEMP
node --test --experimental-test-isolation=none tests/*.test.mjs
```

## 資料與授權

請保留現有第三方授權與來源，詳見 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。提交自己有權授權的原創程式碼時，採本專案 MIT 授權；引入第三方內容必須附上相容的授權、來源和修改紀錄。

不要提交 `.env`、密鑰、訪客信箱、資料庫匯出、原始 HTTP 快取、收據或本機路徑。安全漏洞請依 [SECURITY.md](SECURITY.md) 處理。
