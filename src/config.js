// 全域設定：尺度、玩家、房屋輪廓、房間分區、畫質/天氣預設、燈光配置。
// 世界座標：1 unit = 1 公尺，Y 向上。房屋 x -8..8、z -6..6，x=0/z=0 為房屋中心。
// 前方(+z)= 門面（玄關大門/客廳落地窗），後方(-z)= 主臥/次臥窗 + 後門通花園。

export const EYE_HEIGHT = 1.65;
export const PLAYER_RADIUS = 0.32;
export const WALK_SPEED = 2.3;
export const RUN_SPEED = 4.4;
export const SPAWN = { x: 0, z: 8.6, yaw: 0 }; // 門廊前步道，面向大門（yaw 0 → 注視 +z... 由 controller 以 yaw=PI 面向房屋；此处 yaw: 0 表示注視 -z 的房屋）

export const HOUSE = { minX: -8, maxX: 8, minZ: -6, maxZ: 6, wallT: 0.25, floorY: 0.15, ceilY: 3.15, wallH: 3.0, roofY: 3.45 };

// 房間偵測區（HUD 顯示目前所在房間）
export const ROOM_ZONES = [
  { name: '客廳', x1: 1.5, x2: 8, z1: 2, z2: 6 },
  { name: '廚房・用餐區', x1: -8, x2: -1.5, z1: 2, z2: 6 },
  { name: '主臥室', x1: -8, x2: -1.5, z1: -6, z2: 2 },
  { name: '次臥', x1: 1.5, x2: 8, z1: -6, z2: -1.5 },
  { name: '書房', x1: 4.5, x2: 8, z1: -1.5, z2: 2 },
  { name: '浴室', x1: 1.5, x2: 4.5, z1: -1.5, z2: 2 },
  { name: '玄關・走廊', x1: -1.5, x2: 1.5, z1: -6, z2: 6 },
];

// 畫質模式（key 同時給中英）
const _Q = {
  low: {
    label: '低', pixelRatio: 1.0,
    shadowScale: 0.5, pointShadows: false,
    ssao: false, bloom: false, bloomStrength: 0,
    fxaa: true, rainCount: 500,
    refractScale: 0.25, refractEveryN: 3,
  },
  medium: {
    label: '中', pixelRatio: 1.25,
    shadowScale: 1.0, pointShadows: false,
    ssao: true, bloom: true, bloomStrength: 0.32,
    fxaa: true, rainCount: 1600,
    refractScale: 0.5, refractEveryN: 2,
  },
  high: {
    label: '高', pixelRatio: 1.75,
    shadowScale: 1.0, pointShadows: true,
    ssao: true, bloom: true, bloomStrength: 0.5,
    fxaa: true, rainCount: 3200,
    refractScale: 0.75, refractEveryN: 1,
  },
};
export const QUALITY_PRESETS = { low: _Q.low, medium: _Q.medium, high: _Q.high, '低': _Q.low, '中': _Q.medium, '高': _Q.high };

// 程序化天空（頂點色天穹 / 環境球 / 玻璃反射共用）
export const SKY_PRESETS = {
  day: { top: 0x2e63b4, horizon: 0xbfd3dd, ground: 0x59533f },
  overcast: { top: 0x5d6771, horizon: 0x8d949b, ground: 0x494841 },
  night: { top: 0x05070f, horizon: 0x141c2e, ground: 0x090b10 },
};

// 天氣（clear=晴日 / rain=雨天 / night=夜晚）
export const WEATHERS = {
  clear: {
    label: '晴日', sky: 'day',
    sunElev: 46, sunAzim: 35, sunColor: 0xfff1de, sunIntensity: 3.0,
    hemiIntensity: 0.5, fogDensity: 0.0022, wetness: 0, rainIntensity: 0,
  },
  rain: {
    label: '雨天', sky: 'overcast',
    sunElev: 21, sunAzim: 25, sunColor: 0xa9b4c4, sunIntensity: 0.55,
    hemiIntensity: 0.6, fogDensity: 0.011, wetness: 1, rainIntensity: 1,
  },
  night: {
    label: '夜晚', sky: 'night',
    sunElev: 58, sunAzim: 215, sunColor: 0x9fb4d8, sunIntensity: 0.16,
    hemiIntensity: 0.1, fogDensity: 0.008, wetness: 0.2, rainIntensity: 0,
  },
};
export const WEATHER_PRESETS = WEATHERS; // 別名（UI 選單用）
export const EXPOSURE = { clear: 0.88, rain: 1.05, night: 1.3 };

// 室內燈光定義（lighting.js 建立燈具與 PointLight）
export const ROOM_LIGHTS = [
  { id: 'living', name: '客廳', color: 0xffc98a, intensity: 26, positions: [[5.0, 2.95, 3.2], [3.4, 2.95, 4.9]] },
  { id: 'dining', name: '用餐區', color: 0xffca8e, intensity: 18, positions: [[-3.2, 2.15, 2.9]] },
  { id: 'kitchen', name: '廚房', color: 0xffd2a0, intensity: 20, positions: [[-6.0, 2.95, 4.2]] },
  { id: 'corridor', name: '走廊', color: 0xffc98a, intensity: 9, positions: [[0, 2.95, 4.3], [0, 2.95, -3.0]] },
  { id: 'master', name: '主臥室', color: 0xffc287, intensity: 14, positions: [[-4.8, 2.95, -1.2]] },
  { id: 'bedroom2', name: '次臥', color: 0xffc287, intensity: 11, positions: [[4.7, 2.95, -3.6]] },
  { id: 'bath', name: '浴室', color: 0xe8f0ff, intensity: 13, positions: [[3.0, 2.95, 0.3]] },
  { id: 'study', name: '書房', color: 0xffc98a, intensity: 12, positions: [[6.2, 2.95, 0.3]] },
];

// 互動
export const INTERACT_RANGE = 2.6;
export const INTERACT_RANGE_DOOR = 3.0;
