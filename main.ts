// Ember Fjord — the hand-in program.
// Node 22, standard library only. It takes the playable game and its
// screenshots from beside this file, copies them into the output
// directory the grader reads, and writes the dossier the judge reads
// with the vendored make.fun library.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for
// /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Before it copies anything it checks the entry is shaped like the gate
// expects: a game/index.html, three or four screenshots under the size
// cap, and a game tree inside the file and byte caps. A malformed entry
// fails loudly here instead of silently failing in the grader.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const destination = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const GAME_DIR = join(repoRoot, 'game');
const SHOTS_DIR = join(repoRoot, 'screenshots');
const GAME_INDEX = join(GAME_DIR, 'index.html');

function fail(message) {
  throw new Error(`Ember Fjord hand-in refused: ${message}`);
}

function countTree(dir) {
  let files = 0;
  let bytes = 0;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) {
      const sub = countTree(path);
      files += sub.files;
      bytes += sub.bytes;
    } else {
      files += 1;
      bytes += st.size;
    }
  }
  return { files, bytes };
}

function checkEntry() {
  if (!existsSync(GAME_INDEX)) fail('game/index.html is missing');
  const shots = existsSync(SHOTS_DIR)
    ? readdirSync(SHOTS_DIR).filter((n) => !n.startsWith('.'))
    : [];
  if (shots.length < 3 || shots.length > 4) {
    fail(`expected 3 or 4 screenshots, found ${shots.length}`);
  }
  for (const name of shots) {
    const size = statSync(join(SHOTS_DIR, name)).size;
    if (size > 262144) fail(`screenshot ${name} is ${size} bytes, over the 256 KiB cap`);
  }
  const tree = countTree(GAME_DIR);
  if (tree.files > 993) fail(`game/ holds ${tree.files} files, over the 993 cap`);
  if (tree.bytes > 50331648) fail(`game/ is ${tree.bytes} bytes, over the 48 MiB cap`);
  return { shots: shots.length, gameFiles: tree.files, gameBytes: tree.bytes };
}

function handIn() {
  const checked = checkEntry();
  mkdirSync(destination, { recursive: true });
  cpSync(GAME_DIR, join(destination, 'game'), { recursive: true });
  mkdirSync(join(destination, 'screenshots'), { recursive: true });
  cpSync(SHOTS_DIR, join(destination, 'screenshots'), { recursive: true });
  const dossier = buildDossier(destination, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(destination, 'dossier.json'), dossier);
  console.log(
    `Ember Fjord handed in: ${checked.shots} screenshots, ` +
      `${checked.gameFiles} game files (${checked.gameBytes} bytes), ` +
      `dossier ${dossier.length} bytes -> ${destination}`,
  );
}

handIn();
