// 房屋結構：外牆（雙面材質：外 render / 內 paint）、內隔間、屋頂、門（鉸鏈動畫+動態碰撞）、
// 窗（固定窗框 paneless/pane + 可開窗扇）、客廳推拉玻璃門（滑軌 + 動態 AABB）。
// 座標慣例：buildWall 面板從 base 沿 dir 方向延伸 wallT 厚。
import * as THREE from 'three';
import { HOUSE } from '../config.js';
import { buildWall, box, addBoxCollider } from './buildHelpers.js';
import { createDoorObject } from '../interaction/door.js';
import { createSlidingGlassObject } from '../interaction/furniture.js';

const { floorY, ceilY, wallT } = HOUSE;

// 外牆雙面材質：BoxGeometry 面序 [ +x, -x, +y, -y, +z, -z ]
function dualWallMat(mats, axis, outerSign) {
  const { wallRender: outer, wallPaint: inner } = mats;
  if (axis === 'vertical') {
    // 厚度沿 z
    return outerSign > 0
      ? [inner, inner, outer, outer, outer, inner]  // 外側 +z
      : [inner, inner, outer, outer, inner, outer];  // 外側 -z
  }
  // 厚度沿 x
  return outerSign > 0
    ? [outer, inner, outer, outer, inner, inner]     // 外側 +x
    : [inner, outer, outer, outer, inner, inner];    // 外側 -x
}

export function buildHouse({ scene, mats, glass, colliderSys, group }) {
  const interactives = [];
  const paint = mats.wallPaint;
  const bw = (axis, a0, a1, fixed, y0, y1, mat, grp, openings = []) =>
    buildWall(axis, a0, a1, fixed, y0, y1, mat, grp, openings, { colliderSys });
  const wallS = dualWallMat(mats, 'vertical', 1);   // 前牆（外側 +z）
  const wallN = dualWallMat(mats, 'vertical', -1);  // 後牆（外側 -z）
  const wallE = dualWallMat(mats, 'horizontal', 1); // 東牆（外側 +x）
  const wallW = dualWallMat(mats, 'horizontal', -1);// 西牆（外側 -x）

  // ---------- 地板 ----------
  box(16 + wallT * 2, floorY, 12 + wallT * 2, mats.floorWood, 0, floorY / 2, 0, { cast: false });
  box(2.9, 0.012, 3.4, mats.tileBath, 2.98, floorY + 0.008, 0.25, { cast: false });   // 浴室
  box(3.9, 0.012, 2.9, mats.tileFloor, -6.05, floorY + 0.008, 4.5, { cast: false });  // 廚房

  // ---------- 天花板 ----------
  box(16 + wallT * 2, 0.06, 12 + wallT * 2, mats.ceilingMat, 0, ceilY + 0.03, 0, { cast: false });

  // ---------- 屋頂（平頂挑簷 + 木飾收邊帶）----------
  box(17.6, 0.28, 13.6, mats.roofMat, 0, 3.45 + 0.14, 0);
  const fascia = mats.woodSlat;
  box(17.6, 0.34, 0.06, fascia, 0, 3.28, 6.77);
  box(17.6, 0.34, 0.06, fascia, 0, 3.28, -6.77);
  box(0.06, 0.34, 13.6, fascia, 8.77, 3.28, 0);
  box(0.06, 0.34, 13.6, fascia, -8.77, 3.28, 0);

  // ---------- 外牆 ----------
  // 前牆 z=6（外側 6..6.25）
  bw('vertical', -8, -5, 6, floorY, ceilY, wallS, group, [[-7.5, -5.5, 1.2, 2.9]]); // 廚房窗
  bw('vertical', -5, -0.55, 6, floorY, ceilY, wallS, group);
  bw('vertical', 0.55, 0.85, 6, floorY, ceilY, wallS, group);
  // 客廳玻璃帷幕 0.85..3.85（見下方 makeGlassWall）
  bw('vertical', 3.85, 8, 6, floorY, ceilY, wallS, group);

  // 後牆 z=-6.25（外側 -z）
  bw('vertical', -8, -6.5, -6.25, floorY, ceilY, wallN, group);
  bw('vertical', -6.5, -3, -6.25, floorY, ceilY, wallN, group, [[-6.5, -3, 1.2, 2.6]]);   // 主臥窗
  bw('vertical', -3, -0.6, -6.25, floorY, ceilY, wallN, group);
  bw('vertical', 0.6, 1.5, -6.25, floorY, ceilY, wallN, group);
  bw('vertical', 1.5, 2.6, -6.25, floorY, ceilY, wallN, group);
  bw('vertical', 2.6, 4.4, -6.25, floorY, ceilY, wallN, group, [[2.6, 4.4, 1.15, 2.55]]); // 次臥窗
  bw('vertical', 4.4, 8, -6.25, floorY, ceilY, wallN, group);

  // 東牆 x=8（外側 8..8.25）
  bw('horizontal', -6, -4.6, 8, floorY, ceilY, wallE, group);
  bw('horizontal', -4.6, -2.6, 8, floorY, ceilY, wallE, group, [[-4.6, -2.6, 1.15, 2.55]]);
  bw('horizontal', -2.6, 2.6, 8, floorY, ceilY, wallE, group);
  bw('horizontal', 2.6, 4.6, 8, floorY, ceilY, wallE, group, [[2.6, 4.6, 1.1, 2.65]]);
  bw('horizontal', 4.6, 6, 8, floorY, ceilY, wallE, group);

  // 西牆 x=-8.25（外側 -x）
  bw('horizontal', -6, -3.8, -8.25, floorY, ceilY, wallW, group);
  bw('horizontal', -3.8, -2, -8.25, floorY, ceilY, wallW, group, [[-3.8, -2, 1.15, 2.55]]);
  bw('horizontal', -2, 3.8, -8.25, floorY, ceilY, wallW, group);
  bw('horizontal', 3.8, 5.2, -8.25, floorY, ceilY, wallW, group, [[3.8, 5.2, 1.3, 2.6]]);
  bw('horizontal', 5.2, 6, -8.25, floorY, ceilY, wallW, group);

  // ---------- 內隔間（雙面 paint）----------
  // P2 x=-1.5（面板 -1.625..-1.375）：玄關西牆 + 主臥東牆；开口：z 2.6..4.2 餐區開放通道、z -2.6..-1.5 主臥門
  bw('horizontal', 4.2, 6, -1.625, floorY, ceilY, paint, group);
  bw('horizontal', -2.6, 2.6, -1.625, floorY, ceilY, paint, group);
  bw('horizontal', -6, -2.6, -1.625, floorY, ceilY, paint, group);
  // P3 主臥北牆 z=2（面板 1.875..2.125）
  bw('vertical', -8, -1.5, 1.875, floorY, ceilY, paint, group);
  // P4 x=1.5（面板 1.375..1.625）：开口 z -4.6..-3.5 次臥門、z -1.55..-0.45 浴室門、z 1.2..3.9 客廳開放開口
  bw('horizontal', -6, -4.6, 1.375, floorY, ceilY, paint, group);
  bw('horizontal', -3.5, -1.55, 1.375, floorY, ceilY, paint, group);
  bw('horizontal', -0.45, 1.2, 1.375, floorY, ceilY, paint, group);
  bw('horizontal', 3.9, 6, 1.375, floorY, ceilY, paint, group);
  // P6 z=-1.5（面板 -1.625..-1.375）x 1.5..8：床2北牆（實）
  bw('vertical', 1.5, 8, -1.625, floorY, ceilY, paint, group);
  // P7 z=2（面板 1.875..2.125）x 1.5..8：客廳南牆 + 浴室霧面高窗 x 2.2..3.4 y 2.3..2.85
  bw('vertical', 1.5, 8, 1.875, floorY, ceilY, paint, group, [[2.2, 3.4, 2.3, 2.85]]);
  // P5 x=4.5（面板 4.375..4.625）：書房門开口 z -1.2..-0.1
  bw('horizontal', -1.5, -1.2, 4.375, floorY, ceilY, paint, group);
  bw('horizontal', -0.1, 2, 4.375, floorY, ceilY, paint, group);

  // ---------- 玄關門廊 ----------
  box(6.0, 0.12, 1.6, mats.roofMat, 1.2, 3.1, 7.0);
  box(0.14, 3.0, 0.14, mats.woodSlat, -1.6, 1.65, 7.65);
  box(0.14, 3.0, 0.14, mats.woodSlat, 1.6, 1.65, 7.65);
  box(6.0, 0.06, 1.7, mats.concretePave, 1.2, 0.03, 7.05, { cast: false });

  // ---------- 窗框系統 ----------
  const frameMat = mats.darkGlassFrame;
  const windowFrames = [];

  function fixedWindow(axis, fixedCoord, a0, a1, y0, y1, { frosted = false, paneless = false, sill = true } = {}) {
    const depth = wallT + 0.04;
    const inZ = fixedCoord + (fixedCoord > 0 ? -wallT / 2 : wallT / 2);
    const inX = fixedCoord + (fixedCoord > 0 ? -wallT / 2 : wallT / 2);
    const w = a1 - a0, h = y1 - y0;
    const cy = (y0 + y1) / 2;
    const gmat = frosted ? glass.frostedMat : glass.clearMat;
    if (axis === 'vertical') {
      box(w, 0.07, depth, frameMat, (a0 + a1) / 2, y0 + 0.035, inZ, { cast: false });
      box(w, 0.07, depth, frameMat, (a0 + a1) / 2, y1 - 0.035, inZ, { cast: false });
      box(0.07, h, depth, frameMat, a0 + 0.035, cy, inZ, { cast: false });
      box(0.07, h, depth, frameMat, a1 - 0.035, cy, inZ, { cast: false });
      if (sill) box(w + 0.2, 0.06, depth + 0.18, mats.stoneGray, (a0 + a1) / 2, y0 - 0.03, fixedCoord + (fixedCoord > 0 ? 0.02 : -0.02));
      if (!paneless) {
        const pane = box(w - 0.08, h - 0.08, 0.015, gmat, (a0 + a1) / 2, cy, inZ, { cast: false });
        addBoxCollider(pane, colliderSys);
        windowFrames.push(pane);
      }
    } else {
      box(depth, 0.07, w, frameMat, inX, y0 + 0.035, (a0 + a1) / 2, { cast: false });
      box(depth, 0.07, w, frameMat, inX, y1 - 0.035, (a0 + a1) / 2, { cast: false });
      box(depth, h, 0.07, frameMat, inX, cy, a0 + 0.035, { cast: false });
      box(depth, h, 0.07, frameMat, inX, cy, a1 - 0.035, { cast: false });
      if (sill) box(depth + 0.18, 0.06, w + 0.2, mats.stoneGray, fixedCoord + (fixedCoord > 0 ? 0.02 : -0.02), y0 - 0.03, (a0 + a1) / 2);
      if (!paneless) {
        const pane = box(0.015, h - 0.08, w - 0.08, gmat, inX, cy, (a0 + a1) / 2, { cast: false });
        addBoxCollider(pane, colliderSys);
        windowFrames.push(pane);
      }
    }
  }

  // 純框窗（开口留給可開扇）
  fixedWindow('vertical', 1.875, 2.2, 3.4, 2.3, 2.85, { frosted: true, sill: false });
  // 東牆客廳窗（固定）
  fixedWindow('horizontal', 8, 2.6, 4.6, 1.1, 2.65);
  // 西牆廚房窗（固定）
  fixedWindow('horizontal', -8.25, 3.8, 5.2, 1.3, 2.6);

  // 純框窗（开口留給可開扇）
  fixedWindow('vertical', 6, -7.5, -5.5, 1.2, 2.9, { paneless: true });    // 廚房
  fixedWindow('vertical', -6.25, -6.5, -3, 1.2, 2.6, { paneless: true });  // 主臥
  fixedWindow('vertical', -6.25, 2.6, 4.4, 1.15, 2.55, { paneless: true }); // 次臥
  fixedWindow('horizontal', 8, -4.6, -2.6, 1.15, 2.55, { paneless: true }); // 次臥東
  fixedWindow('horizontal', -8.25, -3.8, -2, 1.15, 2.55, { paneless: true }); // 主臥西

  // ---------- 可開窗扇 ----------
  function casementWindow(axis, fixedCoord, a0, a1, y0, y1, { hingeAt0 = true } = {}) {
    const depth = wallT + 0.04;
    const inZ = fixedCoord + (fixedCoord > 0 ? -wallT / 2 : wallT / 2);
    const inX = fixedCoord + (fixedCoord > 0 ? -wallT / 2 : wallT / 2);
    const w = a1 - a0 - 0.06, h = y1 - y0 - 0.06;
    const pivot = new THREE.Group();
    const leaf = new THREE.Group();
    pivot.add(leaf);
    if (axis === 'vertical') {
      pivot.position.set(hingeAt0 ? a0 : a1, y0, inZ);
      if (!hingeAt0) pivot.rotation.y = Math.PI;
    } else {
      pivot.position.set(inX, y0, hingeAt0 ? a0 : a1);
      pivot.rotation.y = hingeAt0 ? -Math.PI / 2 : Math.PI / 2;
    }
    box(0.06, h + 0.06, depth, frameMat, 0.03, h / 2, 0, { cast: false, group: leaf });
    box(0.06, h + 0.06, depth, frameMat, w - 0.03, h / 2, 0, { cast: false, group: leaf });
    box(w, 0.06, depth, frameMat, w / 2, 0.03, 0, { cast: false, group: leaf });
    box(w, 0.06, depth, frameMat, w / 2, h - 0.03, 0, { cast: false, group: leaf });
    box(w - 0.06, h - 0.06, 0.012, glass.clearMat, w / 2, h / 2, 0, { cast: false, group: leaf });
    box(0.02, h - 0.06, 0.03, mats.brass, w - 0.12, h * 0.45, 0.06, { cast: false, group: leaf });
    group.add(pivot);

    const maxAngle = (55 * Math.PI) / 180;
    const outSign = fixedCoord > 0 ? 1 : -1;
    const baseY = pivot.rotation.y;
    const st = { open: false, target: 0, cur: 0 };
    const obj = {
      type: 'window',
      meshes: [leaf],
      distance: 2.0,
      busy: false,
      label: () => 'F — 開關窗戶',
      update(dt) {
        if (st.cur === st.target) return;
        const step = dt * 2.2;
        st.cur = Math.abs(st.cur - st.target) <= step ? st.target : st.cur + Math.sign(st.target - st.cur) * step;
        pivot.rotation.y = baseY + st.cur;
      },
      action() {
        st.open = !st.open;
        st.target = st.open ? outSign * maxAngle : 0;
      },
    };
    interactives.push(obj);
    windowFrames.push(pivot);
    return obj;
  }

  casementWindow('vertical', 6, -7.44, -5.56, 1.26, 2.84, { hingeAt0: false });
  casementWindow('vertical', -6.25, -6.44, -3.06, 1.26, 2.54, { hingeAt0: false });
  casementWindow('vertical', -6.25, 2.66, 4.34, 1.21, 2.49, { hingeAt0: true });
  casementWindow('horizontal', 8, -4.54, -2.66, 1.21, 2.49, { hingeAt0: false });
  casementWindow('horizontal', -8.25, -3.74, -2.06, 1.21, 2.49, { hingeAt0: true });

  // ---------- 門 ----------
  function addDoor(leaf) {
    group.add(leaf.pivot.parent || leaf.pivot);
    interactives.push(leaf);
    return leaf;
  }
  function handle(leaf, lx, sides = 2) {
    box(0.03, 0.28, 0.04, mats.brass, lx, 1.05, -0.075, { cast: false, group: leaf.meshes[0] });
    if (sides === 2) box(0.03, 0.28, 0.04, mats.brass, lx, 1.05, 0.075, { cast: false, group: leaf.meshes[0] });
    return leaf;
  }

  // 玄關大門（向外開向門廊）
  addDoor(handle(createDoorObject({
    width: 1.03, height: 2.28, thick: 0.06,
    pivotPos: [-0.565, floorY, 5.97], pivotRotY: 0, dir: -1,
    maxAngleDeg: 92, labelClosed: 'F — 開啟大門', labelOpen: 'F — 關上大門',
    mats: { woodMat: mats.woodDoor, frameMat: frameMat }, colliderSys,
  }), 0.88));
  // 大門玻璃氣窗（門上方固定玻璃）
  box(1.13, 0.06, wallT + 0.04, frameMat, 0, 2.44, 6.125, { cast: false });
  box(1.03, 0.62, 0.012, glass.clearMat, 0, 2.78, 5.95, { cast: false });

  // 後門（走廊→後花園，向外開）
  addDoor(handle(createDoorObject({
    width: 1.13, height: 2.28, thick: 0.06,
    pivotPos: [0.63, floorY, -6.02], pivotRotY: Math.PI, dir: -1,
    maxAngleDeg: 92, labelClosed: 'F — 開啟後門', labelOpen: 'F — 關上後門',
    mats: { woodMat: mats.woodDoor, frameMat: frameMat }, colliderSys,
  }), 0.98, 1));

  // 室內門 ×4
  function interiorDoor({ pivotPos, rotY, dir, label }) {
    const leaf = createDoorObject({
      width: 1.03, height: 2.18, thick: 0.045, pivotPos, pivotRotY: rotY, dir,
      maxAngleDeg: 88, labelClosed: `F — 開啟${label}`, labelOpen: `F — 關上${label}`,
      mats: { woodMat: mats.woodDoor, frameMat: frameMat }, colliderSys,
    });
    addDoor(leaf);
    handle(leaf, 0.92);
    return leaf;
  }
  interiorDoor({ pivotPos: [-1.5, floorY, -2.57], rotY: -Math.PI / 2, dir: -1, label: '主臥室門' });  // 向主臥(-x)開
  interiorDoor({ pivotPos: [1.5, floorY, -1.52], rotY: -Math.PI / 2, dir: 1, label: '浴室門' });       // 向浴室(+x)開
  interiorDoor({ pivotPos: [1.5, floorY, -4.57], rotY: -Math.PI / 2, dir: 1, label: '次臥門' });       // 向次臥(+x)開
  interiorDoor({ pivotPos: [4.5, floorY, -0.07], rotY: Math.PI / 2, dir: -1, label: '書房門' });       // 向書房(+x)開

  // 門楣與後門楣（補齊開口上方）
  box(0.25, 0.84, 1.1, paint, -1.5, 2.73, -2.05);
  box(0.25, 0.84, 1.1, paint, 1.5, 2.73, -1.0);
  box(0.25, 0.84, 1.1, paint, 1.5, 2.73, -4.05);
  box(0.25, 0.84, 1.1, paint, 4.5, 2.73, -0.65);
  box(1.2, 0.84, wallT, wallN, 0, 2.73, -6.125);

  // ---------- 客廳推拉玻璃門（前牆帷幕 x 0.85..3.85）----------
  {
    const gw = 1.5, gh = 2.9;
    const gcz = 6.125; // 牆中面
    box(0.08, gh, wallT + 0.04, frameMat, 0.87, floorY + gh / 2, gcz, { cast: false });
    box(0.08, gh, wallT + 0.04, frameMat, 2.36, floorY + gh / 2, gcz, { cast: false });
    box(0.08, gh, wallT + 0.04, frameMat, 3.83, floorY + gh / 2, gcz, { cast: false });
    box(3.0, 0.12, wallT + 0.04, frameMat, 2.35, ceilY - 0.06, gcz, { cast: false });
    // 上方補牆
    box(3.0, ceilY - 2.9, wallT, wallS, 2.35, (2.9 + ceilY) / 2, 6.125);
    // 固定玻璃（左扇）
    const fixedPane = box(gw - 0.06, gh - 0.12, 0.012, glass.clearMat, 1.61, floorY + gh / 2, gcz, { cast: false });
    addBoxCollider(fixedPane, colliderSys);
    // 可滑玻璃（右扇，滑向左扇前方）
    const slide = createSlidingGlassObject({
      width: gw, height: gh,
      closedCenter: [3.08, floorY + gh / 2, gcz + 0.075],
      travel: -1.5,
      labelClosed: 'F — 推开玻璃门', labelOpen: 'F — 关上玻璃门',
      glassMat: glass.clearMat, frameMat, colliderSys,
    });
    group.add(slide.group);
    interactives.push(slide);
  }

  return { interactives, windowFrames };
}
