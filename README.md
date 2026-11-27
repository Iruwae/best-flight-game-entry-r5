[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Iruwae/best-flight-game-entry-r5/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Iruwae/best-flight-game-entry-r5/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

# Ember Fjord

A dusk flight game. Fly an orange-liveried jet through glowing rings down a fjord channel, slalom the peaks, or bring her home to runway 18 under the PAPI lights — all in one valley at golden hour.

## Play

Serve `game/` with any static server and open `game/index.html` in a desktop browser. No network request, no build step.

- **Arrows** fly (Up climbs, Down descends, Left/Right bank), **Shift** adds throttle, **Ctrl** cuts it, **C** swaps chase/cockpit camera, **R** restarts the mission, **Esc** returns to the menu. Mouse drag steers, wheel trims throttle.
- **Fjord Run** — thread 8 glowing rings in order, low over the water.
- **Peak Slalom** — weave 6 gates between the peaks.
- **Precision Landing** — land on runway 18, on the centreline, under the speed limit. Fuel burns and the jet crashes if you kiss the terrain.

## How it is built

Three.js (vendored as `game/vendor/three.min.js`) over a procedural world: a faceted, vertex-coloured heightfield with checkered valley fields, snow peaks and a water-filled fjord channel; a real F-35 jet model with a glowing afterburner; a 3D cockpit with six lit gauges; and a DOM HUD with speed/altitude tapes, compass, radar and attitude ball. The source is split into one-job modules under `game/src/` — `config`, `random`, `terrain`, `jet-glb`, `rings`, `cockpit`, `hud`, `input`, `flight`, `missions`, `menu`, `shots`, `render`, `main`.

The F-35 is the low-poly model by S1Priv (Sketchfab, CC BY 4.0) — `game/assets/f35-model.glb`, loaded at runtime by `game/src/jet-glb.js`.

The hero trees are "Oak Tree", "Pine Tree", "Birch Tree", "Weeping Willow" and "Snowy Spruce" by vinish.dev (https://vinish.dev/free-3d-models/), CC BY 4.0 — `game/assets/trees-vinish/`, instanced at runtime by `game/src/terrain-combined.js`. The far forest is procedurally generated with ez-tree (https://github.com/dgreenheck/ez-tree, MIT).

`main.ts` (Node 22, standard library only) hands the entry in: it copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library.
