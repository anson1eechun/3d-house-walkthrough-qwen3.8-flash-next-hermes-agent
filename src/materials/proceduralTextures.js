// 程序化貼圖系統：Canvas 2D 產生木紋、磁磚、石材、布料、草地等
// 每個貼圖產生器同時輸出 color / height / roughness，height 經 Sobel 轉法線圖。
import * as THREE from 'three';

// ---------- 雜湊與雜訊 ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 362437);
  h = (h ^ (h >>> 13)) >>> 0; h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function makeValueNoise(seed) {
  const R = 512, grid = new Float32Array(R * R);
  const rnd = mulberry32(seed);
  for (let i = 0; i < R * R; i++) grid[i] = rnd();
  const smooth = (t) => t * t * (3 - 2 * t);
  return function noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const sx = smooth(xf), sy = smooth(yf);
    const g = (ix, iy) => grid[((iy & (R - 1)) * R) + (ix & (R - 1))];
    const a = g(xi, yi), b = g(xi + 1, yi), c = g(xi, yi + 1), d = g(xi + 1, yi + 1);
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
  };
}
function makeFBM(seed, octaves = 5) {
  const noise = makeValueNoise(seed);
  return function fbm(x, y) {
    let v = 0, amp = 0.5, f = 1, tot = 0;
    for (let i = 0; i < octaves; i++) { v += noise(x * f, y * f) * amp; tot += amp; amp *= 0.5; f *= 2; }
    return v / tot;
  };
}
function makeRidgedFBM(seed, octaves = 5) {
  const noise = makeValueNoise(seed);
  return function ridged(x, y) {
    let v = 0, amp = 0.5, f = 1, tot = 0;
    for (let i = 0; i < octaves; i++) { v += (1 - Math.abs(noise(x * f, y * f) * 2 - 1)) * amp; tot += amp; amp *= 0.5; f *= 2.1; }
    return v / tot;
  };
}

// ---------- 畫布/貼圖工具 ----------
function genMaps(size, seed, fn) {
  const color = document.createElement('canvas'); color.width = color.height = size;
  const cctx = color.getContext('2d'); const cimg = cctx.createImageData(size, size);
  const height = new Float32Array(size * size); const rough = new Float32Array(size * size);
  const out = { r: 0, g: 0, b: 0, h: 0.5, w: 0.5 };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      fn(x, y, size, out);
      const i = (y * size + x) * 4;
      cimg.data[i] = out.r; cimg.data[i + 1] = out.g; cimg.data[i + 2] = out.b; cimg.data[i + 3] = 255;
      height[y * size + x] = Math.min(1, Math.max(0, out.h));
      rough[y * size + x] = Math.min(1, Math.max(0, out.w));
    }
  }
  cctx.putImageData(cimg, 0, 0);
  // height → normal（Sobel）
  const nrm = document.createElement('canvas'); nrm.width = nrm.height = size;
  const nctx = nrm.getContext('2d'); const nimg = nctx.createImageData(size, size);
  const H = (x, y) => height[(((y + size) % size) * size) + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tl = H(x - 1, y - 1), t = H(x, y - 1), tr = H(x + 1, y - 1);
      const l = H(x - 1, y), r = H(x + 1, y);
      const bl = H(x - 1, y + 1), b = H(x, y + 1), br = H(x + 1, y + 1);
      const dx = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const dy = (bl + 2 * b + br) - (tl + 2 * t + tr);
      const nz = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const i = (y * size + x) * 4;
      nimg.data[i] = ((-dx * nz) * 0.5 + 0.5) * 255;
      nimg.data[i + 1] = ((dy * nz) * 0.5 + 0.5) * 255;
      nimg.data[i + 2] = ((nz) * 0.5 + 0.5) * 255;
      nimg.data[i + 3] = 255;
    }
  }
  nctx.putImageData(nimg, 0, 0);
  // roughness canvas
  const rcv = document.createElement('canvas'); rcv.width = rcv.height = size;
  const rctx = rcv.getContext('2d'); const rimg = rctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = rough[i] * 255; const j = i * 4;
    rimg.data[j] = rimg.data[j + 1] = rimg.data[j + 2] = v; rimg.data[j + 3] = 255;
  }
  rctx.putImageData(rimg, 0, 0);
  return { color, normal: nrm, rough: rcv };
}

function makeTex(canvas, repeat, srgb) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function stdMat(params, maps, repeat, opts = {}) {
  const m = new THREE.MeshStandardMaterial(params);
  if (maps.color) { m.map = makeTex(maps.color, repeat, true); }
  if (maps.normal) {
    m.normalMap = makeTex(maps.normal, repeat, false);
    m.normalScale = new THREE.Vector2(opts.normalScale ?? 0.8, opts.normalScale ?? 0.8);
  }
  if (maps.rough && opts.useRoughMap !== false) { m.roughnessMap = makeTex(maps.rough, repeat, false); m.roughness = opts.rough ?? 1; }
  else m.roughness = opts.rough ?? params.roughness ?? 0.7;
  return m;
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const mix = (a, b, t) => a + (b - a) * t;
const mixc = (c1, c2, t) => [mix(c1[0], c2[0], t), mix(c1[1], c2[1], t), mix(c1[2], c2[2], t)];

// ---------- 木紋（木地板 / 家具共用） ----------
function woodGenerator(cfg) {
  const fbm = makeFBM(cfg.seed, 5);
  const fine = makeFBM(cfg.seed + 91, 4);
  return (x, y, size, out) => {
    const u = x / size, v = y / size;
    const rows = cfg.rows;                       // 木板排數
    const row = Math.floor(v * rows);
    const rowFrac = v * rows - row;
    // 每排錯縫：依排決定縫位置
    const jointOff = hash2(row, 7, cfg.seed);
    const cols = cfg.cols;
    const col = Math.floor((u + jointOff) * cols);
    const colFrac = (u + jointOff) * cols - col;
    const plankSeed = hash2(col, row, cfg.seed + 13);
    // 木板座標系（沿板長軸 u）
    const lx = (colFrac) * cfg.grainStretch + plankSeed * 10;
    const ly = rowFrac / cfg.rows * rows * 0.18;
    // 木紋：沿長軸的條紋 + 擾動
    const warp = fbm(lx * 2.2, ly * 8) - 0.5;
    const grain = Math.sin((lx * cfg.grainFreq + warp * 6.0) * Math.PI * 2) * 0.5 + 0.5;
    const fineN = fine(x * 0.35, y * 0.35);
    // 每片色差
    const tone = (plankSeed - 0.5) * cfg.toneVar;
    let t = grain * 0.55 + fineN * 0.3 + 0.15 + tone;
    t = clamp01(t);
    let [r, g, b] = mixc(cfg.colorDark, cfg.colorLight, t);
    // 節
    const knotN = fine(col * 3.7 + plankSeed * 50, row * 3.1);
    if (knotN > 0.965) { const k = (knotN - 0.965) / 0.035; r = mix(r, cfg.knot[0], k * 0.8); g = mix(g, cfg.knot[1], k * 0.8); b = mix(b, cfg.knot[2], k * 0.8); }
    // 板縫
    const seamW = 0.012;
    const seamV = rowFrac < seamW || rowFrac > 1 - seamW;
    const seamU = colFrac < 0.006 || colFrac > 1 - 0.006;
    let hgt = grain * 0.35 + fineN * 0.2 + 0.2;
    if (seamV || seamU) { r *= 0.55; g *= 0.55; b *= 0.55; hgt = 0.02; out.w = cfg.seamRough; }
    else out.w = clamp01(cfg.rough + (grain - 0.5) * cfg.roughVar);
    out.h = hgt; out.r = r; out.g = g; out.b = b;
  };
}

// ---------- 磁磚 ----------
function tileGenerator(cfg) {
  const fbm = makeFBM(cfg.seed, 5);
  const n = cfg.n; // n x n 塊磁磚
  return (x, y, size, out) => {
    const u = x / size, v = y / size;
    const tx = Math.floor(u * n), ty = Math.floor(v * n);
    const fx = u * n - tx, fy = v * n - ty;
    const tone = (hash2(tx, ty, cfg.seed) - 0.5) * cfg.toneVar;
    const mott = fbm(x * 0.05, y * 0.05);
    let t = clamp01(0.5 + tone + (mott - 0.5) * cfg.mottle);
    let [r, g, b] = mixc(cfg.colorA, cfg.colorB, t);
    // 磁磚縫
    const gw = cfg.groutWidth / n;
    const inGrout = fx < gw || fx > 1 - gw || fy < gw || fy > 1 - gw;
    if (inGrout) {
      [r, g, b] = mixc([r, g, b], cfg.grout, 0.92);
      out.h = 0; out.w = cfg.groutRough;
    } else {
      out.h = 0.75 + mott * 0.15; out.w = clamp01(cfg.rough + (mott - 0.5) * 0.12);
    }
    // 邊緣高光倒角
    const edge = Math.min(fx, 1 - fx, fy, 1 - fy);
    if (!inGrout && edge < gw * 0.6) { const k = 1 - edge / (gw * 0.6); r = mix(r, 255, k * 0.15); g = mix(g, 255, k * 0.15); b = mix(b, 255, k * 0.15); }
    out.r = r; out.g = g; out.b = b;
  };
}

// ---------- 石材（云石檯面） ----------
function marbleGenerator(cfg) {
  const ridged = makeRidgedFBM(cfg.seed, 6);
  const warp = makeFBM(cfg.seed + 5, 4);
  const fine = makeFBM(cfg.seed + 77, 4);
  return (x, y, size, out) => {
    const u = x / size, v = y / size;
    const wx = u + warp(u * 3, v * 3) * 0.35;
    const vein = ridged(wx * 3.2, v * 3.2);
    const vn = Math.pow(1 - Math.abs(vein * 2 - 1), 8);
    const f = fine(x * 0.12, y * 0.12);
    let [r, g, b] = mixc(cfg.base, cfg.veinColor, vn * cfg.veinStrength);
    const mott = (f - 0.5) * 0.1;
    r += mott * 255; g += mott * 255; b += mott * 255;
    out.r = r; out.g = g; out.b = b;
    out.h = 0.5 + vn * 0.2; out.w = clamp01(cfg.rough + vn * 0.1);
  };
}

// ---------- 混凝土 / 洗石子 ----------
function concreteGenerator(cfg) {
  const fbm = makeFBM(cfg.seed, 6);
  const speck = makeFBM(cfg.seed + 31, 3);
  return (x, y, size, out) => {
    const u = x / size, v = y / size;
    const n1 = fbm(x / size * 6, y / size * 6);
    const n2 = speck(x * 0.9, y * 0.9);
    let [r, g, b] = cfg.base;
    const tone = (n1 - 0.5) * cfg.variation;
    r += tone * 255; g += tone * 255 * 0.98; b += tone * 0.96;
    if (n2 > 0.78) { const k = (n2 - 0.78) / 0.22 * cfg.speckle; r = mix(r, cfg.speckColor[0], k); g = mix(g, cfg.speckColor[1], k); b = mix(b, cfg.speckColor[2], k); }
    // 伸縮縫（每半張貼圖一條直線縫）
    let hgt = 0.5 + n1 * 0.25;
    let w = clamp01(cfg.rough + (n1 - 0.5) * 0.15);
    if (cfg.joints) {
      const jw = 0.006;
      const ju = u % 0.5, jv = v % 0.5;
      if (ju < jw || ju > 0.5 - jw || jv < jw || jv > 0.5 - jw) { r *= 0.6; g *= 0.6; b *= 0.6; hgt = 0.05; w = cfg.jointRough; }
    }
    out.r = r; out.g = g; out.b = b; out.h = hgt; out.w = w;
  };
}

// ---------- 灰泥牆（室內外） ----------
function plasterGenerator(cfg) {
  const fine = makeFBM(cfg.seed, 4);
  return (x, y, size, out) => {
    const n = fine(x * 0.45, y * 0.45);
    const n2 = fine(x * 1.6, y * 1.6);
    const tone = (n - 0.5) * cfg.variation + (n2 - 0.5) * 0.03;
    let [r, g, b] = cfg.base;
    r += tone * 255; g += tone * 255; b += tone * 255;
    out.r = r; out.g = g; out.b = b;
    out.h = n * 0.6 + n2 * 0.4; out.w = clamp01(cfg.rough + (n - 0.5) * 0.1);
  };
}

// ---------- 布料 ----------
function fabricGenerator(cfg) {
  const n = makeFBM(cfg.seed, 4);
  return (x, y, size, out) => {
    const weaveX = Math.sin(x * Math.PI * 2 * cfg.weave / 2) * 0.5 + 0.5;
    const weaveY = Math.sin(y * Math.PI * 2 * cfg.weave / 2 + Math.PI / 2) * 0.5 + 0.5;
    const weave = (Math.floor(x / 2) % 2 === Math.floor(y / 2) % 2) ? weaveX : weaveY;
    const fuzz = n(x / size * 40, y / size * 40) ?? n(x * 0.2, y * 0.2);
    const t = clamp01(0.45 + weave * 0.2 + (fuzz - 0.5) * 0.25);
    let [r, g, b] = mixc(cfg.colorDark, cfg.colorLight, t);
    out.r = r; out.g = g; out.b = b;
    out.h = weave * 0.5 + (fuzz - 0.5) * 0.3; out.w = clamp01(cfg.rough + (weave - 0.5) * 0.08);
  };
}

// ---------- 地毯 ----------
function rugGenerator(cfg) {
  const n = makeFBM(cfg.seed, 4);
  return (x, y, size, out) => {
    const u = x / size, v = y / size;
    const band = Math.sin((u * 0.3 + v) * Math.PI * 2 * 5) * 0.5 + 0.5;
    const fuzz = n(x * 0.3, y * 0.3);
    let [r, g, b] = mixc(cfg.colorA, cfg.colorB, clamp01(band * 0.5 + (fuzz - 0.5) * 0.5));
    // 邊框
    const bm = 0.06;
    if (u < bm || u > 1 - bm || v < bm || v > 1 - bm) [r, g, b] = cfg.border;
    out.r = r; out.g = g; out.b = b;
    out.h = 0.6 + fuzz * 0.4; out.w = cfg.rough;
  };
}

// ---------- 草地 ----------
function grassGenerator(cfg) {
  const patch = makeFBM(cfg.seed, 5);
  const blade = makeFBM(cfg.seed + 17, 3);
  return (x, y, size, out) => {
    const n = blade(x * 1.9, y * 1.9);
    const p = patch(x / size * 5, y / size * 5);
    let [r, g, b] = mixc(cfg.colorDry, cfg.colorLush, clamp01(p * 1.3 - 0.15));
    const sh = (n - 0.5) * 0.35;
    r = mix(r, r * 0.65, Math.max(0, -sh)); g = mix(g, g * 0.65, Math.max(0, -sh)); b = mix(b, b * 0.7, Math.max(0, -sh));
    r += sh * 60; g += sh * 85; b += sh * 40;
    // 乾枯隨機點
    if (n > 0.93) { r = mix(r, 170, 0.5); g = mix(g, 160, 0.5); b = mix(b, 120, 0.5); }
    out.r = r; out.g = g; out.b = b;
    out.h = n * 0.8; out.w = cfg.rough;
  };
}

// ---------- 户外鋪面（石板步道/露台） ----------
function paverGenerator(cfg) {
  const fbm = makeFBM(cfg.seed, 5);
  return (x, y, size, out) => {
    const u = x / size, v = y / size;
    // 交錯工字鋪：每排錯半塊
    const rows = 4;
    const row = Math.floor(v * rows);
    const fy = v * rows - row;
    const off = (row % 2) * 0.5;
    const col = Math.floor((u + off) * 4);
    const fx = (u + off) * 4 - col;
    const tone = (hash2(col, row, cfg.seed) - 0.5) * cfg.toneVar;
    const m = fbm(x * 0.08, y * 0.08);
    let t = clamp01(0.5 + tone + (m - 0.5) * 0.35);
    let [r, g, b] = mixc(cfg.colorA, cfg.colorB, t);
    const gw = 0.035;
    if (fx < gw || fx > 1 - gw || fy < gw || fy > 1 - gw) {
      [r, g, b] = mixc([r, g, b], [40, 38, 35], 0.75);
      out.h = 0; out.w = 0.85;
    } else {
      out.h = 0.7 + m * 0.2; out.w = clamp01(cfg.rough + (m - 0.5) * 0.15);
    }
    out.r = r; out.g = g; out.b = b;
  };
}

// ---------- 藝術畫作 ----------
function artTexture(seed) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  const pal = [['#2b3a42', '#c96f3a', '#e0d5c0'], ['#3f4a3a', '#b9a06b', '#e8e2d2'], ['#4a2f26', '#7a8fa3', '#d9cbb0']][seed % 3];
  ctx.fillStyle = pal[2]; ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = pal[Math.floor(rnd() * 2)];
    ctx.globalAlpha = 0.25 + rnd() * 0.5;
    if (rnd() > 0.5) {
      ctx.beginPath();
      ctx.arc(rnd() * 512, rnd() * 512, 40 + rnd() * 160, 0, Math.PI * 2 * (0.4 + rnd() * 0.6));
      if (rnd() > 0.5) { ctx.lineWidth = 8 + rnd() * 40; ctx.strokeStyle = ctx.fillStyle; ctx.stroke(); }
      else ctx.fill();
    } else {
      ctx.save(); ctx.translate(rnd() * 512, rnd() * 512); ctx.rotate(rnd() * Math.PI);
      ctx.fillRect(-rnd() * 180, -rnd() * 20, rnd() * 300, rnd() * 60 + 8); ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
  return c;
}

// ---------- 材質庫 ----------
export function buildMaterialLibrary(renderer) {
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const setAniso = (m) => {
    for (const k of ['map', 'normalMap', 'roughnessMap']) if (m[k]) { m[k].anisotropy = Math.min(8, aniso); m[k].needsUpdate = true; }
    return m;
  };

  // 木地板：貼圖設計為 4m x 4m 範圍
  const floorMaps = genMaps(1024, 101, woodGenerator({
    seed: 7, rows: 16, cols: 2, grainStretch: 3, grainFreq: 26,
    colorDark: [96, 62, 34], colorLight: [196, 150, 100], knot: [58, 38, 22],
    toneVar: 0.35, rough: 0.42, roughVar: 0.25, seamRough: 0.7,
  }));
  const floorWood = setAniso(stdMat(
    { metalness: 0 },
    floorMaps, [4, 3.5], { rough: 1, normalScale: 0.5 }));

  const oakMaps = genMaps(512, 202, woodGenerator({
    seed: 21, rows: 7, cols: 2, grainStretch: 2.5, grainFreq: 30,
    colorDark: [120, 88, 52], colorLight: [205, 168, 118], knot: [70, 48, 28],
    toneVar: 0.3, rough: 0.5, roughVar: 0.2, seamRough: 0.75,
  }));
  const woodOak = setAniso(stdMat({ metalness: 0 }, oakMaps, [1, 1], { rough: 1, normalScale: 0.4 }));

  const walnutMaps = genMaps(512, 203, woodGenerator({
    seed: 33, rows: 5, cols: 2, grainStretch: 3, grainFreq: 24,
    colorDark: [44, 30, 22], colorLight: [112, 78, 52], knot: [30, 20, 14],
    toneVar: 0.3, rough: 0.45, roughVar: 0.2, seamRough: 0.7,
  }));
  const woodWalnut = setAniso(stdMat({ metalness: 0 }, walnutMaps, [1, 1], { rough: 1, normalScale: 0.4 }));

  const doorMaps = genMaps(512, 204, woodGenerator({
    seed: 41, rows: 3, cols: 1, grainStretch: 1.4, grainFreq: 22,
    colorDark: [52, 42, 34], colorLight: [104, 84, 64], knot: [34, 26, 20],
    toneVar: 0.22, rough: 0.4, roughVar: 0.15, seamRough: 0.65,
  }));
  const woodDoor = setAniso(stdMat({ metalness: 0 }, doorMaps, [1, 1], { rough: 1, normalScale: 0.35 }));

  const tileMaps = genMaps(512, 301, tileGenerator({
    seed: 51, n: 4, groutWidth: 0.1, toneVar: 0.22, mottle: 0.35,
    colorA: [168, 164, 158], colorB: [198, 194, 187], grout: [92, 88, 84],
    rough: 0.28, groutRough: 0.85,
  }));
  const tileFloor = setAniso(stdMat({ metalness: 0 }, tileMaps, [1.6, 1.3], { rough: 1, normalScale: 0.5 }));

  const bathTileMaps = genMaps(512, 302, tileGenerator({
    seed: 57, n: 4, groutWidth: 0.09, toneVar: 0.1, mottle: 0.18,
    colorA: [208, 210, 210], colorB: [232, 233, 231], grout: [150, 152, 150],
    rough: 0.18, groutRough: 0.8,
  }));
  const tileBath = setAniso(stdMat({ metalness: 0 }, bathTileMaps, [2, 1.2], { rough: 1, normalScale: 0.4 }));

  const showerMaps = genMaps(512, 303, tileGenerator({
    seed: 61, n: 3, groutWidth: 0.07, toneVar: 0.16, mottle: 0.3,
    colorA: [118, 122, 124], colorB: [152, 156, 156], grout: [70, 74, 76],
    rough: 0.35, groutRough: 0.8,
  }));
  const tileShower = setAniso(stdMat({ metalness: 0 }, showerMaps, [1.5, 1.5], { rough: 1, normalScale: 0.5 }));

  const marbleMaps = genMaps(512, 401, marbleGenerator({
    seed: 71, base: [234, 230, 224], veinColor: [120, 118, 116],
    veinStrength: 0.55, rough: 0.12,
  }));
  const stoneCounter = setAniso(stdMat({ metalness: 0 }, marbleMaps, [1.2, 1.2], { rough: 1, normalScale: 0.25 }));

  const concMaps = genMaps(512, 402, concreteGenerator({
    seed: 81, base: [158, 156, 150], variation: 0.16, speckle: 0.5, speckColor: [120, 118, 112],
    rough: 0.6, joints: true, jointRough: 0.8,
  }));
  const concretePave = setAniso(stdMat({ metalness: 0 }, concMaps, [1, 1], { rough: 1, normalScale: 0.4 }));

  const renderMaps = genMaps(512, 403, plasterGenerator({
    seed: 91, base: [214, 210, 202], variation: 0.1, rough: 0.85,
  }));
  const wallRender = setAniso(stdMat({ metalness: 0 }, renderMaps, [2, 2], { rough: 1, normalScale: 0.35 }));

  const innerPlaster = genMaps(512, 404, plasterGenerator({
    seed: 97, base: [228, 224, 216], variation: 0.05, rough: 0.9,
  }));
  const wallPaint = setAniso(stdMat({ color: 0xffffff, metalness: 0 }, innerPlaster, [1, 1], { rough: 1, normalScale: 0.2 }));

  const fabricLinenMaps = genMaps(256, 501, fabricGenerator({
    seed: 111, weave: 6, colorDark: [140, 132, 118], colorLight: [196, 188, 172], rough: 0.92,
  }));
  const fabricLinen = setAniso(stdMat({ metalness: 0 }, fabricLinenMaps, [2, 2], { rough: 1, normalScale: 0.6 }));

  const fabricSageMaps = genMaps(256, 502, fabricGenerator({
    seed: 113, weave: 6, colorDark: [92, 100, 88], colorLight: [148, 158, 140], rough: 0.9,
  }));
  const fabricSage = setAniso(stdMat({ metalness: 0 }, fabricSageMaps, [2, 2], { rough: 1, normalScale: 0.6 }));

  const fabricTerraMaps = genMaps(256, 503, fabricGenerator({
    seed: 117, weave: 5, colorDark: [130, 78, 54], colorLight: [190, 130, 96], rough: 0.9,
  }));
  const fabricTerra = setAniso(stdMat({ metalness: 0 }, fabricTerraMaps, [2, 2], { rough: 1, normalScale: 0.6 }));

  const rugMaps = genMaps(512, 601, rugGenerator({
    seed: 121, colorA: [122, 110, 94], colorB: [158, 146, 126], border: [88, 78, 66], rough: 0.95,
  }));
  const rug = setAniso(stdMat({ metalness: 0 }, rugMaps, [1, 1], { rough: 1, normalScale: 0.8 }));

  const runnerMaps = genMaps(512, 602, rugGenerator({
    seed: 127, colorA: [70, 74, 84], colorB: [112, 116, 124], border: [52, 54, 60], rough: 0.95,
  }));
  const rugRunner = setAniso(stdMat({ metalness: 0 }, runnerMaps, [1, 1], { rough: 1, normalScale: 0.8 }));

  const grassMaps = genMaps(512, 701, grassGenerator({
    seed: 131, colorDry: [108, 104, 64], colorLush: [82, 118, 62], rough: 0.92,
  }));
  const grass = setAniso(stdMat({ metalness: 0 }, grassMaps, [24, 24], { rough: 1, normalScale: 0.6 }));

  const paverMaps = genMaps(512, 702, paverGenerator({
    seed: 137, toneVar: 0.3, colorA: [128, 124, 118], colorB: [168, 162, 152], rough: 0.55,
  }));
  const paverStone = setAniso(stdMat({ metalness: 0 }, paverMaps, [1, 1], { rough: 1, normalScale: 0.7 }));

  // 畫作貼圖
  const artworks = [0, 1, 2].map((s) => {
    const t = new THREE.CanvasTexture(artTexture(s * 13 + 3));
    t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, metalness: 0 });
  });

  const matteBlack = new THREE.MeshStandardMaterial({ color: 0x1e2022, roughness: 0.55, metalness: 0.25 });
  const softBlack = new THREE.MeshStandardMaterial({ color: 0x2a2c2e, roughness: 0.85, metalness: 0.05 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd8dade, roughness: 0.12, metalness: 1 });
  const brushedSteel = new THREE.MeshStandardMaterial({ color: 0xb9bcc0, roughness: 0.35, metalness: 1 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb98a3f, roughness: 0.32, metalness: 1 });
  const porcelain = new THREE.MeshStandardMaterial({ color: 0xf4f2ee, roughness: 0.15, metalness: 0 });
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0xf2efe9, roughness: 0.95, metalness: 0 });
  const tvScreen = new THREE.MeshStandardMaterial({ color: 0x0a0c0e, roughness: 0.08, metalness: 0.4 });
  const darkGlassFrame = new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.4, metalness: 0.6 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a4d50, roughness: 0.7, metalness: 0.1 });
  const woodSlat = new THREE.MeshStandardMaterial({ color: 0x7a5a3c, roughness: 0.6, metalness: 0 });
  const soil = new THREE.MeshStandardMaterial({ color: 0x4a3c2e, roughness: 0.98 });
  const leafA = new THREE.MeshStandardMaterial({ color: 0x4e6b3a, roughness: 0.9, flatShading: true });
  const leafB = new THREE.MeshStandardMaterial({ color: 0x5f7a42, roughness: 0.9, flatShading: true });
  const leafC = new THREE.MeshStandardMaterial({ color: 0x6b7d4e, roughness: 0.9, flatShading: true });
  const bark = new THREE.MeshStandardMaterial({ color: 0x544437, roughness: 0.95 });
  const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x42583a, roughness: 0.95, flatShading: true });
  const stoneGray = new THREE.MeshStandardMaterial({ color: 0x8f8d88, roughness: 0.8 });

  return {
    floorWood, woodOak, woodWalnut, woodDoor,
    tileFloor, tileBath, tileShower, stoneCounter,
    concretePave, wallRender, wallPaint, ceilingMat,
    fabricLinen, fabricSage, fabricTerra, rug, rugRunner,
    grass, paverStone, artworks,
    matteBlack, softBlack, chrome, brushedSteel, brass, porcelain,
    tvScreen, darkGlassFrame, roofMat, woodSlat, soil,
    leafA, leafB, leafC, bark, hedgeMat, stoneGray,
  };
}

// 供濕地面无關的細節貼圖（濕度遮罩雜訊）
export function wetnessMaskTexture() {
  const fbm = makeFBM(888, 5);
  const size = 256;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d'); const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const n = fbm(x / size * 5, y / size * 5);
    const v = Math.max(0, (n - 0.45)) / 0.55;
    const i = (y * size + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = clamp01(v) * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3);
  return t;
}
