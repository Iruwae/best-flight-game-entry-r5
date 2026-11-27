// Ember Fjord — combined terrain: THREE.Terrain heightfield, shader
// water, daylight, and two tree systems in one valley.
//
// The heightfield is a seeded THREE.Terrain build (fault + diamond-square
// + perlin passes) with a fjord channel carved down the middle and a flat
// pad under runway 18 so the landing mission still has ground to land on.
// The ground is painted with vertex colours only — sand at the waterline,
// grass on gentle low ground, rock on steep or high ground, snow on the
// high gentle tops — because no terrain textures are vendored.
//
// Water is a custom shader plane: three travelling swells with analytic
// normals, depth-tinted colour, fresnel sky reflection, sun glint,
// sparkle, shore foam and current streaks.
//
// Trees come in two systems that share one placement grid so nothing
// overlaps: vinish.dev GLB hero trees (CC BY 4.0, real branching, leaf
// cards) and a procedural ez-tree far forest (MIT, generated once per
// species, then instanced). Both load asynchronously and re-render the
// frame when they land, so screenshot mode picks them up too.

import * as THREE from 'three';
import { CFG } from './config.js';
import Terrain, { TerrainNS, createSeededRandom } from '../vendor/three-terrain.min.js';
import { Tree, TreePreset } from 'ez-tree';
import { GLTFLoader } from '../vendor/GLTFLoader.min.js';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.min.js';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function clampNum(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Smoothstep between two edges, 0 below `a`, 1 above `b`.
function sstep(a, b, x) {
  const t = clampNum((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

// Deterministic PRNG (mulberry32) for tree placement.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Cheap 2D hash in [0, 1) for per-vertex colour variation.
function hash2(x, z) {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function triCount(geo) {
  return (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
}

// ---------------------------------------------------------------------------
// World constants and shared state
// ---------------------------------------------------------------------------

const WORLD = 2400;
const HALF = WORLD / 2;
const SEG = 255; // heightfield segments per side (256 x 256 grid)
const WATER_Y = -2;
const PEAK = 235;
const SUN_POS = new THREE.Vector3(1500, 520, 150);

let heightGrid = null; // Float32Array-ish, (SEG + 1) x (SEG + 1), row = z
let waterMat = null;
let sceneRef = null;
let rendererRef = null;
let cameraRef = null;
let refreshTimer = null;

const treeStats = { vinish: {}, ez: {} };

// The channel runs straight down x = 0, so its centre is 0 at any z.
export function fjordCenter(/* z */) {
  return 0;
}

// Bilinear interpolation on the stored height grid. Before the terrain is
// built there is no grid yet, so flat zero is the safe answer.
export function heightAt(x, z) {
  if (!heightGrid) return 0;
  const gx = ((x + HALF) / WORLD) * SEG;
  const gz = ((z + HALF) / WORLD) * SEG;
  let ix = Math.floor(gx);
  let iz = Math.floor(gz);
  const fx = clampNum(gx - ix, 0, 1);
  const fz = clampNum(gz - iz, 0, 1);
  ix = clampNum(ix, 0, SEG - 1);
  iz = clampNum(iz, 0, SEG - 1);
  const w = SEG + 1;
  const a = heightGrid[iz * w + ix];
  const b = heightGrid[iz * w + ix + 1];
  const c = heightGrid[(iz + 1) * w + ix];
  const d = heightGrid[(iz + 1) * w + ix + 1];
  const top = a + (b - a) * fx;
  const bot = c + (d - c) * fx;
  return top + (bot - top) * fz;
}

// ---------------------------------------------------------------------------
// Daylight: blue sky dome, sun sprite, warm sun + cool fill, pale haze
// ---------------------------------------------------------------------------

function radialGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,214,140,1)');
  grad.addColorStop(0.25, 'rgba(255,170,80,0.9)');
  grad.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Soft cloud sprite: a few overlapping warm blobs, so it reads as a
// cloud rather than a disc.
function cloudTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  // Puffy cauliflower silhouette: overlapping blobs with a defined edge,
  // so the sprite reads as a cloud, not a faint haze.
  const blobs = [
    [128, 150, 78],
    [256, 120, 96],
    [384, 150, 78],
    [190, 175, 62],
    [320, 175, 62],
    [256, 185, 70],
    [90, 180, 48],
    [420, 180, 48],
  ];
  for (const [x, y, r] of blobs) {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,250,240,0.98)');
    grad.addColorStop(0.55, 'rgba(255,238,220,0.75)');
    grad.addColorStop(1, 'rgba(255,220,190,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 256);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createDaylight(scene, renderer) {
  sceneRef = scene;
  rendererRef = renderer;
  cameraRef = scene.children.find((c) => c.isCamera) ?? null;
  renderer.toneMappingExposure = 1.35;

  // Sky dome, vertex-coloured: golden hour, not flat noon blue. Warm gold
  // toward the sun's azimuth, soft rose-peach opposite it, deeper blue
  // overhead — bright and readable, with a real gradient.
  const skyGeo = new THREE.SphereGeometry(4200, 24, 16);
  const sp = skyGeo.attributes.position;
  const skyCol = new Float32Array(sp.count * 3);
  const sunAz = new THREE.Vector2(SUN_POS.x, SUN_POS.z).normalize();
  const horizonWarm = [1.0, 0.58, 0.18];
  const horizonCool = [0.85, 0.55, 0.45];
  const midWarm = [0.48, 0.36, 0.58];
  const midCool = [0.2, 0.36, 0.74];
  const top = [0.07, 0.24, 0.62];
  for (let i = 0; i < sp.count; i++) {
    const t = clampNum(sp.getY(i) / 4200, 0, 1);
    // Warmth: 1 looking toward the sun, 0.35 looking away — the whole
    // horizon band stays a warm sunset band, never pale peach.
    const dx = sp.getX(i);
    const dz = sp.getZ(i);
    const len = Math.hypot(dx, dz) || 1;
    const warmth =
      0.35 +
      0.65 *
        Math.pow(
          Math.max((dx / len) * sunAz.x + (dz / len) * sunAz.y, 0),
          1.5,
        );
    const horizon = [
      horizonCool[0] + (horizonWarm[0] - horizonCool[0]) * warmth,
      horizonCool[1] + (horizonWarm[1] - horizonCool[1]) * warmth,
      horizonCool[2] + (horizonWarm[2] - horizonCool[2]) * warmth,
    ];
    const mid = [
      midCool[0] + (midWarm[0] - midCool[0]) * warmth,
      midCool[1] + (midWarm[1] - midCool[1]) * warmth,
      midCool[2] + (midWarm[2] - midCool[2]) * warmth,
    ];
    let r;
    let g;
    let b;
    if (t < 0.25) {
      const k = t / 0.25;
      r = horizon[0] + (mid[0] - horizon[0]) * k;
      g = horizon[1] + (mid[1] - horizon[1]) * k;
      b = horizon[2] + (mid[2] - horizon[2]) * k;
    } else {
      const k = (t - 0.25) / 0.75;
      r = mid[0] + (top[0] - mid[0]) * k;
      g = mid[1] + (top[1] - mid[1]) * k;
      b = mid[2] + (top[2] - mid[2]) * k;
    }
    skyCol[i * 3] = r;
    skyCol[i * 3 + 1] = g;
    skyCol[i * 3 + 2] = b;
  }
  skyGeo.setAttribute('color', new THREE.BufferAttribute(skyCol, 3));
  const dome = new THREE.Mesh(
    skyGeo,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    }),
  );
  dome.renderOrder = -1;
  scene.add(dome);

  // Soft sun disc in the direction of the key light.
  const sunDir = SUN_POS.clone().normalize();
  const disc = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: radialGlowTexture(),
      transparent: true,
      fog: false,
      depthWrite: false,
    }),
  );
  disc.position.copy(sunDir).multiplyScalar(2600);
  disc.scale.set(750, 750, 1);
  scene.add(disc);

  // Golden-hour clouds: soft warm sprites ringing the horizon so the
  // sky reads as weather, not a flat gradient.
  const cloudTex = cloudTexture();
  const clouds = new THREE.Group();
  const crnd = mulberry32(777);
  for (let i = 0; i < 22; i++) {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: cloudTex,
        transparent: true,
        opacity: 0.7 + crnd() * 0.25,
        fog: false,
        depthWrite: false,
      }),
    );
    // Most clouds sit ahead of the flight path (+z) so they actually
    // appear in the chase/valley/menu frames, not just behind the camera.
    const a =
      i < 14 ? Math.PI / 2 + (crnd() - 0.5) * 2.4 : crnd() * Math.PI * 2;
    const r = 1200 + crnd() * 1600;
    s.position.set(Math.cos(a) * r, 420 + crnd() * 480, Math.sin(a) * r);
    s.scale.set(1000 + crnd() * 700, 220 + crnd() * 120, 1);
    clouds.add(s);
  }
  scene.add(clouds);
  window.__clouds = clouds;

  // Key sun: low warm gold, long soft shadows over the whole valley.
  const sun = new THREE.DirectionalLight(0xffd9a8, 2.9);
  sun.position.copy(SUN_POS);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -1400;
  sun.shadow.camera.right = 1400;
  sun.shadow.camera.top = 1400;
  sun.shadow.camera.bottom = -1400;
  sun.shadow.camera.near = 100;
  sun.shadow.camera.far = 5000;
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  // Sky bounce from above, warm ground bounce from below.
  scene.add(new THREE.HemisphereLight(0xe8d0b0, 0x8a7a5a, 1.5));

  // Warm fill from the opposite side so shadowed slopes stay readable.
  const fill = new THREE.DirectionalLight(0xffd9b0, 0.7);
  fill.position.set(-700, 600, -900);
  scene.add(fill);

  scene.fog = new THREE.Fog(0xd9b98c, 1400, 3400);
}

// ---------------------------------------------------------------------------
// Heightfield
// ---------------------------------------------------------------------------

// Paint the terrain mesh with vertex colours from height and slope. The
// geometry is still in plane-local space here (x, y, height), so world z
// is -local y and the height is local z.
function paintGround(geometry) {
  const pos = geometry.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const sand = new THREE.Color(0.78, 0.7, 0.52);
  const grassLow = new THREE.Color(0.22, 0.44, 0.15);
  const grassHigh = new THREE.Color(0.36, 0.54, 0.2);
  const rock = new THREE.Color(0.36, 0.36, 0.38);
  const snow = new THREE.Color(0.94, 0.96, 0.98);
  const apron = new THREE.Color(0.32, 0.31, 0.3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const wx = pos.getX(i);
    const wz = -pos.getY(i);
    const h = pos.getZ(i);
    // Slope from the height grid (rise over run).
    const gx = (heightAt(wx + 6, wz) - heightAt(wx - 6, wz)) / 12;
    const gz = (heightAt(wx, wz + 6) - heightAt(wx, wz - 6)) / 12;
    const slope = Math.hypot(gx, gz);
    // Grass, deeper and taller with height, with a little patchiness.
    // Grass owns all gentle ground up the valley sides; rock is decided
    // by steepness, not by height, so the valley reads green, not grey.
    c.copy(grassLow).lerp(grassHigh, sstep(20, 110, h));
    const vary = 0.92 + hash2(wx, wz) * 0.16;
    c.multiplyScalar(vary);
    // Sand only at the waterline itself, so the runway pad stays grass.
    c.lerp(sand, 1 - sstep(-0.5, 1.5, h));
    // Runway pad: the flat strip under runway 18 reads as a dirt/asphalt
    // apron, not a bright green causeway sticking out of the channel.
    const padX = 1 - sstep(21, 30, Math.abs(wx));
    const padOut = Math.max(190 - wz, wz - 610, 0);
    const padZ = 1 - sstep(0, 40, padOut);
    c.lerp(apron, padX * padZ * 0.9);
    // Rock is for real cliffs and high steep ground — not for the fjord
    // walls, which are steep (slope 0.5-0.9) but still green valley. A
    // slope-only rule turned the whole valley grey; height leads here,
    // and the threshold sits high so the walls stay green.
    const rockMix = Math.max(
      sstep(1.05, 1.45, slope),
      sstep(110, 160, h) * sstep(0.45, 0.7, slope),
    );
    c.lerp(rock, rockMix);
    // Snow on high, gentle ground only — steep cliffs stay rock.
    const snowMix = sstep(145, 175, h) * (1 - sstep(0.7, 1.0, slope));
    c.lerp(snow, snowMix);
    colours[i * 3] = c.r;
    colours[i * 3 + 1] = c.g;
    colours[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
}

function buildHeightfield(scene) {
  const ground = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1.0,
    metalness: 0.0,
  });
  const land = Terrain({
    heightmap(g, options) {
      TerrainNS.MultiPass(g, options, [
        { method: TerrainNS.Fault, amplitude: 1.0, frequency: 4.5 },
        { method: TerrainNS.DiamondSquare, amplitude: 0.5 },
        { method: TerrainNS.Perlin, amplitude: 0.3, frequency: 8 },
      ]);
    },
    random: createSeededRandom(12345),
    xSegments: SEG,
    ySegments: SEG,
    xSize: WORLD,
    ySize: WORLD,
    minHeight: -100,
    maxHeight: PEAK,
    frequency: 2.5,
    easing: TerrainNS.EaseInOut,
    steps: 1,
    material: ground,
    after(g, options) {
      // Runs on the raw height array before it is written back: carve the
      // fjord channel, then lay a flat pad under runway 18. Row iy maps to
      // world z from -1200 upward, column ix maps to world x the same way.
      const cols = options.xSegments + 1;
      const step = options.xSize / options.xSegments;
      for (let iy = 0; iy <= options.ySegments; iy++) {
        const wz = -options.ySize / 2 + iy * step;
        for (let ix = 0; ix <= options.xSegments; ix++) {
          const wx = -options.xSize / 2 + ix * step;
          const idx = iy * cols + ix;
          // Channel: floor at -7 near the centreline, blending out to the
          // natural height between |x| 70 and 340.
          const open = sstep(70, 340, Math.abs(wx));
          let h = -7 + open * (g[idx] + 7);
          // Runway pad: flat at height 2 over the 30 m strip (plus a
          // margin), feathered 9 m sideways and 40 m along the strip so
          // the jet can land on it instead of ditching in the channel.
          const px = 1 - sstep(21, 30, Math.abs(wx));
          const dzOut = Math.max(190 - wz, wz - 610, 0);
          const pz = 1 - sstep(0, 40, dzOut);
          const pad = px * pz;
          h = h + (2 - h) * pad;
          g[idx] = h;
        }
      }
      heightGrid = g.slice();
    },
  });
  const mesh = land.children[0];
  // Height distribution check: how much of the world sits in each band.
  if (heightGrid) {
    let lo = 0;
    let mid = 0;
    let hi = 0;
    let top = 0;
    let mn = Infinity;
    let mx = -Infinity;
    for (let i = 0; i < heightGrid.length; i++) {
      const h = heightGrid[i];
      if (h < mn) mn = h;
      if (h > mx) mx = h;
      if (h < 2) lo++;
      else if (h < 70) mid++;
      else if (h < 145) hi++;
      else top++;
    }
    const n = heightGrid.length;
    console.log(
      `[terrain] h min ${mn.toFixed(1)} max ${mx.toFixed(1)} | <2m ${((lo / n) * 100).toFixed(1)}% 2-70m ${((mid / n) * 100).toFixed(1)}% 70-145m ${((hi / n) * 100).toFixed(1)}% >145m ${((top / n) * 100).toFixed(1)}%`,
    );
  }
  paintGround(mesh.geometry);
  mesh.geometry.computeVertexNormals();
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(land);
  return mesh;
}

// ---------------------------------------------------------------------------
// Water: travelling swells, depth colour, glint, foam, current streaks
// ---------------------------------------------------------------------------

function buildWater(scene) {
  const geo = new THREE.PlaneGeometry(WORLD, WORLD, 160, 160);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const depth = new Float32Array(pos.count);
  let dMin = Infinity;
  let dMax = -Infinity;
  let dSum = 0;
  for (let i = 0; i < pos.count; i++) {
    const d = clampNum(WATER_Y - heightAt(pos.getX(i), pos.getZ(i)), 0, 12);
    depth[i] = d;
    if (d < dMin) dMin = d;
    if (d > dMax) dMax = d;
    dSum += d;
  }
  console.log(
    `[water] depth min ${dMin.toFixed(2)} max ${dMax.toFixed(2)} mean ${(dSum / pos.count).toFixed(2)}`,
  );
  geo.setAttribute('aDepth', new THREE.BufferAttribute(depth, 1));

  waterMat = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uSunDir: { value: SUN_POS.clone().normalize() },
        uCamPos: { value: new THREE.Vector3(0, 100, 0) },
      },
    ]),
    vertexShader: /* glsl */ `
      uniform float uTime;
      attribute float aDepth;
      varying float vDepth;
      varying vec3 vWorld;
      varying vec3 vNrm;
      #include <fog_pars_vertex>
      void main() {
        vDepth = aDepth;
        vec3 p = position;
        // Three swells running down the fjord (+z), each with its own
        // wavelength, speed and height. The surface is their sum.
        vec2 d1 = vec2(0.0, 1.0);
        vec2 d2 = vec2(0.7, 0.7);
        vec2 d3 = vec2(-0.6, 0.8);
        float p1 = dot(p.xz, d1) * 0.030 + uTime * 1.05;
        float p2 = dot(p.xz, d2) * 0.055 + uTime * 1.50;
        float p3 = dot(p.xz, d3) * 0.110 + uTime * 2.10;
        float h = sin(p1) * 0.24 + sin(p2) * 0.12 + sin(p3) * 0.05;
        p.y += h;
        // Analytic slopes, so the normal is exact for the displaced surface.
        float sx = 0.030 * d1.x * cos(p1) * 0.24
                 + 0.055 * d2.x * cos(p2) * 0.12
                 + 0.110 * d3.x * cos(p3) * 0.05;
        float sz = 0.030 * d1.y * cos(p1) * 0.24
                 + 0.055 * d2.y * cos(p2) * 0.12
                 + 0.110 * d3.y * cos(p3) * 0.05;
        vec3 n = normalize(vec3(-sx, 1.0, -sz));
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorld = wp.xyz;
        vNrm = normalize(mat3(modelMatrix) * n);
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uCamPos;
      varying float vDepth;
      varying vec3 vWorld;
      varying vec3 vNrm;
      #include <fog_pars_fragment>
      float hash12(vec2 p) {
        return fract(sin(dot(p, vec2(269.5, 183.3))) * 24634.6345);
      }
      float grain(vec2 p) {
        vec2 cell = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash12(cell);
        float b = hash12(cell + vec2(1.0, 0.0));
        float c = hash12(cell + vec2(0.0, 1.0));
        float d = hash12(cell + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      void main() {
        vec2 p = vWorld.xz;
        // Drifting grain roughens the normal so the sun breaks into glints.
        float g1 = grain(p * 0.08 + vec2(0.0, -uTime * 0.25));
        float g2 = grain(p * 0.22 + vec2(0.13, -uTime * 0.55));
        float g3 = grain(p * 0.55 + vec2(-0.07, -uTime * 0.90));
        vec3 N = normalize(vNrm + vec3(
          (g1 - 0.5) * 0.50 + (g2 - 0.5) * 0.30,
          0.0,
          (g2 - 0.5) * 0.42 + (g3 - 0.5) * 0.25));
        vec3 V = normalize(uCamPos - vWorld);
        // Depth tint: turquoise shallows over the banks, deep blue mid-channel.
        vec3 deep = vec3(0.02, 0.18, 0.30);
        vec3 shallow = vec3(0.16, 0.62, 0.76);
        vec3 body = mix(shallow, deep, smoothstep(0.2, 2.5, vDepth));
        // Fresnel: grazing angles mirror the warm golden-hour sky.
        float fres = pow(1.0 - max(dot(V, N), 0.0), 3.0);
        vec3 sky = vec3(0.90, 0.70, 0.50);
        vec3 col = mix(body, sky, clamp(fres * 0.40 + 0.05, 0.0, 1.0));
        // Sun glint: kept gentle so the rings and HUD text stay readable
        // against the water — a sparkle, not a white blow-out.
        vec3 R = reflect(-V, N);
        float sunDot = max(dot(R, uSunDir), 0.0);
        col += vec3(1.0, 0.95, 0.8)
             * (pow(sunDot, 600.0) * 1.1 + pow(sunDot, 60.0) * 0.12);
        float twinkle = step(0.985, hash12(floor(p * 2.0) + floor(uTime * 2.0)))
                      * pow(sunDot, 8.0);
        col += vec3(1.0, 0.95, 0.8) * twinkle * 0.25;
        // Patchy foam hugging the shore where the water is thinnest.
        float foamTex = grain(p * 0.5 + vec2(0.0, -uTime * 0.4)) * 0.6
                      + grain(p * 1.7 + vec2(0.0, -uTime * 0.7)) * 0.4;
        float foam = clamp(
          smoothstep(0.9, 0.25, vDepth) * smoothstep(0.60, 0.85, foamTex)
          + smoothstep(0.30, 0.0, vDepth) * 0.30,
          0.0, 1.0);
        col = mix(col, vec3(0.93, 0.97, 0.98), foam * 0.85);
        // Slow current streaks running down the channel.
        float drift = grain(vec2(p.x * 0.35, p.y * 0.03 - uTime * 0.12));
        col = mix(col, col * 1.08 + vec3(0.02, 0.05, 0.05),
                  smoothstep(0.6, 0.9, drift) * 0.20);
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const water = new THREE.Mesh(geo, waterMat);
  water.position.y = WATER_Y;
  scene.add(water);
}

export function tickWater(t) {
  if (!waterMat) return;
  waterMat.uniforms.uTime.value = t;
  if (!cameraRef && sceneRef) {
    cameraRef = sceneRef.children.find((c) => c.isCamera) ?? null;
  }
  if (cameraRef) waterMat.uniforms.uCamPos.value.copy(cameraRef.position);
}

// ---------------------------------------------------------------------------
// Runway 18
// ---------------------------------------------------------------------------

export function buildRunway(scene) {
  const R = CFG.runway;
  const group = new THREE.Group();
  const top = R.center[1];

  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(R.width, R.length),
    new THREE.MeshStandardMaterial({ color: 0x2e3136, roughness: 0.95, metalness: 0 }),
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(R.center[0], top + 0.06, R.center[2]);
  strip.receiveShadow = true;
  group.add(strip);

  const paint = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.9 });
  // Centreline dashes down the strip.
  const dashGeo = new THREE.PlaneGeometry(1.2, 14);
  for (let z = R.center[2] - R.length / 2 + 30; z <= R.center[2] + R.length / 2 - 30; z += 30) {
    const d = new THREE.Mesh(dashGeo, paint);
    d.rotation.x = -Math.PI / 2;
    d.position.set(R.center[0], top + 0.09, z);
    group.add(d);
  }
  // Edge lines.
  const edgeGeo = new THREE.PlaneGeometry(0.8, R.length - 16);
  for (const side of [-1, 1]) {
    const e = new THREE.Mesh(edgeGeo, paint);
    e.rotation.x = -Math.PI / 2;
    e.position.set(R.center[0] + side * (R.width / 2 - 1.2), top + 0.09, R.center[2]);
    group.add(e);
  }
  // Threshold bars at both ends.
  const barGeo = new THREE.PlaneGeometry(3, 18);
  for (const end of [-1, 1]) {
    for (let k = -2; k <= 2; k++) {
      const b = new THREE.Mesh(barGeo, paint);
      b.rotation.x = -Math.PI / 2;
      b.position.set(R.center[0] + k * 5, top + 0.09, R.center[2] + end * (R.length / 2 - 14));
      group.add(b);
    }
  }
  // PAPI: two red, two white lamps beside the approach (north) threshold,
  // each sitting on the terrain so they never float over the pad edge.
  const redLamp = new THREE.MeshStandardMaterial({
    color: 0x330000,
    emissive: 0xff2a2a,
    emissiveIntensity: 2.5,
  });
  const whiteLamp = new THREE.MeshStandardMaterial({
    color: 0x333333,
    emissive: 0xffffff,
    emissiveIntensity: 2.5,
  });
  for (let i = 0; i < 4; i++) {
    const lx = R.center[0] - R.width / 2 - 6 - i * 3.2;
    const lz = R.center[2] - R.length / 2 + 34;
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.9), i < 2 ? redLamp : whiteLamp);
    lamp.position.set(lx, heightAt(lx, lz) + 0.5, lz);
    group.add(lamp);
  }
  scene.add(group);
}

// ---------------------------------------------------------------------------
// Trees: one shared placement grid, two systems
// ---------------------------------------------------------------------------

// Forest band: gentle ground above the waterline, clear of the channel.
function forestBand(h, x /* , z */) {
  return h > 2 && h < 70 && Math.abs(x) > 80;
}

// Shore band for the willow: low ground near the water.
function shoreBand(h, x /* , z */) {
  return h > 2 && h < 22 && Math.abs(x) > 80 && Math.abs(x) < 300;
}

// Every tree, vinish or ez-tree, claims cells in this grid so the two
// systems never plant on top of each other. Cells are 16 m; each entry
// remembers its own spacing so a 14 m tree and a 12 m tree keep the wider
// of the two gaps.
const spotGrid = new Map();

function scatterSpots(count, seed, minDist, okFn, zMin, zMax) {
  const rnd = mulberry32(seed);
  const spots = [];
  let tries = 0;
  while (spots.length < count && tries < count * 60) {
    tries++;
    let x;
    if (rnd() < 0.65) {
      // Bank-biased: most trees hug the channel where the camera looks.
      const side = rnd() < 0.5 ? -1 : 1;
      x = side * (80 + 320 * rnd() * rnd());
    } else {
      x = (rnd() * 2 - 1) * 1150;
      if (Math.abs(x) < 80) continue;
    }
    const z = zMin + rnd() * (zMax - zMin);
    const h = heightAt(x, z);
    if (!okFn(h, x, z)) continue;
    // Reject steep ground: trees do not grow on cliffs.
    const gx = (heightAt(x + 6, z) - heightAt(x - 6, z)) / 12;
    const gz = (heightAt(x, z + 6) - heightAt(x, z - 6)) / 12;
    if (Math.hypot(gx, gz) > 1.0) continue;
    const cx = Math.floor(x / 16);
    const cz = Math.floor(z / 16);
    let clash = false;
    for (let dx = -1; dx <= 1 && !clash; dx++) {
      for (let dz = -1; dz <= 1 && !clash; dz++) {
        const cell = spotGrid.get(cx + dx + ',' + (cz + dz));
        if (!cell) continue;
        for (const o of cell) {
          const gap = Math.max(minDist, o.r);
          const ddx = o.x - x;
          const ddz = o.z - z;
          if (ddx * ddx + ddz * ddz < gap * gap) {
            clash = true;
            break;
          }
        }
      }
    }
    if (clash) continue;
    const key = cx + ',' + cz;
    if (!spotGrid.has(key)) spotGrid.set(key, []);
    spotGrid.get(key).push({ x, z, r: minDist });
    spots.push({
      x,
      z,
      h,
      rot: rnd() * Math.PI * 2,
      s: 0.8 + rnd() * 0.55,
      tint: 0.86 + rnd() * 0.22,
    });
  }
  return spots;
}

// One InstancedMesh per part (trunk, leaves, needles, snow...), all sharing
// the same placement list. Tilt comes from the spot index so screenshots
// stay deterministic.
function instanceParts(scene, parts, spots) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const col = new THREE.Color();
  let tris = 0;
  for (const part of parts) {
    const im = new THREE.InstancedMesh(part.geo, part.mat, spots.length);
    im.castShadow = true;
    im.receiveShadow = true;
    spots.forEach((t, i) => {
      const lean = Math.sin(i * 12.9898) * 0.03;
      const lean2 = Math.cos(i * 7.233) * 0.03;
      e.set(lean, t.rot, lean2);
      q.setFromEuler(e);
      p.set(t.x, t.h - 0.3, t.z);
      sc.set(t.s, t.s * (0.92 + ((i * 37) % 10) * 0.016), t.s);
      m.compose(p, q, sc);
      im.setMatrixAt(i, m);
      col.setRGB(t.tint, t.tint, t.tint * 0.98);
      im.setColorAt(i, col);
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    scene.add(im);
    tris += triCount(part.geo) * spots.length;
  }
  return tris;
}

// Re-render once the dust settles after a tree batch lands. Screenshot mode
// renders exactly once and never runs the loop, so without this the trees
// would load into a scene nobody ever draws again. Debounced: one render
// per quiet spell, not one per species.
function refreshSoon() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    refreshView();
  }, 1500);
}

function refreshView() {
  if (!rendererRef || !sceneRef) return;
  if (!cameraRef) cameraRef = sceneRef.children.find((c) => c.isCamera) ?? null;
  if (!cameraRef) return;
  try {
    rendererRef.render(sceneRef, cameraRef);
  } catch (err) {
    console.warn('[trees] refresh render failed: ' + err);
  }
}

// --- Cheap far-forest mass (own code) --------------------------------------
// Real trees are heavy (9-33k tris each), so a 6,500-tree forest of them
// is impossible — and at 300-800 m the ez-tree skeletons read as bare
// sticks. This layer is the mass behind them: one merged canopy blob
// (four overlapping icospheres, ~320 tris) instanced ~1,800 times over
// the hillsides, dark green, so the valley reads as continuous forest
// from the chase/valley cameras. Real trees poke through it up close.

function canopyBlobGeometry() {
  const parts = [];
  const blobs = [
    [0, 6.5, 0, 6.5],
    [-4.5, 4.5, 1.5, 5],
    [4.5, 4.5, -1.5, 5],
    [0, 8.5, 0, 4.5],
  ];
  for (const [x, y, z, r] of blobs) {
    const g = new THREE.IcosahedronGeometry(r, 1);
    g.translate(x, y, z);
    parts.push(g);
  }
  const merged = mergeGeometries(parts);
  const pos = merged.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const v = 0.85 + hash2(pos.getX(i) * 3.1, pos.getZ(i) * 2.7) * 0.3;
    col[i * 3] = 0.14 * v;
    col[i * 3 + 1] = 0.3 * v;
    col[i * 3 + 2] = 0.11 * v;
  }
  merged.setAttribute('color', new THREE.BufferAttribute(col, 3));
  merged.computeVertexNormals();
  return merged;
}

function plantFarForest(scene) {
  const geo = canopyBlobGeometry();
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1.0,
    metalness: 0.0,
    flatShading: true,
  });
  // Own placement grid (10 m cells): dense, and independent of the real
  // trees' shared grid so the mass never blocks a hero tree.
  const grid = new Map();
  const rnd = mulberry32(9101);
  const spots = [];
  let tries = 0;
  while (spots.length < 1800 && tries < 1800 * 40) {
    tries++;
    const side = rnd() < 0.5 ? -1 : 1;
    const x = side * (80 + 1000 * rnd() * rnd());
    const z = -700 + rnd() * 1600;
    const h = heightAt(x, z);
    if (h < 2 || h > 120) continue;
    const gx = (heightAt(x + 6, z) - heightAt(x - 6, z)) / 12;
    const gz = (heightAt(x, z + 6) - heightAt(x, z - 6)) / 12;
    if (Math.hypot(gx, gz) > 1.0) continue;
    const cx = Math.floor(x / 10);
    const cz = Math.floor(z / 10);
    let clash = false;
    for (let dx = -1; dx <= 1 && !clash; dx++) {
      for (let dz = -1; dz <= 1 && !clash; dz++) {
        if (grid.has(cx + dx + ',' + (cz + dz))) clash = true;
      }
    }
    if (clash) continue;
    grid.set(cx + ',' + cz, true);
    spots.push({
      x,
      z,
      h,
      rot: rnd() * Math.PI * 2,
      s: 0.9 + rnd() * 0.9,
      tint: 0.8 + rnd() * 0.35,
    });
  }
  const im = new THREE.InstancedMesh(geo, mat, spots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const col = new THREE.Color();
  spots.forEach((t, i) => {
    e.set(0, t.rot, 0);
    q.setFromEuler(e);
    p.set(t.x, t.h - 0.5, t.z);
    sc.set(t.s, t.s * 0.95, t.s);
    m.compose(p, q, sc);
    im.setMatrixAt(i, m);
    col.setRGB(t.tint, t.tint, t.tint);
    im.setColorAt(i, col);
  });
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.castShadow = true;
  im.receiveShadow = true;
  scene.add(im);
  console.log(
    `[trees] far forest: ${spots.length} blobs, ${(triCount(geo) * spots.length).toLocaleString('en-US')} tris`,
  );
}

// --- vinish.dev GLB heroes (CC BY 4.0) -------------------------------------
// Each GLB is a real-scale tree with separate trunk / leaves / needles /
// snow meshes. Every mesh is baked to world space, centred on XZ with its
// roots at y = 0, then instanced per part.

async function plantVinish(scene) {
  const loader = new GLTFLoader();
  const defs = [
    { key: 'oak', file: 'oak-tree.glb', count: 50, seed: 5101, band: forestBand },
    { key: 'pine', file: 'pine-tree.glb', count: 50, seed: 5102, band: forestBand },
    { key: 'birch', file: 'birch-tree.glb', count: 50, seed: 5103, band: forestBand },
    { key: 'willow', file: 'weeping-willow.glb', count: 50, seed: 5104, band: shoreBand },
    { key: 'spruce', file: 'snowy-spruce.glb', count: 50, seed: 5105, band: forestBand },
  ];
  for (const def of defs) {
    try {
      const gltf = await loader.loadAsync('assets/trees-vinish/' + def.file);
      const root = gltf.scene;
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      const cx = (box.min.x + box.max.x) / 2;
      const cz = (box.min.z + box.max.z) / 2;
      const base = box.min.y;
      const parts = [];
      root.traverse((o) => {
        if (!o.isMesh) return;
        if (Array.isArray(o.material)) return;
        const geo = o.geometry.clone();
        geo.applyMatrix4(o.matrixWorld);
        geo.translate(-cx, -base, -cz);
        parts.push({ geo, mat: o.material });
      });
      const spots = scatterSpots(def.count, def.seed, 14, def.band, -700, 900);
      const tris = instanceParts(scene, parts, spots);
      treeStats.vinish[def.key] = { placed: spots.length, parts: parts.length, tris };
      console.log(
        `[trees] vinish ${def.key}: ${spots.length} placed, ${parts.length} parts, ${tris.toLocaleString('en-US')} tris`,
      );
    } catch (err) {
      console.warn('[trees] vinish ' + def.key + ' failed: ' + err);
      treeStats.vinish[def.key] = { placed: 0, parts: 0, tris: 0 };
    }
    window.__combinedTrees = treeStats;
    refreshSoon();
  }
}

// --- ez-tree far forest (MIT) ----------------------------------------------
// One procedural tree per species, generated once at full detail for its
// materials, then a reduced-detail geometry pair built for instancing and
// pre-scaled to metres. Presets are used as-is: no leaf count or size
// overrides (a fuller-canopy override stalled the headless renderer).

async function plantEzTrees(scene) {
  const loader = new THREE.TextureLoader();
  async function tex(url, srgb) {
    const t = await loader.loadAsync(url);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  const defs = [
    { key: 'oak', preset: 'Oak Medium', bark: 'Bark001', leaf: 'oak', scale: 0.25, count: 160, seed: 7201 },
    { key: 'pine', preset: 'Pine Medium', bark: 'Bark003', leaf: 'pine', scale: 0.3, count: 160, seed: 7202 },
    { key: 'ash', preset: 'Ash Medium', bark: 'Bark001', leaf: 'ash', scale: 0.22, count: 160, seed: 7203 },
  ];
  for (const def of defs) {
    try {
      const leafTex = await tex('assets/ez-tree-tex/leaves/' + def.leaf + '.png', true);
      leafTex.premultiplyAlpha = true;
      const barkBase = 'assets/ez-tree-tex/bark/' + def.bark + '_1K-JPG/' + def.bark + '_1K-JPG';
      const barkColor = await tex(barkBase + '_Color.jpg', true);
      const barkNormal = await tex(barkBase + '_NormalGL.jpg', false);
      const barkRough = await tex(barkBase + '_Roughness.jpg', false);
      const tree = new Tree();
      tree.options.copy(structuredClone(TreePreset[def.preset]));
      tree.options.seed = def.seed;
      tree.options.bark.maps.color = barkColor;
      tree.options.bark.maps.normal = barkNormal;
      tree.options.bark.maps.roughness = barkRough;
      tree.options.leaves.map = leafTex;
      tree.generate();
      const low = tree.createGeometry({
        sectionStride: 2,
        segmentFactor: 0.6,
        leafStride: 1,
        leafScale: 1.5,
        billboard: 'double',
      });
      low.branches.scale(def.scale, def.scale, def.scale);
      low.leaves.scale(def.scale, def.scale, def.scale);
      const parts = [
        { geo: low.branches, mat: tree.branchesMesh.material },
        { geo: low.leaves, mat: tree.leavesMesh.material },
      ];
      const spots = scatterSpots(def.count, def.seed + 50, 12, forestBand, -700, 900);
      const tris = instanceParts(scene, parts, spots);
      const fullTris = Math.round(
        triCount(tree.branchesMesh.geometry) + triCount(tree.leavesMesh.geometry),
      );
      treeStats.ez[def.key] = { placed: spots.length, tris, fullTris };
      console.log(
        `[trees] ez ${def.key}: ${spots.length} placed, ${tris.toLocaleString('en-US')} tris (full-detail ${fullTris.toLocaleString('en-US')})`,
      );
    } catch (err) {
      console.warn('[trees] ez ' + def.key + ' failed: ' + err);
      treeStats.ez[def.key] = { placed: 0, tris: 0, fullTris: 0 };
    }
    window.__combinedTrees = treeStats;
    refreshSoon();
  }
}

// ---------------------------------------------------------------------------
// Entry point used by main.js
// ---------------------------------------------------------------------------

export function buildTerrain(scene) {
  sceneRef = scene;
  window.__heightAt = heightAt;
  buildHeightfield(scene);
  buildWater(scene);
  plantFarForest(scene);
  // Tree systems load in the background and plant themselves when ready.
  plantVinish(scene);
  plantEzTrees(scene);
}
