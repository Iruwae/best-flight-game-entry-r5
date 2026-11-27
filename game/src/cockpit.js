// Ember Fjord — the cockpit, rebuilt as an F-35 panoramic display.
// One wide backlit touchscreen replaces the six round gauges: the left
// half shows live flight data (speed, altitude, heading, attitude and a
// top-down jet schematic), the right half a moving map plus engine
// system bars. Below it sits the small centre pedestal with its keypad
// and a live readout. The faces are MeshBasicMaterial, so the display
// glows in the dusk instead of sitting dark on a black slab.

import * as THREE from 'three';

const PANO_W = 1024;
const PANO_H = 336;
const PED_W = 512;
const PED_H = 128;

const CYAN = '#7fe7ff';
const GREEN = '#7dff9a';
const AMBER = '#ffcf5a';
const DIM = '#5a7a94';
const WHITE = '#eef4ff';
const LINE = '#1e4a5a';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function drawAttitude(g, cx, cy, r, pitchDeg, rollDeg) {
  g.save();
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.clip();
  g.translate(cx, cy);
  g.rotate((rollDeg * Math.PI) / 180);
  const dy = (pitchDeg / 30) * r;
  g.fillStyle = '#2f6fd0';
  g.fillRect(-r, -r + dy, r * 2, r - dy + r);
  g.fillStyle = '#8a5a2a';
  g.fillRect(-r, dy, r * 2, r * 2);
  g.fillStyle = '#ffffff';
  g.fillRect(-r, dy - 2, r * 2, 4);
  g.restore();
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.lineWidth = 3;
  g.strokeStyle = '#2a4a5e';
  g.stroke();
  // Fixed aircraft symbol.
  g.strokeStyle = '#ffe9a8';
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(cx - 34, cy);
  g.lineTo(cx - 10, cy);
  g.moveTo(cx + 10, cy);
  g.lineTo(cx + 34, cy);
  g.moveTo(cx, cy - 6);
  g.lineTo(cx, cy + 6);
  g.stroke();
}

function drawJetSchematic(g, cx, cy) {
  // Top-down F-35 outline: pointed nose, swept wings, twin canted tails.
  g.save();
  g.translate(cx, cy);
  g.strokeStyle = CYAN;
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(0, -52);
  g.lineTo(10, -28);
  g.lineTo(14, 0);
  g.lineTo(52, 18);
  g.lineTo(52, 26);
  g.lineTo(16, 14);
  g.lineTo(30, 34);
  g.lineTo(30, 40);
  g.lineTo(14, 34);
  g.lineTo(10, 44);
  g.lineTo(-10, 44);
  g.lineTo(-14, 34);
  g.lineTo(-30, 40);
  g.lineTo(-30, 34);
  g.lineTo(-16, 14);
  g.lineTo(-52, 26);
  g.lineTo(-52, 18);
  g.lineTo(-14, 0);
  g.lineTo(-10, -28);
  g.closePath();
  g.stroke();
  // Gold canopy dot.
  g.fillStyle = AMBER;
  g.beginPath();
  g.arc(0, -14, 5, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function drawPanoramic(g, s) {
  const W = PANO_W;
  const H = PANO_H;
  // Background: dark navy, slightly lighter at the top.
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0d1a2e');
  grad.addColorStop(1, '#0a101d');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  // Frame.
  g.lineWidth = 3;
  g.strokeStyle = '#2a4a5e';
  g.strokeRect(2, 2, W - 4, H - 4);
  g.lineWidth = 1;
  g.strokeStyle = '#16303f';
  g.strokeRect(8, 8, W - 16, H - 16);

  // Top bar.
  g.fillStyle = '#0e2233';
  g.fillRect(8, 8, W - 16, 30);
  g.fillStyle = CYAN;
  g.font = 'bold 20px sans-serif';
  g.textAlign = 'left';
  g.fillText('F-35 LIGHTNING II', 20, 30);
  g.textAlign = 'right';
  g.fillText('MACH ' + s.mach.toFixed(2), W - 20, 30);

  // Centre divider.
  g.strokeStyle = LINE;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(512, 44);
  g.lineTo(512, H - 10);
  g.stroke();

  // ---- LEFT: live flight data ----
  const cols = [
    { x: 100, value: Math.round(s.kts), label: 'KTS', accent: GREEN },
    { x: 256, value: Math.round(s.altFt), label: 'ALT FT', accent: CYAN },
    { x: 412, value: Math.round(s.hdgDeg) + '°', label: 'HDG', accent: AMBER },
  ];
  for (const c of cols) {
    g.fillStyle = WHITE;
    g.font = 'bold 72px sans-serif';
    g.textAlign = 'center';
    g.fillText(String(c.value), c.x, 118);
    g.fillStyle = CYAN;
    g.font = 'bold 20px sans-serif';
    g.fillText(c.label, c.x, 146);
    g.fillStyle = c.accent;
    g.fillRect(c.x - 42, 154, 84, 3);
  }
  // Attitude.
  g.fillStyle = DIM;
  g.font = 'bold 16px sans-serif';
  g.textAlign = 'center';
  g.fillText('ATTITUDE', 110, 182);
  drawAttitude(g, 110, 242, 56, s.pitchDeg, s.rollDeg);
  // Jet schematic.
  drawJetSchematic(g, 330, 240);
  g.fillStyle = DIM;
  g.font = 'bold 16px sans-serif';
  g.fillText('A/C', 330, 306);
  // VS / THR line.
  g.fillStyle = WHITE;
  g.font = 'bold 20px sans-serif';
  g.textAlign = 'left';
  g.fillText('VS ' + Math.round(s.vsFpm) + ' FPM', 16, 322);
  g.textAlign = 'right';
  g.fillText('THR ' + Math.round(s.thr * 100) + '%', 496, 322);

  // ---- RIGHT: moving map + systems ----
  // Map window.
  const mx = 528;
  const my = 44;
  const mw = 330;
  const mh = 282;
  g.fillStyle = '#081120';
  g.fillRect(mx, my, mw, mh);
  g.strokeStyle = '#16303f';
  g.lineWidth = 1;
  g.strokeRect(mx, my, mw, mh);
  // Grid.
  g.strokeStyle = '#12283a';
  for (let gx = mx + 30; gx < mx + mw; gx += 30) {
    g.beginPath();
    g.moveTo(gx, my);
    g.lineTo(gx, my + mh);
    g.stroke();
  }
  for (let gy = my + 30; gy < my + mh; gy += 30) {
    g.beginPath();
    g.moveTo(mx, gy);
    g.lineTo(mx + mw, gy);
    g.stroke();
  }
  // Valley walls.
  g.strokeStyle = '#2a4a6a';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(mx + 12, my + mh - 6);
  g.lineTo(mx + 42, my + 176);
  g.lineTo(mx + 32, my + 76);
  g.lineTo(mx + 62, my + 6);
  g.stroke();
  g.beginPath();
  g.moveTo(mx + mw - 12, my + mh - 6);
  g.lineTo(mx + mw - 42, my + 176);
  g.lineTo(mx + mw - 32, my + 76);
  g.lineTo(mx + mw - 62, my + 6);
  g.stroke();
  // Heading tape along the top of the map.
  g.fillStyle = CYAN;
  g.font = 'bold 15px sans-serif';
  g.textAlign = 'center';
  for (let d = -20; d <= 20; d += 10) {
    const h = ((Math.round(s.hdgDeg) + d) % 360 + 360) % 360;
    const x = mx + mw / 2 + d * 6;
    g.fillRect(x - 1, my + 4, 2, d % 20 === 0 ? 12 : 7);
    if (d % 20 === 0) g.fillText(String(h).padStart(3, '0'), x, my + 30);
  }
  // Ring ahead + own-ship symbol (heading-up: the ring is straight up).
  const jx = mx + mw / 2;
  const jy = my + mh - 42;
  const rx = jx;
  const ry = my + 95;
  g.strokeStyle = CYAN;
  g.lineWidth = 3;
  g.beginPath();
  g.arc(rx, ry, 24, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = CYAN;
  g.font = 'bold 15px sans-serif';
  g.fillText('RING', rx, ry - 32);
  g.strokeStyle = GREEN;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(jx, jy - 12);
  g.lineTo(rx, ry + 26);
  g.stroke();
  g.fillStyle = GREEN;
  g.beginPath();
  g.moveTo(jx, jy - 14);
  g.lineTo(jx - 9, jy + 8);
  g.lineTo(jx + 9, jy + 8);
  g.closePath();
  g.fill();
  // System bars.
  const sys = [
    { y: 60, label: 'FUEL', value: Math.round(s.fuel) + '%', frac: s.fuel / 100, color: GREEN },
    { y: 140, label: 'EGT', value: Math.round(s.egt) + '°C', frac: (s.egt - 300) / 600, color: AMBER },
    { y: 220, label: 'THR', value: Math.round(s.thr * 100) + '%', frac: s.thr, color: CYAN },
  ];
  for (const b of sys) {
    const bx = 872;
    g.fillStyle = DIM;
    g.font = 'bold 18px sans-serif';
    g.textAlign = 'left';
    g.fillText(b.label, bx, b.y);
    g.fillStyle = WHITE;
    g.font = 'bold 30px sans-serif';
    g.fillText(b.value, bx, b.y + 32);
    g.fillStyle = '#12283a';
    g.fillRect(bx, b.y + 42, 128, 12);
    g.fillStyle = b.color;
    g.fillRect(bx, b.y + 42, Math.max(4, 128 * Math.min(1, Math.max(0, b.frac))), 12);
  }
  g.fillStyle = GREEN;
  g.font = 'bold 16px sans-serif';
  g.textAlign = 'left';
  g.fillText('SYS NOMINAL', 872, 316);
}

function drawPedestal(g, s) {
  const W = PED_W;
  const H = PED_H;
  g.fillStyle = '#0d141d';
  g.fillRect(0, 0, W, H);
  g.lineWidth = 3;
  g.strokeStyle = '#2a4a5e';
  g.strokeRect(2, 2, W - 4, H - 4);
  // Live readout line.
  g.fillStyle = CYAN;
  g.font = 'bold 24px sans-serif';
  g.textAlign = 'center';
  g.fillText(
    'THR ' + Math.round(s.thr * 100) + '%   •   FUEL ' + Math.round(s.fuel) + '%',
    W / 2,
    34,
  );
  // Keypad grid.
  g.strokeStyle = DIM;
  g.lineWidth = 2;
  g.fillStyle = DIM;
  g.font = 'bold 18px sans-serif';
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const x = 56 + col * 140;
      const y = 48 + row * 36;
      g.strokeRect(x, y, 120, 28);
      g.fillText(String(row * 3 + col + 1), x + 60, y + 21);
    }
  }
  // Status LEDs.
  g.fillStyle = GREEN;
  g.beginPath();
  g.arc(36, 62, 5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = AMBER;
  g.beginPath();
  g.arc(36, 98, 5, 0, Math.PI * 2);
  g.fill();
}

export function buildCockpit(camera) {
  const group = new THREE.Group();
  const bezelMat = new THREE.MeshStandardMaterial({
    color: 0x1c2129,
    metalness: 0.7,
    roughness: 0.45,
  });
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0x232a35,
    metalness: 0.4,
    roughness: 0.6,
  });
  // Panoramic display bezel + screen, low in the view so the screen sits
  // in the lower third and the ring stays visible above it. The screen
  // leans back toward the pilot, like the real F-35's panel. It sits
  // farther out than the old gauge panel so its full height fits in
  // frame instead of running off the bottom edge.
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.83, 0.65, 0.08), bezelMat);
  bezel.position.set(0, -0.4, -1.53);
  bezel.rotation.x = -0.4;
  group.add(bezel);

  const panoCanvas = makeCanvas(PANO_W, PANO_H);
  const panoTex = new THREE.CanvasTexture(panoCanvas);
  panoTex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.75, 0.574),
    new THREE.MeshBasicMaterial({ map: panoTex }),
  );
  screen.position.set(0, -0.4, -1.485);
  screen.rotation.x = -0.4;
  group.add(screen);

  // Centre pedestal below the screen: small box with its own lit face.
  const pedBox = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.2, 0.08), panelMat);
  pedBox.position.set(0, -0.63, -1.35);
  pedBox.rotation.x = -0.7;
  group.add(pedBox);
  const pedCanvas = makeCanvas(PED_W, PED_H);
  const pedTex = new THREE.CanvasTexture(pedCanvas);
  pedTex.colorSpace = THREE.SRGBColorSpace;
  const pedFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.58, 0.145),
    new THREE.MeshBasicMaterial({ map: pedTex }),
  );
  // 0.075 ahead of the box centre: the -0.7 tilt swings the box's front
  // face up-forward, so a smaller offset leaves the face behind it.
  pedFace.position.set(0, -0.63, -1.275);
  pedFace.rotation.x = -0.7;
  group.add(pedFace);

  // Side-stick (right) and throttle (left): small dark shapes at the
  // panel edges, like the real F-35's controls.
  const ctrlMat = new THREE.MeshStandardMaterial({
    color: 0x14181f,
    metalness: 0.5,
    roughness: 0.55,
  });
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.16, 10), ctrlMat);
  stick.position.set(0.92, -0.5, -1.45);
  stick.rotation.z = -0.3;
  group.add(stick);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.05), ctrlMat);
  grip.position.set(0.94, -0.42, -1.45);
  grip.rotation.z = -0.3;
  group.add(grip);
  const throttle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.09), ctrlMat);
  throttle.position.set(-0.92, -0.5, -1.45);
  throttle.rotation.x = -0.3;
  group.add(throttle);

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
    const g = panoCanvas.getContext('2d');
    drawPanoramic(g, state);
    panoTex.needsUpdate = true;
    const p = pedCanvas.getContext('2d');
    drawPedestal(p, state);
    pedTex.needsUpdate = true;
  }
  group.userData.update = update;
  return group;
}
