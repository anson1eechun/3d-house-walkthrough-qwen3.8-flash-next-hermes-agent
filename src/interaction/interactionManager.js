// 互動管理器：注視射線 → 最近有效互動物件 → 提示；F 觸發（edge-detect + busy 鎖）。
import * as THREE from 'three';
import { INTERACT_RANGE } from '../config.js';

export function createInteractionManager({ camera, scene, dom, hud, updateAll }) {
  const raycaster = new THREE.Raycaster();
  raycaster.far = INTERACT_RANGE + 1.2;
  const center = new THREE.Vector2(0, 0);
  let interactives = [];
  const owner = new Map(); // mesh → 互動對象（含群組後代）
  let target = null;
  let fHeld = false;

  function setInteractives(list) {
    interactives = list;
    owner.clear();
    for (const obj of interactives) {
      for (const root of obj.meshes || []) {
        root.traverse((n) => { if (n.isMesh) owner.set(n, obj); });
        if (root.isMesh) owner.set(root, obj);
      }
    }
  }

  function pick() {
    raycaster.setFromCamera(center, camera);
    const roots = [];
    for (const obj of interactives) for (const m of obj.meshes || []) roots.push(m);
    const hits = raycaster.intersectObjects(roots, true);
    if (!hits.length) return null;
    const hitMesh = hits[0].object;
    const hitDist = hits[0].distance;
    const obj = owner.get(hitMesh);
    if (!obj) return null;
    const range = obj.distance || INTERACT_RANGE;
    return hitDist <= range ? obj : null;
  }

  function update(dt) {
    if (updateAll) updateAll(dt);
    target = pick();
    if (target && !target.busy) hud.showHint(target.label());
    else if (target && target.busy) hud.showHint('……');
    else hud.hideHint();
  }

  function pressF() {
    if (fHeld) return;
    fHeld = true;
    if (target && !target.busy) target.action();
  }
  function releaseF() { fHeld = false; }

  return { setInteractives, update, pressF, releaseF, getTarget: () => target };
}
