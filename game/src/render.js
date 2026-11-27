// Ember Fjord — renderer, dusk sky, sun and lights.
// Everything the eye reads as "dusk" lives here: a gradient sky dome with
// a glowing sun, warm low light with long shadows, and haze that melts the
// far peaks into the horizon.

import * as THREE from 'three';
import { CFG } from './config.js';

export function createRenderer(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true });
  r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  r.setSize(window.innerWidth, window.innerHeight);
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.25;
  r.outputColorSpace = THREE.SRGBColorSpace;
  return r;
}

function skyMaterial() {
  const s = CFG.sky;
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(s.topColor) },
      mid: { value: new THREE.Color(s.midColor) },
      low: { value: new THREE.Color(s.lowColor) },
      sunDir: { value: new THREE.Vector3(...s.sunDir).normalize() },
      sunCol: { value: new THREE.Color(s.sunColor) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_Position.z = gl_Position.w;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      uniform vec3 top; uniform vec3 mid; uniform vec3 low;
      uniform vec3 sunDir; uniform vec3 sunCol;
      void main() {
        float h = clamp(vDir.y, -0.08, 1.0);
        vec3 col = mix(low, mid, smoothstep(0.0, 0.22, h));
        col = mix(col, top, smoothstep(0.18, 0.65, h));
        float sunAmt = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        col += sunCol * pow(sunAmt, 90.0) * 1.6;
        col += sunCol * pow(sunAmt, 8.0) * 0.35;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

export function createSky(scene) {
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(3200, 24, 16),
    skyMaterial(),
  );
  scene.add(dome);
  return dome;
}

function glowTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 4, 128, 128, 128);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.35, outer);
  grad.addColorStop(1, 'rgba(255, 120, 40, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSun(scene) {
  const dir = new THREE.Vector3(...CFG.sky.sunDir).normalize();
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture('rgba(255, 246, 220, 1)', 'rgba(255, 150, 60, 0.85)'),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  sprite.position.copy(dir).multiplyScalar(2600);
  sprite.scale.set(620, 620, 1);
  scene.add(sprite);
  return sprite;
}

export function createClouds(scene, rng) {
  const tex = glowTexture('rgba(255, 235, 225, 0.9)', 'rgba(255, 200, 180, 0.45)');
  const group = new THREE.Group();
  for (let i = 0; i < 16; i++) {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        opacity: 0.4 + rng() * 0.35,
        depthWrite: false,
      }),
    );
    const a = rng() * Math.PI * 2;
    const r = 500 + rng() * 1400;
    s.position.set(Math.cos(a) * r, 200 + rng() * 180, Math.sin(a) * r);
    s.scale.set(220 + rng() * 260, 55 + rng() * 60, 1);
    group.add(s);
  }
  scene.add(group);
  return group;
}

export function createLights(scene) {
  const s = CFG.sky;
  const sun = new THREE.DirectionalLight(s.sunColor, s.sunIntensity);
  sun.position.set(s.sunDir[0] * 900, s.sunDir[1] * 900 + 120, s.sunDir[2] * 900);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -700;
  sun.shadow.camera.right = 700;
  sun.shadow.camera.top = 700;
  sun.shadow.camera.bottom = -700;
  sun.shadow.camera.near = 50;
  sun.shadow.camera.far = 2600;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(s.hemiSky, s.hemiGround, s.hemiIntensity);
  scene.add(hemi);
  scene.fog = new THREE.Fog(s.fogColor, CFG.world.fogNear, CFG.world.fogFar);
  return { sun, hemi };
}
