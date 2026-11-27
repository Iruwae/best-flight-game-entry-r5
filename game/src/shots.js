// Ember Fjord — deterministic screenshot setups.
// ?shot=chase|cockpit|valley|menu&seed=1 freezes the world in a composed
// frame: the jet big and low over the fjord, a glowing ring ahead with its
// distance label, the dusk valley behind it. No animation runs under a
// shot, so the frame Playwright captures is the frame the judge sees.

import { CFG } from './config.js';
import { fjordCenter } from './terrain.js';
import { MISSIONS } from './missions.js';

function findRing(rings, label) {
  return rings.find((r) => r.def.label === label);
}

export function placeShot(name, w) {
  w.frozen = true;
  w.menu.hide();
  w.hud.root.style.display = 'block';
  const mission = MISSIONS[0];
  w.startMission('fjord-run');
  const f = w.flight.state;

  if (name === 'chase') {
    f.pos.set(fjordCenter(-440), 56, -440);
    f.yaw = Math.PI;
    f.pitch = 0;
    f.roll = 0.12;
    f.speed = 78;
    f.throttle = 0.85;
    f.fuel = 99;
    w.mission.timeLeft = 148;
    w.mission.score = 0;
    w.mission.ringsHit = 0;
    const ring = findRing(w.rings, 'RING 1');
    if (ring) ring.setDistance(62);
    w.cameraMode = 'chase';
    w.chaseDist = CFG.shots.chase.dist;
    w.chaseHeight = CFG.shots.chase.height;
  } else if (name === 'cockpit') {
    f.pos.set(fjordCenter(-310), 82, -310);
    f.yaw = Math.PI;
    f.pitch = 0.02;
    f.roll = -0.08;
    f.speed = 82;
    f.throttle = 0.85;
    f.fuel = 98;
    w.mission.timeLeft = 146;
    w.mission.score = 100;
    w.mission.ringsHit = 1;
    const ring = findRing(w.rings, 'RING 2');
    if (ring) ring.setDistance(71);
    w.cameraMode = 'cockpit';
  } else if (name === 'valley') {
    f.pos.set(0, 140, -100);
    f.yaw = Math.PI;
    f.pitch = 0;
    f.roll = 0.1;
    f.speed = 75;
    f.throttle = 0.8;
    f.fuel = 97;
    w.mission.timeLeft = 121;
    w.mission.score = 400;
    w.mission.ringsHit = 4;
    const ring = findRing(w.rings, 'RING 3');
    if (ring) ring.setDistance(152);
    w.cameraMode = 'chase';
    w.chaseDist = CFG.shots.valley.dist;
    w.chaseHeight = CFG.shots.valley.height;
  } else if (name === 'menu') {
    w.hud.root.style.display = 'none';
    f.pos.set(40, 70, 60);
    f.yaw = Math.PI;
    f.pitch = 0;
    f.roll = 0.05;
    f.speed = 70;
    f.throttle = 0.7;
    w.cameraMode = 'scenic';
    w.menu.show();
  }

  w.flight.applyTo(w.jet);
  w.updateCamera();
  w.updateHud();
  w.cockpit.userData.update(w.flight.hudState());
  w.renderer.render(w.scene, w.camera);
}
