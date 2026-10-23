// 第一人稱控制器：Pointer Lock 視角 + WASD（delta time、斜向歸一化）+ Shift 加速。
// 視角 pitch 限制；移動與碰撞由 player/collision.js 的膠囊-盒系統處理。
import * as THREE from 'three';
import { EYE_HEIGHT, WALK_SPEED, RUN_SPEED, PLAYER_RADIUS, HOUSE } from '../config.js';

const PITCH_LIMIT = Math.PI / 2 - 0.05;
const BOUNDS = { minX: -26, maxX: 26, minZ: -18, maxZ: 20 };

/** 站立地面高度：屋內=地板面，屋外=地面 0（門廊 0.06 由步高容忍跨越） */
export function groundYAt(x, z) {
  const inside = x > HOUSE.minX && x < HOUSE.maxX && z > HOUSE.minZ && z < HOUSE.maxZ + 0.2;
  return inside ? HOUSE.floorY : 0;
}

export function createPlayerController({ camera, colliderSys, dom, onLockChange }) {
  const yaw = { v: 0 }; // 相機預設注視 -z；SPAWN 在 +z 側門廊外，故 yaw 0 即面向房屋
  const pitch = { v: 0 };
  let locked = false;
  const keys = new Set();

  function lock() {
    if (document.pointerLockElement !== dom) dom.requestPointerLock();
  }

  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === dom;
    if (onLockChange) onLockChange(locked);
  });

  document.addEventListener('mousemove', (e) => {
    if (!locked) return;
    yaw.v -= e.movementX * 0.0022;
    pitch.v -= e.movementY * 0.0022;
    pitch.v = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch.v));
  });

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const k = e.code;
    if (k === 'KeyW' || k === 'KeyA' || k === 'KeyS' || k === 'KeyD' || k === 'ShiftLeft' || k === 'ShiftRight') keys.add(k);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  // 簡潔 yaw/pitch → 相機朝向（不用 quaternion accumulate）
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  function applyLook() {
    euler.set(pitch.v, yaw.v, 0);
    camera.quaternion.setFromEuler(euler);
  }

  function update(dt) {
    let mx = 0, mz = 0;
    if (keys.has('KeyW')) mz -= 1;
    if (keys.has('KeyS')) mz += 1;
    if (keys.has('KeyA')) mx -= 1;
    if (keys.has('KeyD')) mx += 1;
    const moving = mx !== 0 || mz !== 0;
    const run = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const speed = run ? RUN_SPEED : WALK_SPEED;
    if (moving) {
      const inv = 1 / Math.hypot(mx, mz);
      const sin = Math.sin(yaw.v), cos = Math.cos(yaw.v);
      // 相機注視方向 = (-sin yaw, -cos yaw)；右方 = (cos yaw, -sin yaw)
      const vx = (mx * cos + mz * sin) * inv;
      const vz = (-mx * sin + mz * cos) * inv;
      camera.position.x += vx * speed * dt;
      camera.position.z += vz * speed * dt;
      const feetY = groundYAt(camera.position.x, camera.position.z);
      colliderSys.moveAndCollide(camera.position, feetY, PLAYER_RADIUS, BOUNDS);
      // 跟随地面（平滑，避免內外門檻處跳動）
      const wantY = feetY + EYE_HEIGHT;
      camera.position.y += (wantY - camera.position.y) * Math.min(1, dt * 12);
    } else {
      const feetY = groundYAt(camera.position.x, camera.position.z);
      const wantY = feetY + EYE_HEIGHT;
      camera.position.y += (wantY - camera.position.y) * Math.min(1, dt * 12);
    }
    applyLook();
  }

  function respawn(x, z, yawInit = 0) {
    camera.position.set(x, groundYAt(x, z) + EYE_HEIGHT, z);
    yaw.v = yawInit;
    pitch.v = 0;
    applyLook();
  }

  return {
    update,
    lock,
    isLocked: () => locked,
    respawn,
    setYaw(v) { yaw.v = v; },
  };
}
