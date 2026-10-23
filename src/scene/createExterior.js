// 室外環境：草地、步道、車道、後院木台、樹叢、針葉樹、綠籬、遮陽傘 — 全部程序化。
import * as THREE from 'three';
import { box, cyl } from './buildHelpers.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function buildExterior({ scene, mats, colliderSys, group }) {
  const m = mats;
  const rand = rng(28471);

  // 草地（大面積接受濕地 shader）
  const grass = box(56, 0.02, 56, m.grass, 0, -0.011, 0, { cast: false, group });

  // 玄關步道（前門 z6.7  outward）+ 連車道小徑
  box(1.8, 0.03, 9.4, m.paverStone, 0, 0.006, 11.4, { cast: false, group });
  box(9.0, 0.03, 1.4, m.paverStone, 4.6, 0.006, 15.2, { cast: false, group });
  // 車道（東南角）
  box(4.6, 0.032, 13.0, m.concretePave, 11.6, 0.007, 9.5, { cast: false, group });
  // 側牆步道
  box(1.2, 0.028, 6.0, m.paverStone, -9.9, 0.006, 3.5, { cast: false, group });

  // 後院木台
  const deck = box(9.0, 0.14, 4.2, m.woodSlat, 0, 0.07, -9.0, { cast: false, group });
  for (const dz of [-11.1, -10.3]) box(9.0, 0.05, 0.35, m.woodWalnut, 0, 0.115 - 0.045 * (dz < -10.5 ? 1 : 0), dz + 0.9, { cast: false, receive: false, group });
  // 木台欄杆（矮柱+橫桿）：有碰撞
  function rail(x0, x1, z, posts) {
    for (let i = 0; i <= posts; i++) {
      const t = i / posts;
      cyl(0.04, 0.045, 0.9, m.woodWalnut, x0 + (x1 - x0) * t, 0.59, z, { seg: 6, group });
    }
    box(Math.abs(x1 - x0) + 0.08, 0.07, 0.07, m.woodWalnut, (x0 + x1) / 2, 0.98, z, { group });
    box(Math.abs(x1 - x0) + 0.08, 0.05, 0.05, m.woodWalnut, (x0 + x1) / 2, 0.62, z, { group });
  }
  rail(-4.5, 4.5, -11.05, 9);
  rail(-4.5, -4.42, -9.0, 0);
  box(0.07, 0.98, 4.3, m.woodWalnut, -4.5, 0.55, -9.0, { group });
  box(0.07, 0.98, 4.3, m.woodWalnut, 4.5, 0.55, -9.0, { group });
  // 台階（前側，可跨越）
  box(2.0, 0.09, 0.45, m.woodWalnut, 0, 0.045, -11.5, { cast: false, group });
  box(2.0, 0.13, 0.45, m.woodWalnut, 0, 0.065, -11.95, { cast: false, group });

  // 露台桌 + 椅 ×2 + 遮陽傘
  cyl(0.55, 0.55, 0.045, m.woodSlat, -2.2, 0.86, -9.4, { seg: 14, group });
  cyl(0.05, 0.06, 0.78, m.matteBlack, -2.2, 0.44, -9.4, { seg: 8, group });
  cyl(0.28, 0.34, 0.03, m.matteBlack, -2.2, 0.06, -9.4, { seg: 10, cast: false, group });
  cyl(0.022, 0.022, 2.35, m.brushedSteel, -2.2, 1.9, -9.4, { seg: 6, group });
  const umbrella = cyl(1.25, 0.08, 0.42, m.fabricLinen, -2.2, 2.85, -9.4, { seg: 8, group });
  for (const dz of [-8.7, -10.1]) {
    cyl(0.21, 0.21, 0.045, m.woodWalnut, -2.2, 0.5, dz + 0.7, { seg: 12, group });
    cyl(0.02, 0.025, 0.46, m.brushedSteel, -2.2, 0.27, dz + 0.7, { seg: 6, group });
  }
  // 前門兩側花盆
  for (const sx of [-1.65, 1.65]) {
    cyl(0.3, 0.24, 0.5, m.porcelain, sx, 0.25, 7.3, { seg: 12, group });
    cyl(0.18, 0.3, 0.34, m.leafA, sx, 0.66, 7.3, { seg: 7, group });
  }

  // 綠籬（圍界四周，L 形段）
  function hedge(x0, z0, x1, z1) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const w = Math.abs(x1 - x0) || 0.85, d = Math.abs(z1 - z0) || 0.85;
    const mesh = box(w, 1.25, d, m.hedgeMat, cx, 0.62, cz, { group });
    return mesh;
  }
  hedge(-24, 24.4, 24.4, 25.2);
  hedge(-24.4, -24, 24, -24.8);
  hedge(-24.8, -24, -24, 24.4);
  hedge(24, -24, 24.8, 24.4);
  // 綠籬碰撞（整圈內側牆，留缺口給車道：x 9.4..14.2 z24.4~）
  const H = 1.2;
  colliderSys.addAABBCollider(group, { half: [24.4, H / 2, 0.4], pos: [0, 0.62, 24.8] });
  colliderSys.addAABBCollider(group, { half: [24.4, H / 2, 0.4], pos: [0, 0.62, -24.4] });
  colliderSys.addAABBCollider(group, { half: [0.4, H / 2, 24.4], pos: [-24.4, 0.62, 0] });
  colliderSys.addAABBCollider(group, { half: [0.4, H / 2, 13.4], pos: [24.4, 0.62, 11.2] });
  colliderSys.addAABBCollider(group, { half: [0.4, H / 2, 12.6], pos: [24.4, 0.62, -11.6] });

  // 樹木：針葉樹（圓錐×3）+ 闊葉樹（球×2-3），沿籬內側與角落
  function conifer(x, z, s) {
    cyl(0.09 * s, 0.13 * s, 1.1 * s, m.woodWalnut, x, 0.55 * s, z, { seg: 6, group });
    for (let i = 0; i < 3; i++) {
      const yy = (1.15 + i * 0.72) * s;
      cyl(0.02, (0.95 - i * 0.24) * s, (1.35 - i * 0.28) * s, m.leafB, x, yy + (1.35 - i * 0.28) * s / 2 - 0.12, z, { seg: 7, group });
    }
    colliderSys.addAABBCollider(group, { half: [0.22 * s, 1.6 * s, 0.22 * s], pos: [x, 1.6 * s, z] });
  }
  function broadleaf(x, z, s) {
    cyl(0.1 * s, 0.14 * s, 1.7 * s, m.woodWalnut, x, 0.85 * s, z, { seg: 6, group });
    const n = 2 + (rand() > 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const off = i === 0 ? [0, 0] : [(rand() - 0.5) * 1.4 * s, (rand() - 0.5) * 1.4 * s];
      const r = (i === 0 ? 1.15 : 0.8) * s;
      const sph = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), m.leafA);
      sph.position.set(x + off[0], (1.9 + rand() * 0.7) * s + (i === 0 ? 0.2 : 0.5), z + off[1]);
      sph.castShadow = true;
      group.add(sph);
    }
    colliderSys.addAABBCollider(group, { half: [0.22 * s, 1.9 * s, 0.22 * s], pos: [x, 1.9 * s, z] });
  }
  const trees = [
    ['c', -19.5, 20, 1.6], ['c', -15.5, 21.6, 1.2], ['c', 18.5, 19.5, 1.4], ['c', -21, 9, 1.5],
    ['c', -21.5, -14, 1.3], ['c', 21, -19, 1.7],
    ['b', 16.5, 20, 1.3], ['b', -12, 22, 1.1], ['b', 20.5, 4, 1.4], ['b', 20, -6, 1.2],
    ['b', -20.5, -2.5, 1.3], ['b', -8, -21.5, 1.2], ['b', 10, -21.5, 1.5], ['b', -17, -20.5, 1.0],
    ['b', -2.5, -13.4, 0.9], ['b', 6.8, -13.8, 1.0],
  ];
  for (const [kind, x, z, s] of trees) (kind === 'c' ? conifer : broadleaf)(x, z, s);

  // 矮灌木叢（石塊點綴步道旁）
  const bushPos = [[-2.4, 9.4], [2.6, 9.6], [-2.6, 12.8], [3.1, 8.4], [-10.2, 7.0], [-10.1, 0.9], [9.3, 15.9], [-3.4, -12.6], [4.2, -12.2]];
  for (const [x, z] of bushPos) {
    const s = 0.55 + rand() * 0.35;
    const sph = new THREE.Mesh(new THREE.IcosahedronGeometry(s * 0.42, 1), m.hedgeMat);
    sph.position.set(x, s * 0.32, z);
    sph.scale.y = 0.75;
    sph.castShadow = true;
    group.add(sph);
  }
  const stones = [[-1.4, -13.8], [0.4, -14.6], [2.1, -13.6]];
  for (const [x, z] of stones) {
    const sph = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24 + rand() * 0.12, 0), m.stoneCounter);
    sph.position.set(x, 0.1, z);
    sph.scale.set(1, 0.55, 1.2);
    sph.castShadow = true;
    group.add(sph);
  }

  // 車道指示燈柱 ×2（夜間發光面）
  for (const [x, z] of [[9.35, 15.6], [13.85, 15.6]]) {
    cyl(0.05, 0.06, 1.15, m.matteBlack, x, 0.575, z, { seg: 6, group });
    const cap = box(0.16, 0.1, 0.16, new THREE.MeshStandardMaterial({ color: 0xfff6da, emissive: 0xfff0c8, emissiveIntensity: 0.25 }), x, 1.2, z, { group, cast: false });
    cap.userData.lamp = true;
  }

  return { deck, umbrella };
}
