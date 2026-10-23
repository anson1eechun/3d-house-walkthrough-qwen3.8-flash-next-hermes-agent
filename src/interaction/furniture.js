// 家具互動：抽屜（線性滑出）、櫃門（鉸鏈）、推拉玻璃門（滑軌+動態 AABB）、開關（切換）。
import * as THREE from 'three';
import { createSwingObject, deg } from './door.js';

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** 抽屜：drawerGroup 沿本地 +z 滑出 travel 公尺 */
export function createDrawerObject({ drawerGroup, travel = 0.45, speed = 1.6, labelClosed = 'F — 拉開抽屜', labelOpen = 'F — 關上抽屜' }) {
  const state = { open: false, progress: 0, target: 0, busy: false };
  const baseZ = drawerGroup.position.z;
  return {
    type: 'drawer',
    state,
    distance: 2.2,
    get busy() { return state.busy; },
    label() { return state.open ? labelOpen : labelClosed; },
    action() {
      if (state.busy) return;
      state.open = !state.open;
      state.target = state.open ? 1 : 0;
      state.busy = true;
    },
    update(dt) {
      if (state.progress === state.target) { state.busy = false; return; }
      const step = speed * dt;
      if (state.target > state.progress) state.progress = Math.min(state.target, state.progress + step);
      else state.progress = Math.max(state.target, state.progress - step);
      drawerGroup.position.z = baseZ + easeInOut(state.progress) * travel;
      if (state.progress === state.target) state.busy = false;
    },
  };
}

/** 櫃門：pivot 本地旋轉，dir 開向 */
export function createCabinetDoorObject({ pivot, width, dir = 1, speed = 1.5, maxAngleDeg = 100, labelClosed = 'F — 開啟櫃門', labelOpen = 'F — 關上櫃門' }) {
  return createSwingObject({
    pivot, width, height: 0.7, baseY: 0, dir, maxAngleDeg, speed,
    collider: null, block: false, labelClosed, labelOpen,
  });
}

/** 推拉玻璃門：整組沿世界 x 滑動，動態 AABB 碰撞 */
export function createSlidingGlassObject({
  width, height, closedCenter, travel = -1.5, speed = 1.2,
  labelClosed = 'F — 推开玻璃门', labelOpen = 'F — 关上玻璃门',
  glassMat, frameMat, colliderSys,
}) {
  const group = new THREE.Group();
  const cz = closedCenter[2];
  group.position.set(closedCenter[0], 0, cz);
  const cy = closedCenter[1];
  // 組內網格以 group 為参考：本地 x 中心 = 0
  boxFrame(width, height, glassMat, frameMat, group, cy);
  const state = { open: false, progress: 0, target: 0, busy: false };
  const id = colliderSys.addDynamic({
    x0: closedCenter[0] - width / 2, z0: cz - 0.05, x1: closedCenter[0] + width / 2, z1: cz + 0.05,
    y0: 0.15, y1: 0.15 + height,
  });
  const api = {
    type: 'sliding',
    group,
    meshes: [group],
    state,
    distance: 2.8,
    get busy() { return state.busy; },
    label() { return state.open ? labelOpen : labelClosed; },
    action() {
      if (state.busy) return;
      state.open = !state.open;
      state.target = state.open ? 1 : 0;
      state.busy = true;
    },
    update(dt) {
      if (state.progress === state.target) { state.busy = false; return; }
      const step = speed * dt;
      if (state.target > state.progress) state.progress = Math.min(state.target, state.progress + step);
      else state.progress = Math.max(state.target, state.progress - step);
      group.position.x = closedCenter[0] + easeInOut(state.progress) * travel;
      const cx = group.position.x;
      colliderSys.updateDynamic(id, {
        x0: cx - width / 2, z0: cz - 0.05, x1: cx + width / 2, z1: cz + 0.05,
      });
      if (state.progress === state.target) state.busy = false;
    },
  };
  return api;
}

function boxFrame(w, h, glassMat, frameMat, group, cy) {
  const f = (bw, bh, bd, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), frameMat);
    m.position.set(x, y, z);
    m.castShadow = false;
    group.add(m);
  };
  const pane = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, h - 0.1, 0.012), glassMat);
  pane.position.set(0, cy, 0);
  group.add(pane);
  f(w, 0.08, 0.05, 0, cy - h / 2 + 0.04, 0);
  f(w, 0.08, 0.05, 0, cy + h / 2 - 0.04, 0);
  f(0.08, h, 0.05, -w / 2 + 0.04, cy, 0);
  f(0.08, h, 0.05, w / 2 - 0.04, cy, 0);
}

/** 通用切換（燈光、開關等）由外部提供 action/label */
export function createToggleObject({ meshes, label, action, distance = 2.6 }) {
  return {
    type: 'toggle',
    meshes,
    distance,
    busy: false,
    label() { return typeof label === 'function' ? label() : label; },
    action() { action(); },
    update() {},
  };
}

export { deg };
