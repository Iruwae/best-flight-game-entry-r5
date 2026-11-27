// Ember Fjord — boot and game loop.
// Builds the world, owns the camera, runs the missions and freezes the
// frame for screenshots. The loop is deliberately boring: read input,
// step the flight model, update the mission, move the camera, paint the
// instruments, render. Everything interesting lives in the modules it
// calls.

import * as THREE from 'three';
import { CFG } from './config.js';
import { mulberry32 } from './random.js';
import {
  createRenderer,
  createSky,
  createSun,
  createClouds,
  createLights,
} from './render.js';
import { buildTerrain, buildRunway } from './terrain.js';
import { buildJet } from './jet.js';
import { buildRings } from './rings.js';
import { buildCockpit } from './cockpit.js';
import { buildHUD } from './hud.js';
import { createInput } from './input.js';
import { createFlight } from './flight.js';
import { MISSIONS, startMission, updateMission } from './missions.js';
import { buildMenu } from './menu.js';
import { placeShot } from './shots.js';

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 6000);
scene.add(camera);

createSky(scene);
createSun(scene);
createClouds(scene, mulberry32(3));
createLights(scene);
buildTerrain(scene);
buildRunway(scene);

const jet = buildJet();
scene.add(jet);

const hud = buildHUD();
hud.root.style.display = 'none'; // The game opens on the menu; the HUD appears when a mission starts.
const cockpit = buildCockpit(camera);
const input = createInput();

let flight = createFlight(MISSIONS[0].start);
let mission = startMission(MISSIONS[0]);
let rings = buildRings(scene, MISSIONS[0].rings);

const world = {
  scene,
  camera,
  renderer,
  jet,
  flight,
  mission,
  rings,
  hud,
  cockpit,
  menu: null,
  cameraMode: 'chase',
  chaseDist: 19,
  chaseHeight: 4.5,
  frozen: false,
  mode: 'menu',
  startMission: beginMission,
  updateCamera,
  updateHud,
};

function beginMission(id) {
  const def = MISSIONS.find((m) => m.id === id) ?? MISSIONS[0];
  for (const r of rings) scene.remove(r.group);
  rings = buildRings(scene, def.rings);
  world.rings = rings;
  flight = createFlight(def.start);
  world.flight = flight;
  mission = startMission(def);
  world.mission = mission;
  world.cameraMode = 'chase';
  world.chaseDist = 19;
  world.chaseHeight = 4.5;
  world.mode = 'play';
  world.menu.hide();
  hud.root.style.display = 'block';
  flight.applyTo(jet);
}

world.menu = buildMenu((id) => beginMission(id));
world.menu.show();

const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3();

function updateCamera(dt = 0, snap = false) {
  const f = flight.state;
  const forward = flight.forward();
  hud.setMode(world.cameraMode);
  if (world.cameraMode === 'cockpit') {
    camPos.copy(f.pos).addScaledVector(forward, 1.2);
    camPos.y += 2.0; // High enough to clear the jet's gold canopy dome,
    // which otherwise fills the lower centre of the frame and covers
    // the panoramic display's lower half.
    camTarget.copy(f.pos).addScaledVector(forward, 120);
    camTarget.y += 5;
    cockpit.visible = true;
  } else if (world.cameraMode === 'scenic') {
    camPos.set(170, 125, -320);
    camTarget.set(0, 30, 250);
    cockpit.visible = false;
  } else {
    camPos.copy(f.pos).addScaledVector(forward, -world.chaseDist);
    camPos.y += world.chaseHeight;
    camTarget.copy(f.pos).addScaledVector(forward, 12);
    camTarget.y += 0.5;
    cockpit.visible = false;
  }
  if (snap || world.frozen) {
    camera.position.copy(camPos);
  } else {
    const k = 1 - Math.exp(-7 * Math.max(dt, 0.001));
    camera.position.lerp(camPos, k);
  }
  camera.lookAt(camTarget);
}

function updateHud() {
  const next = rings.find((r) => !r.passed);
  const hs = flight.hudState();
  hud.update({
    ...hs,
    missionName: mission.name,
    timeLeft: Math.max(0, Math.ceil(mission.timeLeft)),
    ringsHit: mission.ringsHit,
    ringsTotal: mission.ringsTotal,
    score: mission.score,
    nextRing: next ? { pos: next.group.position } : null,
  });
  if (next) next.setDistance(flight.state.pos.distanceTo(next.group.position));
}

function showMenuBackdrop(dt) {
  // Gentle orbit while the menu is up; the jet circles the valley.
  const t = performance.now() * 0.00004;
  camera.position.set(Math.cos(t) * 420, 170, Math.sin(t) * 420);
  camera.lookAt(0, 30, 100);
  const a = performance.now() * 0.00012;
  flight.state.pos.set(Math.cos(a) * 220, 90, Math.sin(a) * 220);
  flight.state.yaw = -a + Math.PI / 2;
  flight.state.roll = 0.35;
  flight.state.speed = 70;
  flight.state.throttle = 0.7;
  flight.applyTo(jet);
}

const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (world.frozen) {
    renderer.render(scene, camera);
    return;
  }
  if (world.mode === 'menu') {
    showMenuBackdrop(dt);
    renderer.render(scene, camera);
    input.endFrame();
    return;
  }
  if (input.justPressed('KeyC')) {
    world.cameraMode = world.cameraMode === 'chase' ? 'cockpit' : 'chase';
  }
  if (input.justPressed('KeyR')) {
    beginMission(mission.def.id);
  }
  if (input.justPressed('Escape') || input.justPressed('KeyM')) {
    world.mode = 'menu';
    world.menu.show();
    hud.root.style.display = 'none';
  }
  flight.step(dt, input);
  updateMission(mission, dt, flight, rings);
  flight.applyTo(jet);
  updateCamera(dt);
  updateHud();
  cockpit.userData.update(flight.hudState());
  renderer.render(scene, camera);
  input.endFrame();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Screenshot mode: ?shot=chase|cockpit|valley|menu&seed=1 freezes the
// world in a composed frame instead of starting the game.
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  placeShot(shot, world);
} else {
  flight.applyTo(jet);
  updateCamera(0, true);
  loop();
}
