// 玻璃材質 + 雨天水珠 GLSL。
// 折射以場景顏色緩衝區（glassRT，不含玻璃本身）做螢幕空間取樣模擬；
// 反射以程序化天空近似（頂/地平/地平面混合 + 太陽光暈）。
// 水珠為 Voronoi 單元偽隨機生成：局部背景扭曲 + 高光 + 滑動動畫。
import * as THREE from 'three';

export const glassVertexShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vWorldN;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vWorldN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const glassFragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vWorldN;

  uniform sampler2D uRT;        // 場景顏色緩衝區（不含玻璃）
  uniform vec2 uResolution;
  uniform float uAspectInv;
  uniform float uTime;
  uniform float uWet;           // 0..1 濕度
  uniform float uRefract;       // 折射強度（低畫質 0）
  uniform vec3 uSunDir, uSunColor, uSkyTop, uSkyHorizon, uSkyGround;
  uniform float uSunIntensity;

  float hash21(vec2 p) {
    p = fract(p * vec2(233.34, 851.73));
    p += dot(p, p + 23.45);
    return fract(p.x * p.y);
  }

  // 程序化天空：依方向混合地平面/地平/天頂，加太陽光暈
  vec3 skyColor(vec3 dir) {
    float t = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 c = mix(uSkyGround, uSkyHorizon, smoothstep(0.30, 0.50, t));
    c = mix(c, uSkyTop, smoothstep(0.52, 0.85, t));
    float s = max(dot(dir, uSunDir), 0.0);
    c += uSunColor * pow(s, 90.0) * 6.0 * uSunIntensity;
    c += uSunColor * pow(s, 8.0) * 0.12 * uSunIntensity;
    return c;
  }

  // ACES 近似（與後處理 OutputPass 同調性，RT 內容為線性 HDR）
  vec3 aces(vec3 x) {
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  }

  // 水珠欄格：回傳 (单元中心偏移, 半径, 是否滑动)
  vec3 dropletCell(vec2 p, float t) {
    vec2 ip = floor(p);
    vec2 f = fract(p);
    float bestD = 1e9; vec2 bestO = vec2(0.0); float bestR = 0.0; float bestSeed = 0.0;
    for (int oy = -1; oy <= 1; oy++) for (int ox = -1; ox <= 1; ox++) {
      vec2 o = vec2(float(ox), float(oy));
      vec2 cell = ip + o;
      float seed = hash21(cell);
      vec2 center = o + vec2(hash21(cell + 7.31), hash21(cell + 3.17));
      // 部分大水珠沿玻璃下滑（慢、錯相位）
      float slide = step(0.82, seed);
      float slideSpeed = 0.05 + hash21(cell + 1.7) * 0.10;
      center.y -= mod(t * slideSpeed * (0.4 + seed), 1.0) * slide;
      float radius = 0.10 + hash21(cell + 5.3) * 0.32;
      float d = length(f - center);
      if (d < bestD) { bestD = d; bestO = f - center; bestR = radius; bestSeed = seed; }
    }
    return vec3(bestO / max(bestR, 1e-4), bestR, bestSeed);
  }

  void main() {
    vec3 N = normalize(vWorldN);
    vec3 V = normalize(cameraPosition - vWorldPos);
    if (dot(N, V) < 0.0) N = -N; // 雙面玻璃統一法線方向

    vec2 screenUV = gl_FragCoord.xy / uResolution;

    // --- 水珠扭曲場 ---
    // 依世界座標參數化，讓水珠大小不隨窗格尺寸變形
    float scale = 22.0;
    vec2 dp = (abs(N.z) > abs(N.x)) ? vWorldPos.xy : vec2(vWorldPos.z, vWorldPos.y);
    dp *= scale;
    vec3 drop = dropletCell(dp, uTime);
    vec2 dropN = drop.x; // 已歸一化到單元半徑：>1 在珠外
    float inDrop = smoothstep(1.0, 0.55, length(dropN)) * step(0.001, uWet);
    // 珠內透鏡：以偏移當局部法線做背景位移
    vec2 distort = dropN * (1.0 - smoothstep(0.0, 1.0, length(dropN))) * 0.020 * uWet;

    // --- 背景（折射模擬）---
    float blur = uWet * 0.006; // 濕膜稍微霧化背景
    vec3 bg;
    if (uRefract > 0.0) {
      vec2 uvB = screenUV + distort + N.xy * vec2(1.0, uAspectInv) * uRefract * 0.25;
      uvB = clamp(uvB, vec2(0.001), vec2(0.999));
      vec3 c0 = textureLod(uRT, uvB, 0.0).rgb;
      vec3 c1 = textureLod(uRT, uvB + vec2(blur, blur * uAspectInv), 3.0).rgb;
      bg = mix(c0, c1, uWet * 0.55);
    } else {
      bg = skyColor(reflect(-V, N)) * 0.6;
    }

    // --- 反射 ---
    vec3 R = reflect(-V, N);
    vec3 sky = skyColor(R);
    float fresnel = 0.04 + 0.92 * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 5.0);

    // --- 合成 ---
    vec3 tint = vec3(0.86, 0.90, 0.88);
    vec3 col = mix(bg * tint, sky, fresnel);
    col = aces(col) ; // 顯示域混合（RT 已 tonemap? 否：RT 為線性 HDR，此處手動 tonemap 玻璃混合）

    // 水珠高光與邊緣亮
    float dl = length(dropN);
    float spec = pow(max(dot(R, uSunDir), 0.0), 24.0) * uSunIntensity;
    float rim = smoothstep(0.75, 1.0, dl) * inDrop;
    float lensHi = smoothstep(0.35, 0.0, abs(dl - 0.45)) * inDrop;
    col += vec3(1.0) * (spec * fresnel * 2.0 + rim * 0.35 + lensHi * 0.22) * uWet;
    col += vec3(0.7, 0.8, 1.0) * spec * 0.25;

    // --- 透明度 ---
    float alpha = mix(0.14, 0.55, fresnel);
    alpha += inDrop * 0.30 + rim * 0.25;      // 水珠輪廓更易見
    alpha = clamp(alpha, 0.06, 0.92);

    gl_FragColor = vec4(col, alpha);
  }
`;

export function createGlassMaterial({ sceneCtx, quality, size }) {
  const uniforms = {
    uRT: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uAspectInv: { value: 1 },
    uTime: sceneCtx.timeU,
    uWet: sceneCtx.wetU,
    uRefract: { value: quality === '低' ? 0 : 0.16 },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color(1, 1, 1) },
    uSkyTop: { value: new THREE.Color(0.1, 0.2, 0.4) },
    uSkyHorizon: { value: new THREE.Color(0.6, 0.6, 0.6) },
    uSkyGround: { value: new THREE.Color(0.2, 0.2, 0.2) },
    uSunIntensity: { value: 1 },
  };
  const material = new THREE.ShaderMaterial({
    vertexShader: glassVertexShader,
    fragmentShader: glassFragmentShader,
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  return material;
}

/** 每幀同步玻璃材質與天空/RT 狀態（scratch 向量由 main 複用） */
export function updateGlassMaterial(material, sceneCtx, renderer, scratchSize) {
  const u = material.uniforms;
  const w = sceneCtx.getActiveSky();
  u.uSunDir.value.copy(w.sunDirVec);
  u.uSunColor.value.copy(w.sunColorLin);
  u.uSkyTop.value.set(w.topHex);
  u.uSkyHorizon.value.set(w.horizonHex);
  u.uSkyGround.value.set(w.groundHex);
  u.uSunIntensity.value = w.sunIntensity;
  const size = renderer.getDrawingBufferSize(scratchSize);
  u.uResolution.value.set(size.x, size.y);
  u.uAspectInv.value = size.y / Math.max(1, size.x);
  if (sceneCtx.refractRT) u.uRT.value = sceneCtx.refractRT.texture;
}
