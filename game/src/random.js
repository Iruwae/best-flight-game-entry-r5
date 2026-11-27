// Ember Fjord — deterministic randomness.
// Everything procedural in the game (terrain, trees, rocks, clouds) draws
// from here, so a fixed seed always builds the same world. The screenshot
// setups pass seed 1 and the world never changes under them.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Integer-lattice hash: same (x, z, seed) always gives the same [0, 1).
export function hash2(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 974634211) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

// Smooth value noise in 2D, single octave.
export function valueNoise(x, z, seed) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smooth(x - ix);
  const fz = smooth(z - iz);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  const ab = a + (b - a) * fx;
  const cd = c + (d - c) * fx;
  return ab + (cd - ab) * fz;
}

// Fractal brownian motion: 4 octaves of value noise, [0, 1) roughly.
export function fbm(x, z, seed) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let o = 0; o < 4; o++) {
    sum += amp * valueNoise(x * freq, z * freq, seed + o * 101);
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum;
}

// Pick a point from a list without replacement, driven by a rng.
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}
