// Ember Fjord — the DOM HUD.
// Speed and altitude tapes, compass strip, mission banner, throttle/fuel
// bars, a radar scope and an attitude ball. All of it is plain DOM and
// canvas, updated every frame from the flight state, so the screenshots
// show live instruments, not painted ones.

import { CFG } from './config.js';

const H = CFG.hud;

function el(tag, cls, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (parent) parent.appendChild(e);
  return e;
}

function tapeValues(current, step, count) {
  const base = Math.round(current / step) * step;
  const out = [];
  for (let i = count; i >= -count; i--) out.push(base + i * step);
  return out;
}

export function buildHUD() {
  const root = el('div', 'hud', document.body);

  const banner = el('div', 'hud-banner', root);
  const bannerTitle = el('div', 'hud-banner-title', banner);
  const bannerSub = el('div', 'hud-banner-sub', banner);

  const flight = el('div', 'hud-flight', root);
  const flightHdg = el('div', 'hud-flight-big', flight);
  const flightSub = el('div', 'hud-flight-sub', flight);

  const compass = el('div', 'hud-compass', root);
  const compassInner = el('div', 'hud-compass-inner', compass);

  const speedTape = el('div', 'hud-tape hud-tape-left', root);
  const altTape = el('div', 'hud-tape hud-tape-right', root);

  const bars = el('div', 'hud-bars', root);
  const barRows = {};
  for (const [key, label] of [['thr', 'THR'], ['fuel', 'FUEL'], ['egt', 'EGT']]) {
    const row = el('div', 'hud-bar-row', bars);
    el('span', 'hud-bar-label', row).textContent = label;
    const track = el('div', 'hud-bar-track', row);
    const fill = el('div', 'hud-bar-fill', track);
    const val = el('span', 'hud-bar-val', row);
    barRows[key] = { fill, val };
  }

  const attBox = el('div', 'hud-att', root);
  const attCanvas = el('canvas', '', attBox);
  attCanvas.width = 150;
  attCanvas.height = 150;
  el('div', 'hud-att-label', attBox).textContent = 'ATTITUDE';

  const radarBox = el('div', 'hud-radar', root);
  const radarCanvas = el('canvas', '', radarBox);
  radarCanvas.width = 150;
  radarCanvas.height = 150;
  el('div', 'hud-radar-label', radarBox).textContent = 'RADAR';

  let sweep = 0;

  function drawTape(tape, current, step, unit) {
    const vals = tapeValues(current, step, 5).filter((v) => v >= 0);
    const currentRounded = Math.round(current / step) * step;
    let html = '';
    for (const v of vals) {
      const cls = v === currentRounded ? 'hud-tape-cur' : '';
      html += `<div class="hud-tape-row ${cls}">${v}</div>`;
    }
    html += `<div class="hud-tape-big">${Math.round(current)}<span>${unit}</span></div>`;
    tape.innerHTML = html;
  }

  function drawAttitude(canvas, pitchDeg, rollDeg) {
    const g = canvas.getContext('2d');
    const S = 150;
    const cx = S / 2;
    const cy = S / 2;
    const R = 62;
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
    g.fillStyle = '#fff';
    g.fillRect(-R, dy - 2, R * 2, 4);
    g.restore();
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.strokeStyle = '#e8eef8';
    g.lineWidth = 3;
    g.stroke();
    g.strokeStyle = '#ffe9a8';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(cx - 34, cy);
    g.lineTo(cx - 10, cy);
    g.moveTo(cx + 10, cy);
    g.lineTo(cx + 34, cy);
    g.stroke();
  }

  function drawRadar(canvas, state) {
    const g = canvas.getContext('2d');
    const S = 150;
    const cx = S / 2;
    const cy = S / 2;
    g.clearRect(0, 0, S, S);
    g.fillStyle = 'rgba(6, 20, 10, 0.9)';
    g.beginPath();
    g.arc(cx, cy, 66, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(125, 255, 154, 0.5)';
    g.lineWidth = 1.5;
    for (const r of [22, 44, 66]) {
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.stroke();
    }
    sweep = (sweep + 0.06) % (Math.PI * 2);
    g.strokeStyle = 'rgba(125, 255, 154, 0.9)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(sweep) * 66, cy + Math.sin(sweep) * 66);
    g.stroke();
    // Blips: next ring (gold) and runway (white).
    const range = 600;
    const blips = [];
    if (state.nextRing) {
      blips.push([state.nextRing.pos, '#ffc23e']);
    }
    blips.push([CFG.runway.center, '#ffffff']);
    for (const [p, color] of blips) {
      const dx = (p[0] - state.pos.x) / range;
      const dz = (p[2] - state.pos.z) / range;
      const bx = cx + dx * 60;
      const by = cy + dz * 60;
      if (Math.hypot(bx - cx, by - cy) > 64) continue;
      g.fillStyle = color;
      g.beginPath();
      g.arc(bx, by, 4, 0, Math.PI * 2);
      g.fill();
    }
    // Ownship triangle, nose up.
    g.fillStyle = '#7dff9a';
    g.beginPath();
    g.moveTo(cx, cy - 8);
    g.lineTo(cx - 6, cy + 7);
    g.lineTo(cx + 6, cy + 7);
    g.closePath();
    g.fill();
  }

  function update(state) {
    bannerTitle.textContent = state.missionName;
    bannerSub.textContent = `${state.timeLeft}s   ${state.ringsHit} / ${state.ringsTotal}   SCORE ${state.score}`;
    flightHdg.textContent = `HDG ${String(Math.round(state.hdgDeg)).padStart(3, '0')}`;
    flightSub.textContent = `V/S ${Math.round(state.vsFpm)} FPM\nMACH ${state.mach.toFixed(2)}`;
    compassInner.textContent = compassText(state.hdgDeg);
    drawTape(speedTape, state.kts, 10, 'KTS');
    drawTape(altTape, state.altFt, 100, 'ALT FT');
    barRows.thr.fill.style.width = `${state.thr * 100}%`;
    barRows.thr.val.textContent = `${Math.round(state.thr * 100)}%`;
    barRows.fuel.fill.style.width = `${state.fuel}%`;
    barRows.fuel.val.textContent = `${Math.round(state.fuel)}%`;
    barRows.egt.fill.style.width = `${((state.egt - 300) / 600) * 100}%`;
    barRows.egt.val.textContent = `${Math.round(state.egt)}`;
    drawAttitude(attCanvas, state.pitchDeg, state.rollDeg);
    drawRadar(radarCanvas, state);
  }

  // In the cockpit the 3D panel carries the instruments, so the DOM
  // tapes, bars, attitude ball and radar step aside instead of piling
  // on top of the gauges. The banner, flight data and compass stay.
  function setMode(mode) {
    const cockpit = mode === 'cockpit';
    speedTape.style.display = cockpit ? 'none' : '';
    altTape.style.display = cockpit ? 'none' : '';
    bars.style.display = cockpit ? 'none' : '';
    attBox.style.display = cockpit ? 'none' : '';
    radarBox.style.display = cockpit ? 'none' : '';
  }

  return { root, update, setMode };
}

function compassText(hdgDeg) {
  const pts = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const idx = Math.round(hdgDeg / 22.5) % 16;
  const parts = [];
  for (let d = -60; d <= 60; d += 15) {
    const h = (Math.round(hdgDeg) + d + 360) % 360;
    parts.push(String(h).padStart(3, '0'));
  }
  return `${parts.join('  ')}   ${pts[idx]} ${String(Math.round(hdgDeg)).padStart(3, '0')}°`;
}
