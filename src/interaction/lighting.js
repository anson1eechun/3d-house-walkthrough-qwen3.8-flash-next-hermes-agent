// 室內燈光系統：每房間獨立燈組（燈具網格 + PointLight），注視燈具按 F 切換；
// UI 可全關。燈罩 emissive 與光強度同步漸變（餵給 Bloom）。
import * as THREE from 'three';
import { ROOM_LIGHTS } from '../config.js';
import { box, cyl } from '../scene/buildHelpers.js';

export function createLightingSystem({ scene, mats, quality, group }) {
  const fixtures = []; // 互動對象（每房間一個）
  const allLights = [];
  const state = { globalOff: false };

  // 燈罩發光材質（本模組自建：開燈時 emissive 漸變，餵 Bloom）
  const emitWarm = new THREE.MeshStandardMaterial({
    color: 0xfff2dd, roughness: 0.6, metalness: 0,
    emissive: 0xffd9a0, emissiveIntensity: 2.6,
  });
  const metalBlack = mats.matteBlack;

  function buildRoom(room) {
    const roomFixtures = []; // 每燈：{ light, shadeMat, base, target, cur }

    room.positions.forEach(([x, y, z]) => {
      const fGroup = new THREE.Group();
      fGroup.position.set(x, 0, z);
      group.add(fGroup);

      const light = new THREE.PointLight(room.color, 0, 0, 2);
      light.position.set(x, y - 0.12, z);
      if (quality.pointShadows && room.id === 'living') {
        light.castShadow = true;
        light.shadow.mapSize.set(512, 512);
        light.shadow.bias = -0.004;
        light.shadow.camera.far = 12;
      }
      scene.add(light);
      allLights.push(light);

      const shadeMat = emitWarm.clone();
      let shade;
      if (room.id === 'dining') {
        cyl(0.012, 0.012, 3.15 - y, metalBlack, x, (3.15 + y) / 2, z, { seg: 6, cast: false, group: fGroup });
        shade = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.3, 24, 1, true), shadeMat);
        shade.rotation.x = Math.PI; // 開口朝下
        shade.position.set(x, y + 0.02, z);
      } else {
        shade = box(0.42, 0.05, 0.42, shadeMat, x, 3.115, z, { cast: false, group: fGroup });
        box(0.5, 0.04, 0.5, metalBlack, x, 3.137, z, { cast: false, group: fGroup });
      }
      shade.castShadow = false;
      roomFixtures.push({ light, shadeMat, base: room.intensity / room.positions.length, target: 1, cur: 1 });
    });

    const roomOn = () => !state.globalOff && roomFixtures[0].target > 0.5;
    const labelOn = `F — 關閉${room.name}燈光`, labelOff = `F — 開啟${room.name}燈光`;

    fixtures.push({
      type: 'light',
      meshes: roomFixtures.map(() => null), // 佔位，下方以燈罩網格填入
      distance: 2.7,
      busy: false,
      roomName: room.name,
      roomOn,
      label() { return roomOn() ? labelOn : labelOff; },
      action() { const want = !roomOn(); for (const f of roomFixtures) f.target = want ? 1 : 0; },
      update() {
        for (const f of roomFixtures) {
          const tgt = state.globalOff ? 0 : f.target;
          if (f.cur !== tgt) {
            const step = 0.1; // ~4/s 漸變（60fps）
            f.cur = Math.abs(f.cur - tgt) <= step ? tgt : f.cur + Math.sign(tgt - f.cur) * step;
          }
          f.light.intensity = f.base * f.cur;
          f.shadeMat.emissiveIntensity = 2.6 * f.cur;
        }
      },
    });
  }

  // meshes 必須是網格（raycast 用）：把燈罩網格直接放進去
  function buildRoomWithMeshes(room) {
    const before = group.children.length;
    buildRoom(room);
    // 收集本房間燈具網格：掃 fGroup（由 buildRoom 建立於 group 尾端）
    const fx = fixtures[fixtures.length - 1];
    const collect = [];
    for (let i = before; i < group.children.length; i++) {
      group.children[i].traverse((o) => { if (o.isMesh) collect.push(o); });
    }
    fx.meshes = collect;
  }

  for (const room of ROOM_LIGHTS) buildRoomWithMeshes(room);

  function turnAll(on) {
    for (const obj of fixtures) {
      // 直接設目標（roomOn 內部狀態由 target 決定）
      const cur = obj.roomOn();
      if (cur !== on) obj.action();
    }
  }

  return {
    fixtures,
    turnAll,
    setGlobalOff: (off) => { state.globalOff = off; },
    isGlobalOff: () => state.globalOff,
    countOn: () => fixtures.reduce((n, f) => n + (f.roomOn() ? 1 : 0), 0),
    update: () => { for (const f of fixtures) f.update(); },
    dispose() {
      for (const l of allLights) {
        if (l.shadow && l.shadow.map) l.shadow.map.dispose();
        scene.remove(l);
        l.dispose();
      }
    },
  };
}

export { ROOM_LIGHTS };
