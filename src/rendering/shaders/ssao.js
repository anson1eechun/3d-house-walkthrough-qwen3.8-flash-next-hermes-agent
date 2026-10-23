// 自製 SSAO（深度重建法線、半球取樣、距離衰減、角落防黑）
// 以 THREE.GLSL3 撰寫，供 fullscreen quad ShaderMaterial 使用。
import * as THREE from 'three';

export const aoVertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const aoFragmentShader = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform sampler2D tDepth;
uniform mat4 uProj;
uniform mat4 uProjInv;
uniform vec2 uResolution;
uniform float uNear;
uniform float uFar;
uniform float uRadius;      // 世界半徑（公尺）
uniform float uIntensity;   // 0..1
uniform float uBias;        // 自我遮蔽偏差
uniform float uSamplesF;
uniform vec3 uKernel[16];
uniform float uTime;

const float TAU = 6.2831853;

float linearDepth(float z01) {
  return (uNear * uFar) / (uFar - z01 * (uFar - uNear));
}

vec3 viewPosFrom(vec2 uv, float z01) {
  vec3 ndc = vec3(uv * 2.0 - 1.0, 1.0);
  vec4 vp = uProjInv * vec4(ndc, 1.0);
  vp /= vp.w;
  // 以線性深度替換 z，保持 z 為負（OpenGL 視空間）
  float d = linearDepth(z01);
  float scale = (-d) / (-vp.z);
  return vp.xyz * scale;
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  float z01 = texture2D(tDepth, vUv).x;
  if (z01 >= 0.9999) { gl_FragColor = vec4(1.0); return; } // 天空不著色

  vec3 vp = viewPosFrom(vUv, z01);

  // 由深度導數重建視空間法線
  vec3 dx = dFdx(vp);
  vec3 dy = dFdy(vp);
  vec3 n = normalize(cross(dx, dy));
  if (dot(n, normalize(vp)) > 0.0) n = -n; // 面向相機

  // 正交基（以法線為 z）
  vec3 t = normalize(dy);
  vec3 b = cross(n, t) * sign(dot(n, dx)) ;
  b = normalize(cross(n, t));

  float rot = hash12(floor(gl_FragCoord.xy)) * TAU + floor(uTime * 7.0) * 1.5707963;
  float c = cos(rot), s = sin(rot);

  float ao = 0.0;
  float totalW = 0.0;
  float camDist = -vp.z;
  float nSamples = int(uSamplesF);

  for (int i = 0; i < 16; i++) {
    if (i >= nSamples) break;
    vec3 off = uKernel[i];
    // 繞法線旋轉取樣向量
    vec3 o = vec3(off.x * c - off.y * s, off.x * s + off.y * c, off.z);
    vec3 sampleDir = t * o.x + b * o.y + n * o.z;
    vec3 sp = vp + sampleDir * uRadius;

    vec4 clip = uProj * vec4(sp, 1.0);
    if (clip.w <= 0.0) continue;
    vec2 suv = (clip.xy / clip.w) * 0.5 + 0.5;
    if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) continue;

    float sz01 = texture2D(tDepth, suv).x;
    if (sz01 >= 0.9999) continue;
    vec3 sap = viewPosFrom(suv, sz01);

    // sp.z 為負的探針深度；sap.z 若「更靠近相機」（較大）則遮蔽
    float delta = sap.z - sp.z - uBias;
    float occl = clamp(delta / (0.35 * uRadius), 0.0, 1.0);

    // 遠距離遮蔽衰減（防止大面積變黑）
    float rangeFade = 1.0 - clamp(length(sap - vp) / (uRadius * 2.2), 0.0, 1.0);
    ao += occl * rangeFade;
    totalW += 1.0;
  }

  ao = totalW > 0.0 ? ao / float(nSamples) : 0.0;
  // 距離相机越遠 AO 越弱（抗雜訊與過度變黑）
  float distFade = 1.0 - smoothstep(9.0, 30.0, camDist);
  ao *= distFade;

  float shade = 1.0 - uIntensity * pow(ao, 1.35);
  shade = clamp(shade, 0.15, 1.0);
  gl_FragColor = vec4(vec3(shade), 1.0);
}
`;

// 半球取樣核（餘弦加權螺旋）
export function makeKernel(n = 16) {
  const kernel = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const r = (i + 0.5) / n;
    const theta = golden * i;
    const z = Math.sqrt(1 - r * r * 0.9);
    const rr = Math.sqrt(1 - z * z);
    kernel.push(new THREE.Vector3(Math.cos(theta) * rr, Math.sin(theta) * rr, z));
  }
  return kernel;
}

export function createSSAOMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: aoVertexShader,
    fragmentShader: aoFragmentShader,
    uniforms: {
      tDepth: { value: null },
      uProj: { value: new THREE.Matrix4() },
      uProjInv: { value: new THREE.Matrix4() },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uNear: { value: 0.05 },
      uFar: { value: 500 },
      uRadius: { value: 0.55 },
      uIntensity: { value: 0.55 },
      uBias: { value: 0.03 },
      uSamplesF: { value: 16 },
      uKernel: { value: makeKernel(16) },
      uTime: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
  });
}

export const aoBlurFragmentShader = /* glsl */ `
precision mediump float;
varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform vec2 uTexel;
void main() {
  vec4 sum = texture2D(tDiffuse, vUv) * 4.0;
  sum += (texture2D(tDiffuse, vUv + vec2(uTexel.x, 0.0)) +
          texture2D(tDiffuse, vUv + vec2(-uTexel.x, 0.0)) +
          texture2D(tDiffuse, vUv + vec2(0.0, uTexel.y)) +
          texture2D(tDiffuse, vUv + vec2(0.0, -uTexel.y))) * 2.0;
  sum += (texture2D(tDiffuse, vUv + uTexel) +
          texture2D(tDiffuse, vUv + vec2(uTexel.x, -uTexel.y)) +
          texture2D(tDiffuse, vUv + vec2(-uTexel.x, uTexel.y)) +
          texture2D(tDiffuse, vUv - uTexel)) * 1.0;
  gl_FragColor = vec4(sum.rgb / 16.0, 1.0);
}
`;

export const compositeFragmentShader = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform sampler2D tAO;
uniform float uAOStrength;
void main() {
  vec4 col = texture2D(tDiffuse, vUv);
  float ao = texture2D(tAO, vUv).r;
  col.rgb *= mix(1.0, ao, uAOStrength);
  gl_FragColor = col;
}
`;