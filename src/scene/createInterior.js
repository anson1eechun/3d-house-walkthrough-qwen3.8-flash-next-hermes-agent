// 室內家具：客廳／廚房用餐／主臥／次臥／書房／浴室／玄關 — 程式化建模 + 抽屜・櫥門・電視互動。
import * as THREE from 'three';
import { HOUSE } from '../config.js';
import { box, rbox, cyl, addBoxCollider } from './buildHelpers.js';
import { createDrawerObject, createToggleObject, createCabinetDoorObject } from '../interaction/furniture.js';

const { floorY, wallT } = HOUSE;
const FLOOR = floorY;

export function buildInterior({ scene, mats, glass, colliderSys, group }) {
  const interactives = [];
  const glassMeshes = [];
  const m = mats;

  // 統一註冊盒碰撞（本地尺寸）
  function solid(mesh) { addBoxCollider(mesh, colliderSys); return mesh; }
  function solidBox(obj, half, pos = [0, 0, 0]) { colliderSys.addAABBCollider(obj, { half, pos }); return obj; }

  // 滑軌抽屜：drawerGroup 沿世界軸 dirSign 滑出 travel（rotation 不影響位移軸）
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  function slide(dg, axis, dirSign, travel = 0.4, speed = 1.6) {
    const o = createDrawerObject({ drawerGroup: dg, travel: 0, speed });
    const b = { x: dg.position.x, z: dg.position.z };
    o.update = (dt) => {
      const st = o.state;
      if (st.progress === st.target) { st.busy = false; return; }
      const step = speed * dt;
      st.progress = st.target > st.progress
        ? Math.min(st.target, st.progress + step)
        : Math.max(st.target, st.progress - step);
      const d = easeInOut(st.progress) * travel * dirSign;
      if (axis === 'z') dg.position.z = b.z + d; else dg.position.x = b.x + d;
      if (st.progress === st.target) st.busy = false;
    };
    interactives.push(o);
    return o;
  }

  // 鉸鏈櫥門（不擋通行）：pivot 在鉸鏈處，panel 向 dir 開
  function hingeDoor(px, py, pz, rotY, w, h, dir, label) {
    const pivot = new THREE.Group();
    pivot.position.set(px, py, pz);
    pivot.rotation.y = rotY;
    const panel = box(w, h, 0.035, m.woodOak, w / 2, h / 2, 0, { group: pivot });
    box(0.02, 0.18, 0.03, m.brass, w - 0.1, h / 2, 0.035, { group: pivot, cast: false });
    group.add(pivot);
    const obj = createCabinetDoorObject({ pivot, width: w, dir, labelClosed: `F — 打開${label}`, labelOpen: `F — 關上${label}` });
    obj.meshes = [pivot];
    interactives.push(obj);
    return obj;
  }

  function chair(x, z, rotY, seatMat) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    rbox(0.46, 0.06, 0.44, seatMat, 0, 0.45, 0, { radius: 0.02, group: g });
    rbox(0.46, 0.5, 0.06, seatMat, 0, 0.72, -0.19, { radius: 0.02, group: g });
    for (const [lx, lz] of [[-0.19, -0.17], [0.19, -0.17], [-0.19, 0.17], [0.19, 0.17]]) {
      cyl(0.02, 0.025, 0.44, m.brushedSteel, lx, 0.22, lz, { group: g });
    }
    group.add(g);
    solidBox(g, [0.26, 0.5, 0.26]);
    return g;
  }

  function pendant(x, y, z) {
    cyl(0.015, 0.015, 2.9 - y + 0.4, m.matteBlack, x, (y + 3.1) / 2 - 0.2, z, { seg: 6, cast: false });
    cyl(0.16, 0.22, 0.24, m.matteBlack, x, y, z, { cast: false });
  }

  function artPanel(x, y, z, rotY, w, h, idx) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    box(w + 0.06, h + 0.06, 0.04, m.matteBlack, 0, 0, 0, { group: g, cast: false });
    box(w, h, 0.012, m.artworks[idx % 3], 0, 0, 0.026, { group: g, cast: false });
    group.add(g);
  }

  // ==================== 客廳（x 1.6..8, z 2..6）====================
  {
    // 地毯
    box(3.4, 0.015, 2.4, m.rug, 4.9, FLOOR + 0.008, 3.9, { cast: false });
    // L 型沙發（面向落地窗 +z）
    const sofa = new THREE.Group();
    sofa.position.set(4.9, 0, 3.1);
    const fab = m.fabricSage;
    box(3.2, 0.42, 1.05, fab, 0, 0.24, 0, { group: sofa });            // 坐基座
    box(3.2, 0.55, 0.22, fab, 0, 0.72, -0.42, { group: sofa });        // 靠背
    box(0.24, 0.6, 1.05, fab, -1.48, 0.55, 0, { group: sofa });        // 左扶手
    box(0.24, 0.6, 1.05, fab, 1.48, 0.55, 0, { group: sofa });         // 右扶手
    for (const sx of [-1.02, -0.34, 0.34, 1.02]) rbox(0.62, 0.16, 0.9, fab, sx, 0.53, 0.03, { radius: 0.05, group: sofa });
    for (const sx of [-1.02, 0.34]) rbox(0.6, 0.42, 0.18, m.fabricLinen, sx, 0.82, -0.3, { radius: 0.06, group: sofa });
    // 貴妃躺椅段（向右延伸到東牆）
    box(1.0, 0.42, 1.9, fab, 2.1, 0.24, 0.95, { group: sofa });
    box(0.22, 0.55, 1.9, fab, 2.5, 0.72, 0.95, { group: sofa });
    for (const sz of [0.28, 1.0, 1.72]) rbox(0.86, 0.16, 0.66, fab, 2.1, 0.53, sz, { radius: 0.05, group: sofa });
    group.add(sofa);
    solidBox(sofa, [1.85, 0.8, 1.55]);
    solidBox(sofa, [0.7, 0.8, 1.0]);
    // 咖啡桌
    const ct = new THREE.Group();
    ct.position.set(4.9, 0, 4.35);
    rbox(1.3, 0.05, 0.7, m.woodWalnut, 0, 0.4, 0, { radius: 0.012, group: ct });
    rbox(1.1, 0.1, 0.55, m.softBlack, 0, 0.3, 0, { radius: 0.01, group: ct });
    for (const [lx, lz] of [[-0.56, -0.28], [0.56, -0.28], [-0.56, 0.28], [0.56, 0.28]]) cyl(0.02, 0.02, 0.38, m.brushedSteel, lx, 0.2, lz, { seg: 8, group: ct });
    group.add(ct);
    solidBox(ct, [0.68, 0.45, 0.38]);
    // 電視牆（北牆 P7）+ 電視櫃
    box(2.2, 0.42, 0.45, m.woodWalnut, 4.9, FLOOR + 0.21, 2.35, { group });
    box(2.0, 0.02, 0.42, m.softBlack, 4.9, FLOOR + 0.44, 2.35, { cast: false, group });
    const tvScreen = rbox(1.7, 0.95, 0.05, m.tvScreen, 4.9, FLOOR + 1.55, 2.2, { radius: 0.008, group });
    box(1.78, 1.02, 0.06, m.matteBlack, 4.9, FLOOR + 1.55, 2.18, { cast: false, group });
    let tvOn = false;
    interactives.push(createToggleObject({
      meshes: [tvScreen],
      label: () => (tvOn ? 'F — 關閉電視' : 'F — 開啟電視'),
      action() {
        tvOn = !tvOn;
        m.tvScreen.emissive = tvOn ? new THREE.Color(0x9db7c8) : new THREE.Color(0x000000);
        m.tvScreen.emissiveIntensity = tvOn ? 2.2 : 0;
      },
      distance: 2.8,
    }));
    // 落地燈 + 邊几
    cyl(0.16, 0.2, 0.03, m.matteBlack, 2.1, FLOOR + 0.015, 2.5, { cast: false });
    cyl(0.02, 0.02, 1.5, m.brushedSteel, 2.1, FLOOR + 0.76, 2.5, { seg: 8 });
    cyl(0.14, 0.18, 0.24, m.fabricLinen, 2.1, FLOOR + 1.6, 2.5, { cast: false });
    // 窗簾（帷幕兩側）
    box(0.5, 2.8, 0.07, m.fabricLinen, 0.72, FLOOR + 1.42, 5.92, { group });
    box(0.5, 2.8, 0.07, m.fabricLinen, 4.02, FLOOR + 1.42, 5.92, { group });
    artPanel(7.94, FLOOR + 1.7, 5.35, -Math.PI / 2, 1.1, 0.75, 0);
  }

  // ==================== 廚房（x -8..-4, z 2..6）====================
  {
    // ㄇ 型流水吧：前牆跑 + 西牆跑
    const cabBase = m.softBlack, stone = m.stoneCounter;
    box(3.5, 0.86, 0.62, cabBase, -6.15, FLOOR + 0.43, 5.62, { group });
    rbox(3.6, 0.05, 0.66, stone, -6.1, FLOOR + 0.885, 5.62, { radius: 0.01, group });
    box(0.62, 0.86, 2.6, cabBase, -7.62, FLOOR + 0.43, 3.92, { group });
    rbox(0.66, 0.05, 2.7, stone, -7.62, FLOOR + 0.885, 3.92, { radius: 0.01, group });
    // 瓦斯爐 + 抽油煙機 + 水槽
    box(0.62, 0.02, 0.5, m.matteBlack, -7.62, FLOOR + 0.915, 4.4);
    for (const sz of [4.28, 4.56]) cyl(0.09, 0.09, 0.012, m.brushedSteel, -7.62, FLOOR + 0.93, sz, { seg: 12, cast: false });
    box(0.9, 0.7, 0.5, m.matteBlack, -7.62, FLOOR + 1.9, 4.42);
    box(0.62, 1.2, 0.9, m.matteBlack, -7.62, FLOOR + 1.9, 4.42);
    box(0.64, 0.16, 0.48, m.porcelain, -5.7, FLOOR + 0.82, 5.62);
    cyl(0.02, 0.02, 0.34, m.chrome, -5.7, FLOOR + 1.06, 5.36, { seg: 8 });
    cyl(0.018, 0.018, 0.16, m.chrome, -5.7, FLOOR + 1.22, 5.44, { seg: 8, rotZ: Math.PI / 2 });
    // 上吊櫃（兩扇櫥門）
    box(3.5, 0.7, 0.36, m.woodOak, -6.15, FLOOR + 2.15, 5.75, { group });
    hingeDoor(-7.85, FLOOR + 1.82, 5.57, 0, 1.65, 0.66, -1, '橱柜');
    hingeDoor(-4.48, FLOOR + 1.82, 5.57, Math.PI, 1.65, 0.66, -1, '橱柜');
    // 冰箱
    const fridge = box(0.78, 1.9, 0.72, m.brushedSteel, -2.4, FLOOR + 0.95, 5.55, { group });
    box(0.02, 1.2, 0.03, m.matteBlack, -2.0, FLOOR + 1.25, 5.2, { cast: false, group });
    box(0.02, 0.4, 0.03, m.matteBlack, -2.0, FLOOR + 0.42, 5.2, { cast: false, group });
    solidBox(fridge, [0.42, 0.97, 0.38]);
    // 中島 + 抽屜 ×2
    const island = box(2.2, 0.9, 1.0, m.woodOak, -5.6, FLOOR + 0.45, 3.4, { group });
    rbox(2.35, 0.06, 1.15, stone, -5.6, FLOOR + 0.93, 3.4, { radius: 0.012, group });
    solidBox(island, [1.1, 0.47, 0.53]);
    for (let i = 0; i < 2; i++) {
      const dg = new THREE.Group();
      dg.position.set(-6.25 + i * 1.3, FLOOR + 0.18 + i * 0.32, 2.9);
      box(1.0, 0.28, 0.04, m.woodWalnut, 0, 0.14, -0.02, { group: dg, cast: false });
      box(0.02, 0.14, 0.03, m.brass, 0, 0.14, -0.06, { group: dg, cast: false });
      group.add(dg);
      slide(dg, 'z', -1, 0.42);
    }
    // 吧檯凳 ×3
    for (const sx of [-6.3, -5.6, -4.9]) {
      cyl(0.17, 0.17, 0.05, m.woodWalnut, sx, FLOOR + 0.62, 2.62);
      cyl(0.02, 0.03, 0.6, m.matteBlack, sx, FLOOR + 0.31, 2.62, { seg: 8 });
      cyl(0.17, 0.2, 0.02, m.matteBlack, sx, FLOOR + 0.01, 2.62, { cast: false });
    }
    solidBox(island, [1.2, 0.47, 0.6]);
  }

  // ==================== 用餐區（x -4.5..-2, z 2..4）====================
  {
    box(1.9, 0.06, 0.95, m.woodOak, -3.3, FLOOR + 0.73, 3.1, { group });
    for (const [lx, lz] of [[-0.82, -0.36], [0.82, -0.36], [-0.82, 0.36], [0.82, 0.36]]) {
      box(0.07, 0.72, 0.07, m.matteBlack, -3.3 + lx, FLOOR + 0.36, 3.1 + lz, { group });
    }
    solidBox(box(1.9, 0.7, 0.95, m.softBlack, -3.3, FLOOR + 0.35, 3.1, { cast: false, receive: false }), [0.95, 0.35, 0.475]);
    chair(-4.05, 3.1, Math.PI / 2, m.fabricSage);
    chair(-2.55, 3.1, -Math.PI / 2, m.fabricSage);
    chair(-3.55, 2.35, 0, m.fabricSage);
    chair(-3.05, 2.35, 0, m.fabricSage);
    chair(-3.55, 3.85, Math.PI, m.fabricSage);
    chair(-3.05, 3.85, Math.PI, m.fabricSage);
    pendant(-3.3, FLOOR + 1.85, 3.1);
    // 餐桌花器
    cyl(0.06, 0.09, 0.22, m.porcelain, -3.3, FLOOR + 0.87, 3.1, { seg: 12 });
    cyl(0.012, 0.012, 0.3, m.leafA, -3.32, FLOOR + 1.12, 3.08, { seg: 5, rotZ: 0.15, cast: false });
  }

  // ==================== 主臥（x -8..-1.6, z -6..1.9）====================
  {
    box(2.6, 0.015, 2.0, m.rug, -4.4, FLOOR + 0.008, -3.4, { cast: false });
    // 床（床头靠西牆）
    const bed = new THREE.Group();
    bed.position.set(-6.6, 0, -3.6);
    box(1.75, 0.32, 2.1, m.woodWalnut, 0, 0.16, 0, { group: bed });           // 床架
    box(0.06, 1.15, 2.1, m.fabricLinen, -0.9, 0.57, 0, { group: bed });       // 床头板贴墙
    rbox(1.66, 0.28, 2.0, m.porcelain, 0.04, 0.46, 0, { radius: 0.06, seg: 3, group: bed }); // 床垫
    rbox(1.62, 0.14, 1.45, m.fabricTerra, 0.28, 0.63, 0.28, { radius: 0.05, seg: 3, group: bed }); // 被
    rbox(1.6, 0.05, 0.5, m.fabricSage, 0.28, 0.72, -0.55, { radius: 0.03, group: bed });    // 床尾毯
    for (const sz of [-0.72, -0.22]) {
      rbox(0.62, 0.16, 0.4, m.porcelain, 0.3, 0.74, sz, { radius: 0.07, seg: 3, group: bed });
    }
    group.add(bed);
    solidBox(bed, [0.95, 0.8, 1.1]);
    // 床頭柜（含一個抽屜）
    function nightstand(x, z) {
      const body = box(0.5, 0.5, 0.42, m.woodWalnut, x, FLOOR + 0.25, z, { group });
      solidBox(body, [0.25, 0.26, 0.21]);
      const dg = new THREE.Group();
      dg.position.set(x, FLOOR + 0.09, z);
      box(0.44, 0.18, 0.03, m.woodWalnut, 0, 0.09, 0.21, { group: dg, cast: false });
      box(0.12, 0.02, 0.025, m.brass, 0, 0.09, 0.24, { group: dg, cast: false });
      group.add(dg);
      slide(dg, 'z', 1, 0.3);
      cyl(0.09, 0.12, 0.22, m.porcelain, x, FLOOR + 0.61, z, { seg: 10, cast: false });
      return body;
    }
    nightstand(-6.6, -1.9);
    nightstand(-6.6, -5.3);
    // 衣柜（北牆，推拉兩門 → 用線性滑軌）
    box(2.4, 2.3, 0.6, m.woodOak, -4.6, FLOOR + 1.15, -5.55, { group });
    solidBox(box(2.4, 2.3, 0.6, m.softBlack, -4.6, FLOOR + 1.15, -5.55, { cast: false, receive: false }), [1.2, 1.15, 0.3]);
    for (let i = 0; i < 2; i++) {
      const dg = new THREE.Group();
      dg.position.set(-5.15 + i * 1.15, FLOOR + 0.05, -5.31);
      box(1.12, 2.18, 0.035, i === 0 ? m.woodOak : m.woodDoor, 0, 1.09, 0, { group: dg, cast: false });
      box(0.03, 0.3, 0.03, m.brushedSteel, i === 0 ? 0.45 : -0.45, 1.1, -0.04, { group: dg, cast: false });
      group.add(dg);
      slide(dg, 'x', i === 0 ? -1 : 1, 1.05, 1.1);
    }
    // 梳妝柜（P2 西面，一個抽屜）
    const dresser = box(1.1, 0.75, 0.45, m.woodOak, -1.9, FLOOR + 0.38, 0.2, { group });
    solidBox(dresser, [0.55, 0.38, 0.23]);
    {
      const dg = new THREE.Group();
      dg.position.set(-1.9, FLOOR + 0.12, 0.2);
      box(0.03, 0.22, 1.0, m.woodOak, -0.56, 0.11, 0, { group: dg, cast: false });
      box(0.025, 0.02, 0.16, m.brass, -0.59, 0.11, 0, { group: dg, cast: false });
      group.add(dg);
      slide(dg, 'x', -1, 0.38);
    }
    artPanel(-3.6, FLOOR + 1.9, -5.83, 0, 1.2, 0.8, 1);
  }

  // ==================== 次臥（x 1.6..8, z -6..-1.7）====================
  {
    box(2.2, 0.015, 1.6, m.rugRunner, 4.6, FLOOR + 0.008, -3.6, { cast: false });
    const bed = new THREE.Group();
    bed.position.set(6.7, 0, -3.7);
    box(1.35, 0.3, 2.05, m.woodOak, 0, 0.15, 0, { group: bed });
    box(0.06, 1.0, 1.4, m.fabricLinen, 0.7, 0.5, 0, { group: bed });
    rbox(1.28, 0.26, 1.96, m.porcelain, -0.02, 0.43, 0, { radius: 0.06, seg: 3, group: bed });
    rbox(1.24, 0.12, 1.35, m.fabricSage, -0.24, 0.58, 0.3, { radius: 0.05, seg: 3, group: bed });
    rbox(0.56, 0.14, 0.38, m.porcelain, -0.2, 0.66, -0.72, { radius: 0.06, seg: 3, group: bed });
    group.add(bed);
    solidBox(bed, [0.72, 0.7, 1.05]);
    const ns = box(0.45, 0.45, 0.4, m.woodOak, 6.7, FLOOR + 0.23, -2.35, { group });
    solidBox(ns, [0.24, 0.24, 0.21]);
    cyl(0.08, 0.11, 0.2, m.porcelain, 6.7, FLOOR + 0.56, -2.35, { seg: 10, cast: false });
    // 書桌區（後牆）
    box(1.4, 0.05, 0.55, m.woodOak, 3.2, FLOOR + 0.72, -5.57, { group });
    for (const lx of [2.55, 3.85]) box(0.06, 0.72, 0.5, m.matteBlack, lx, FLOOR + 0.36, -5.55, { group });
    solidBox(box(1.4, 0.7, 0.55, m.softBlack, 3.2, FLOOR + 0.35, -5.57, { cast: false }), [0.7, 0.35, 0.28]);
    chair(3.2, -4.75, Math.PI, m.fabricTerra);
    // 書架
    const shelf = box(1.2, 1.9, 0.32, m.woodOak, 5.4, FLOOR + 0.95, -5.7, { group });
    for (const sy of [0.42, 0.92, 1.42]) box(1.12, 0.03, 0.3, m.woodWalnut, 5.4, FLOOR + sy, -5.68, { cast: false, group });
    solidBox(shelf, [0.6, 0.95, 0.17]);
    artPanel(7.94, FLOOR + 1.75, -3.2, -Math.PI / 2, 0.85, 0.6, 2);
  }

  // ==================== 書房（x 4.6..8, z -1.4..1.9）====================
  {
    box(1.9, 0.015, 1.4, m.rugRunner, 6.4, FLOOR + 0.008, 0.4, { cast: false });
    box(1.5, 0.05, 0.6, m.woodWalnut, 6.9, FLOOR + 0.72, 1.45, { group });
    for (const lx of [6.2, 7.6]) box(0.06, 0.72, 0.55, m.matteBlack, lx, FLOOR + 0.36, 1.45, { group });
    solidBox(box(1.5, 0.7, 0.6, m.softBlack, 6.9, FLOOR + 0.35, 1.45, { cast: false }), [0.75, 0.35, 0.3]);
    chair(6.9, 0.62, 0, m.fabricSage);
    // 東牆書架（連頂）
    const shelf = box(0.34, 2.6, 2.2, m.woodOak, 7.78, FLOOR + 1.3, -0.5, { group });
    for (const sy of [0.5, 1.1, 1.7, 2.3]) box(0.32, 0.03, 2.14, m.woodWalnut, 7.78, FLOOR + sy, -0.5, { cast: false, group });
    solidBox(shelf, [0.17, 1.3, 1.1]);
    // 单人沙发 + 灯
    const arm = new THREE.Group();
    arm.position.set(5.3, 0, -0.6);
    rbox(0.9, 0.42, 0.85, m.fabricTerra, 0, 0.24, 0, { radius: 0.07, seg: 3, group: arm });
    rbox(0.9, 0.5, 0.2, m.fabricTerra, 0, 0.7, -0.36, { radius: 0.07, seg: 3, group: arm });
    rbox(0.18, 0.24, 0.8, m.fabricTerra, -0.42, 0.55, 0, { radius: 0.06, seg: 3, group: arm });
    rbox(0.18, 0.24, 0.8, m.fabricTerra, 0.42, 0.55, 0, { radius: 0.06, seg: 3, group: arm });
    group.add(arm);
    solidBox(arm, [0.5, 0.5, 0.45]);
    cyl(0.14, 0.18, 0.025, m.matteBlack, 6.1, FLOOR + 0.013, -1.1, { cast: false });
    cyl(0.018, 0.018, 1.4, m.brushedSteel, 6.1, FLOOR + 0.72, -1.1, { seg: 8 });
    cyl(0.12, 0.15, 0.2, m.fabricLinen, 6.1, FLOOR + 1.5, -1.1, { cast: false });
  }

  // ==================== 浴室（x 1.7..4.4, z -1.4..1.9）====================
  {
    // 洗手台（西牆 P4 面）+ 抽屜 + 镜
    const vanity = box(0.5, 0.72, 1.1, m.woodWalnut, 1.9, FLOOR + 0.36, 0.3, { group });
    solidBox(vanity, [0.26, 0.37, 0.55]);
    rbox(0.56, 0.05, 1.2, m.stoneCounter, 1.9, FLOOR + 0.745, 0.3, { radius: 0.01, group });
    box(0.4, 0.12, 0.5, m.porcelain, 1.9, FLOOR + 0.71, 0.3);
    cyl(0.02, 0.02, 0.24, m.chrome, 1.72, FLOOR + 0.88, 0.3, { seg: 8 });
    {
      const dg = new THREE.Group();
      dg.position.set(1.9, FLOOR + 0.1, 0.3);
      box(0.03, 0.2, 1.0, m.woodWalnut, 0.27, 0.1, 0, { group: dg, cast: false });
      box(0.025, 0.02, 0.2, m.brass, 0.3, 0.1, 0, { group: dg, cast: false });
      group.add(dg);
      slide(dg, 'x', 1, 0.34);
    }
    box(0.02, 0.9, 0.8, m.chrome, 1.66, FLOOR + 1.5, 0.3, { cast: false });
    // 馬桶
    const wc = new THREE.Group();
    wc.position.set(2.45, 0, 1.4);
    rbox(0.42, 0.42, 0.55, m.porcelain, 0, 0.24, 0.05, { radius: 0.1, seg: 3, group: wc });
    rbox(0.44, 0.34, 0.2, m.porcelain, 0, 0.6, -0.22, { radius: 0.05, seg: 2, group: wc });
    rbox(0.4, 0.06, 0.44, m.porcelain, 0, 0.47, 0.08, { radius: 0.06, seg: 2, group: wc });
    group.add(wc);
    solidBox(wc, [0.24, 0.55, 0.32]);
    // 淋浴：玻璃隔段 + 花洒
    const showerPane = box(0.015, 2.05, 1.2, glass.clearMat, 3.35, FLOOR + 1.05, 0.35, { cast: false });
    glassMeshes.push(showerPane);
    addBoxCollider(showerPane, colliderSys);
    box(1.05, 0.06, 1.25, m.tileShower, 3.87, FLOOR + 0.04, 0.35, { cast: false });
    box(0.02, 2.0, 1.25, m.tileBath, 4.35, FLOOR + 1.0, 0.35, { cast: false });
    cyl(0.02, 0.02, 0.5, m.chrome, 4.2, FLOOR + 1.9, 0.35, { seg: 8, rotZ: -0.9 });
    cyl(0.09, 0.11, 0.05, m.chrome, 4.0, FLOOR + 2.1, 0.35, { seg: 12 });
  }

  // ==================== 玄關（x -1.4..1.4, z -5.9..5.9）====================
  {
    box(1.1, 0.015, 3.0, m.rugRunner, 0, FLOOR + 0.008, 3.4, { cast: false });
    box(1.1, 0.015, 2.4, m.rugRunner, 0, FLOOR + 0.008, -3.0, { cast: false });
    // 鞋柜（雨傘季節：双开门）
    const sc = box(1.2, 0.9, 0.35, m.woodOak, -1.32, FLOOR + 0.45, 4.6, { group });
    solidBox(sc, [0.6, 0.45, 0.18]);
    hingeDoor(-1.92, FLOOR + 0.05, 4.43, 0, 0.58, 0.82, -1, '鞋柜');
    hingeDoor(-0.72, FLOOR + 0.05, 4.43, Math.PI, 0.58, 0.82, -1, '鞋柜');
    // 玄關桌 + 镜
    box(0.95, 0.04, 0.32, m.woodWalnut, 1.28, FLOOR + 0.8, 4.9, { group });
    for (const lx of [0.88, 1.68]) box(0.05, 0.8, 0.05, m.brushedSteel, 1.28 + lx - 1.28, FLOOR + 0.4, 4.9, { group });
    solidBox(box(0.95, 0.8, 0.32, m.softBlack, 1.28, FLOOR + 0.4, 4.9, { cast: false }), [0.48, 0.4, 0.16]);
    box(0.02, 1.1, 0.7, m.chrome, 1.28, FLOOR + 1.6, 5.82, { cast: false });
    cyl(0.05, 0.07, 0.18, m.porcelain, 1.28, FLOOR + 0.91, 4.9, { seg: 10 });
    // 傘架
    cyl(0.11, 0.13, 0.4, m.matteBlack, 1.35, FLOOR + 0.2, 3.9, { seg: 10 });
  }

  return { interactives, glassMeshes };
}
