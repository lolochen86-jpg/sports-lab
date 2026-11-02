# Sports Lab V1.0

將 StatsHub 與 HoopsLab 的有用資訊放在同一個新網站：NBA／MLB 賽程、來源比對、傷病與出賽、新人快照、模型研究存檔。原網站程式、資料庫、模型參數及排程不更動。

## 啟動與更新

需要 Node.js 22 以上，無需 npm install、付費 API、雲端密鑰或資料庫。

```text
npm run collect
npm test
npm run build
npm start
```

本機預覽：`http://127.0.0.1:4180/`。重新整理頁面只讀取快照，不會啟動重算。擁有者可從 GitHub Actions 手動執行更新。

已依使用者指定在 GitHub workflow 設定每天台灣時間 07:00、14:00、21:00 更新。排程可能因 GitHub 延遲；實際執行與線上資料時間才是更新證據。

## 來源與可用範圍

| 機構 | 本版取得與比對 | 界線 |
| --- | --- | --- |
| NBA 官方 | 當季傷病 PDF 報告索引；賽程 CDN 另記可用性 | CDN 本機實測403；PDF索引不是球員傷病共識 |
| ESPN | NBA／MLB 單日賽程、比分、NBA傷病 | 公開介面沒有穩定性承諾；傷病可標示 RotoWire 上游 |
| CBS Sports | NBA賽程、比分、傷病 | 保留原始日期精度，完整姓名取 long 欄位 |
| FOX Sports | NBA配對與有提供的比分狀態 | 不與主要來源相符時獨立保留，不猜時間 |
| RotoWire | 公開先發與出賽狀態 | 預期不等於確認，未訂閱區不擷取；與ESPN可共用上游 |
| MLB 官方 | 賽程、比分與有提供的先發投手 | 無比賽如實顯示空清單 |

StatsHub、HoopsLab 是既有模型輸出的整合入口，不另算獨立第三方資料源。六個機構不是每欄六源：本版 NBA 賽程主要比對 ESPN／CBS／FOX，傷病比對 ESPN／CBS／RotoWire；MLB 主要比對 MLB 官方與 ESPN。上游獨立性未知時，不能把網站一致當成獨立驗證。

參考頁：[NBA 官方傷病報告](https://official.nba.com/nba-injury-report-2026-27-season/)、[CBS 傷病](https://www.cbssports.com/nba/injuries/)、[FOX NBA](https://www.foxsports.com/nba/scores)、[RotoWire 先發](https://www.rotowire.com/basketball/nba-lineups.php)、[MLB 賽事](https://www.mlb.com/scores)。

## 可靠性規則

- 全輪請求預算90秒，每個請求10秒，最多兩次；六個並行工作。
- 401／403不重試，429遵守Retry-After；回應上限12MB。
- 來源失敗可回退有限期限的快取，但保留原時間與SHA，標示過期並排除新共識。
- 同聯盟、同主客隊、時間相符才合併。無時間的補充來源只在美東同日唯一配對時附加；雙重賽不可任意合併。
- 傷病以同隊完整姓名比對；沒有紀錄不代表健康。UNKNOWN無出賽機率。衝突不自動取最嚴重或默認健康。
- 預測只保存原模型、原時間與指紋。不平均不同模型，不改寫賽後結果為賽前資料，不宣稱已獨立校準。
- 蒐集、測試、建置、發布分段；失敗留收據，不宣稱整輪完成。

## 資料與部署

`data/dashboard.json` 為公開正規化快照；`data/cache`、`data/runs`、原始HTTP回應與鎖檔不進公開儲存庫。`dist/` 可部署 GitHub Pages 或 Cloudflare Pages。頁面全部採相對資產路徑，支援儲存庫子路徑。

GitHub工作流程使用免費的公開來源及Pages，不需要讀取舊站Cloudflare secret。首次設定Pages為GitHub Actions後，手動執行工作流程並核對正式網址。

僅供研究與學習，不構成投注或投資建議。
