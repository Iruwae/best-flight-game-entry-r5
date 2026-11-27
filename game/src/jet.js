// Ember Fjord — the jet, rebuilt as an F-35 Lightning II.
// Gray low-visibility stealth paint, a faceted chined fuselage lofted
// from diamond cross-sections, twin canted tails, swept trapezoidal
// wings, a big gold bubble canopy, caret intakes and one round nozzle.
// The shape reads as a real stealth fighter, not a toy: the livery is
// matte gray against the dusk valley, with the gold canopy as the one
// warm accent. Nose forward (-Z), tail at +Z; span and length come
// from CFG.jet so the flight model and cameras keep working.

import * as THREE from 'three';
import { CFG } from './config.js';

const J = CFG.jet;

function std(color, rough = 0.6, metal = 0.35, flat = false) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: rough,
    metalness: metal,
    flatShading: flat,
  });
}

// One full-span wing planform, drawn as a single shape so the two
// sides can never disagree. x is span (half-span each way), y is the
// chord direction: the shape is later rotated flat.
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
    bevelSegments: 2,
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

// Faceted stealth fuselage: a loft of diamond (chined) cross-sections.
// Each station gives a half-width and a top/bottom height; the section
// is an 8-point ring (top, upper side, chine, lower side, bottom and
// mirrors) so the body has flat angled sides like a real stealth jet,
// never a round tube. Stations run nose (-Z) to tail (+Z).
function loftFuselage(stations, mat) {
  const ring = (st) => {
    const w = st.w;
    const t = st.top;
    const b = st.bot;
    return [
      [0, t],
      [w * 0.82, t * 0.62],
      [w, 0.05],
      [w * 0.78, b * 0.72],
      [0, b],
      [-w * 0.78, b * 0.72],
      [-w, 0.05],
      [-w * 0.82, t * 0.62],
    ];
  };
  const pos = [];
  const rings = stations.map((st) => ring(st));
  for (let i = 0; i < stations.length - 1; i++) {
    const a = rings[i];
    const b = rings[i + 1];
    const za = stations[i].z;
    const zb = stations[i + 1].z;
    for (let k = 0; k < 8; k++) {
      const k2 = (k + 1) % 8;
      // Two triangles per quad, wound so the faces point outward.
      pos.push(a[k][0], a[k][1], za, b[k][0], b[k][1], zb, b[k2][0], b[k2][1], zb);
      pos.push(a[k][0], a[k][1], za, b[k2][0], b[k2][1], zb, a[k2][0], a[k2][1], za);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}

export function buildJet() {
  const jet = new THREE.Group();
  const gray = std(J.bodyColor, 0.62, 0.3, true);
  gray.side = THREE.DoubleSide;
  const wingGray = std(J.wingColor, 0.6, 0.32, true);
  const tailGray = std(J.tailColor, 0.58, 0.35, true);
  const dark = std(J.intakeColor, 0.5, 0.55);
  const nozzleMat = std(0x23262b, 0.35, 0.85);

  // Fuselage: pointed chined nose, blended wide mid-body, tapered tail.
  // z is nose (-7.6) to tail (+7.6); w is half-width, top/bot are heights.
  const stations = [
    { z: -7.6, w: 0.01, top: 0.01, bot: -0.01 },
    { z: -7.0, w: 0.10, top: 0.10, bot: -0.10 },
    { z: -6.0, w: 0.22, top: 0.22, bot: -0.22 },
    { z: -5.0, w: 0.35, top: 0.34, bot: -0.32 },
    { z: -4.0, w: 0.50, top: 0.48, bot: -0.42 },
    { z: -3.0, w: 0.68, top: 0.62, bot: -0.52 },
    { z: -1.5, w: 0.85, top: 0.72, bot: -0.58 },
    { z: 0.0, w: 1.05, top: 0.78, bot: -0.62 },
    { z: 1.5, w: 1.25, top: 0.72, bot: -0.60 },
    { z: 3.0, w: 1.05, top: 0.62, bot: -0.55 },
    { z: 4.5, w: 0.85, top: 0.55, bot: -0.50 },
    { z: 6.0, w: 0.62, top: 0.48, bot: -0.45 },
    { z: 7.0, w: 0.48, top: 0.42, bot: -0.40 },
    { z: 7.6, w: 0.42, top: 0.38, bot: -0.36 },
  ];
  const body = loftFuselage(stations, gray);
  jet.add(body);

  // Nose probe: a thin dark pitot on the tip, like the real jet's.
  const probe = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 1.1, 8), dark);
  probe.rotation.x = Math.PI / 2;
  probe.position.set(0, 0.02, -7.9);
  jet.add(probe);

  // Gold bubble canopy: big, prominent, gold-tinted like the real
  // F-35/F-22 canopy. Sits high on the nose so it reads from every angle.
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(1, 28, 20),
    new THREE.MeshStandardMaterial({
      color: J.glassColor,
      metalness: J.glassMetal,
      roughness: J.glassRough,
      emissive: 0x8a6d1f,
      emissiveIntensity: 0.25,
    }),
  );
  canopy.scale.set(0.72, 0.48, 1.9);
  canopy.position.set(0, 0.68, -2.7);
  canopy.castShadow = true;
  jet.add(canopy);

  // Swept trapezoidal wing, one full-span shape, gray. Root chord long,
  // tip chord short, leading edge swept back — the F-35 planform.
  // Thin and swept so it reads as a blade, not a slab.
  const wing = extrudeFlat(
    wingShape(J.span, -1.2, 2.2, 2.6, 3.6),
    0.18,
    wingGray,
  );
  wing.position.set(0, -0.08, -0.4);
  jet.add(wing);

  // All-moving horizontal stabilators at the tail, swept, slight dihedral.
  const stab = extrudeFlat(wingShape(4.8, 5.4, 6.6, 7.3, 7.8), 0.18, tailGray);
  stab.position.set(0, 0.22, 0);
  stab.rotation.z = 0.08;
  jet.add(stab);

  // Twin vertical tails, canted outward like the real F-35 (about 26 deg),
  // swept back, gray with a darker leading edge.
  for (const side of [-1, 1]) {
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.lineTo(2.7, 0.3);
    finShape.lineTo(2.3, 2.5);
    finShape.lineTo(0.9, 2.2);
    finShape.closePath();
    const finGeo = new THREE.ExtrudeGeometry(finShape, {
      depth: 0.18,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 2,
    });
    const fin = new THREE.Mesh(finGeo, tailGray);
    fin.castShadow = true;
    // Shape is in XY (x = chord back, y = height); stand it in the YZ plane.
    fin.rotation.y = Math.PI / 2;
    fin.rotation.z = side * -0.45;
    fin.position.set(side * 0.8, 0.5, 4.4);
    jet.add(fin);
  }

  // Caret intakes: dark angled wedges on the fuselage sides, ahead of
  // the wing roots, tilted so the opening faces forward and out.
  for (const side of [-1, 1]) {
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.85, 2.8), dark);
    intake.position.set(side * 1.02, -0.22, -0.7);
    intake.rotation.y = side * -0.18;
    intake.rotation.z = side * 0.06;
    intake.castShadow = true;
    jet.add(intake);
    // Thin gray lip along the intake's outer edge.
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 2.6), wingGray);
    lip.position.set(side * 1.5, -0.2, -0.7);
    lip.rotation.y = side * -0.18;
    jet.add(lip);
  }

  // Afterburner: one round nozzle, a shorter tamer flame, a small glow.
  const nozzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.6, 1.2, 24),
    nozzleMat,
  );
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.set(0, 0, J.length / 2 + 0.35);
  jet.add(nozzle);
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
  flame.position.set(0, 0, J.length / 2 + 1.5);
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
  flameCore.position.set(0, 0, J.length / 2 + 1.2);
  jet.add(flameCore);
  const glow = glowSprite('rgba(255, 140, 40, 0.9)', 2.2);
  glow.position.set(0, 0, J.length / 2 + 0.9);
  jet.add(glow);
  const light = new THREE.PointLight(0xff7a1a, 1.6, 30, 1.8);
  light.position.set(0, 0, J.length / 2 + 2.0);
  jet.add(light);

  // Wingtip nav lights: red port, green starboard, white tail.
  const tipLights = [
    [0xff2a2a, -J.span / 2, 0, 1.2],
    [0x2aff5a, J.span / 2, 0, 1.2],
    [0xffffff, 0, 0.1, J.length / 2 + 0.9],
  ];
  for (const [c, x, y, z] of tipLights) {
    const l = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 8),
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
    flame.material.opacity = 0.3 + l * 0.5;
    glow.material.opacity = 0.2 + l * 0.7;
    light.intensity = 0.3 + l * 2.6;
  }
  setAfterburner(0.8);

  jet.userData.setAfterburner = setAfterburner;
  return jet;
}
