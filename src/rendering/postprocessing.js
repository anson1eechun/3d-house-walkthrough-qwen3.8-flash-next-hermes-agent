// 自訂後處理管線（不依賴 EffectComposer 的 buffer 輪換）：
// scene(+depth) → SSAO(half-res) → blur → composite → UnrealBloom(加法疊加) → OutputPass(ACES+sRGB) → FXAA
// MSAA 與 HDR 後處理目標難以共存，採 FXAA 作為抗鋸齒方案（規格 5.3 允许的替代方案）。
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createSSAOMaterial, aoVertexShader, aoBlurFragmentShader, compositeFragmentShader } from './shaders/ssao.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

function copyFragment() {
  return /* glsl */ `
precision mediump float;
varying vec2 vUv;
uniform sampler2D tDiffuse;
void main() { gl_FragColor = texture2D(tDiffuse, vUv); }
`;
}

export class PostPipeline {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.px = 1; this.py = 1;
    this.enableAO = true; this.enableBloom = true; this.enableFXAA = true;
    this.aoStrength = 0.85;

    // 共用 fullscreen quad（GLSL3 頂點）
    this.quadScene = new THREE.Scene();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quadMesh.frustumCulled = false;
    this.quadScene.add(this.quadMesh);

    const vsh = aoVertexShader;
    this.aoMat = createSSAOMaterial();
    this.blurMat = new THREE.ShaderMaterial({
      vertexShader: vsh, fragmentShader: aoBlurFragmentShader,
      uniforms: { tDiffuse: { value: null }, uTexel: { value: new THREE.Vector2(1, 1) } },
      depthTest: false, depthWrite: false,
    });
    this.compMat = new THREE.ShaderMaterial({
      vertexShader: vsh, fragmentShader: compositeFragmentShader,
      uniforms: { tDiffuse: { value: null }, tAO: { value: null }, uAOStrength: { value: this.aoStrength } },
      depthTest: false, depthWrite: false,
    });
    this.copyMat = new THREE.ShaderMaterial({
      vertexShader: vsh,
      fragmentShader: copyFragment(),
      uniforms: { tDiffuse: { value: null } },
      depthTest: false, depthWrite: false,
    });
    this.fxaaMat = new THREE.ShaderMaterial({
      vertexShader: vsh,
      fragmentShader: FXAAShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(FXAAShader.uniforms),
      depthTest: false, depthWrite: false,
    });

    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.35, 0.55, 1.05);
    this.bloomPass.autoClear = false; // 我們手動控制 clear，避免把既有底色清掉
    this.outputPass = new OutputPass();

    this._mats = [this.aoMat, this.blurMat, this.compMat, this.copyMat, this.fxaaMat];
    this._rts = [];
    this.hdrOK = this._probeHDR();
    this.aoOK = this._probeAO();
    if (!this.aoOK) this.enableAO = false;
  }

  /** 探測 SSAO 可用：以 clear(深度=1) 的 RT 餵給 AO 著色器，天空路徑應輸出白色(1.0) */
  _probeAO() {
    const r = this.renderer;
    let ok = false;
    let rt = null;
    try {
      rt = new THREE.WebGLRenderTarget(8, 8, { depthBuffer: true, depthTexture: new THREE.DepthTexture(8, 8) });
      rt.depthTexture.minFilter = THREE.NearestFilter;
      rt.depthTexture.magFilter = THREE.NearestFilter;
      const oldAutoClear = r.autoClear;
      r.autoClear = true;
      r.setRenderTarget(rt);
      r.setClearColor(0x000000, 1);
      r.clear(true, true, true); // 清空 → 深度 = 1.0（天空）
      const mat = this.aoMat.clone();
      mat.uniforms.uProj.value = new THREE.Matrix4();
      mat.uniforms.uProjInv.value = new THREE.Matrix4();
      mat.uniforms.uNear.value = 0.1;
      mat.uniforms.uFar.value = 100;
      mat.uniforms.uResolution.value.set(8, 8);
      mat.uniforms.uTime.value = 0;
      mat.uniforms.tDepth.value = rt.depthTexture;
      const oldMat = this.quadMesh.material;
      this.quadMesh.material = mat;
      r.render(this.quadScene, this.quadCam);
      const buf = new Uint8Array(4);
      r.readRenderTargetPixels(rt, 4, 4, 1, 1, buf);
      ok = buf[0] >= 250 && buf[1] >= 250 && buf[2] >= 250; // 天空 → AO=白
      this.quadMesh.material = oldMat;
      mat.dispose();
      r.autoClear = oldAutoClear;
    } catch (e) {
      ok = false;
    } finally {
      r.setRenderTarget(null);
      r.setClearColor(0x000000, 1);
      if (rt) { if (rt.depthTexture) rt.depthTexture.dispose(); rt.dispose(); }
    }
    return ok;
  }

  /** 黑盒探測：RGBA16F 能否作為 color attachment 繪製（SwiftShader/舊 driver 常不支援 → 退回 8-bit） */
  _probeHDR() {
    const r = this.renderer;
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    const oldAutoClear = r.autoClear;
    let ok = false;
    try {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const oldMat = this.quadMesh.material;
      this.quadMesh.material = mat;
      r.autoClear = true;
      r.setRenderTarget(rt);
      r.clear();
      r.render(this.quadScene, this.quadCam);
      const buf = new Uint16Array(4);
      r.readRenderTargetPixels(rt, 0, 0, 1, 1, buf);
      const h = buf[0]; // 1.0 的 half 編碼為 0x3C00
      ok = ((h >> 10) & 0x1f) >= 0x1c && (h & 0x3ff) >= 0x300; // >= ~0.9
      this.quadMesh.material = oldMat;
      mat.dispose();
    } catch (e) {
      ok = false;
    } finally {
      r.autoClear = oldAutoClear;
      r.setRenderTarget(null);
      rt.dispose();
    }
    return ok;
  }

  _mkRT(w, h, opts = {}) {
    const rt = new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
      type: opts.hdr ? THREE.HalfFloatType : THREE.UnsignedByteType,
      depthBuffer: !!opts.depth, stencilBuffer: false,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    });
    if (opts.depth) {
      rt.depthTexture = new THREE.DepthTexture(Math.max(1, w), Math.max(1, h));
      rt.depthTexture.minFilter = THREE.NearestFilter;
      rt.depthTexture.magFilter = THREE.NearestFilter;
      rt.depthTexture.generateMipmaps = false;
    }
    this._rts.push(rt);
    return rt;
  }

  setSize(cssW, cssH, pixelRatio) {
    const r = this.renderer;
    r.setPixelRatio(pixelRatio);
    r.setSize(cssW, cssH, false);
    const px = Math.max(1, Math.floor(cssW * pixelRatio));
    const py = Math.max(1, Math.floor(cssH * pixelRatio));
    if (px === this.px && py === this.py && pixelRatio === this.pixelRatio) return;
    this.px = px; this.py = py; this.pixelRatio = pixelRatio;

    for (const rt of this._rts) rt.dispose();
    this._rts = [];
    const hdr = this.hdrOK;
    this.rtScene = this._mkRT(px, py, { hdr, depth: true });
    this.rtAO = this._mkRT(Math.floor(px / 2), Math.floor(py / 2));
    this.rtAO2 = this._mkRT(Math.floor(px / 2), Math.floor(py / 2));
    this.rtComp = this._mkRT(px, py, { hdr });
    this.rtFinal = this._mkRT(px, py);

    this.aoMat.uniforms.uResolution.value.set(Math.floor(px / 2), Math.floor(py / 2));
    this.blurMat.uniforms.uTexel.value.set(2 / px, 2 / py);
    this.fxaaMat.uniforms.resolution.value.set(1 / px, 1 / py);
    this.bloomPass.setSize(px, py);
  }

  setQuality(qp) {
    this.enableAO = qp.ssao;
    this.enableBloom = qp.bloom;
    this.bloomPass.strength = qp.bloomStrength;
    this.enableFXAA = qp.fxaa;
  }

  setAOEnabled(on) { this.enableAO = on && this.aoOK; }

  drawQuad(mat, target) {
    this.quadMesh.material = mat;
    this.renderer.setRenderTarget(target || null);
    this.renderer.render(this.quadScene, this.quadCam);
  }

  renderFrame(time) {
    const r = this.renderer;
    const cam = this.camera;
    const oldAutoClear = r.autoClear;
    r.autoClear = false;

    // 1. 場景 → rtScene（含 depth）
    r.setRenderTarget(this.rtScene);
    r.clear();
    r.render(this.scene, cam);

    let src = this.rtScene;
    // 2. SSAO（驅動不支援深度採樣時由 aoOK 探測自動停用）
    if (this.enableAO && this.aoOK) {
      const u = this.aoMat.uniforms;
      u.tDepth.value = this.rtScene.depthTexture;
      u.uProj.value.copy(cam.projectionMatrix);
      u.uProjInv.value.copy(cam.projectionMatrix).invert();
      u.uNear.value = cam.near; u.uFar.value = cam.far;
      u.uTime.value = time;
      this.drawQuad(this.aoMat, this.rtAO);
      this.blurMat.uniforms.tDiffuse.value = this.rtAO.texture;
      this.drawQuad(this.blurMat, this.rtAO2);
      this.compMat.uniforms.tDiffuse.value = this.rtScene.texture;
      this.compMat.uniforms.tAO.value = this.rtAO2.texture;
      this.compMat.uniforms.uAOStrength.value = this.aoStrength;
      this.drawQuad(this.compMat, this.rtComp);
      src = this.rtComp;
    }

    // 3. Bloom（加法疊加在 readBuffer 上）
    if (this.enableBloom) {
      this.bloomPass.render(r, src, src, 0, false);
    }

    // 4. ACES 色調映射 + sRGB → rtFinal（或 FXAA 關閉時直接到螢幕）
    this.outputPass.renderToScreen = !this.enableFXAA;
    this.outputPass.render(r, this.rtFinal, src, 0, false);

    // 5. FXAA → 螢幕
    if (this.enableFXAA) {
      this.fxaaMat.uniforms.tDiffuse.value = this.rtFinal.texture;
      this.drawQuad(this.fxaaMat, null);
    }

    r.autoClear = oldAutoClear;
    r.setRenderTarget(null);
  }

  dispose() {
    for (const rt of this._rts) rt.dispose();
    for (const m of this._mats) m.dispose();
    this.bloomPass.dispose();
    this.outputPass.dispose();
    this.quadMesh.geometry.dispose();
  }
}
