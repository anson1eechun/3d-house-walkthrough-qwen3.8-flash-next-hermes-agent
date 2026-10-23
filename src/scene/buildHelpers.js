// 場景建構共用工具：方盒、圓角盒、圓柱、UV 縮放複製材質、帶開口的牆板（自動註冊碰撞）。
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function box(w, h, d, mat, x, y, z, { cast = true, receive = true, group = null, name = '' } = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  if (name) mesh.name = name;
  if (group) group.add(mesh);
  return mesh;
}

export function rbox(w, h, d, mat, x, y, z, { seg = 2, radius = 0.02, cast = true, receive = true, group = null } = {}) {
  const geo = new RoundedBoxGeometry(w, Math.max(0.01, h), d, seg, Math.min(radius, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  if (group) group.add(mesh);
  return mesh;
}

export function cyl(r1, r2, h, mat, x, y, z, { seg = 16, cast = true, group = null, rotZ = 0 } = {}) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat);
  mesh.position.set(x, y, z);
  mesh.rotation.z = rotZ;
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  if (group) group.add(mesh);
  return mesh;
}

/** 以網格自身尺寸註冊靜態 AABB 碰撞（BoxGeometry 專用） */
export function addBoxCollider(mesh, colliderSys) {
  const p = mesh.geometry.parameters;
  if (!p || !('width' in p)) return null;
  return colliderSys.addAABBCollider(mesh, {
    half: [p.width / 2, p.height / 2, p.depth / 2],
    pos: [0, 0, 0],
  });
}

/** 複製材質並調整貼圖重複數（texture clone 共享 GPU 上傳，便宜） */
export function matRepeat(mat, ru, rv) {
  const m = mat.clone();
  for (const k of ['map', 'normalMap', 'roughnessMap']) {
    if (mat[k]) {
      const t = mat[k].clone();
      t.needsUpdate = true;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(ru, rv);
      m[k] = t;
    }
  }
  return m;
}

/**
 * 帶矩形開口的牆板（自動註冊碰撞）。
 * axis='vertical'：沿 x 延伸、厚沿 z（面板 z: fixed..fixed+thick）。
 * axis='horizontal'：沿 z 延伸、厚沿 x（面板 x: fixed..fixed+thick）。
 * openings: [[a0, a1, y0, y1]] — 沿軸區間 + 絕對 y；開口上下自動補窗台/過梁。
 */
export function buildWall(axis, a0, a1, fixed, fromY, toY, mat, group, openings = [], opts = {}) {
  const { thick = 0.25, colliderSys = null, cast = true } = opts;
  const meshes = [];
  const seg = (s0, s1, ys, ye) => {
    if (s1 - s0 < 1e-3 || ye - ys < 1e-3) return;
    let m;
    if (axis === 'vertical') {
      m = box(s1 - s0, ye - ys, thick, mat, (s0 + s1) / 2, (ys + ye) / 2, fixed + thick / 2, { group, cast });
    } else {
      m = box(thick, ye - ys, s1 - s0, mat, fixed + thick / 2, (ys + ye) / 2, (s0 + s1) / 2, { group, cast });
    }
    if (colliderSys) addBoxCollider(m, colliderSys);
    meshes.push(m);
  };

  const sorted = [...openings].sort((p, q) => p[0] - q[0]);
  let cursor = a0;
  for (const [o0, o1, y0, y1] of sorted) {
    seg(cursor, o0, fromY, toY);
    if (o0 < cursor) continue;
    if (y0 > fromY + 1e-3) seg(o0, o1, fromY, y0); // 窗台下
    if (y1 < toY - 1e-3) seg(o0, o1, y1, toY);     // 過梁上
    cursor = o1;
  }
  seg(cursor, a1, fromY, toY);
  return meshes;
}
