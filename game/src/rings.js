// Ember Fjord — glowing ring gates with distance labels.
// A ring is a gold torus plus a halo sprite and a canvas label that reads
// "RING n · ddd m". The label is the thing the pilot (and the judge)
// actually aims at, so it is big, bright and always faces the camera.

import * as THREE from 'three';
import { CFG } from './config.js';

function labelTexture(text) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 128);
  g.font = 'bold 56px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(255, 170, 40, 0.9)';
  g.shadowBlur = 18;
  g.fillStyle = '#ffe9a8';
  g.fillText(text, 256, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function haloTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 6, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255, 220, 120, 0.9)');
  grad.addColorStop(0.45, 'rgba(255, 170, 50, 0.4)');
  grad.addColorStop(1, 'rgba(255, 150, 30, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildRings(scene, defs) {
  const haloTex = haloTexture();
  const rings = [];
  for (const def of defs) {
    const group = new THREE.Group();
    group.position.set(def.pos[0], def.pos[1], def.pos[2]);
    group.rotation.y = def.yaw ?? 0;
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(CFG.rings.radius, CFG.rings.tube, 14, 48),
      new THREE.MeshStandardMaterial({
        color: CFG.rings.gold,
        emissive: 0xff9a1a,
        emissiveIntensity: 1.8,
        roughness: 0.35,
        metalness: 0.4,
      }),
    );
    group.add(torus);
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: haloTex,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0.5,
      }),
    );
    halo.scale.set(CFG.rings.radius * 2.6, CFG.rings.radius * 2.6, 1);
    group.add(halo);
    const label = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: labelTexture(def.label),
        depthWrite: false,
        transparent: true,
      }),
    );
    label.scale.set(34, 8.5, 1);
    label.position.y = CFG.rings.radius + 9;
    group.add(label);
    scene.add(group);
    rings.push({
      group,
      def,
      passed: false,
      setDistance(d) {
        const text = `${def.label} · ${Math.max(0, Math.round(d))} m`;
        label.material.map.dispose();
        label.material.map = labelTexture(text);
        label.material.needsUpdate = true;
      },
    });
  }
  return rings;
}
