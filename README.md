# 現代住宅 · 即時 3D 看房探索

**Qwen3.8 Flash-Next + Hermes Agent 版本**

![Three.js](https://img.shields.io/badge/Three.js-r0.169.0-000000?logo=three.js)
![WebGL2](https://img.shields.io/badge/WebGL-2.0-990000)
![No build](https://img.shields.io/badge/build-不需要-2ea44f)
![Offline](https://img.shields.io/badge/執行-完全離線-2ea44f)
![Zero deps](https://img.shields.io/badge/npm_依賴-0-2ea44f)

在瀏覽器裡以第一人稱走進一棟現代風格的單層住宅：開關門窗、拉抽屜、開電視、控制每個房間的燈光，並在晴天、雨天與夜晚之間切換。整個場景、家具與材質都由程式即時生成，不需要任何 3D 模型檔或圖片素材，也不需要建置步驟或網路連線。

![鳥瞰（實機截圖）](docs/screenshots/aerial-day.jpg)

> 本文件依 2026-10-23 的實際程式碼與實機執行結果撰寫。上圖可以直接看見室內配置，是因為目前版本的**屋頂與天花板沒有被加入場景**（並非刻意的剖面模式），詳見〈[已知問題](#已知問題)〉。

---

## 目錄

- [實機截圖](#實機截圖)
- [快速開始](#快速開始)
- [操作方式](#操作方式)
- [功能一覽](#功能一覽)
- [渲染與技術](#渲染與技術)
- [專案結構](#專案結構)
- [實測結果](#實測結果)
- [已知問題](#已知問題)
- [疑難排解](#疑難排解)
- [開發紀錄](#開發紀錄)
- [授權](#授權)

---

## 實機截圖

以下全部是程式實際執行的畫面，未經修圖。

**截圖環境：** Linux、Google Chrome（無頭模式，ANGLE / OpenGL ES 3.2）、NVIDIA GeForce RTX 2080 Ti、1600×900、**低畫質**（目前唯一能正確顯示完整畫面的畫質，見〈已知問題〉第 2 點）。相機位置與天氣由腳本設定後擷取。

### 開始畫面與平面配置

| 開始畫面 | 平面俯視 |
|---|---|
| ![開始畫面](docs/screenshots/start.jpg) | ![平面俯視](docs/screenshots/aerial-top.jpg) |
| 進入住宅前的說明面板 | 16 × 12 m 的單層平面：上方為後院木平台與遮陽傘，下方為門廊、步道與車道 |

### 室外

| 前院與入口 | 後院木平台 |
|---|---|
| ![前院](docs/screenshots/ext-front.jpg) | ![後院](docs/screenshots/ext-back.jpg) |
| 步道、盆栽、大門與客廳玻璃帷幕；四周為草地、針葉樹與綠籬 | 後院木平台（含欄杆、桌椅、遮陽傘）與主臥 / 次臥窗戶 |

### 室內各區域

| 客廳 | 廚房・用餐區 |
|---|---|
| ![客廳](docs/screenshots/living.jpg) | ![廚房](docs/screenshots/kitchen.jpg) |
| L 型沙發、咖啡桌、電視牆、落地燈 | 中島、流理台、餐桌與餐椅 |

| 主臥室 | 次臥 |
|---|---|
| ![主臥](docs/screenshots/master.jpg) | ![次臥](docs/screenshots/bedroom2.jpg) |
| 雙人床、床頭櫃、推拉衣櫃、平開窗 | 床、書桌與椅子、衣櫃、窗外景觀 |

| 書房 | 浴室 |
|---|---|
| ![書房](docs/screenshots/study.jpg) | ![浴室](docs/screenshots/bath.jpg) |
| 連頂書牆、書桌與單人座椅 | 洗手台與抽屜、馬桶、淋浴間 |

| 玄關・走廊 |
|---|
| ![走廊](docs/screenshots/hallway.jpg) |
| 貫穿房屋前後的走廊，兩側為各房間的門 |

### 互動

| 注視大門時的提示 | 按 F 開門後 |
|---|---|
| ![互動提示](docs/screenshots/door-prompt.jpg) | ![開門](docs/screenshots/door-open.jpg) |
| 準星對準可互動物件時顯示「F — 開啟大門」，右上角狀態列顯示 FPS、天氣、燈光與畫質 | 大門以門軸平滑旋轉開啟，門板碰撞跟著更新，可以走進玄關 |

### 天氣與時段

| 雨天 | 雨天・濕地面 |
|---|---|
| ![雨天](docs/screenshots/rain-front.jpg) | ![濕地面](docs/screenshots/rain-ground.jpg) |
| 陰天天空、霧變濃、雨絲粒子 | 步道與地面呈現濕潤高光 |

| 夜晚・室外 | 夜晚・鳥瞰 |
|---|---|
| ![夜晚室外](docs/screenshots/night-front.jpg) | ![夜晚鳥瞰](docs/screenshots/aerial-night.jpg) |
| 室內暖色燈光透出，月光與夜空 | 8 個房間的燈光同時開啟 |

| 夜晚・客廳 | 夜晚・廚房 |
|---|---|
| ![夜晚客廳](docs/screenshots/night-living.jpg) | ![夜晚廚房](docs/screenshots/night-kitchen.jpg) |
| 吸頂燈與落地燈的暖光 | 廚房與用餐區燈光 |

### 設定面板

![設定面板](docs/screenshots/settings.jpg)

按 `O` 開啟。可切換畫質、天氣，個別開關 8 個房間的燈光。

### 中 / 高畫質的算繪輸出

中、高畫質目前在瀏覽器裡只會顯示畫面的左上部分（見〈已知問題〉第 2 點）。下列圖片是直接讀取 canvas 得到的**完整算繪結果**，用來呈現較高畫質的效果，**不是**玩家在螢幕上實際看到的畫面。

| 高畫質・鳥瞰 | 高畫質・夜晚鳥瞰 |
|---|---|
| ![高畫質鳥瞰](docs/screenshots/full-high-aerial-day.jpg) | ![高畫質夜晚](docs/screenshots/full-high-aerial-night.jpg) |

| 中畫質・夜晚客廳 | 高畫質・雨天 |
|---|---|
| ![中畫質夜晚客廳](docs/screenshots/full-medium-night-living.jpg) | ![高畫質雨天](docs/screenshots/full-high-rain.jpg) |

---

## 快速開始

瀏覽器不允許用 `file://` 直接開啟 ES 模組，因此需要一個本機靜態伺服器。伺服器只在你的電腦上運作，**不需要網路**。

### macOS / Linux

```bash
./start.sh                 # 依序嘗試 python3 → python → node，預設 http://localhost:8080
PORT=8765 ./start.sh       # 8080 被占用時改用其他埠
```

### Windows

雙擊 `start.bat`（依序嘗試 Python、py 啟動器、Node.js）。若無法啟動，請改用下方手動方式（見〈已知問題〉第 6 點）。

### 手動啟動（任何平台）

```bash
python3 -m http.server 8080       # 或 Windows：python -m http.server 8080
node scripts/serve.js 8080        # 內附零依賴 Node 伺服器（需要 Node.js 20.11 以上）
```

然後用瀏覽器開啟 `http://localhost:8080/`，按「進入住宅」。

### 需求

| 項目 | 需求 |
|---|---|
| 瀏覽器 | 支援 WebGL2 與 Import Maps 的桌面瀏覽器（Chrome / Edge / Firefox / Safari 16.4+） |
| 顯示卡 | 支援 WebGL2；請開啟瀏覽器的硬體加速 |
| 伺服器 | Python 3，或 Node.js 20.11 以上（擇一） |
| 操作 | 鍵盤 + 滑鼠（無觸控操作） |

---

## 操作方式

| 按鍵 | 功能 |
|---|---|
| 「進入住宅」按鈕 / 點擊畫面 | 開始探索並鎖定滑鼠 |
| `W` `A` `S` `D` | 移動 |
| 滑鼠 | 轉動視角 |
| `Shift` | 加速（步行 2.3 m/s → 奔跑 4.4 m/s） |
| `F` | 與準星對準的物件互動：門、窗、燈、抽屜、櫃門、電視 |
| `E` | 與 `F` 相同 |
| `O` | 開啟設定面板（畫質、天氣、各房間燈光） |
| `Esc` | 釋放滑鼠，顯示暫停畫面；點「繼續探索」回到遊戲 |

畫面右上角的狀態列顯示目前 FPS、天氣、亮燈房間數與畫質；底部顯示操作提示。

---

## 功能一覽

### 空間

單層住宅，外牆範圍 16 × 12 m，室內淨高約 3 m（1 單位 = 1 公尺）。

| 區域 | 內容 |
|---|---|
| 客廳 | L 型沙發與貴妃椅段、咖啡桌、電視牆與電視櫃、落地燈與邊几、窗簾、玻璃帷幕與推拉門 |
| 廚房・用餐區 | ㄇ 型流理台、瓦斯爐、抽油煙機、水槽、上吊櫃、冰箱、中島與抽屜、吧檯凳、餐桌椅、吊燈 |
| 主臥室 | 雙人床（床架、床墊、被、床尾毯）、床頭櫃 ×2、推拉衣櫃、梳妝櫃 |
| 次臥 | 床、書桌區、書架 |
| 書房 | 連頂書牆、單人沙發與燈 |
| 浴室 | 洗手台與抽屜、鏡子、馬桶、淋浴玻璃隔間與花灑 |
| 玄關・走廊 | 鞋櫃（雙開門）、玄關桌與鏡子、傘架；後門通往後院 |
| 室外 | 草地、步道、車道、門廊、後院木平台與遮陽傘、針葉樹與闊葉樹、灌木、綠籬 |

### 互動物件（共 33 個）

| 類型 | 數量 | 內容 |
|---|---|---|
| 門 | 6 | 大門、後門（皆向外開）、主臥 / 浴室 / 次臥 / 書房門；鉸鏈旋轉動畫，門板碰撞隨角度更新 |
| 推拉玻璃門 | 1 | 客廳玻璃帷幕的可滑動門扇 |
| 窗 | 5 | 可開啟的平開窗（廚房、主臥、次臥、東西兩側） |
| 燈光 | 8 | 每個房間一組，注視燈具按 `F` 開關，燈罩發光同步漸變 |
| 抽屜 / 推拉門 | 8 | 中島抽屜 ×2、床頭櫃 ×2、梳妝櫃、浴室櫃、衣櫃推拉門 ×2 |
| 櫃門 | 4 | 廚房上吊櫃 ×2、玄關鞋櫃 ×2 |
| 電視 | 1 | 開啟 / 關閉螢幕 |

### 天氣（設定面板）

| 模式 | 天空 | 光照 | 其他 |
|---|---|---|---|
| 白天 | 頂點色漸層天穹 | 日光 3.0、霧密度 0.0022 | 曝光 0.88 |
| 雨天 | 陰天 | 日光 0.55、霧密度 0.011 | 雨絲粒子、濕地面、曝光 1.05 |
| 夜晚 | 夜空 | 月光 0.16、霧密度 0.008 | 地面微濕、室內燈為主光源、曝光 1.3 |

切換時天空顏色、光照與霧會平滑過渡。

### 畫質（設定面板）

| | 低 | 中（預設） | 高 |
|---|---|---|---|
| 像素比 | 1.0 | 1.25 | 1.75 |
| 陰影 | 半解析度 | 完整 | 完整 + 客廳點光源陰影 |
| SSAO | 關 | 開* | 開* |
| Bloom | 關 | 0.32 | 0.5 |
| FXAA | 開 | 開 | 開 |
| 雨滴粒子 | 500 | 1,600 | 3,200 |
| 玻璃折射緩衝 | 0.25 倍、每 3 幀 | 0.5 倍、每 2 幀 | 0.75 倍、每幀 |

\* 啟動時會實際繪製一幀來探測 GPU 是否支援；不支援時自動停用（見〈實測結果〉）。

---

## 渲染與技術

| 模組 | 做法 |
|---|---|
| 引擎 | Three.js r0.169.0，放在 `vendor/three/` 並以 import map 載入，沒有任何 CDN |
| 材質 | `proceduralTextures.js` 以 Canvas 程式化產生 PBR 貼圖（木紋、磁磚、牆面、地面、布料等） |
| 光照 | 方向光（太陽 / 月光）+ PCF 軟陰影、半球光、PMREM 環境貼圖、10 盞室內點光源 |
| 後處理 | 自訂管線（不使用 EffectComposer 的緩衝輪換）：場景與深度 → SSAO（半解析度）→ 模糊 → 合成 → Unreal Bloom → OutputPass（ACES 色調映射 + sRGB）→ FXAA |
| 能力探測 | 啟動時實際繪製並讀回驗證 HDR 浮點目標與 SSAO，任一不支援就退回安全管線，避免黑屏 |
| 玻璃 | 自訂 ShaderMaterial：以不含玻璃的場景緩衝區做螢幕空間折射、程序化天空反射，雨天加上 Voronoi 水珠扭曲 |
| 降雨 | GPU 粒子（`Points` + ShaderMaterial），在頂點著色器下落並循環，跟隨玩家，不需每幀 CPU 更新 |
| 濕地面 | 對草地、石板、混凝土、木平台材質注入濕度 uniform，降低粗糙度並加入漣漪 |
| 碰撞 | XZ 平面上的膠囊體對 AABB 集合，2 m 網格空間索引；0.18 m 以下的障礙（門檻、台階）可直接跨越 |

---

## 專案結構

```text
3d-house-walkthrough/
├── index.html                 載入畫面、開始畫面、HUD、暫停與設定面板、錯誤提示
├── start.sh / start.bat       啟動腳本（Python 或 Node）
├── scripts/serve.js           零依賴 Node 靜態伺服器
├── package.json
├── src/
│   ├── main.js                進入點：組裝場景、選單、輸入、主迴圈
│   ├── config.js              尺度、房屋輪廓、房間分區、畫質 / 天氣預設、燈光配置
│   ├── scene/                 createScene（天空、光、霧、天氣、濕地面）、createHouse（牆、門、窗）
│   │                          createInterior（家具）、createExterior（庭院）、buildHelpers
│   ├── player/                controller（第一人稱）、collision（膠囊對 AABB）
│   ├── interaction/           interactionManager、door、furniture、lighting
│   ├── rendering/             renderer、postprocessing、shaders/ssao.js
│   ├── weather/               rain（GPU 粒子）、glassDroplets（玻璃與水珠）
│   ├── materials/             proceduralTextures（程式化 PBR 貼圖）
│   └── ui/style.css
├── vendor/three/              Three.js r0.169.0 與使用到的 addons
└── docs/screenshots/          本文件的實機截圖
```

`src/` 內共 19 個 JavaScript 模組，約 3,400 行。

---

## 實測結果

2026-10-23，以 Chrome（無頭模式）在 RTX 2080 Ti 上實際執行：

| 項目 | 結果 |
|---|---|
| 載入時間 | 約 3 秒進入可操作狀態 |
| 離線 | 封鎖所有非 localhost 連線後正常載入，共 31 個請求，**全部來自本機** |
| JavaScript 錯誤 | 0（`window.__errors` 為空） |
| FPS | HUD 顯示 60 FPS（1600×900，低 / 高畫質皆同；測試時 GPU 同時被其他程式使用） |
| 互動 | 注視大門出現「F — 開啟大門」提示，按 `F` 後門板開啟 |
| 天氣 / 畫質 / 燈光切換 | 設定面板三種天氣、三種畫質、8 個房間燈光皆可切換 |
| HDR / SSAO 探測 | 在這台機器上兩者都被判定為**不支援**，因此以安全管線執行（無 SSAO） |

---

## 已知問題

以下問題都在實機執行中確認過。本文件只做記錄，**沒有修改任何程式碼**。

1. **地板、天花板、屋頂沒有出現在畫面中。** 室內會看到草地與天空，窗台與固定窗的窗框、玻璃也沒有顯示（玻璃仍有碰撞）。
   原因：`src/scene/buildHelpers.js` 的 `box()` 只在傳入 `group` 選項時才把網格加入場景；`src/scene/createHouse.js` 中有 35 處呼叫沒有傳入 `group`，包含地板、天花板、屋頂、收邊、門廊與固定窗。
2. **中、高畫質下畫面被裁切，準星與實際視線中心不一致。**
   原因：`renderer.setSize(w, h, false)` 不會設定 canvas 的 CSS 尺寸，加上像素比 1.25 / 1.75，canvas 實際顯示為視窗的 1.25 / 1.75 倍，只能看到左上部分；互動判定以 canvas 中心為準，因此和螢幕上的準星對不上。**目前請使用低畫質。**
3. **設定面板的「回到玄關」會讓畫面全黑。**
   原因：`main.js` 呼叫 `player.respawn()` 時沒有傳入座標，相機 X 座標變成 NaN。發生時請重新整理頁面。
4. **SSAO 與 HDR 在 RTX 2080 Ti 上被探測判為不支援**（Chrome、ANGLE / OpenGL ES 3.2），因此實際以 8 位元緩衝、無 SSAO 的安全管線執行。
5. **玻璃水珠在實機截圖中看不到。** 雨天時玻璃著色器的濕度 uniform 為 1，但近距離與高畫質下都沒有觀察到可見的水珠或扭曲。
6. **`start.bat` 未在 Windows 上測試。** 第 4 行 `set PORT=%PORT:8080%` 疑似批次檔語法錯誤（設定預設值應寫成 `if not defined PORT set PORT=8080`）；若啟動失敗請用手動方式。
7. **晴天未使用 `Sky`（物理天空）。** `createScene.js` 以 `w.sky === 'clear'` 判斷，但設定中的值是 `'day'`，因此三種天氣都使用頂點色天穹。
8. **所在區域名稱不會顯示。** 程式每幀更新 `#room-name` 的文字，但它的 CSS `opacity` 為 0，且從未被加上 `.show` class。
9. 預設埠 8080 常被其他程式占用，可用 `PORT=8765 ./start.sh` 改埠。
10. 沒有音效、沒有觸控操作、沒有自動化測試；家具為低面數程序化幾何。

---

## 疑難排解

| 狀況 | 處理方式 |
|---|---|
| 直接雙擊 `index.html` 後畫面空白 | 必須透過本機伺服器開啟，請依〈快速開始〉操作 |
| 顯示「無法啟動 3D 場景」 | 瀏覽器或顯示卡不支援 WebGL2：更新瀏覽器、開啟硬體加速，可到 `chrome://gpu` 檢查 |
| 畫面像被放大、只看到一角 | 中 / 高畫質的已知問題，按 `O` 改成「低」 |
| 畫面突然全黑 | 可能按了「回到玄關」，請重新整理頁面 |
| `Address already in use` | 8080 被占用：`PORT=8765 ./start.sh` 或 `python3 -m http.server 8765` |
| 滑鼠無法鎖定 | 按 `Esc` 離開後瀏覽器約 1 秒內不允許再次鎖定，稍等再點一次 |

---

## 開發紀錄

開發過程中最大的問題是軟體渲染環境（Chrome SwiftShader）的黑屏：以 GLSL3 語法撰寫、取樣 `sampler2D` 的自訂 ShaderMaterial 在 SwiftShader 上會靜默失敗（`INVALID_OPERATION`，錯誤碼 1282）。改用 GLSL1 寫法（`texture2D`、`varying`）重寫 SSAO、模糊、合成、FXAA 與玻璃著色器後解決，並加入啟動時的 HDR / SSAO 能力探測與退回機制。

本專案由 **Qwen3.8 Flash-Next + Hermes Agent** 開發。

---

## 授權

專案本身未附授權條款。`vendor/three/` 為 [Three.js](https://threejs.org/)（MIT License）。
