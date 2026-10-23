// 場景基底：天空、日光、半球光、霧、環境貼圖（PMREM）、天氣切換、
// 濕度全域 uniform 與濕地面材質注入、玻璃折射用場景 RT。
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { SKY_PRESETS, WEATHERS, EXPOSURE } from '../config.js';

export function createScene(renderer, scene, camera, quality) {
  // ---------- 全域時間/濕度 uniform ----------
  const timeU = { value: 0 };
  const wetU = { value: 0 };

  // ---------- 天空（晴天用 Sky，陰天/夜間用頂點色天穹） ----------
  const sky = new Sky();
  sky.scale.setScalar(450);
  sky.renderOrder = -2;
  scene.add(sky);

  const skyUniforms = sky.material.uniforms;
  skyUniforms['turbidity'].value = 8;
  skyUniforms['rayleigh'].value = 1.6;
  skyUniforms['mieCoefficient'].value = 0.004;
  skyUniforms['mieDirectionalG'].value = 0.85;

  // 頂點色天穹（可還原陰天/夜環境，PMREM 來源）
  const domeGeo = new THREE.IcosahedronGeometry(320, 5);
  const colors = new Float32Array(domeGeo.attributes.position.count * 3);
  domeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const dome = new THREE.Mesh(domeGeo, new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false,
  }));
  dome.renderOrder = -3;
  scene.add(dome);

  // ---------- 光照 ----------
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.castShadow = true;
  sun.shadow.camera.left = -30; sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 90;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  sun.target.position.set(0, 0, 0);
  scene.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight(0x9fb8d8, 0x4a4136, 0.6);
  scene.add(hemi);

  scene.fog = new THREE.FogExp2(0x9db2cc, 0.008);

  // ---------- PMREM 環境 ----------
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envScene = new THREE.Scene();
  const envDomeGeo = new THREE.IcosahedronGeometry(100, 4);
  const envColors = new Float32Array(envDomeGeo.attributes.position.count * 3);
  envDomeGeo.setAttribute('color', new THREE.BufferAttribute(envColors, 3));
  const envDome = new THREE.Mesh(envDomeGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
  envScene.add(envDome);
  const envGround = new THREE.Mesh(
    new THREE.PlaneGeometry(240, 240).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x54534c }),
  );
  envGround.position.y = -1.5;
  envScene.add(envGround);

  let envRT = null;
  function rebuildEnv() {
    const rt = pmrem.fromScene(envScene, 0.04);
    if (envRT) envRT.dispose();
    envRT = rt;
    scene.environment = rt.texture;
  }

  // 天穹與環境上色
  const cTop = new THREE.Color(), cHor = new THREE.Color(), cBot = new THREE.Color();
  function paintDome(geo, preset) {
    const pos = geo.attributes.position;
    const col = geo.attributes.color;
    cTop.set(preset.top); cHor.set(preset.horizon); cBot.set(preset.ground);
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize();
      const y = v.y;
      let c;
      if (y >= 0) {
        const t = Math.pow(y, 0.6);
        c = cHor.clone().lerp(cTop, t);
      } else {
        const t = Math.min(1, -y * 3);
        c = cHor.clone().lerp(cBot, t);
      }
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
  }

  // ---------- 天氣狀態（current → target 平滑過渡） ----------
  const state = {
    weather: 'clear',
    wetness: 0, wetnessTarget: 0,
    rain: 0, rainTarget: 0,
    fog: scene.fog.density, fogTarget: scene.fog.density,
    exposure: EXPOSURE.clear, exposureTarget: EXPOSURE.clear,
    sunInt: sun.intensity, sunIntTarget: sun.intensity,
    hemiInt: hemi.intensity, hemiIntTarget: hemi.intensity,
  };
  const sunDir = new THREE.Vector3();
  function sunVector(elDeg, azDeg) {
    const el = THREE.MathUtils.degToRad(elDeg), az = THREE.MathUtils.degToRad(azDeg);
    return sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  }

  function applyWeather(id) {
    const w = WEATHERS[id];
    state.weather = id;
    const preset = SKY_PRESETS[w.sky];
    paintDome(domeGeo, preset);
    paintDome(envDomeGeo, preset);
    rebuildEnv();

    const useSky = w.sky === 'clear';
    sky.visible = useSky;
    dome.visible = !useSky;
    if (useSky) {
      skyUniforms['turbidity'].value = 8;
      skyUniforms['rayleigh'].value = 1.6;
      skyUniforms['mieCoefficient'].value = 0.004;
      skyUniforms['mieDirectionalG'].value = 0.85;
      sky.material.uniforms['sunPosition'].value.copy(sunVector(w.sunElev, w.sunAzim));
    }

    sun.visible = w.sunIntensity > 0.01;
    state.sunIntTarget = w.sunIntensity;
    sun.color.set(w.sunColor);
    sun.position.copy(sunVector(w.sunElev, w.sunAzim)).multiplyScalar(55);

    hemi.color.set(preset.horizon);
    hemi.groundColor.set(preset.ground);
    state.hemiIntTarget = w.hemiIntensity;

    state.fogTarget = w.fogDensity;
    state.exposureTarget = EXPOSURE[id] ?? 0.9;
    state.wetnessTarget = w.wetness;
    state.rainTarget = w.rainIntensity;

    scene.fog.color.set(preset.horizon).multiplyScalar(0.92);
    return state;
  }

  // 每幀平滑過渡
  function updateWeatherTransition(dt) {
    const k = 1 - Math.exp(-dt * 0.9);
    const app = (cur, tgt) => cur + (tgt - cur) * k;
    state.wetness = app(state.wetness, state.wetnessTarget);
    state.rain = app(state.rain, state.rainTarget);
    state.fog = app(state.fog, state.fogTarget);
    state.sunInt = app(state.sunInt, state.sunIntTarget);
    state.hemiInt = app(state.hemiInt, state.hemiIntTarget);
    state.exposure = app(state.exposure, state.exposureTarget);
    wetU.value = state.wetness;
    scene.fog.density = state.fog;
    sun.intensity = state.sunInt;
    hemi.intensity = state.hemiInt;
    renderer.toneMappingExposure = state.exposure;
    return state;
  }

  // ---------- 玻璃折射用場景 RT ----------
  const refractRes = Math.min(1024, Math.floor(1024 * (quality.refractScale || 0.5)));
  const refractRT = new THREE.WebGLRenderTarget(refractRes, Math.floor(refractRes * 0.5625), {
    type: THREE.HalfFloatType, depthBuffer: false,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
  });
  const glassRegistry = []; // { mesh } — 折射渲染時隱藏
  let glassHidden = false;
  function renderGlassReflection(cam) {
    for (const g of glassRegistry) g.visible = false;
    glassHidden = true;
    renderer.setRenderTarget(refractRT);
    renderer.render(scene, cam);
    renderer.setRenderTarget(null);
    for (const g of glassRegistry) g.visible = true;
    glassHidden = false;
  }

  // ---------- 濕地面无質注入 ----------
  const patched = [];
  function applyWetPatch(mat, { wetRough = 0.08, rippleAmp = 0.06, rippleScale = 6, wetMask = 1 } = {}) {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uWet = wetU;
      shader.uniforms.uTime = timeU;
      shader.uniforms.uWetParams = { value: new THREE.Vector4(rippleAmp, rippleScale, wetMask, wetRough) };
      shader.vertexShader = 'varying vec2 vWetUV;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        'vWetUV = uv;\n#include <project_vertex>',
      );
      shader.fragmentShader = [
        'uniform float uWet;', 'uniform float uTime;', 'uniform vec4 uWetParams;', 'varying vec2 vWetUV;',
      ].join('\n') + '\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        float uWetF = clamp(uWet * uWetParams.z, 0.0, 1.0);
        roughnessFactor = mix(roughnessFactor, max(uWetParams.w, 0.02), uWetF);`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        float uWetR = clamp(uWet * uWetParams.z, 0.0, 1.0);
        if (uWetR > 0.001 && uWetParams.x > 0.0) {
          vec2 wuv = vWetUV * uWetParams.y;
          float rip = sin(wuv.x * 18.0 + sin(wuv.y * 7.0) * 1.2 + uTime * 2.4) * 0.5
                    + sin(wuv.y * 21.0 + sin(wuv.x * 9.0 - uTime * 1.9) * 1.1 + uTime * 1.7) * 0.5;
          normal = normalize(normal + vec3(rip, 0.0, rip * 0.7) * (uWetParams.x * uWetR * 0.5));
        }`,
      );
      mat.customProgramCacheKey = () => `wet_${rippleAmp}_${rippleScale}_${wetMask}_${wetRough}`;
    };
    patched.push(mat);
    return mat;
  }

  // ---------- 品質 ----------
  function applyShadowQuality(qp) {
    const s = Math.max(512, Math.round(2048 * (qp.shadowScale || 1)));
    if (sun.shadow.mapSize.width !== s) {
      sun.shadow.mapSize.set(s, s);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
  }

  function dispose() {
    if (envRT) envRT.dispose();
    pmrem.dispose();
    refractRT.dispose();
    domeGeo.dispose(); dome.material.dispose();
    envDomeGeo.dispose(); envDome.material.dispose();
    envGround.geometry.dispose(); envGround.material.dispose();
    sky.geometry.dispose(); sky.material.dispose();
  }

  applyWeather('clear');

  // 給玻璃 shader 的目前天空狀態（重用向量/色彩，避免每幀分配）
  const activeSky = {
    sunDirVec: new THREE.Vector3(),
    sunColorLin: new THREE.Color(),
    topHex: 0, horizonHex: 0, groundHex: 0, sunIntensity: 1,
  };
  function getActiveSky() {
    const w = WEATHERS[state.weather];
    const preset = SKY_PRESETS[w.sky];
    activeSky.sunDirVec.copy(sun.position).normalize();
    activeSky.sunColorLin.set(w.sunColor);
    activeSky.topHex = preset.top;
    activeSky.horizonHex = preset.horizon;
    activeSky.groundHex = preset.ground;
    activeSky.sunIntensity = Math.max(0.15, state.sunInt);
    return activeSky;
  }

  return {
    sun, hemi, sky, dome, state, timeU, wetU,
    applyWeather, updateWeatherTransition, applyWetPatch, applyShadowQuality,
    refractRT, glassRegistry, renderGlassReflection,
    getGlassHidden: () => glassHidden,
    getActiveSky,
    dispose,
  };
}
