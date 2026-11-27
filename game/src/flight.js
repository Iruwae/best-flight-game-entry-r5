// Ember Fjord — arcade flight model.
// Throttle sets a target speed, banking turns the jet, pitch climbs and
// descends, and below stall speed the jet sinks. Terrain, water and the
// runway decide between a crash, a ditch and a landing.

import * as THREE from 'three';
import { CFG } from './config.js';
import { heightAt } from './terrain-combined.js';

const F = CFG.flight;
const R = CFG.runway;

export function createFlight(start) {
  const state = {
    pos: new THREE.Vector3(...start.pos),
    yaw: start.yaw,
    pitch: 0,
    roll: 0,
    speed: start.speed ?? 60,
    throttle: start.throttle ?? 0.7,
    fuel: F.fuelStart,
    damage: 0,
    crashed: false,
    landed: false,
    landedScore: 0,
    vsMs: 0,
    egt: 700,
  };

  function forward() {
    return new THREE.Vector3(
      -Math.sin(state.yaw) * Math.cos(state.pitch),
      Math.sin(state.pitch),
      -Math.cos(state.yaw) * Math.cos(state.pitch),
    );
  }

  function onRunway() {
    const dx = state.pos.x - R.center[0];
    const dz = state.pos.z - R.center[2];
    return Math.abs(dx) < R.width / 2 + 6 && Math.abs(dz) < R.length / 2 + 6;
  }

  function step(dt, input) {
    if (state.crashed || state.landed) return;
    // Throttle.
    if (input.throttleUp()) state.throttle = Math.min(1, state.throttle + dt * 0.55);
    if (input.throttleDown()) state.throttle = Math.max(0, state.throttle - dt * 0.7);
    state.throttle = Math.max(0, Math.min(1, state.throttle + input.wheel()));
    // Fuel.
    if (state.fuel > 0) {
      const burn = F.fuelBurnCruise + state.throttle * (F.fuelBurnFull - F.fuelBurnCruise);
      state.fuel = Math.max(0, state.fuel - burn * dt);
    }
    const thrust = state.fuel > 0 ? state.throttle : 0;
    // Speed chases the throttle target, with drag.
    const target = thrust * F.maxSpeed;
    const rate = 0.45 + F.drag * state.speed * 40;
    state.speed += (target - state.speed) * (1 - Math.exp(-rate * dt));
    // Pitch and roll from input, eased toward the stick.
    const pitchTarget = input.pitch() * 0.55;
    const rollTarget = input.roll() * 1.1;
    state.pitch += (pitchTarget - state.pitch) * (1 - Math.exp(-F.pitchRate * 2.2 * dt));
    state.roll += (rollTarget - state.roll) * (1 - Math.exp(-F.rollRate * 2.2 * dt));
    // Banked turn: yaw follows the bank.
    state.yaw -= state.roll * F.turnFactor * (0.35 + state.speed / F.maxSpeed) * dt;
    // Vertical speed: pitch carries the jet, stall sinks it.
    let vy = Math.sin(state.pitch) * state.speed;
    if (state.speed < F.stallSpeed) {
      vy -= (F.stallSpeed - state.speed) * 0.9;
    }
    state.vsMs = vy;
    state.pos.addScaledVector(forward(), state.speed * dt);
    state.pos.y += vy * dt;
    state.egt = 580 + thrust * 260 + Math.max(0, 60 - state.speed) * 0.4;
    // Ground and water.
    const ground = heightAt(state.pos.x, state.pos.z);
    if (state.pos.y < CFG.world.waterLevel + 1 && ground < CFG.world.waterLevel) {
      state.crashed = true;
      state.damage = 100;
      return;
    }
    if (state.pos.y <= ground + 1.4) {
      const sink = -vy;
      if (onRunway() && state.speed < R.maxTouchSpeed && sink < R.maxSink && Math.abs(state.roll) < 0.25) {
        state.landed = true;
        state.pos.y = ground + 1.4;
        const centreErr = Math.abs(state.pos.x - R.center[0]);
        const zoneErr = Math.abs(state.pos.z - (R.center[2] - R.length / 2 + 90));
        state.landedScore = Math.max(0, Math.round(1000 - centreErr * 12 - zoneErr * 2 - sink * 22));
      } else {
        state.crashed = true;
        state.damage = 100;
        state.pos.y = ground + 1.4;
      }
    }
    if (state.pos.y > 600) state.pos.y = 600;
  }

  function applyTo(jet) {
    jet.position.copy(state.pos);
    jet.rotation.set(state.pitch, state.yaw, -state.roll, 'YXZ');
    jet.userData.setAfterburner(state.throttle);
  }

  function hudState() {
    const hdg = ((-(state.yaw * 180) / Math.PI) % 360 + 360) % 360;
    return {
      pos: state.pos,
      hdgDeg: hdg,
      pitchDeg: (state.pitch * 180) / Math.PI,
      rollDeg: (state.roll * 180) / Math.PI,
      kts: state.speed * 1.94384,
      altFt: Math.max(0, state.pos.y * 3.28084),
      vsFpm: state.vsMs * 196.85,
      mach: state.speed / 343,
      thr: state.throttle,
      fuel: state.fuel,
      egt: state.egt,
    };
  }

  return { state, step, applyTo, hudState, forward, onRunway };
}
