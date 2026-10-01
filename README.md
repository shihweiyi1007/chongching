# 重慶六天五夜　互動行程

純靜態網站（HTML / CSS / JavaScript），不需要編譯，放上 GitHub Pages 就能用手機、平板開啟。

## 頁面

- `index.html`：地圖頁。可切換「全部 / 10/2 ~ 10/7」，依當日順序顯示編號標記與連線；點清單可在地圖上定位。
- `itinerary.html`：行程表頁。不需要地圖，逐日列出每一站的名稱、說明、高德名稱與連結。

旅程期間打開時，兩頁都會自動跳到當天。

## 檔案

| 檔案 | 用途 |
| --- | --- |
| `data.js` | 唯一的行程資料來源：地點、座標、每日順序、備註 |
| `config.js` | Google Maps 金鑰（可留空） |
| `common.js` | 兩頁共用：座標換算、高德／Google 連結、行程整理 |
| `app.js` | 地圖頁邏輯 |
| `schedule.js` | 行程表頁邏輯 |
| `styles.css` | 樣式（手機、平板直向／橫向、桌機） |
| `vendor/` | Leaflet 1.9.4（OpenStreetMap 備援底圖用） |

## 座標與高德

- `data.js` 的 `gcj` 是 GCJ-02 座標 `[緯度, 經度]`。Google 地圖在中國境內的地點資料與高德地圖都使用 GCJ-02，
  所以同一組數字直接給兩邊使用，**不需要再做 WGS-84 → GCJ-02 轉換**（多轉一次會偏約 500 公尺）。
- 座標是事先查好寫死的，不在瀏覽器裡即時查詢。每個座標後面的註解記錄了來源
  （G = Google 地圖地點，O = OpenStreetMap 換算成 GCJ-02）。
- 「高德地圖」按鈕用 `https://uri.amap.com/marker?position=經度,緯度&coordinate=gaode&callnative=1`，
  手機上會喚起高德 App 並落在該座標。
- `approx: true` 或沒有 `gcj` 的地點改用高德名稱搜尋（`uri.amap.com/search`）。

### 修改或新增地點

在 `data.js` 的 `PLACES` 加一筆，再把它的 key 放進某一天的 `items`：

```js
myplace: { name: '顯示名稱', zh: '高德搜尋用的简体名称', type: 'spot', gcj: [29.56, 106.57], desc: '到這裡做什麼' },
```

取得 GCJ-02 座標最簡單的方法：在高德地圖 App 或 Google 地圖找到該地點，複製它顯示的經緯度。

## 底圖

- `config.js` 的 `GOOGLE_MAPS_KEY` 有填：使用 Google 地圖。
- 留空、金鑰無效，或 8 秒內連不上 Google（中國境內未漫遊／未翻牆）：自動改用 OpenStreetMap。
  這時程式會把 GCJ-02 換回 WGS-84 再畫，標記位置一樣正確。

申請 Google 金鑰：Google Cloud 啟用 **Maps JavaScript API**，並把金鑰的「網站限制」設成
`https://<你的帳號>.github.io/*`，因為金鑰會公開在 repo 裡。

## 本機預覽

```bash
python3 -m http.server 8080
# 瀏覽器開 http://localhost:8080
```

不要直接在「檔案」App 預覽 `index.html`，那樣 CSS 與 JS 不會載入。
