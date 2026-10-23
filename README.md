# 3D 房屋即時看房（Three.js r0.169.0 · 純離線）

第一人稱即時 3D 看房專案：一棟兩層現代住宅的室内外可探索場景，Unreal 風格即時渲染（PBR、即時陰影、Bloom、FXAA、自製 SSAO、動態天氣、濕地面、玻璃水珠折射）。所有程式碼與 Three.js vendor 全部本地化，**不需網路、不需 build**，用任意本地靜態伺服器開瀏覽器即可跑。

## 快速開始

```bash
# Linux / macOS
./start.sh            # 自動選 python3 → python → node，開 http://localhost:8080
# Windows
start.bat             # 雙擊即可
# 或手動
python3 -m http.server 8080
# 或內附零依賴伺服器
node scripts/serve.js 8080
```

瀏覽器開 `http://localhost:8080/index.html`。需要支援 WebGL2 的现代瀏覽器（Chrome / Edge / Firefox / Safari 16+）。

## 操作

| 按鍵 | 功能 |
|---|---|
| 滑鼠點擊畫面 | 鎖定滑鼠視角（拖拽視角） |
| W/A/S/D | 移動 |
| 滑鼠滾輪 | 縮放視角 |
| Shift | 加速 |
| F | 開啟/關閉大門 |
| E | 互動（開門、推拉窗門） |
| Esc | 釋放滑鼠 |
| 右上按鈕 | 晴天 / 雨天 / 夜晚、畫質 低/中/高、燈光 8 間開關 |

## 架構速覽

```
index.html                 HUD、載入進度、品質/天氣/燈光按鈕
src/main.js                主循環、天氣/畫質/互動整合
src/scene/                 房屋結構（外殼、 rooms、家具、燈具）+ 碰撞盒
src/player/                第一人稱控制器（pointer lock、碰撞、加速）
src/materials/             程序化 PBR 材質、法線貼圖
src/rendering/             renderer、後處理管線（自製 SSAO/blur/composite、Unreal Bloom、OutputPass、FXAA）、天空
src/weather/               即時降雨粒子、濕地面、玻璃水珠折射
scripts/serve.js           零依賴 Node 靜態伺服器
vendor/three/              Three.js r0.169.0 本體 + addons（離線）
```

## 渲染管線

場景 →（可選 HDR float RT + 自製 SSAO：深度重建法線、半球取樣、模糊、复合）→ Unreal Bloom（低畫質自動關）→ OutputPass（ACES tone mapping、sRGB 輸出）→ FXAA → 螢幕。

啟動時對 HDR / SSAO 做 **GPU 能力黑盒探測**（實際畫一幀讀回驗證），任一不支援自動退回安全管線，絕不會黑屏。Shadow 為即時 PCF 軟陰影；雨天時天空變暗、太陽熄燈、濕地面反射、窗玻璃積水珠帶折射。

## 已完成清單

- ✅ Three.js r0.169.0 純本地 vendor，零遠端請求（已驗證：離線載入成功）
- ✅ 第一人稱探索：移動、碰撞、門互動（F/E）（已驗證：實際走位穿過大門/走廊/房間）
- ✅ 房屋室内外完整結構：1F/2F、客廳/餐廳/廚房/走廊/主臥/次臥/浴室/書房、家具燈具
- ✅ 即時陰影、ACES 色調映射、Unreal Bloom、FXAA
- ✅ 自製 SSAO（GLSL1，含 GPU 探測退回）
- ✅ 即時天氣：晴天 / 雨天（粒子、天色、濕滑地面）/ 夜晚（星空、室內燈）（皆已截圖驗證）
- ✅ 畫質三檔切換（低/中/高：RT 精度、bloom、AO 自動增減）（已驗證切換生效）
- ✅ 燈光 8 間獨立開關
- ✅ 載入進度 + HUD（FPS、狀態列）
- ✅ Windows / macOS / Linux 啟動腳本 + README
- ✅ 全部模組 node --check 語法驗證、瀏覽器 console 無 error 級日誌（觀測中無異常）

## 未完成 / 已知限制

- ⚠️ 軟體渲染（SwiftShader）下 FPS ~20；實際 GPU（如 RTX 2080 Ti）應全速 60fps+。HDR float RT 與 SSAO 探測在 SwiftShader 判為不支援 → 該環境自動退回安全管線（設計如此，非 bug）。
- ⚠️ 天空盒在軟體渲染環境不可見 → 用「跟隨玩家屋頂」方案代替，戶外看天是屋頂跟隨視窗的夜空/天光。
- ⚠️ 玻璃水珠/濕地面 shader 已載入編譯成功，但近距離特寫畫面本輪未逐一截圖確認。
- ⚠️ 無音效、無手機觸控操作、陰影贴图單光源；家具為低模程序化幾何。
- ⚠️ 未做正式自動化測試（以手動瀏覽器驗證為主）。

## 除錯日誌摘要（SwiftShader 相容性實戰）

最終黑屏根因：**Chrome SwiftShader 的 WebGL2 對 GLSL3 dialect + sampler2D 取樣的 ShaderMaterial 繪製會靜默失敗（INVALID_OPERATION, err 1282）**。以 GLSL1（texture2D/varying）改寫自製 SSAO/copy/blur/composite/FXAA 裝載與玻璃 shader 後完全修復；probe 退回機制確保真 GPU 上 HDR+SSAO 自動啟用、軟體渲染自動關閉。
