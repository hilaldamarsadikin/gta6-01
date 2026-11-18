// TELUK EMAS — the entry program (Node 22, standard library only). It
// hands the game in: the whole game/ folder and screenshots/ are copied
// beside this file into /output, and /output/dossier.json is written with
// the vendored make.fun library, so the judge can read the game. Serve it
// locally first with `node serve.ts`, then open http://localhost:8080 to
// play. Run it outside the grader with MAKEFUN_OUTPUT_DIR standing in
// for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The scorer's own caps, in one place: the text budget shapes the
// dossier's bytes, the rest refuse an entry the scorer would refuse
// (more than 4 screenshots or one over 256 KiB; more than 993 files in
// game/ or 48 MiB of game files in all, or a path under game/ over
// 1000 bytes). The dossier itself is capped at 1.5 MiB, and every cap is
// checked here before the dossier is built, so a bad handoff fails loud
// and early instead of dying quietly at the gate.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
  dossier_max_bytes: 1572864,
};

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function countFiles(dir) {
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    n += entry.isDirectory() ? countFiles(path) : 1;
  }
  return n;
}

// Total bytes under a folder, so the log can say how big the handoff is
// and the game-bytes cap can be checked with a real number, not a guess.
function countBytes(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    total += entry.isDirectory() ? countBytes(path) : statSync(path).size;
  }
  return total;
}

function fail(message) {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// Refuse a broken handoff early, with a readable message, instead of
// handing the scorer an empty screenshots folder. The four staged shots
// are cover, walk, mission and night (see shots.json).
const shotDir = join(here, 'screenshots');
const shotFiles = existsSync(shotDir)
  ? readdirSync(shotDir).filter((f) => f.endsWith('.jpg'))
  : [];
if (shotFiles.length === 0) {
  fail('no screenshots found in screenshots/ — take the four shots first (1-cover, 2-walk, 3-mission, 4-night)');
}
if (shotFiles.length > DOSSIER_CAPS.screenshots.max) {
  fail(`found ${shotFiles.length} screenshots, over the ${DOSSIER_CAPS.screenshots.max} cap — keep only the four staged shots`);
}
// A screenshot over the scorer's 256 KiB cap would be refused at the
// gate, so check the size here instead of after the dossier is built.
for (const shot of shotFiles) {
  const size = statSync(join(shotDir, shot)).size;
  if (size > DOSSIER_CAPS.screenshots.max_bytes) {
    fail(`screenshots/${shot} is ${size} bytes, over the ${DOSSIER_CAPS.screenshots.max_bytes} cap`);
  }
}
const gameFiles = countFiles(join(here, 'game'));
if (gameFiles > DOSSIER_CAPS.game_max_files) {
  fail(`game/ holds ${gameFiles} files, over the ${DOSSIER_CAPS.game_max_files} cap`);
}
const gameBytes = countBytes(join(here, 'game'));
if (gameBytes > DOSSIER_CAPS.game_max_bytes) {
  fail(`game/ is ${gameBytes} bytes, over the ${DOSSIER_CAPS.game_max_bytes} cap (48 MiB)`);
}

writeFileSync(join(out, 'dossier.json'), buildDossier(out, DOSSIER_CAPS));
const dossierBytes = statSync(join(out, 'dossier.json')).size;
if (dossierBytes > DOSSIER_CAPS.dossier_max_bytes) {
  fail(`dossier is ${dossierBytes} bytes, over the 1.5 MiB budget`);
}
console.log(`dossier written: ${dossierBytes} bytes, ${gameFiles} game files (${gameBytes} bytes), ${shotFiles.length} screenshots`);
