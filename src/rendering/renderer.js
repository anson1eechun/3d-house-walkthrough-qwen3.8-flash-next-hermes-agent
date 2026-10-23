// 渲染器與場景/相機建立；WebGL2 可用性檢查
import * as THREE from 'three';

export function assertWebGL2() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return { ok: false, reason: 'no-webgl2' };
    return { ok: true, gl };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
}

export function createRenderer(host) {
  const renderer = new THREE.WebGLRenderer({
    antialias: false, // 後處理管線自管抗鋸齒（FXAA）
    powerPreference: 'high-performance',
    stencil: false,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  return renderer;
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.matrixAutoUpdate = true;
  return scene;
}

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 500);
  camera.rotation.order = 'YXZ';
  camera.position.set(0, 1.65, 7.2);
  return camera;
}
