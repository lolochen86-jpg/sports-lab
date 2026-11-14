# 第三方程式、資料與素材

根目錄 MIT 授權適用於本專案擁有著作權的原創程式碼與文件。外部程式、資料、姓名詞件、模型衍生成果、圖片與商標仍依各自條款使用，不因本專案開源而改為 MIT。

| 項目 | 來源與授權資訊 | 本專案中的對應位置 |
| --- | --- | --- |
| Dobson NBA Elo 方法與衍生實作 | [nicidob/nba_elo](https://github.com/nicidob/nba_elo)，MIT | `lib/elo.mjs`、`data/elo-dobson-MIT-LICENSE.txt` |
| Nordberg 預測方法與衍生實作 | [tylernordberg0/nba-game-predictor](https://github.com/tylernordberg0/nba-game-predictor)，MIT；本站自行重新擬合 | `lib/nordberg.mjs`、`data/nordberg-MIT-LICENSE.txt`、`data/nordberg-model-v1.json` |
| BoxScore Lab 歷史賽果／模型訓練資料 | [BoxScore Lab](https://www.boxscorelab.com/downloads/)，原程式記錄 CC BY 4.0；請保留來源及衍生處理說明 | 模型資料中的 `dataSource`、`dataLicense` 及各模型頁說明 |
| Elo 起始資料 | [Neil Paine NBA-elo](https://github.com/Neil-Paine-1/NBA-elo)；依原來源條款，未額外授予 MIT | `data/elo-seed-2023.json` |
| 球員影響與身分對照 | [SportsDataverse](https://github.com/sportsdataverse/sportsdataverse-data)、[方法](https://hoopr.sportsdataverse.org/articles/nba-player-impact-model.html)；依原來源條款，未額外授予 MIT | 評分模組與快照的 source／method 欄位 |
| 姓名詞件 | [Onomaverse](https://onomaverse.com/datasets/name-transliterations)，CC BY 4.0；本站經 OpenCC 簡轉繁、篩選、組合並標註暫定音譯 | `public/onomaverse-name-tokens.js`、`data/player-name-attribution.md` |
| 姓名參考 | [CedPane](https://github.com/ssb22/CedPane)，Unlicense；[Wikidata](https://www.wikidata.org/wiki/Wikidata:Licensing)，CC0 | 姓名模組及 `data/player-name-attribution.md` |
| NBA、MLB、ESPN、CBS、FOX、RotoWire 等資料 | 公開端點／公告不代表資料具有開源授權；應遵守各來源條款及存取限制 | `data/dashboard.json`、歷史快照、測試用來源片段、轉隊與背號資料 |
| 隊徽、球員照片、品牌與商標 | 版權或商標屬原權利人；主要透過外部 URL 載入，不納入本專案 MIT 授權 | `public/` 與快照中的外部圖片連結 |

`data/`、測試中的第三方資料片段及前端內嵌的外部資料，均不能僅憑根目錄 LICENSE 推定可任意再散布。發布自己的網站或資料集前，請查閱相關來源條款；保留原有作者、授權、來源日期和修改說明。

此表是專案現有來源與授權紀錄的整理，不表示已取得所有外部資料或圖片的再授權。
