// Ember Fjord — the cockpit.
// A real 3D panel parented to the camera: six round gauges, each with its
// own metal bezel and its own lit canvas face, plus the canopy frame.
// The faces are MeshBasicMaterial, so the instruments glow in the dusk
// instead of sitting dark on a black slab.

import * as THREE from 'three';

const GAUGE_SIZE = 256;

function faceCanvas() {
  const c = document.createElement('canvas');
  c.width = GAUGE_SIZE;
  c.height = GAUGE_SIZE;
  return c;
}

function drawRoundGauge(g, value, min, max, label, unit, accent) {
  const S = GAUGE_SIZE;
  const cx = S / 2;
  const cy = S / 2;
  const R = S / 2 - 8;
  g.clearRect(0, 0, S, S);
  // Face.
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.fillStyle = '#0d1522';
  g.fill();
  g.lineWidth = 4;
  g.strokeStyle = '#2a3648';
  g.stroke();
  // Coloured arc (green to amber).
  g.beginPath();
  g.arc(cx, cy, R - 14, -Math.PI * 0.75, Math.PI * 0.15);
  g.strokeStyle = accent;
  g.lineWidth = 7;
  g.stroke();
  // Ticks.
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
    const inner = i % 5 === 0 ? R - 26 : R - 20;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    g.lineTo(cx + Math.cos(a) * (R - 12), cy + Math.sin(a) * (R - 12));
    g.strokeStyle = '#c8d4e8';
    g.lineWidth = i % 5 === 0 ? 4 : 2;
    g.stroke();
  }
  // Needle.
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const na = -Math.PI * 0.75 + t * Math.PI * 1.5;
  g.beginPath();
  g.moveTo(cx, cy);
  g.lineTo(cx + Math.cos(na) * (R - 34), cy + Math.sin(na) * (R - 34));
  g.strokeStyle = '#ffe9a8';
  g.lineWidth = 6;
  g.stroke();
  g.beginPath();
  g.arc(cx, cy, 10, 0, Math.PI * 2);
  g.fillStyle = '#e8eef8';
  g.fill();
  // Digital readout + label.
  g.fillStyle = '#ffffff';
  g.font = 'bold 44px sans-serif';
  g.textAlign = 'center';
  g.fillText(String(Math.round(value)), cx, cy + 62);
  g.font = 'bold 26px sans-serif';
  g.fillStyle = '#9fb4d8';
  g.fillText(label, cx, cy + 96);
  if (unit) {
    g.font = '22px sans-serif';
    g.fillText(unit, cx, cy - 58);
  }
}

function drawAttitude(g, pitchDeg, rollDeg) {
  const S = GAUGE_SIZE;
  const cx = S / 2;
  const cy = S / 2;
  const R = S / 2 - 8;
  g.clearRect(0, 0, S, S);
  g.save();
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.clip();
  g.translate(cx, cy);
  g.rotate((rollDeg * Math.PI) / 180);
  const dy = (pitchDeg / 30) * R;
  g.fillStyle = '#3a7bd8';
  g.fillRect(-R, -R + dy, R * 2, R - dy + R);
  g.fillStyle = '#8a5a2a';
  g.fillRect(-R, dy, R * 2, R * 2);
  g.fillStyle = '#ffffff';
  g.fillRect(-R, dy - 2, R * 2, 4);
  g.restore();
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.lineWidth = 4;
  g.strokeStyle = '#2a3648';
  g.stroke();
  // Fixed aircraft symbol.
  g.strokeStyle = '#ffe9a8';
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(cx - 52, cy);
  g.lineTo(cx - 14, cy);
  g.moveTo(cx + 14, cy);
  g.lineTo(cx + 52, cy);
  g.moveTo(cx, cy - 8);
  g.lineTo(cx, cy + 8);
  g.stroke();
  g.fillStyle = '#9fb4d8';
  g.font = 'bold 26px sans-serif';
  g.textAlign = 'center';
  g.fillText('ATT', cx, cy + R - 14);
}

export function buildCockpit(camera) {
  const group = new THREE.Group();
  const bezelMat = new THREE.MeshStandardMaterial({
    color: 0x2a2f38,
    metalness: 0.85,
    roughness: 0.35,
  });
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0x232a35,
    metalness: 0.4,
    roughness: 0.6,
  });
  // Dashboard slab, low in the view so the gauges sit in the lower third.
  // It leans back toward the pilot; the gauges ride on its face, tilted
  // the same way, so they read as full circles instead of thin ellipses.
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 0.16), panelMat);
  panel.position.set(0, -0.35, -1.1);
  panel.rotation.x = -0.5;
  group.add(panel);

  const defs = [
    { key: 'kts', label: 'KTS', min: 0, max: 400, accent: '#7dff9a' },
    { key: 'altFt', label: 'ALT FT', min: 0, max: 1200, accent: '#7db8ff' },
    { key: 'att', label: 'ATT', att: true },
    { key: 'hdgDeg', label: 'HDG', min: 0, max: 360, accent: '#ffe9a8' },
    { key: 'egt', label: 'EGT C', min: 300, max: 900, accent: '#ff9a5a' },
    { key: 'fuel', label: 'FUEL', min: 0, max: 100, accent: '#7dff9a' },
  ];
  const gauges = [];
  defs.forEach((def, i) => {
    const canvas = faceCanvas();
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const x = -0.7 + i * 0.28;
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.026, 10, 28), bezelMat);
    bezel.position.set(x, -0.3, -1.02);
    bezel.rotation.x = -0.5;
    group.add(bezel);
    const face = new THREE.Mesh(
      new THREE.CircleGeometry(0.145, 28),
      new THREE.MeshBasicMaterial({ map: tex }),
    );
    face.position.set(x, -0.3, -1.01);
    face.rotation.x = -0.5;
    group.add(face);
    gauges.push({ def, canvas, tex });
  });

  // Canopy frame: slim pillars left/right and a thin top bar. No centre
  // post — it reads as a black monolith in the middle of the view.
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x0c0e12,
    metalness: 0.6,
    roughness: 0.5,
  });
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.5, 0.05), frameMat);
    pillar.position.set(side * 1.25, 0.25, -1.0);
    pillar.rotation.z = side * -0.22;
    group.add(pillar);
  }
  const topBar = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.05, 0.05), frameMat);
  topBar.position.set(0, 0.92, -1.0);
  group.add(topBar);

  camera.add(group);

  function update(state) {
    for (const { def, canvas, tex } of gauges) {
      const g = canvas.getContext('2d');
      if (def.att) {
        drawAttitude(g, state.pitchDeg, state.rollDeg);
      } else {
        drawRoundGauge(g, state[def.key], def.min, def.max, def.label, null, def.accent);
      }
      tex.needsUpdate = true;
    }
  }
  group.userData.update = update;
  return group;
}
