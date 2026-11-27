// Ember Fjord — the jet.
// One full-span swept wing (a single shape, so it can never end up on one
// side only), twin canted fins, a bubble canopy, and an afterburner that
// actually glows. White fuselage, orange wings and tail, navy intakes:
// the livery is the accent colour against the dusk valley.

import * as THREE from 'three';
import { CFG } from './config.js';

const J = CFG.jet;

function std(color, rough = 0.55, metal = 0.25) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}

function wingShape(span, rootLead, tipLead, rootTrail, tipTrail) {
  const s = new THREE.Shape();
  const h = span / 2;
  s.moveTo(-h, tipLead);
  s.lineTo(0, rootLead);
  s.lineTo(h, tipLead);
  s.lineTo(h, tipTrail);
  s.lineTo(0, rootTrail);
  s.lineTo(-h, tipTrail);
  s.closePath();
  return s;
}

function extrudeFlat(shape, thick, mat) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thick,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.08,
    bevelSegments: 1,
  });
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}

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

export function buildJet() {
  const jet = new THREE.Group();
  const white = std(J.bodyColor, 0.42, 0.35);
  const orange = std(J.orange, 0.5, 0.2);
  const navy = std(J.navy, 0.5, 0.4);
  const dark = std(0x14161c, 0.6, 0.6);

  // Fuselage: lathed profile, nose forward (-Z), tail at +Z.
  const profile = [
    [0.06, 0],
    [0.42, 0.9],
    [0.72, 2.2],
    [0.88, 3.6],
    [0.86, 6.0],
    [0.78, 9.0],
    [0.62, 12.0],
    [0.48, 14.2],
    [0.42, 15.2],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const bodyGeo = new THREE.LatheGeometry(profile, 20);
  bodyGeo.rotateX(Math.PI / 2);
  bodyGeo.translate(0, 0, -J.length / 2);
  const body = new THREE.Mesh(bodyGeo, white);
  body.castShadow = true;
  jet.add(body);

  // Orange nose tip + orange band behind the canopy.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.46, 1.4, 16), orange);
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, 0, -J.length / 2 - 0.4);
  nose.castShadow = true;
  jet.add(nose);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.9, 20), orange);
  band.rotation.x = Math.PI / 2;
  band.position.set(0, 0.05, -1.6);
  jet.add(band);

  // Bubble canopy: dark glass.
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(1, 20, 14),
    new THREE.MeshStandardMaterial({
      color: J.glassColor,
      metalness: J.glassMetal,
      roughness: J.glassRough,
    }),
  );
  canopy.scale.set(0.78, 0.62, 1.9);
  canopy.position.set(0, 0.72, -2.9);
  canopy.castShadow = true;
  jet.add(canopy);

  // One full-span swept wing, orange.
  const wing = extrudeFlat(
    wingShape(J.span, -1.6, 2.4, 2.2, 3.7),
    0.26,
    orange,
  );
  wing.position.set(0, -0.05, -0.6);
  jet.add(wing);

  // Horizontal stabilators at the tail, orange, slight dihedral.
  const stab = extrudeFlat(wingShape(4.6, 5.6, 6.6, 7.4, 7.9), 0.2, orange);
  stab.position.set(0, 0.28, 0);
  stab.rotation.z = 0.1;
  jet.add(stab);

  // Twin vertical fins, canted outward, navy with orange tips.
  for (const side of [-1, 1]) {
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.lineTo(2.6, 0.35);
    finShape.lineTo(2.2, 2.4);
    finShape.lineTo(0.9, 2.1);
    finShape.closePath();
    const finGeo = new THREE.ExtrudeGeometry(finShape, {
      depth: 0.2,
      bevelEnabled: false,
    });
    const fin = new THREE.Mesh(finGeo, navy);
    fin.castShadow = true;
    // Shape is in XY (x = chord back, y = height); stand it in the YZ plane.
    fin.rotation.y = Math.PI / 2;
    fin.rotation.z = side * -0.32;
    fin.position.set(side * 0.85, 0.55, 4.6);
    jet.add(fin);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.5, 1.1), orange);
    tip.position.set(side * 1.55, 2.55, 5.6);
    tip.rotation.z = side * -0.32;
    jet.add(tip);
  }

  // Intakes: dark boxes under the wing roots.
  for (const side of [-1, 1]) {
    const intake = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.95, 3.1), dark);
    intake.position.set(side * 1.05, -0.28, -0.4);
    intake.castShadow = true;
    jet.add(intake);
  }

  // Afterburner: nozzle, flame cone, glow sprite and a point light.
  const nozzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.52, 0.62, 1.3, 16),
    std(0x2a2d33, 0.35, 0.8),
  );
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.set(0, 0, J.length / 2 + 0.4);
  jet.add(nozzle);
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.52, 3.6, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: J.afterburner.mid,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  flame.rotation.x = Math.PI / 2;
  flame.position.set(0, 0, J.length / 2 + 2.6);
  jet.add(flame);
  const flameCore = new THREE.Mesh(
    new THREE.ConeGeometry(0.26, 2.4, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: J.afterburner.core,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  flameCore.rotation.x = Math.PI / 2;
  flameCore.position.set(0, 0, J.length / 2 + 2.0);
  jet.add(flameCore);
  const glow = glowSprite('rgba(255, 140, 40, 0.9)', 5.5);
  glow.position.set(0, 0, J.length / 2 + 1.6);
  jet.add(glow);
  const light = new THREE.PointLight(0xff7a1a, 2.5, 34, 1.8);
  light.position.set(0, 0, J.length / 2 + 2.5);
  jet.add(light);

  // Wingtip lights: red port, green starboard, white tail.
  const tipLights = [
    [0xff2a2a, -J.span / 2, 0, 1.2],
    [0x2aff5a, J.span / 2, 0, 1.2],
    [0xffffff, 0, 0.1, J.length / 2 + 0.9],
  ];
  for (const [c, x, y, z] of tipLights) {
    const l = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 6),
      new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 3 }),
    );
    l.position.set(x, y, z);
    jet.add(l);
  }

  jet.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });

  // Throttle 0..1 drives flame size, glow and light.
  function setAfterburner(level) {
    const l = Math.max(0.15, Math.min(1, level));
    flame.scale.set(1, 1, 0.45 + l * 0.85);
    flameCore.scale.set(1, 1, 0.4 + l * 0.9);
    flame.material.opacity = 0.35 + l * 0.55;
    glow.material.opacity = 0.25 + l * 0.75;
    light.intensity = 0.4 + l * 3.2;
  }
  setAfterburner(0.8);

  jet.userData.setAfterburner = setAfterburner;
  return jet;
}
