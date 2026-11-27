// Ember Fjord — the cockpit, rebuilt as a dense F-35 glass cockpit you
// sit INSIDE. A curved panoramic touchscreen full of live data (flight
// numbers, terrain map, radar, engine systems), an ejection seat and
// side consoles giving it depth, a canopy frame that encloses the view,
// and the jet's nose ahead below the sill. The panel sits below eye
// level (lower third of the frame) so you look slightly down at it and
// forward through the canopy at the ring and the fjord.

import * as THREE from 'three';

const PANO_W = 1280;
const PANO_H = 400;
const PED_W = 512;
const PED_H = 128;

const CYAN = '#7fe7ff';
const GREEN = '#7dff9a';
const AMBER = '#ffcf5a';
const RED = '#ff6a5a';
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
  // Zone labels around the schematic.
  g.fillStyle = DIM;
  g.font = 'bold 11px sans-serif';
  g.textAlign = 'center';
  g.fillText('NOSE', cx, cy - 60);
  g.fillText('L WING', cx - 66, cy + 4);
  g.fillText('R WING', cx + 66, cy + 4);
  g.fillText('TAIL', cx, cy + 56);
  g.fillText('A/C', cx, cy + 72);
}

function drawEngSys(g, x, y, s) {
  // Engine / systems cluster: live values derived from throttle.
  g.fillStyle = DIM;
  g.font = 'bold 15px sans-serif';
  g.textAlign = 'left';
  g.fillText('ENG SYS', x, y);
  const oil = Math.round(40 + s.thr * 10);
  const hyd = Math.round(2800 + s.thr * 400);
  const elec = (27.5 + s.thr).toFixed(1);
  const rows = [
    ['OIL', oil + ' PSI', GREEN],
    ['HYD', hyd + ' PSI', GREEN],
    ['ELEC', elec + ' V', GREEN],
    ['AVIONICS', 'OK', GREEN],
  ];
  let ry = y + 24;
  for (const [label, value, color] of rows) {
    g.fillStyle = DIM;
    g.font = 'bold 13px sans-serif';
    g.fillText(label, x, ry);
    g.fillStyle = color;
    g.font = 'bold 15px sans-serif';
    g.textAlign = 'right';
    g.fillText(value, x + 150, ry);
    g.textAlign = 'left';
    ry += 26;
  }
}

function drawMap(g, mx, my, mw, mh, s) {
  // Moving map: fjord water channel down the middle, mountain contours
  // on both sides, waypoints, the ring ahead and the own-ship symbol.
  g.fillStyle = '#081120';
  g.fillRect(mx, my, mw, mh);
  g.strokeStyle = '#16303f';
  g.lineWidth = 1;
  g.strokeRect(mx, my, mw, mh);
  // Soft hill shading blobs.
  const blobs = [
    [mx + 52, my + 70, 46],
    [mx + 44, my + 200, 58],
    [mx + mw - 52, my + 88, 50],
    [mx + mw - 46, my + 210, 60],
  ];
  for (const [bx, by, br] of blobs) {
    const rg = g.createRadialGradient(bx, by, 4, bx, by, br);
    rg.addColorStop(0, 'rgba(42,74,106,0.55)');
    rg.addColorStop(1, 'rgba(42,74,106,0)');
    g.fillStyle = rg;
    g.beginPath();
    g.arc(bx, by, br, 0, Math.PI * 2);
    g.fill();
  }
  // Mountain contour lines, both valley walls.
  g.strokeStyle = '#2a4a6a';
  g.lineWidth = 1.5;
  for (const side of [0, 1]) {
    for (let k = 0; k < 3; k++) {
      const off = 14 + k * 22;
      const x0 = side === 0 ? mx + off : mx + mw - off;
      g.beginPath();
      g.moveTo(x0, my + mh - 6);
      g.bezierCurveTo(
        x0 + (side === 0 ? 18 : -18), my + mh * 0.72,
        x0 + (side === 0 ? -8 : 8), my + mh * 0.45,
        x0 + (side === 0 ? 14 : -14), my + 8,
      );
      g.stroke();
    }
  }
  // Water channel: dark blue band down the centre, with a centre line.
  const cx = mx + mw / 2;
  g.fillStyle = '#0e2a4a';
  g.fillRect(cx - 26, my, 52, mh);
  g.strokeStyle = '#1a3a5a';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(cx, my);
  g.lineTo(cx, my + mh);
  g.stroke();
  // Waypoints.
  const wpts = [
    [mx + 78, my + 66, 'WPT1'],
    [mx + mw - 84, my + 128, 'WPT2'],
    [mx + 96, my + 196, 'WPT3'],
  ];
  g.fillStyle = AMBER;
  g.font = 'bold 11px sans-serif';
  g.textAlign = 'center';
  for (const [wx, wy, wl] of wpts) {
    g.save();
    g.translate(wx, wy);
    g.rotate(Math.PI / 4);
    g.fillRect(-5, -5, 10, 10);
    g.restore();
    g.fillText(wl, wx, wy - 10);
  }
  // Heading tape along the top of the map.
  g.fillStyle = CYAN;
  g.font = 'bold 13px sans-serif';
  for (let d = -20; d <= 20; d += 10) {
    const h = ((Math.round(s.hdgDeg) + d) % 360 + 360) % 360;
    const x = cx + d * 6;
    g.fillRect(x - 1, my + 4, 2, d % 20 === 0 ? 10 : 6);
    if (d % 20 === 0) g.fillText(String(h).padStart(3, '0'), x, my + 26);
  }
  // Ring ahead + own-ship symbol (heading-up: the ring is straight up).
  const rx = cx;
  const ry = my + 84;
  g.strokeStyle = CYAN;
  g.lineWidth = 3;
  g.beginPath();
  g.arc(rx, ry, 20, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = CYAN;
  g.font = 'bold 13px sans-serif';
  g.fillText('RING', rx, ry - 28);
  const jx = cx;
  const jy = my + mh - 30;
  g.strokeStyle = GREEN;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(jx, jy - 10);
  g.lineTo(rx, ry + 22);
  g.stroke();
  g.fillStyle = GREEN;
  g.beginPath();
  g.moveTo(jx, jy - 12);
  g.lineTo(jx - 8, jy + 7);
  g.lineTo(jx + 8, jy + 7);
  g.closePath();
  g.fill();
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
  g.fillStyle = GREEN;
  g.font = 'bold 16px sans-serif';
  g.textAlign = 'center';
  g.fillText('● SYS NOMINAL', W / 2, 29);
  g.fillStyle = CYAN;
  g.font = 'bold 20px sans-serif';
  g.textAlign = 'right';
  g.fillText('MACH ' + s.mach.toFixed(2), W - 20, 30);

  // Centre divider.
  g.strokeStyle = LINE;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(640, 44);
  g.lineTo(640, H - 10);
  g.stroke();

  // ---- LEFT: live flight data ----
  const cols = [
    { x: 120, value: Math.round(s.kts), label: 'KTS', accent: GREEN },
    { x: 300, value: Math.round(s.altFt), label: 'ALT FT', accent: CYAN },
    { x: 480, value: Math.round(s.hdgDeg) + '°', label: 'HDG', accent: AMBER },
  ];
  for (const c of cols) {
    g.fillStyle = WHITE;
    g.font = 'bold 62px sans-serif';
    g.textAlign = 'center';
    g.fillText(String(c.value), c.x, 106);
    g.fillStyle = CYAN;
    g.font = 'bold 18px sans-serif';
    g.fillText(c.label, c.x, 132);
    g.fillStyle = c.accent;
    g.fillRect(c.x - 38, 140, 76, 3);
  }
  // Attitude.
  g.fillStyle = DIM;
  g.font = 'bold 15px sans-serif';
  g.textAlign = 'center';
  g.fillText('ATTITUDE', 120, 168);
  drawAttitude(g, 120, 228, 48, s.pitchDeg, s.rollDeg);
  // Jet schematic with zone labels.
  drawJetSchematic(g, 320, 228);
  // Engine systems cluster.
  drawEngSys(g, 470, 176, s);
  // VS / THR line.
  g.fillStyle = WHITE;
  g.font = 'bold 18px sans-serif';
  g.textAlign = 'left';
  g.fillText('VS ' + Math.round(s.vsFpm) + ' FPM', 16, 336);
  g.textAlign = 'right';
  g.fillText('THR ' + Math.round(s.thr * 100) + '%', 624, 336);

  // ---- RIGHT: moving map + radar + systems ----
  drawMap(g, 656, 44, 324, 274, s);
  // Radar strip below the map.
  const rx0 = 656;
  const ry0 = 322;
  const rw = 324;
  const rh = 28;
  g.fillStyle = '#0a1410';
  g.fillRect(rx0, ry0, rw, rh);
  g.strokeStyle = '#16303f';
  g.lineWidth = 1;
  g.strokeRect(rx0, ry0, rw, rh);
  g.fillStyle = GREEN;
  g.font = 'bold 12px sans-serif';
  g.textAlign = 'left';
  g.fillText('RADAR', rx0 + 8, ry0 + 19);
  const sweep = ((s.kts % 100) / 100) * (rw - 70) + 62;
  g.strokeStyle = GREEN;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(rx0 + sweep, ry0 + 4);
  g.lineTo(rx0 + sweep, ry0 + rh - 4);
  g.stroke();
  g.fillStyle = AMBER;
  g.beginPath();
  g.arc(rx0 + 150, ry0 + 14, 4, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = GREEN;
  g.beginPath();
  g.arc(rx0 + 250, ry0 + 14, 4, 0, Math.PI * 2);
  g.fill();
  // System bars.
  const sys = [
    { y: 60, label: 'FUEL', value: Math.round(s.fuel) + '%', frac: s.fuel / 100, color: GREEN },
    { y: 140, label: 'EGT', value: Math.round(s.egt) + '°C', frac: (s.egt - 300) / 600, color: AMBER },
    { y: 220, label: 'THR', value: Math.round(s.thr * 100) + '%', frac: s.thr, color: CYAN },
  ];
  for (const b of sys) {
    const bx = 996;
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
  g.fillText('SYS NOMINAL', 996, 316);
  // Bottom status strip (left + right only — the pedestal covers the centre).
  g.fillStyle = '#0e2233';
  g.fillRect(8, 356, W - 16, 36);
  g.fillStyle = GREEN;
  g.font = 'bold 15px sans-serif';
  g.textAlign = 'left';
  g.fillText('● SYS NOMINAL', 20, 380);
  g.fillStyle = CYAN;
  g.textAlign = 'right';
  g.fillText('HDG ' + Math.round(s.hdgDeg) + '°  •  MACH ' + s.mach.toFixed(2), W - 20, 380);
}

function drawPedestal(g, s) {
  const W = PED_W;
  const H = PED_H;
  g.fillStyle = '#0d141d';
  g.fillRect(0, 0, W, H);
  g.lineWidth = 3;
  g.strokeStyle = '#2a4a5e';
  g.strokeRect(2, 2, W - 4, H - 4);
  g.fillStyle = CYAN;
  g.font = 'bold 24px sans-serif';
  g.textAlign = 'center';
  g.fillText(
    'THR ' + Math.round(s.thr * 100) + '%   •   FUEL ' + Math.round(s.fuel) + '%',
    W / 2,
    34,
  );
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
  g.fillStyle = GREEN;
  g.beginPath();
  g.arc(36, 62, 5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = AMBER;
  g.beginPath();
  g.arc(36, 98, 5, 0, Math.PI * 2);
  g.fill();
}

// Gentle panoramic curve: a plane whose edges come toward the pilot,
// concave like the real F-35's wide display. k sets the edge offset.
function curvedPlane(w, h, k, segW = 24) {
  const geo = new THREE.PlaneGeometry(w, h, segW, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setZ(i, k * x * x);
  }
  geo.computeVertexNormals();
  return geo;
}

function glowTexture() {
  const c = makeCanvas(256, 128);
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(128, 64, 8, 128, 64, 128);
  rg.addColorStop(0, 'rgba(110,255,200,0.55)');
  rg.addColorStop(0.6, 'rgba(110,255,200,0.16)');
  rg.addColorStop(1, 'rgba(110,255,200,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, 256, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
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
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x0c0e12,
    metalness: 0.6,
    roughness: 0.5,
  });
  const seatMat = new THREE.MeshStandardMaterial({
    color: 0x1a1d22,
    metalness: 0.1,
    roughness: 0.95,
  });
  const strapMat = new THREE.MeshStandardMaterial({
    color: 0x3a3a2e,
    metalness: 0.1,
    roughness: 0.9,
  });
  const ctrlMat = new THREE.MeshStandardMaterial({
    color: 0x14181f,
    metalness: 0.5,
    roughness: 0.55,
  });

  // --- Panoramic display: curved bezel + screen + soft glow ---
  // Sits in the lower third of the frame (below eye level), leaning
  // back toward the pilot like the real F-35's panel.
  const bezel = new THREE.Mesh(curvedPlane(1.7, 0.58, 0.12), bezelMat);
  bezel.position.set(0, -0.48, -1.6);
  bezel.rotation.x = -0.35;
  group.add(bezel);

  const panoCanvas = makeCanvas(PANO_W, PANO_H);
  const panoTex = new THREE.CanvasTexture(panoCanvas);
  panoTex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(
    curvedPlane(1.62, 0.506, 0.12),
    new THREE.MeshBasicMaterial({ map: panoTex }),
  );
  screen.position.set(0, -0.48, -1.55);
  screen.rotation.x = -0.35;
  group.add(screen);

  // Faint green glow halo just in front of the screen (backlit feel).
  const glow = new THREE.Mesh(
    curvedPlane(1.66, 0.54, 0.12),
    new THREE.MeshBasicMaterial({
      map: glowTexture(),
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  glow.position.set(0, -0.48, -1.545);
  glow.rotation.x = -0.35;
  group.add(glow);

  // --- Centre pedestal below the screen: small, low, at the very
  // bottom edge so it never covers the display's content ---
  const pedBox = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.06), panelMat);
  pedBox.position.set(0, -0.84, -1.42);
  pedBox.rotation.x = -0.5;
  group.add(pedBox);
  const pedCanvas = makeCanvas(PED_W, PED_H);
  const pedTex = new THREE.CanvasTexture(pedCanvas);
  pedTex.colorSpace = THREE.SRGBColorSpace;
  const pedFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.39, 0.08),
    new THREE.MeshBasicMaterial({ map: pedTex }),
  );
  pedFace.position.set(0, -0.84, -1.37);
  pedFace.rotation.x = -0.5;
  group.add(pedFace);

  // --- Ejection seat: headrest + straps just peeking in at the very
  // bottom edge of the frame, so you feel seated in it ---
  const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.08), seatMat);
  headrest.position.set(0, -0.52, -1.0);
  headrest.rotation.x = -0.15;
  group.add(headrest);
  for (const side of [-1, 1]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.02), strapMat);
    strap.position.set(side * 0.09, -0.54, -0.98);
    strap.rotation.x = -0.15;
    group.add(strap);
  }
  const buckle = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.04, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x8a939e, metalness: 0.8, roughness: 0.35 }),
  );
  buckle.position.set(0, -0.55, -0.97);
  group.add(buckle);

  // --- Side consoles with switch rows, flanking the display ---
  const btnColors = [0x2aff66, 0xffb020, 0x8a939e, 0x2aff66];
  for (const side of [-1, 1]) {
    const consoleGroup = new THREE.Group();
    consoleGroup.position.set(side * 1.0, -0.62, -1.35);
    consoleGroup.rotation.x = -0.15;
    consoleGroup.rotation.z = side * -0.1;
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.45), panelMat);
    consoleGroup.add(box);
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 4; col++) {
        const btn = new THREE.Mesh(
          new THREE.BoxGeometry(0.032, 0.016, 0.032),
          new THREE.MeshStandardMaterial({
            color: btnColors[(row * 4 + col) % 4],
            metalness: 0.3,
            roughness: 0.4,
            emissive: btnColors[(row * 4 + col) % 4],
            emissiveIntensity: 0.25,
          }),
        );
        btn.position.set(-0.06 + col * 0.04, 0.048, -0.14 + row * 0.28);
        consoleGroup.add(btn);
      }
    }
    group.add(consoleGroup);
  }

  // --- Side-stick (right): base, stick, grip, red trigger, hat ---
  const stickGroup = new THREE.Group();
  stickGroup.position.set(0.95, -0.6, -1.28);
  const stickBase = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.04, 12), ctrlMat);
  stickGroup.add(stickBase);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.2, 10), ctrlMat);
  stick.position.set(0, 0.11, 0);
  stick.rotation.z = -0.25;
  stickGroup.add(stick);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.06), ctrlMat);
  grip.position.set(0.025, 0.23, 0);
  grip.rotation.z = -0.25;
  stickGroup.add(grip);
  const trigger = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.03, 0.012),
    new THREE.MeshStandardMaterial({ color: 0xff3020, metalness: 0.3, roughness: 0.4 }),
  );
  trigger.position.set(0.025, 0.21, -0.035);
  stickGroup.add(trigger);
  const hat = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.02), ctrlMat);
  hat.position.set(0.025, 0.28, 0);
  stickGroup.add(hat);
  group.add(stickGroup);

  // --- Throttle quadrant (left): base, lever, grip, buttons ---
  const thrGroup = new THREE.Group();
  thrGroup.position.set(-0.95, -0.6, -1.28);
  const quad = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.22), panelMat);
  thrGroup.add(quad);
  const lever = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.18, 0.05), ctrlMat);
  lever.position.set(0, 0.1, -0.02);
  lever.rotation.x = -0.45;
  thrGroup.add(lever);
  const thrGrip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.07), ctrlMat);
  thrGrip.position.set(0, 0.19, -0.06);
  thrGrip.rotation.x = -0.45;
  thrGroup.add(thrGrip);
  for (let i = 0; i < 2; i++) {
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.012, 0.02),
      new THREE.MeshStandardMaterial({
        color: i === 0 ? 0x2aff66 : 0xffb020,
        emissive: i === 0 ? 0x2aff66 : 0xffb020,
        emissiveIntensity: 0.3,
      }),
    );
    b.position.set(i === 0 ? -0.02 : 0.02, 0.032, 0.08);
    thrGroup.add(b);
  }
  group.add(thrGroup);

  // --- Canopy frame: thicker pillars, top crossbar, side rails and a
  // bottom sill, so the view feels enclosed by the cockpit tub ---
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.5, 0.06), frameMat);
    pillar.position.set(side * 1.28, 0.25, -1.0);
    pillar.rotation.z = side * -0.22;
    group.add(pillar);
    // Rivets down the pillar.
    for (let i = 0; i < 5; i++) {
      const rivet = new THREE.Mesh(
        new THREE.SphereGeometry(0.008, 6, 6),
        new THREE.MeshStandardMaterial({ color: 0x3a4048, metalness: 0.8, roughness: 0.4 }),
      );
      rivet.position.set(side * 1.28 + side * 0.22 * (0.25 - (-0.3 + i * 0.28)) * -1, -0.3 + i * 0.28, -0.97);
      group.add(rivet);
    }
    // Side rail running front-to-back along the canopy edge.
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.9), frameMat);
    rail.position.set(side * 1.22, 0.5, -0.95);
    group.add(rail);
  }
  const topBar = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.05, 0.06), frameMat);
  topBar.position.set(0, 0.55, -1.0);
  group.add(topBar);
  const sill = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.06, 0.06), frameMat);
  sill.position.set(0, -0.82, -1.0);
  group.add(sill);
  // Grab handle on the right pillar.
  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.05, 0.012, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0x3a4048, metalness: 0.8, roughness: 0.4 }),
  );
  handle.position.set(1.28, 0.1, -0.98);
  handle.rotation.y = Math.PI / 2;
  group.add(handle);

  // --- The jet's nose, seen from inside: a narrow rounded wedge
  // below the panel, extending forward toward the horizon. Kept far
  // and narrow so it reads as the distant nose, not a pyramid ---
  const nose = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.2, 2.5, 8),
    new THREE.MeshStandardMaterial({
      color: 0xb8bec6,
      metalness: 0.3,
      roughness: 0.5,
    }),
  );
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, -0.8, -3.75);
  group.add(nose);

  // --- Cockpit lighting: a soft green glow from the display plus a
  // warm top light, so the seat and consoles have shading and depth ---
  const displayLight = new THREE.PointLight(0x66ffcc, 0.6, 3, 1.5);
  displayLight.position.set(0, -0.1, -1.0);
  group.add(displayLight);
  const topLight = new THREE.PointLight(0xffe0b3, 0.4, 4, 1.5);
  topLight.position.set(0, 1.2, -0.8);
  group.add(topLight);

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
