// Ember Fjord — the three missions.
// Fjord Run threads eight glowing rings down the channel. Peak Slalom
// weaves six gates between the peaks. Precision Landing brings the jet
// home to runway 18 under the PAPI lights. Same jet, same valley,
// three different kinds of flying.

import { CFG } from './config.js';
import { fjordCenter } from './terrain-combined.js';

function fjordRing(i, z, y) {
  return {
    pos: [fjordCenter(z), y, z],
    yaw: 0,
    label: `RING ${i + 1}`,
    points: 100,
  };
}

export const MISSIONS = [
  {
    id: 'fjord-run',
    name: 'Fjord Run',
    tag: '8 rings down the channel',
    desc: 'Thread the glowing rings in order, low over the water. Speed is free; missing a ring is not.',
    timeLimit: 150,
    start: { pos: [fjordCenter(-480), 62, -480], yaw: Math.PI, speed: 70, throttle: 0.85 },
    rings: [
      fjordRing(0, -380, 55),
      fjordRing(1, -240, 78),
      fjordRing(2, -100, 52),
      fjordRing(3, 40, 80),
      fjordRing(4, 180, 58),
      fjordRing(5, 320, 84),
      fjordRing(6, 460, 60),
      fjordRing(7, 600, 76),
    ],
  },
  {
    id: 'peak-slalom',
    name: 'Peak Slalom',
    tag: '6 gates between the peaks',
    desc: 'Weave the gates left and right through the high valley. Bank hard, keep the speed up.',
    timeLimit: 150,
    start: { pos: [0, 120, -420], yaw: Math.PI, speed: 80, throttle: 0.9 },
    rings: [
      { pos: [-150, 110, -280], yaw: 0, label: 'GATE 1', points: 150 },
      { pos: [160, 135, -140], yaw: 0, label: 'GATE 2', points: 150 },
      { pos: [-170, 95, 0], yaw: 0, label: 'GATE 3', points: 150 },
      { pos: [150, 125, 150], yaw: 0, label: 'GATE 4', points: 150 },
      { pos: [-140, 105, 300], yaw: 0, label: 'GATE 5', points: 150 },
      { pos: [0, 120, 470], yaw: 0, label: 'GATE 6', points: 150 },
    ],
  },
  {
    id: 'precision-landing',
    name: 'Precision Landing',
    tag: 'Runway 18, PAPI guided',
    desc: 'Come home to runway 18. Slow, steady, on the centreline — the PAPI lights are your friends.',
    timeLimit: 150,
    start: { pos: [0, 320, -520], yaw: Math.PI, speed: 75, throttle: 0.55 },
    rings: [],
  },
];

export function startMission(mission) {
  return {
    def: mission,
    name: mission.name,
    ringsTotal: mission.rings.length,
    ringsHit: 0,
    score: 0,
    timeLeft: mission.timeLimit,
    complete: false,
    failed: false,
    message: '',
  };
}

export function updateMission(m, dt, flight, rings) {
  if (m.complete || m.failed) return;
  m.timeLeft -= dt;
  if (m.timeLeft <= 0) {
    m.failed = true;
    m.message = 'Out of time.';
    return;
  }
  if (flight.state.crashed) {
    m.failed = true;
    m.message = 'Crashed. R to try again.';
    return;
  }
  if (flight.state.landed) {
    m.complete = true;
    m.score += flight.state.landedScore + Math.round(m.timeLeft) * 5;
    m.message = `Landed! Score ${m.score}.`;
    return;
  }
  // Next unpassed ring.
  const next = rings.find((r) => !r.passed);
  if (!next) {
    if (m.ringsTotal > 0) {
      m.complete = true;
      m.score += Math.round(m.timeLeft) * 5;
      m.message = `Course complete! Score ${m.score}.`;
    }
    return;
  }
  const d = flight.state.pos.distanceTo(next.group.position);
  if (d < CFG.rings.radius) {
    next.passed = true;
    m.ringsHit++;
    m.score += next.def.points;
    m.message = `${next.def.label} cleared! +${next.def.points}`;
  }
}
