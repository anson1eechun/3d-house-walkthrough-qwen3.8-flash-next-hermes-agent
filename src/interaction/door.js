// 鉸鏈擺動物件（門與窗共用）：平滑動畫 + 動態碰撞 AABB 每幀更新。
// 動畫期間 busy，避免重複觸發錯亂。
import * as THREE from 'three';
import { box } from '../scene/buildHelpers.js';

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const deg = (d) => (d * Math.PI) / 180;

export function createSwingObject({
  pivot, width, height, baseY = 0, dir = 1, maxAngleDeg = 95, speed = 1.4,
  collider, labelClosed, labelOpen, block = true, thick = 0.05,
}) {
  const state = { open: false, progress: 0, target: 0, busy: false };
  const maxAngle = deg(maxAngleDeg);
  const baseRotY = pivot.rotation.y;

  function updateCollider() {
    if (!collider) return;
    pivot.updateWorldMatrix(true, false);
    const m = pivot.matrixWorld;
    // 面板四角（本地：x 0..width 由鉸鏈量起）
    const y0 = baseY, y1 = baseY + height;
    const corners = [[0, y0, 0], [width, y0, 0], [width, y1, 0], [0, y1, 0]];
    let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
    for (const c of corners) {
      for (const dz of [-thick / 2, thick / 2]) {
        const lx = c[0], lz = c[2] + dz;
        const wx = m.elements[0] * lx + m.elements[4] * c[1] + m.elements[8] * lz + m.elements[12];
        const wz = m.elements[2] * lx + m.elements[6] * c[1] + m.elements[10] * lz + m.elements[14];
        if (wx < minx) minx = wx; if (wx > maxx) maxx = wx;
        if (wz < minz) minz = wz; if (wz > maxz) maxz = wz;
      }
    }
    collider.update(collider.id, { x0: minx - 0.02, z0: minz - 0.02, x1: maxx + 0.02, z1: maxz + 0.02 });
  }

  const api = {
    type: 'swing',
    state,
    pivot,
    distance: 2.9,
    get busy() { return state.busy; },
    label() { return state.open ? labelOpen : labelClosed; },
    action() {
      if (state.busy) return;
      state.open = !state.open;
      state.target = state.open ? 1 : 0;
      state.busy = true;
    },
    updateCollider,
    update(dt) {
      if (state.progress === state.target) { state.busy = false; return; }
      const step = speed * dt;
      if (state.target > state.progress) state.progress = Math.min(state.target, state.progress + step);
      else state.progress = Math.max(state.target, state.progress - step);
      pivot.rotation.y = baseRotY + dir * easeInOut(state.progress) * maxAngle;
      if (block) updateCollider();
      if (state.progress === state.target) state.busy = false;
    },
  };
  updateCollider();
  return api;
}

/** 高層門建構器：建 pivot+門板+門框、註冊動態碰撞、回傳互動對象。
 *  pivotPos = 鉸鏈位置（y=地面參考），pivotRotY = 開閉前基礎朝向。 */
export function createDoorObject({
  width, height, thick = 0.06, pivotPos, pivotRotY = 0, dir = 1,
  maxAngleDeg = 92, speed = 1.4, labelClosed = 'F — 開門', labelOpen = 'F — 關門',
  mats = {}, colliderSys,
}) {
  const pivot = new THREE.Group();
  pivot.position.set(pivotPos[0], pivotPos[1], pivotPos[2]);
  pivot.rotation.y = pivotRotY;
  pivot.userData.baseRotY = pivotRotY;
  const leaf = new THREE.Group();
  pivot.add(leaf);
  box(width, height, thick, mats.woodDoor || mats.woodOak, width / 2, height / 2, 0, { cast: true, group: leaf });
  // 門框（固定在 pivot 群但不隨 leaf 旋轉 → 掛在 pivot 外）
  const casing = new THREE.Group();
  casing.position.copy(pivot.position);
  casing.rotation.y = pivotRotY;
  const frameMat = mats.frameMat || mats.darkGlassFrame || mats.woodDoor;
  box(0.07, height + 0.12, thick + 0.07, frameMat, -0.055, (height + 0.12) / 2, 0, { cast: false, group: casing });
  box(0.07, height + 0.12, thick + 0.07, frameMat, width + 0.055, (height + 0.12) / 2, 0, { cast: false, casing: undefined, group: casing });
  box(width + 0.18, 0.07, thick + 0.07, frameMat, width / 2, height + 0.055, 0, { cast: false, group: casing });

  const id = colliderSys.addDynamic({ x0: 0, z0: 0, x1: 0.1, y0: pivotPos[1], y1: pivotPos[1] + height });
  const collider = { id, update: (i, b) => colliderSys.updateDynamic(i, b) };
  const api = createSwingObject({
    pivot, width, height, baseY: 0, dir, maxAngleDeg, speed,
    collider, labelClosed, labelOpen, block: true, thick,
  });
  // createSwingObject 以 pivot 自身 local 座標算 AABB；pivot 在世界中有位置 →
  // updateCollider 用的是 matrixWorld（含平移）✓
  api.meshes = [leaf];
  api.pivotParent = new THREE.Group();
  api.pivotParent.add(pivot, casing);
  api.colliderId = id;
  return api;
}
createDoorObject.deps = {}; // main 注入 { THREE, box }
