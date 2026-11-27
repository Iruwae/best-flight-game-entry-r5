// Ember Fjord — terrain, water, trees, rocks and runway 18.
// One height function rules everything: the mesh, the water line, where
// trees and rocks may stand, and where the jet crashes. The mesh is
// faceted (flat shading) with vertex colours, so every triangle catches
// the dusk light differently — that faceting IS the texture.

import * as THREE from 'three';
import { CFG } from './config.js';
import { fbm, hash2, mulberry32 } from './random.js';

const T = CFG.terrain;

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function smooth01(a, b, v) {
  return clamp01((v - a) / (b - a));
}

// Distance outside a rectangle (0 inside, growing outside).
function rectOutside(x, z, r) {
  const dx = Math.max(r.x0 - x, 0, x - r.x1);
  const dz = Math.max(r.z0 - z, 0, z - r.z1);
  return Math.hypot(dx, dz);
}

// Fjord channel centre x at a given z (a slow bend through the valley).
export function fjordCenter(z) {
  return T.fjord.bend * Math.sin(z * T.fjord.bendFreq);
}

export function heightAt(x, z) {
  let h = Math.pow(fbm(x * 0.0016, z * 0.0016, 7), 1.7) * T.peakHeight;
  h += (fbm(x * 0.008, z * 0.008, 21) - 0.5) * 22;
  // Valley floor: blend down to flat inside the valley rectangle.
  const outside = rectOutside(x, z, T.valley);
  const blend = smooth01(0, 200, outside);
  const smooth = smooth01(0, 1, blend);
  h = T.valley.floor + (h - T.valley.floor) * smooth * smooth * (3 - 2 * smooth);
  // Fjord channel: carve down to water through valley and mountains.
  const dist = Math.abs(x - fjordCenter(z));
  const carve = 1 - smooth01(T.fjord.width * 0.35, T.fjord.width, dist);
  if (carve > 0) h = h + (T.fjord.depth - h) * carve;
  return h;
}

function slopeAt(x, z) {
  const e = 6;
  const dx = heightAt(x + e, z) - heightAt(x - e, z);
  const dz = heightAt(x, z + e) - heightAt(x, z - e);
  return Math.hypot(dx, dz) / (2 * e);
}

function fieldColor(x, z) {
  const cell = Math.floor(x / T.fieldSize) + Math.floor(z / T.fieldSize);
  const pick = hash2(Math.floor(x / T.fieldSize), Math.floor(z / T.fieldSize), 5);
  if (pick < 0.12) return [0.62, 0.55, 0.30];
  return cell % 2 === 0 ? [0.42, 0.60, 0.28] : [0.34, 0.52, 0.24];
}

function vertexColor(x, z, h) {
  const slope = slopeAt(x, z);
  const jitter = 0.92 + hash2(Math.floor(x / 3), Math.floor(z / 3), 11) * 0.16;
  let c;
  if (h < CFG.world.waterLevel + 1.5) {
    c = [0.76, 0.66, 0.47];
  } else if (h > T.snowLine) {
    c = [0.94, 0.96, 1.0];
  } else if (slope > 0.55 || h > T.rockLine) {
    c = [0.48, 0.42, 0.35];
  } else if (h < T.rockLine && rectOutside(x, z, T.valley) < 40) {
    c = fieldColor(x, z);
  } else {
    c = [0.38, 0.48, 0.27];
  }
  return [c[0] * jitter, c[1] * jitter, c[2] * jitter];
}

export function buildTerrain(scene) {
  const size = CFG.world.size;
  const geo = new THREE.PlaneGeometry(size, size, T.segments, T.segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const c = vertexColor(x, z, h);
    colors[i * 3] = c[0];
    colors[i * 3 + 1] = c[1];
    colors[i * 3 + 2] = c[2];
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const flat = geo.toNonIndexed();
  flat.computeVertexNormals();
  const mesh = new THREE.Mesh(
    flat,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.95,
      metalness: 0,
    }),
  );
  mesh.receiveShadow = true;
  scene.add(mesh);

  // Fjord water: one sheet at water level, visible only in the channel.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshStandardMaterial({
      color: 0x3a7aa0,
      metalness: 0.3,
      roughness: 0.35,
      transparent: true,
      opacity: 0.88,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = CFG.world.waterLevel;
  water.receiveShadow = true;
  scene.add(water);

  plantTrees(scene);
  scatterRocks(scene);
  return mesh;
}

function plantTrees(scene) {
  const rng = mulberry32(41);
  const cone = new THREE.ConeGeometry(3.2, 10, 7);
  const trunk = new THREE.CylinderGeometry(0.55, 0.8, 3.4, 6);
  const leafMat = new THREE.MeshStandardMaterial({
    flatShading: true,
    roughness: 0.9,
  });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3220, roughness: 1 });
  const leaves = new THREE.InstancedMesh(cone, leafMat, T.treeCount);
  const trunks = new THREE.InstancedMesh(trunk, trunkMat, T.treeCount);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const col = new THREE.Color();
  let placed = 0;
  let guard = 0;
  while (placed < T.treeCount && guard++ < 6000) {
    const x = (rng() * 2 - 1) * CFG.world.half * 0.92;
    const z = (rng() * 2 - 1) * CFG.world.half * 0.92;
    const h = heightAt(x, z);
    if (h < 3 || h > 52) continue;
    if (Math.abs(x - CFG.runway.center[0]) < 45 && Math.abs(z - CFG.runway.center[2]) < 260) continue;
    if (Math.abs(x - fjordCenter(z)) < T.fjord.width * 0.7) continue;
    const s = 0.7 + rng() * 0.9;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * Math.PI * 2);
    sc.set(s, s * (0.9 + rng() * 0.4), s);
    m.compose(new THREE.Vector3(x, h + 7.5 * sc.y, z), q, sc);
    leaves.setMatrixAt(placed, m);
    col.setHSL(0.33 + rng() * 0.05, 0.5, 0.26 + rng() * 0.12);
    leaves.setColorAt(placed, col);
    m.compose(new THREE.Vector3(x, h + 1.6 * sc.y, z), q, sc);
    trunks.setMatrixAt(placed, m);
    placed++;
  }
  leaves.count = placed;
  trunks.count = placed;
  leaves.castShadow = true;
  scene.add(leaves);
  scene.add(trunks);
}

function scatterRocks(scene) {
  const rng = mulberry32(97);
  const geo = new THREE.DodecahedronGeometry(2.4, 0);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x6a625a,
    flatShading: true,
    roughness: 1,
  });
  const rocks = new THREE.InstancedMesh(geo, mat, T.rockCount);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  let placed = 0;
  let guard = 0;
  while (placed < T.rockCount && guard++ < 4000) {
    const x = (rng() * 2 - 1) * CFG.world.half * 0.9;
    const z = (rng() * 2 - 1) * CFG.world.half * 0.9;
    const h = heightAt(x, z);
    if (h < 4 || h > 130) continue;
    const s = 0.6 + rng() * 1.8;
    e.set(rng() * 3, rng() * 3, rng() * 3);
    q.setFromEuler(e);
    m.compose(
      new THREE.Vector3(x, h + 0.6 * s, z),
      q,
      new THREE.Vector3(s, s * 0.7, s),
    );
    rocks.setMatrixAt(placed, m);
    placed++;
  }
  rocks.count = placed;
  rocks.castShadow = true;
  scene.add(rocks);
}

function runwayTopTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = '#23262c';
  g.fillRect(0, 0, 256, 1024);
  g.fillStyle = '#f2f2ee';
  // Threshold bars at both ends.
  for (let i = 0; i < 4; i++) {
    g.fillRect(28 + i * 52, 26, 28, 64);
    g.fillRect(28 + i * 52, 934, 28, 64);
  }
  // Centreline dashes.
  for (let y = 130; y < 900; y += 64) g.fillRect(122, y, 12, 36);
  // Runway numbers.
  g.font = 'bold 92px sans-serif';
  g.textAlign = 'center';
  g.fillText('18', 128, 210);
  g.save();
  g.translate(128, 830);
  g.rotate(Math.PI);
  g.fillText('36', 0, 0);
  g.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function buildRunway(scene) {
  const R = CFG.runway;
  const group = new THREE.Group();
  group.position.set(R.center[0], R.center[1], R.center[2]);
  group.rotation.y = R.heading;
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(R.width, 0.5, R.length),
    new THREE.MeshStandardMaterial({ color: 0x23262c, roughness: 0.9 }),
  );
  strip.receiveShadow = true;
  group.add(strip);
  const top = new THREE.Mesh(
    new THREE.PlaneGeometry(R.width, R.length),
    new THREE.MeshStandardMaterial({ map: runwayTopTexture(), roughness: 0.85 }),
  );
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.28;
  top.receiveShadow = true;
  group.add(top);
  // Edge lights down both sides.
  const lightGeo = new THREE.SphereGeometry(0.7, 8, 6);
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xbfe8ff,
    emissive: 0x9fd8ff,
    emissiveIntensity: 2.2,
  });
  for (let z = -R.length / 2 + 12; z <= R.length / 2 - 12; z += 34) {
    for (const x of [-R.width / 2 - 2, R.width / 2 + 2]) {
      const l = new THREE.Mesh(lightGeo, lightMat);
      l.position.set(x, 0.8, z);
      group.add(l);
    }
  }
  // PAPI: two red, two white at the 18 threshold (north end, left side).
  const papiRed = new THREE.MeshStandardMaterial({
    color: 0x881111,
    emissive: 0xff2a1a,
    emissiveIntensity: 2.6,
  });
  const papiWhite = new THREE.MeshStandardMaterial({
    color: 0xdddddd,
    emissive: 0xffffff,
    emissiveIntensity: 2.6,
  });
  for (let i = 0; i < 4; i++) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 1.1), i < 2 ? papiRed : papiWhite);
    box.position.set(-R.width / 2 - 14 - i * 4.5, 1.0, -R.length / 2 + 26);
    group.add(box);
  }
  scene.add(group);
  return group;
}
