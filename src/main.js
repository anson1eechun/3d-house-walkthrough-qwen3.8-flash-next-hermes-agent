// main.js — 進入點：場景組裝、HUD/選單、輸入、渲染迴圈。
import * as THREE from 'three';
import {
  QUALITY_PRESETS, WEATHERS, EXPOSURE, ROOM_ZONES, ROOM_LIGHTS,
  INTERACT_RANGE, SPAWN, HOUSE,
} from './config.js';
import { assertWebGL2, createRenderer, createScene, createCamera } from './rendering/renderer.js';
import { createScene as createWorldEnv } from './scene/createScene.js';
import { PostPipeline } from './rendering/postprocessing.js';
import { buildMaterialLibrary } from './materials/proceduralTextures.js';
import { WorldCollider } from './player/collision.js';
import { createPlayerController } from './player/controller.js';
import { createInteractionManager } from './interaction/interactionManager.js';
import { createLightingSystem } from './interaction/lighting.js';
import { buildHouse } from './scene/createHouse.js';
import { buildInterior } from './scene/createInterior.js';
import { buildExterior } from './scene/createExterior.js';
import { createGlassMaterial, updateGlassMaterial } from './weather/glassDroplets.js';
import { createRain } from './weather/rain.js';

const $ = (id) => document.getElementById(id);
const host = $('scene-host');

// ---------- WebGL2 檢查 ----------
let webglErr = null;
try {
  const probe = assertWebGL2();
  if (!probe || !probe.ok) webglErr = (probe && probe.reason) || 'no-webgl2';
} catch (e) { webglErr = e.message; }
if (webglErr) {
  $('loading').classList.add('hidden');
  $('start-overlay').classList.add('hidden');
  $('error-msg').textContent = webglErr;
  $('error-box').classList.remove('hidden');
  throw new Error(webglErr);
}

// ---------- 核心 ----------
const renderer = createRenderer(host);
const scene = createScene();
const camera = createCamera();
const mats = buildMaterialLibrary(renderer);

let qualityKey = 'medium';
let qp = QUALITY_PRESETS[qualityKey];

const sceneCtx = createWorldEnv(renderer, scene, camera, qp);
const colliderSys = new WorldCollider();

const houseGroup = new THREE.Group();
scene.add(houseGroup);

// 玻璃材質（清透=折射+水珠 shader；霧面=普通材質；框=深色金屬）
const frostedMat = new THREE.MeshStandardMaterial({
  color: 0xdde7e6, roughness: 0.62, metalness: 0,
  transparent: true, opacity: 0.45,
});
const glass = {
  clearMat: createGlassMaterial({ sceneCtx, quality: qp, size: new THREE.Vector2(1, 1) }),
  frostedMat,
  panelMat: mats.darkGlassFrame,
};

const house = buildHouse({ scene, mats, glass, colliderSys, group: houseGroup });
const interior = buildInterior({ scene, mats, glass, colliderSys, group: houseGroup });
const exterior = buildExterior({ scene, mats, colliderSys, group: scene });

// 把所有 clearMat 網格登記進折射渲染遮罩（遍歷一次，確保不漏）
scene.traverse((o) => {
  if (o.isMesh && o.material === glass.clearMat) sceneCtx.glassRegistry.push(o);
});

// 濕地面：只套用在室外材質（濕度經共享 wetU uniform 即時傳入 shader）
for (const groundMat of [mats.grass, mats.paverStone, mats.concretePave, mats.woodSlat])
  sceneCtx.applyWetPatch(groundMat);

const lighting = createLightingSystem({ scene, mats, quality: qp, group: houseGroup });

let rain = createRain({ scene, quality: qp });

// ---------- 互動 ----------
const hud = {
  showHint(t) { const el = $('interact-hint'); el.textContent = t; el.classList.add('show'); },
  hideHint() { $('interact-hint').classList.remove('show'); },
};
const interactives = [...house.interactives, ...interior.interactives, ...lighting.fixtures];
const interMgr = createInteractionManager({
  camera, scene, dom: renderer.domElement, hud,
  updateAll: (dt) => {
    for (const o of interactives) {
      o.update?.(dt);
      o.updateCollider?.(dt);
    }
  },
});
interMgr.setInteractives(interactives);

// ---------- 控制器 ----------
let started = false;
let settingsOpen = false;
const player = createPlayerController({
  camera, colliderSys, dom: renderer.domElement,
  onLockChange: (locked) => {
    if (!started) return;
    if (locked) {
      $('pause-overlay').classList.add('hidden');
      $('settings-panel').classList.add('hidden');
      settingsOpen = false;
    } else if (!settingsOpen) {
      $('pause-overlay').classList.remove('hidden');
    }
  },
});

// ---------- 後處理 ----------
const post = new PostPipeline(renderer, scene, camera);
function applySize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(qp.pixelRatio);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  post.setSize(w, h, qp.pixelRatio);
}
applySize();
post.setQuality(qp);

// ---------- 選單 / HUD ----------
const WEAATHER_LABEL = { clear: '☀ 晴日', rain: '🌧 雨天', night: '🌙 夜晚' };
let weatherKey = 'clear';
let targetExposure = EXPOSURE[weatherKey];

function setWeather(id) {
  weatherKey = id;
  sceneCtx.applyWeather(id);
  targetExposure = EXPOSURE[id] ?? 1;
  $('weather-state').textContent = WEAATHER_LABEL[id] || id;
  for (const b of $('weather-group').querySelectorAll('button'))
    b.classList.toggle('active', b.dataset.w === id);
}

function applyQuality(key) {
  qualityKey = key;
  qp = QUALITY_PRESETS[key];
  post.setQuality(qp);
  sceneCtx.applyShadowQuality(qp);
  applySize();
  rain.dispose();
  rain = createRain({ scene, quality: qp });
  $('quality-state').textContent = `畫質：${qp.label}`;
  for (const b of $('quality-group').querySelectorAll('button'))
    b.classList.toggle('active', b.dataset.q === key);
}

$('quality-group').addEventListener('click', (e) => {
  const q = e.target.dataset?.q;
  if (q) applyQuality(q);
});
$('weather-group').addEventListener('click', (e) => {
  const w = e.target.dataset?.w;
  if (w) setWeather(w);
});

// 燈光總開關（依 ROOM_LIGHTS ↔ lighting.fixtures 同序）
const lightOn = ROOM_LIGHTS.map(() => true);
function refreshLightChips() {
  const wrap = $('light-toggles');
  wrap.textContent = '';
  ROOM_LIGHTS.forEach((r, i) => {
    const b = document.createElement('button');
    b.className = 'chip' + (lightOn[i] ? ' on' : '');
    b.textContent = `${r.name} ${lightOn[i] ? '開' : '關'}`;
    b.addEventListener('click', () => {
      lightOn[i] = !lightOn[i];
      const f = lighting.fixtures[i];
      if (f && f.roomOn() !== lightOn[i]) f.action();
      refreshLightChips();
    });
    wrap.appendChild(b);
  });
  const n = lightOn.filter(Boolean).length;
  $('light-state').textContent = `燈光：${n === 0 ? '全關' : `${n}/${ROOM_LIGHTS.length} 開`}`;
}
refreshLightChips();

function openSettings() {
  settingsOpen = true;
  $('pause-overlay').classList.add('hidden');
  $('settings-panel').classList.remove('hidden');
}
$('btn-close-settings').addEventListener('click', () => {
  settingsOpen = false;
  $('settings-panel').classList.add('hidden');
  if (!player.isLocked()) $('pause-overlay').classList.remove('hidden');
});
$('btn-reset').addEventListener('click', () => player.respawn());
$('btn-resume').addEventListener('click', () => player.lock());
$('btn-start').addEventListener('click', () => {
  started = true;
  $('start-overlay').classList.add('hidden');
  $('hud').classList.remove('hidden');
  player.lock();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyF' && !e.repeat && started) interMgr.pressF();
  if (e.code === 'KeyE' && !e.repeat && started) interMgr.pressF();
  if (e.code === 'KeyO') { if (!settingsOpen) { openSettings(); } }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyF' || e.code === 'KeyE') interMgr.releaseF?.();
});

// ---------- 迴圈 ----------
const scratchSize = new THREE.Vector2();
const clock = new THREE.Clock();
let frames = 0, fpsTimer = 0, elapsed = 0;

function currentRoomName() {
  const p = camera.position;
  if (p.x < HOUSE.minX - 0.4 || p.x > HOUSE.maxX + 0.4 || p.z < HOUSE.minZ - 0.6 || p.z > HOUSE.maxZ + 0.6)
    return '戶外';
  for (const z of ROOM_ZONES)
    if (p.x >= z.x1 && p.x <= z.x2 && p.z >= z.z1 && p.z <= z.z2) return z.name;
  return '玄關・走廊';
}

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta());
  elapsed += dt;

  player.update(dt);
  interMgr.update(dt);
  lighting.update();

  sceneCtx.timeU.value += dt;
  sceneCtx.updateWeatherTransition(dt);

  // 玻璃折射與水珠
  updateGlassMaterial(glass.clearMat, sceneCtx, renderer, scratchSize);
  sceneCtx.renderGlassReflection(camera);

  // 降雨
  rain.update(dt, elapsed, sceneCtx.state.rain, camera);

  // HUD
  $('room-name').textContent = currentRoomName();
  frames++; fpsTimer += dt;
  if (fpsTimer >= 0.5) {
    $('fps').textContent = `${Math.round(frames / fpsTimer)} FPS`;
    frames = 0; fpsTimer = 0;
  }

  post.renderFrame(elapsed);
}

window.__dbg = { renderer, scene, camera, post, glass, sceneCtx, mats };

// ---------- 啟動 ----------
// 先渲一幀讓材质編譯/幾何上傳完成，再移除載入畫面
sceneCtx.applyWeather('clear');
setWeather('clear');
applyQuality('medium');
renderer.compile?.(scene, camera);
requestAnimationFrame(() => {
  $('load-fill').style.width = '100%';
  $('load-text').textContent = '準備完成';
  setTimeout(() => $('loading').classList.add('hidden'), 150);
  loop();
});

window.addEventListener('resize', applySize);
