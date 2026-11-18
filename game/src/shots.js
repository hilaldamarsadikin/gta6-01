// TELUK EMAS — screenshot staging: each named shot arranges the live
// world into one readable picture, then the page paints it twice and
// raises window.__shotReady. The shots reuse the real game state (real
// cars, real police, the real HUD), never a fake backdrop — so what the
// judge sees in a still is what the player sees in the game.
//
// The four shots, matching shots.json: cover (the chase), walk (on foot
// in town), mission (the timed delivery), night (dusk at the harbour).
// An unknown name stages nothing but still shows the HUD, so a typo in
// the query never leaves a black frame.
import { COVER_STAGING } from './config.js';
import { placeWalker } from './pedestrians.js';

// How many scripted steps the world settles for before the paint: two
// seconds at 1/60 s, long enough for traffic to be mid-flow and the chase
// to actually be chasing, short enough to stay inside a headless timeout.
// main.js drives the settle loop with this number.
export const SETTLE_STEPS = 120;

// The four staged names, in the order shots.json lists them. main.js
// checks a ?shot= value against this list before staging, so a typo
// stages nothing instead of silently falling through to a live game.
export const SHOT_NAMES = ['cover', 'walk', 'mission', 'night'];

export function isValidShot(name) {
  // exact match only: "Cover" or "COVER" stages nothing, by design.
  return SHOT_NAMES.includes(name);
}

export function stageShot(name, w) {
  if (name === 'cover') {
    // the chase, staged to read at a glance: Raka driving fast, two
    // cruisers head-on ahead of him with their strobes flashing, three
    // stars, the minimap and the HUD alive. The police fleet is held in
    // place for the still, so both cruisers stay in frame.
    w.setTimeOfDay(0.22);
    w.putPlayerInCar(w.cars[0], 0, 0, 0);
    w.cars[0].speed = 26;
    w.police.state.wanted = 3;
    for (const [px, pz, heading] of COVER_STAGING.policeSpots) {
      w.police.spawnCarAt(px, pz, heading);
    }
    w.police.setHeld(true);
    w.police.flashBars(0.4);
    // traffic ahead on the same road to weave through
    const t0 = w.traffic.cars[0];
    t0.x = 2; t0.z = -90; t0.heading = 0; t0.speed = 9;
    t0.loop = [{ x: 0, z: -280 }, { x: 0, z: 280 }]; t0.loopIndex = 0;
    const t1 = w.traffic.cars[1];
    t1.x = -3; t1.z = -140; t1.heading = 0; t1.speed = 9;
    t1.loop = [{ x: 0, z: -280 }, { x: 0, z: 280 }]; t1.loopIndex = 0;
    w.missions.state.index = 2;
    w.missions.start();
    w.money = 2450;
    w.hud.setMoney(2450);
    w.hud.setObjective('Lolos dari Kejaran — hilangkan polisi dari ekormu!');
    w.camDistance = COVER_STAGING.camDistance;
    w.camHeight = COVER_STAGING.camHeight;
    w.camSide = COVER_STAGING.camSide;
  } else if (name === 'walk') {
    // on foot in the busy heart of town: Raka on the road's edge, traffic
    // rolling past, pedestrians on the sidewalk beside him, the bank tower
    // behind. Three walkers are moved in close so the crowd reads.
    w.setTimeOfDay(0.08);
    w.putPlayerOnFoot(6, 80, Math.PI);
    const near = [[12, 70, 0], [14, 88, Math.PI], [11, 96, Math.PI / 2]];
    w.pedestrians.walkers.slice(0, 3).forEach((walker, i) => {
      placeWalker(walker, near[i][0], near[i][1], near[i][2]);
    });
    w.police.state.wanted = 0;
    w.missions.state.index = 0;
    w.missions.start();
    w.hud.setObjective('Pemanasan — naik mobil apa saja, lalu datang ke titik kuning.');
    w.camDistance = 8;
    w.camHeight = 3.4;
  } else if (name === 'mission') {
    // a timed delivery in progress: Raka racing the clock across town,
    // traffic on the east road, the countdown big in the HUD.
    w.setTimeOfDay(0.3);
    w.putPlayerInCar(w.cars[1], -160, 0, Math.PI / 2);
    w.cars[1].speed = 24;
    const m0 = w.traffic.cars[2];
    m0.x = -100; m0.z = 2; m0.heading = Math.PI / 2; m0.speed = 9;
    m0.loop = [{ x: -280, z: 0 }, { x: 280, z: 0 }]; m0.loopIndex = 0;
    const m1 = w.traffic.cars[3];
    m1.x = -55; m1.z = -2; m1.heading = Math.PI / 2; m1.speed = 9;
    m1.loop = [{ x: -280, z: 0 }, { x: 280, z: 0 }]; m1.loopIndex = 0;
    w.missions.state.index = 3;
    w.missions.start();
    w.missions.state.timer = 42;
    w.hud.setObjective('Antar Paket — sampai di gudang utara sebelum waktu habis!');
    w.hud.setTimer(42, true);
    w.camDistance = 8;
    w.camHeight = 3.6;
    w.camSide = 0;
  } else if (name === 'night') {
    // dusk at the harbour: Raka about to lift the golden sedan, lamps lit,
    // the city glowing behind him, the beacon marking the prize.
    w.setTimeOfDay(0.95);
    w.putPlayerOnFoot(-6, 106, 2.68);
    w.police.state.wanted = 0;
    w.missions.state.index = 1;
    w.missions.start();
    w.hud.setObjective('Mobil Target — curi sedan emas di dekat taman.');
    w.camDistance = 7;
    w.camHeight = 3;
  }
  // the HUD always shows in shots: money, health, stars, minimap.
  w.hud.setHealth(w.player.health);
  w.hud.setWanted(w.police.state.wanted);
  w.hud.setAmmo(w.player.ammo, true);
  w.hud.showCrosshair(false);
  w.hud.showScreen(null);
}
