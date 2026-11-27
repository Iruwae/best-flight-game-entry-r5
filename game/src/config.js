// Ember Fjord — every tuning number in one place.
// The game reads this file first; nothing else hard-codes a magic number
// for the world, the jet, the light or the missions.

export const CFG = {
  // World extents in metres. x is east, z is south, y is up.
  world: {
    size: 2400,
    half: 1200,
    waterLevel: -2,
    fogNear: 250,
    fogFar: 1900,
  },

  // Terrain shape. Peaks rise to ~235 m; the valley floor sits at ~2 m
  // and the fjord channel is carved down to -16 m so water shows.
  terrain: {
    segments: 180,
    peakHeight: 235,
    snowLine: 95,
    rockLine: 55,
    valley: { x0: -60, x1: 60, z0: -520, z1: 720, floor: 2 },
    fjord: { depth: -16, width: 90, bend: 130, bendFreq: 0.0016 },
    fieldSize: 120,
    treeCount: 260,
    rockCount: 140,
  },

  // Dusk light. The sun sits low in the west so the whole valley glows
  // warm and every emissive part (rings, afterburner, PAPI) pops.
  sky: {
    sunDir: [-0.72, 0.15, 0.55],
    sunColor: 0xffb066,
    sunIntensity: 2.3,
    hemiSky: 0x8a7bd8,
    hemiGround: 0x7a5a44,
    hemiIntensity: 1.5,
    fogColor: 0xd99a6c,
    topColor: 0x2e2a5e,
    midColor: 0x9a5a7a,
    lowColor: 0xffb066,
  },

  // The jet. Orange wings and tail over a white fuselage, navy intakes,
  // blue glass canopy — built to read at a glance against dusk terrain.
  jet: {
    bodyColor: 0xf2f0ea,
    orange: 0xff6a1a,
    navy: 0x1a2a4a,
    glassColor: 0x0a2438,
    glassMetal: 0.9,
    glassRough: 0.12,
    span: 11.4,
    length: 15.2,
    afterburner: { core: 0xffd23e, mid: 0xff7a1a, outer: 0xff3d00 },
  },

  // Runway 18 in the valley floor, heading due south.
  runway: {
    center: [0, 2, 400],
    heading: Math.PI,
    length: 420,
    width: 30,
    maxTouchSpeed: 62,
    maxSink: 6,
  },

  // Flight model (arcade, not a sim). Speeds in m/s.
  flight: {
    maxSpeed: 185,
    cruiseSpeed: 95,
    stallSpeed: 34,
    throttleAccel: 14,
    drag: 0.00012,
    rollRate: 1.25,
    pitchRate: 0.85,
    turnFactor: 0.55,
    fuelBurnCruise: 0.05,
    fuelBurnFull: 0.16,
    fuelStart: 100,
  },

  // Ring gates for the Fjord Run mission.
  rings: {
    count: 8,
    radius: 17,
    tube: 1.1,
    gold: 0xffc23e,
  },

  // HUD colours.
  hud: {
    panel: 'rgba(8, 14, 26, 0.72)',
    accent: '#ffb066',
    green: '#7dff9a',
    red: '#ff5a5a',
    text: '#e8f0ff',
  },

  // Deterministic screenshot setups.
  shots: {
    chase: { dist: 19, height: 4.5, ring: 0 },
    cockpit: { ring: 1 },
    valley: { dist: 40, height: 14, ring: 3 },
    menu: {},
  },
};
