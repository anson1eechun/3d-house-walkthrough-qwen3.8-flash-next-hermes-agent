// 玩家移動碰撞：XZ 膠囊 vs AABB 集合，2m 網格空間索引，避免每幀遍歷全部網格。
// 步驟規則：高度 <= STEP_H 的障礙直接略過（門檻、台阶、線材）。
import * as THREE from 'three';

export const STEP_H = 0.18;
export const PLAYER_HEIGHT = 1.7;

export class WorldCollider {
  constructor(cellSize = 2) {
    this.cell = cellSize;
    this.grid = new Map(); // `${gx},${gz}` -> [id]
    this.colliders = []; // {minx,maxx,minz,maxz,h0,h1,dynamic}
    this.dirty = new Set();
  }

  _key(gx, gz) { return gx + ',' + gz; }

  _cells(minx, minz, maxx, maxz) {
    const c = this.cell;
    const x0 = Math.floor(minx / c), x1 = Math.floor(maxx / c);
    const z0 = Math.floor(minz / c), z1 = Math.floor(maxz / c);
    const out = [];
    for (let gx = x0; gx <= x1; gx++) for (let gz = z0; gz <= z1; gz++) out.push(this._key(gx, gz));
    return out;
  }

  _insert(id) {
    const co = this.colliders[id];
    for (const k of this._cells(co.minx, co.minz, co.maxx, co.maxz)) {
      let arr = this.grid.get(k);
      if (!arr) { arr = []; this.grid.set(k, arr); }
      if (!arr.includes(id)) arr.push(id);
    }
  }

  /**
   * 以群組的世界變換註冊一個 AABB 碰撞盒。
   * half/pos 為群組本地座標。
   */
  addAABBCollider(group, { half, pos = [0, 0, 0], name = '' } = {}) {
    group.updateWorldMatrix(true, false);
    const m = group.matrixWorld;
    const hx = half[0], hy = half[1], hz = half[2];
    // 變換 8 角點取世界 AABB（支援旋轉）
    const pts = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const v = new THREE.Vector3(pos[0] + sx * hx, pos[1] + sy * hy, pos[2] + sz * hz).applyMatrix4(m);
      pts.push(v);
    }
    let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity, h0 = Infinity, h1 = -Infinity;
    for (const v of pts) {
      if (v.x < minx) minx = v.x; if (v.x > maxx) maxx = v.x;
      if (v.z < minz) minz = v.z; if (v.z > maxz) maxz = v.z;
      if (v.y < h0) h0 = v.y; if (v.y > h1) h1 = v.y;
    }
    const id = this.colliders.length;
    this.colliders.push({ minx, maxx, minz, maxz, h0, h1, name });
    this._insert(id);
    return id;
  }

  /** 動態碰撞（門等）：自行每幀更新世界 AABB */
  addDynamic({ x0, z0, x1, z1, y0, y1 }) {
    const id = this.colliders.length;
    this.colliders.push({ minx: x0, maxx: x1, minz: z0, maxz: z1, h0: y0, h1: y1, dynamic: true });
    this._insert(id);
    return id;
  }

  updateDynamic(id, { x0, z0, x1, z1 }) {
    const co = this.colliders[id];
    const oldCells = this._cells(co.minx, co.minz, co.maxx, co.maxz);
    co.minx = Math.min(x0, x1); co.maxx = Math.max(x0, x1);
    co.minz = Math.min(z0, z1); co.maxz = Math.max(z0, z1);
    const newCells = this._cells(co.minx, co.minz, co.maxx, co.maxz);
    const oldSet = new Set(oldCells), newSet = new Set(newCells);
    for (const k of oldCells) if (!newSet.has(k)) {
      const arr = this.grid.get(k);
      if (arr) { const i = arr.indexOf(id); if (i >= 0) arr.splice(i, 1); }
    }
    for (const k of newCells) if (!oldSet.has(k)) this._insert(id);
  }

  /**
   * 移動玩家：嘗試把 pos 移到新位置，解決與碰撞盒的分離。
   * feetY 為腳底高度；返回修正後的位置。
   */
  moveAndCollide(pos, feetY, radius, bounds = { minX: -28, maxX: 28, minZ: -28, maxZ: 28 }) {
    pos.x = Math.max(bounds.minX + radius, Math.min(bounds.maxX - radius, pos.x));
    pos.z = Math.max(bounds.minZ + radius, Math.min(bounds.maxZ - radius, pos.z));

    const c = this.cell;
    const gx0 = Math.floor((pos.x - radius) / c), gx1 = Math.floor((pos.x + radius) / c);
    const gz0 = Math.floor((pos.z - radius) / c), gz1 = Math.floor((pos.z + radius) / c);
    const seen = new Set();

    const headY = feetY + PLAYER_HEIGHT;
    // 兩輪分離足以處理角落
    for (let iter = 0; iter < 2; iter++) {
      let resolved = false;
      for (let gx = gx0; gx <= gx1; gx++) {
        for (let gz = gz0; gz <= gz1; gz++) {
          const arr = this.grid.get(this._key(gx, gz));
          if (!arr) continue;
          for (const id of arr) {
            if (seen.has(id)) continue;
            const co = this.colliders[id];
            if (co.h1 <= feetY + STEP_H || co.h0 >= headY) continue; // 可跨越 / 頭頂以上
            // Circle vs AABB（XZ）
            const cx = Math.max(co.minx, Math.min(pos.x, co.maxx));
            const cz = Math.max(co.minz, Math.min(pos.z, co.maxz));
            let dx = pos.x - cx, dz = pos.z - cz;
            const d2 = dx * dx + dz * dz;
            if (d2 >= radius * radius) continue;
            seen.add(id);
            resolved = true;
            let d = Math.sqrt(d2);
            if (d < 1e-6) {
              // 圓心在盒內：沿最少穿透軸推出
              const toL = pos.x - co.minx, toR = co.maxx - pos.x;
              const toB = pos.z - co.minz, toT = co.maxz - pos.z;
              const m = Math.min(toL, toR, toB, toT);
              if (m === toL) { pos.x = co.minx - radius; }
              else if (m === toR) { pos.x = co.maxx + radius; }
              else if (m === toB) { pos.z = co.minz - radius; }
              else { pos.z = co.maxz + radius; }
              continue;
            }
            const push = (radius - d) / d;
            pos.x += dx * push; pos.z += dz * push;
            // 角落滑動：若該軸推進後仍與另一軸相交，只推進單軸
          }
        }
      }
      if (!resolved) break;
    }
    return pos;
  }
}
