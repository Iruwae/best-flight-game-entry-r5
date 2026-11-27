// Ember Fjord — the jet, as the real F-35 GLB model.
// Loads the low-poly F-35 by S1Priv (Sketchfab, CC BY 4.0) at runtime,
// dresses it in low-visibility gray with the gold canopy, hides the
// loose missile / landing gear / slivers, and adds the afterburner the
// model lacks. Nose forward (-Z), tail at +Z, length 15.2 m, so the
// flight model, cameras, rings and runway keep working exactly as
// before. The group exists immediately; the model pops in when the GLB
// resolves, and userData.ready resolves then (screenshots wait on it).

import * as THREE from 'three';
import { GLTFLoader } from '../vendor/GLTFLoader.min.js';
import { CFG } from './config.js';

const J = CFG.jet;
const LENGTH = J.length; // 15.2 m, nose (-Z) to tail (+Z)

// Inside the GLB there is one mesh with 11 primitives; the loader names
// them A_F35, A_F35_1 ... A_F35_10 in primitive order.
const HIDE = new Set(['A_F35', 'A_F35_5', 'A_F35_8', 'A_F35_9', 'A_F35_10']); // missile, gear, slivers
const GOLD = new Set(['A_F35_1', 'A_F35_2']); // canopy dome + windscreen

function glowSprite(color, scale) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255, 240, 200, 1)');
  grad.addColorStop(0.3, color);
  grad.addColorStop(1, 'rgba(255, 90, 0, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    }),
  );
  sp.scale.set(scale, scale, 1);
  return sp;
}

function sstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

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

// ---------- Have-Glass panel texture (ported from the approved viewer) ----------
// One shared panel layout drives the colour map (seams + rivets +
// mottling) and the roughness map (per-panel gloss variation). Seeded,
// so the paint is identical on every load.
function buildPanelLayout(rng) {
  const S = 1024;
  const cells = [];
  const vseams = [], hseams = [];
  let x = 0;
  while (x < S) { const w = 140 + rng() * 120; vseams.push(x); cells.push({ x, w }); x += w; }
  vseams.push(S);
  let y = 0;
  const rows = [];
  while (y < S) { const h = 140 + rng() * 120; hseams.push(y); rows.push({ y, h }); y += h; }
  hseams.push(S);
  const panels = [];
  for (const cx of cells) for (const ry of rows) {
    panels.push({ x: cx.x, y: ry.y, w: cx.w, h: ry.h, tone: 0.35 + rng() * 0.30 });
  }
  return { S, panels, vseams, hseams };
}

function drawPanelMap(layout, rng) {
  const { S, panels, vseams, hseams } = layout;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, S, S);
  // Large soft weathering blotches (very subtle).
  for (let i = 0; i < 26; i++) {
    const bx = rng() * S, by = rng() * S, br = 90 + rng() * 180;
    const rg = g.createRadialGradient(bx, by, 0, bx, by, br);
    const dark = rng() < 0.5;
    rg.addColorStop(0, dark ? 'rgba(200,200,200,0.10)' : 'rgba(255,255,255,0.10)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.fillRect(bx - br, by - br, br * 2, br * 2);
  }
  // Per-panel faint tonal patches.
  for (const p of panels) {
    g.fillStyle = 'rgba(225,225,225,0.16)';
    if (rng() < 0.5) g.fillRect(p.x + 2, p.y + 2, p.w - 4, p.h - 4);
  }
  // Panel seams: dark core + light edge highlight (reads as a real seam).
  // Slightly heavier than the viewer (4px) so the seams stand a chance
  // at screenshot distance.
  g.lineCap = 'round';
  for (const x of vseams) {
    g.strokeStyle = 'rgba(28,30,34,0.45)'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, S); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.30)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x + 4, 0); g.lineTo(x + 4, S); g.stroke();
  }
  for (const y of hseams) {
    g.strokeStyle = 'rgba(28,30,34,0.45)'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.30)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, y + 4); g.lineTo(S, y + 4); g.stroke();
  }
  // Rivets along seams.
  g.fillStyle = 'rgba(35,37,41,0.40)';
  for (const x of vseams) for (let y = 12; y < S; y += 26) { g.beginPath(); g.arc(x, y, 1.4, 0, 7); g.fill(); }
  for (const y of hseams) for (let x = 12; x < S; x += 26) { g.beginPath(); g.arc(x, y, 1.4, 0, 7); g.fill(); }
  // A few small access panels with corner fasteners.
  for (let i = 0; i < 10; i++) {
    const ax = 40 + rng() * (S - 160), ay = 40 + rng() * (S - 160), aw = 46 + rng() * 40, ah = 34 + rng() * 30;
    g.strokeStyle = 'rgba(28,30,34,0.55)'; g.lineWidth = 3;
    g.strokeRect(ax, ay, aw, ah);
    g.fillStyle = 'rgba(35,37,41,0.6)';
    for (const [fx, fy] of [[ax + 6, ay + 6], [ax + aw - 6, ay + 6], [ax + 6, ay + ah - 6], [ax + aw - 6, ay + ah - 6]]) {
      g.beginPath(); g.arc(fx, fy, 2.2, 0, 7); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function drawRoughMap(layout) {
  const { S, panels, vseams, hseams } = layout;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#8c8c8c'; g.fillRect(0, 0, S, S); // ~0.55 base
  for (const p of panels) {
    const v = Math.round(p.tone * 255);
    g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
    g.fillRect(p.x + 1, p.y + 1, p.w - 2, p.h - 2);
  }
  g.strokeStyle = '#b4b4b4'; g.lineWidth = 5;
  for (const x of vseams) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, S); g.stroke(); }
  for (const y of hseams) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

const panelLayout = buildPanelLayout(mulberry32(1337));
const panelMap = drawPanelMap(panelLayout, mulberry32(4242));
const roughMap = drawRoughMap(panelLayout);

// Box-projected UVs from world position + normal (one texture tile per
// 4 world units, in wrap space = game metres). The normal is rotated
// into world space so the chosen projection plane matches the face.
const PAINT_TILE = 4.0;
function boxProjectUVs(mesh) {
  const geo = mesh.geometry;
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const nm = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  const uv = new Float32Array(pos.count * 2);
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    mesh.localToWorld(v);
    n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    let u, w;
    if (ax >= ay && ax >= az) { u = v.z; w = v.y; }
    else if (ay >= ax && ay >= az) { u = v.x; w = v.z; }
    else { u = v.x; w = v.y; }
    uv[i * 2] = u / PAINT_TILE;
    uv[i * 2 + 1] = w / PAINT_TILE;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// Tiny equirect environment for the jet's metals: cool blue sky above,
// warm gold horizon band, dark ground below. MeshStandard/Physical
// metals have nothing to reflect without an env map (the game sets no
// scene.environment), so this is what keeps the 0.55-metalness paint
// reading as gray instead of going dark — and the cool sky reflection
// is what keeps it gray instead of warm tan under the golden sun.
function jetEnvTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 32;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 32);
  grad.addColorStop(0.0, '#3a5a9a'); // cool blue zenith
  grad.addColorStop(0.42, '#7a9ac8'); // pale blue
  grad.addColorStop(0.5, '#ffd9a0'); // warm gold horizon
  grad.addColorStop(0.58, '#8a6a4a'); // warm ground haze
  grad.addColorStop(1.0, '#2a241c'); // dark ground
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 32);
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const jetEnv = jetEnvTexture();

// Main airframe: the approved Have-Glass paint — procedural panel
// seams + rivets over a soft two-tone (light top, mid sides, dark
// belly, darker wing tips) with a heat-tinted nozzle at the tail.
// Coordinates are normalized against the geometry's own bounding box
// (model +X is the nose, +Y is up, +Z is the span).
function paintAirframe(mesh) {
  const geo = mesh.geometry;
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const bs = new THREE.Vector3();
  bb.getSize(bs);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  const cTop = new THREE.Color(0xa9adb3);    // light gray, upper surfaces
  const cSide = new THREE.Color(0x878c93);   // mid gray, sides
  const cBelly = new THREE.Color(0x767b82);  // dark gray, belly
  const cWing = new THREE.Color(0x767b82);
  const cNozzle = new THREE.Color(0x2b2e33); // dark metallic exhaust
  const cBlue = new THREE.Color(0x3a4a6b);   // heat-tint blue
  const cPurple = new THREE.Color(0x4a3a55); // heat-tint purple
  const cBrown = new THREE.Color(0x6b4a2f);  // heat-tint brown
  const c = new THREE.Color(), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const nx = (v.x - bb.min.x) / bs.x; // 0 tail -> 1 nose
    const ny = (v.y - bb.min.y) / bs.y; // 0 belly -> 1 top
    const nz = (v.z - bb.min.z) / bs.z; // 0 one tip -> 1 other tip
    // Soft two-tone: belly -> side -> top (no hard camo lines).
    c.copy(cBelly).lerp(cSide, sstep(0.22, 0.42, ny));
    c.lerp(cTop, sstep(0.55, 0.72, ny));
    // Wing tips slightly darker.
    if (nz < 0.20 || nz > 0.80) c.lerp(cWing, 0.55);
    // Nozzle: dark metal with heat-tint bands near the tail.
    if (nx < 0.12 && Math.abs(nz - 0.5) < 0.16 && ny > 0.32 && ny < 0.68) {
      const d = (0.12 - nx) / 0.12; // 1 at the very tail
      const band = 0.5 + 0.5 * Math.sin(nx * 260);
      const band2 = 0.5 + 0.5 * Math.sin(nx * 173 + 1.7);
      tmp.copy(cNozzle);
      tmp.lerp(cBlue, band * 0.55 * d);
      tmp.lerp(cPurple, band2 * 0.45 * d);
      tmp.lerp(cBrown, (1 - band) * 0.35 * d);
      c.lerp(tmp, Math.min(1, d * 1.6));
    }
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  boxProjectUVs(mesh);
  mesh.material = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    map: panelMap,
    roughnessMap: roughMap,
    roughness: 1.0,
    metalness: 0.55,
    clearcoat: 0.3,
    clearcoatRoughness: 0.35,
    envMap: jetEnv,
    envMapIntensity: 0.9,
  });
}

export function buildJet() {
  const jet = new THREE.Group();
  const canopyMeshes = [];

  // Afterburner: the GLB has no flame, so it is built here, same
  // shape as before — a cone flame + core + glow sprite + point light
  // at the tail. Created up front so setAfterburner works even before
  // the GLB resolves (flight.step calls it every frame).
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.38, 1.8, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: J.afterburner.mid,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  flame.rotation.x = Math.PI / 2;
  flame.position.set(0, 0, LENGTH / 2 + 1.5);
  jet.add(flame);
  const flameCore = new THREE.Mesh(
    new THREE.ConeGeometry(0.2, 1.2, 20, 1, true),
    new THREE.MeshBasicMaterial({
      color: J.afterburner.core,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  flameCore.rotation.x = Math.PI / 2;
  flameCore.position.set(0, 0, LENGTH / 2 + 1.2);
  jet.add(flameCore);
  const glow = glowSprite('rgba(255, 140, 40, 0.9)', 2.2);
  glow.position.set(0, 0, LENGTH / 2 + 0.9);
  jet.add(glow);
  const light = new THREE.PointLight(0xff7a1a, 1.6, 30, 1.8);
  light.position.set(0, 0, LENGTH / 2 + 2.0);
  jet.add(light);

  // Throttle 0..1 drives flame size, glow and light.
  function setAfterburner(level) {
    const l = Math.max(0.15, Math.min(1, level));
    flame.scale.set(1, 1, 0.45 + l * 0.85);
    flameCore.scale.set(1, 1, 0.4 + l * 0.9);
    flame.material.opacity = 0.3 + l * 0.5;
    glow.material.opacity = 0.2 + l * 0.7;
    light.intensity = 0.3 + l * 2.6;
  }
  setAfterburner(0.8);
  jet.userData.setAfterburner = setAfterburner;

  // Cockpit view hides the gold canopy so the panel stays clear.
  jet.userData.setCanopyVisible = (v) => {
    for (const m of canopyMeshes) m.visible = v;
  };

  let readyResolve;
  const ready = new Promise((r) => {
    readyResolve = r;
  });
  jet.userData.ready = ready;

  const goldMat = new THREE.MeshPhysicalMaterial({
    color: 0xd4af37,
    metalness: 0.9,
    roughness: 0.08,
    transparent: true,
    opacity: 0.92,
    emissive: 0x4a3400,
    emissiveIntensity: 0.4,
    envMap: jetEnv,
    envMapIntensity: 1.5,
    clearcoat: 0.6,
    clearcoatRoughness: 0.1,
  });
  const stripMat = new THREE.MeshStandardMaterial({
    color: 0x5d6167,
    roughness: 0.5,
    metalness: 0.45,
    envMap: jetEnv,
    envMapIntensity: 0.7,
  });
  const detailMat = new THREE.MeshStandardMaterial({
    color: 0x777c83,
    roughness: 0.5,
    metalness: 0.45,
    envMap: jetEnv,
    envMapIntensity: 0.7,
  });

  new GLTFLoader().load(
    'assets/f35-model.glb',
    (g) => {
      const obj = g.scene;
      // The model is tiny (~0.10 m long, nose +X, tail -X, up +Y).
      // Scale it to the game's 15.2 m length, rotate the nose to -Z,
      // and centre it on the jet origin inside a detached wrapper so
      // the centering math stays in local space.
      const raw = new THREE.Box3().setFromObject(obj);
      const rawSize = raw.getSize(new THREE.Vector3());
      const s = LENGTH / rawSize.x;
      const wrap = new THREE.Group();
      wrap.add(obj);
      obj.rotation.y = Math.PI / 2; // nose +X -> -Z
      obj.scale.setScalar(s);
      wrap.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(wrap);
      const center = box.getCenter(new THREE.Vector3());
      obj.position.sub(center);
      jet.add(wrap);
      // Refresh world matrices after centering: boxProjectUVs projects
      // through mesh.localToWorld, which needs current matrices.
      obj.updateMatrixWorld(true);

      obj.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        if (HIDE.has(o.name)) {
          o.visible = false;
          return;
        }
        if (GOLD.has(o.name)) {
          o.material = goldMat;
          canopyMeshes.push(o);
          return;
        }
        if (o.name === 'A_F35_3') {
          paintAirframe(o);
          return;
        }
        if (o.name === 'A_F35_6') {
          o.material = stripMat;
          return;
        }
        o.material = detailMat;
      });

      // Wingtip nav lights at the real tips: red port, green starboard.
      const span = box.getSize(new THREE.Vector3()).x;
      const tipLights = [
        [0xff2a2a, -span / 2 + 0.1, 0, 1.2],
        [0x2aff5a, span / 2 - 0.1, 0, 1.2],
        [0xffffff, 0, 0.1, LENGTH / 2 + 0.9],
      ];
      for (const [c, x, y, z] of tipLights) {
        const l = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 12, 8),
          new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 3 }),
        );
        l.position.set(x, y, z);
        jet.add(l);
      }

      readyResolve();
    },
    undefined,
    (e) => {
      console.error('F-35 GLB failed to load', e);
      readyResolve(); // never block the game or a screenshot on the model
    },
  );

  return jet;
}
