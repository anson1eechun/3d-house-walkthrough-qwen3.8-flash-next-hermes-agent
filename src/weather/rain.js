// 動態降雨：GPU 粒子（Points + ShaderMaterial），跟隨相機、無 CPU 每幀更新。
// 每顆雨滴在頂點著色器依 uTime 下落並 mod 回捲；uIntensity 控制可見數量與透明度。
import * as THREE from 'three';

export function createRain({ scene, quality }) {
  const COUNT = quality.rainCount;
  const AREA = 46, TOP = 15;

  const positions = new Float32Array(COUNT * 3);
  const seeds = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * AREA;
    positions[i * 3 + 1] = Math.random() * TOP;
    positions[i * 3 + 2] = (Math.random() - 0.5) * AREA;
    seeds[i] = Math.random();
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

  const uniforms = {
    uTime: { value: 0 },
    uIntensity: { value: 0 },
    uArea: { value: AREA },
    uTop: { value: TOP },
    uSize: { value: quality === '高' ? 9.0 : 7.0 },
    uColor: { value: new THREE.Color(0xb9c6d4) },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    vertexShader: /* glsl */`
      attribute float aSeed;
      uniform float uTime, uIntensity, uArea, uTop, uSize;
      varying float vA;
      void main() {
        vec3 p = position;
        float speed = 14.0 + aSeed * 8.0;
        p.y = mod(p.y - uTime * speed, uTop);
        // 風：輕微斜向漂移
        p.x += sin(uTime * 0.35 + aSeed * 6.2831) * 0.6;
        // 跟隨相機（由 main 每幀設 uCam）
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        // 淡入淡出數量：seed 大於強度的粒子直接藏到相機後
        vA = step(aSeed, max(uIntensity, 0.0001)) * (1.0 - smoothstep(18.0, 34.0, -mv.z));
        gl_PointSize = uSize * (22.0 / max(2.0, -mv.z)) * (0.6 + aSeed * 0.7);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      varying float vA;
      void main() {
        if (vA <= 0.01) discard;
        // 拉長：在 sprite 內只保留細長垂直條
        vec2 c = gl_PointCoord - 0.5;
        float line = smoothstep(0.08, 0.0, abs(c.x)) * smoothstep(0.5, 0.12, abs(c.y));
        float a = line * vA * 0.55;
        if (a < 0.02) discard;
        gl_FragColor = vec4(uColor, a);
      }
    `,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 999;
  scene.add(points);

  return {
    points,
    update(dt, timeSec, rainState, camera) {
      uniforms.uTime.value = timeSec;
      uniforms.uIntensity.value = rainState;
      mat.uniformsNeedUpdate = true;
      // 粒子盒跟隨相機：把 points 移到相機正下方
      points.position.set(
        Math.round(camera.position.x),
        uniforms.uTop.value / 2 - 0.5,
        Math.round(camera.position.z),
      );
    },
    dispose() {
      scene.remove(points);
      geo.dispose();
      mat.dispose();
    },
  };
}
