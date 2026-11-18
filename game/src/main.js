// TELUK EMAS — boot and the one loop. The world is built once (city,
// cars, traffic, pedestrians, police, missions, the player), then a fixed
// 1/60 s simulation steps under a requestAnimationFrame painter. Four
// screens: title, play, paused and game over. ?shot=cover|walk|mission|
// night (with &seed=N) stages that scene instead of running the loop,
// paints it twice and sets window.__shotReady for a screenshot.
// window.__teluk exposes the live systems for scripted play-tests.
import * as THREE from '../vendor/three/three.module.min.js';
import { STEP, CITY, PLAYER, CAR, WANTED, MONEY, MISSIONS, TOTAL_MISSION_REWARD, CAMERA_DEFAULTS } from './config.js';
import { createRandom } from './random.js';
import { createCity, isOnRoad } from './city.js';
import { createCar, randomCarColour, goldCarColour, stepPlayerCar, nearestStealable, setLights } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createPedestrians, startle } from './pedestrians.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createPlayer, resetPlayer, healPlayer, reloadPlayer, isPlayerAlive, isPlayerArmed, stepPlayer, shootAt, punchAt } from './player.js';
import {
  createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER_CAR, ACTION_EXIT_CAR,
  ACTION_HORN, ACTION_RELOAD, ACTION_TAXI, ACTION_MUTE, ACTION_PUNCH,
} from './input.js';
import { createHud } from './hud.js';
import { createMinimap } from './minimap.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave } from './save.js';
import { createEffects } from './effects.js';
import { stageShot, SETTLE_STEPS } from './shots.js';

// Revision marker: bump this when a revision pass lands, so a screenshot
// or a play-test log can say which build it came from. r5 is a polish pass
// only (HUD flash, camera defaults, twelfth facade palette, small helpers):
// no gameplay logic changed, so earlier play-test results still hold.
const VERSION = 'r5';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const random = createRandom(seed);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);

const city = createCity(scene, random);
const hud = createHud();
const minimap = createMinimap(document.getElementById('minimap'));
const audio = createAudio();
const effects = createEffects(scene);
const save = loadSave();
const input = createInput(canvas);

const G = {
  money: save.money,
  timeOfDay: 0.15,
  elapsed: 0,
  camDistance: CAMERA_DEFAULTS.distance,
  camHeight: CAMERA_DEFAULTS.height,
  camSide: CAMERA_DEFAULTS.side, // lateral camera offset: a three-quarter rear view when set
};

// --- the cast ------------------------------------------------------------
const player = createPlayer(scene);
player.x = 0;
player.z = 40;
player.mesh.position.set(0, 0, 40);

const parkedCars = [];
const parkedSpots = [
  [6, 40, 0], [-6, -40, Math.PI], [88, 6, Math.PI / 2], [-88, -6, -Math.PI / 2],
  [168, 88, Math.PI], [6, 168, 0], [-168, -88, Math.PI / 2], [88, -168, -Math.PI / 2],
];
for (const [x, z, heading] of parkedSpots) {
  const car = createCar(scene, x, z, heading, randomCarColour(random), false);
  car.driver = null;
  car.parked = true;
  parkedCars.push(car);
}
const goldenCar = createCar(scene, 0, 120, 0, goldCarColour(), false);
goldenCar.driver = null;
goldenCar.parked = true;
goldenCar.target = true;
parkedCars.push(goldenCar);

const traffic = createTraffic(scene, random);
const pedestrians = createPedestrians(scene, random);
const police = createPolice(scene, random);
const missions = createMissions(scene, {
  onObjective(text) {
    hud.setObjective(text);
    hud.say(text);
    hud.flashObjective();
  },
  onReward(amount) {
    G.money += amount;
    hud.setMoney(G.money);
    hud.pulseMoney();
    save.money = G.money;
    writeSave(save);
    audio.pickup();
  },
  onMissionComplete(index) {
    save.missionIndex = index + 1;
    save.money = G.money;
    writeSave(save);
  },
  onWantedSet(n) {
    police.state.wanted = n;
    police.state.unseenTimer = 0;
  },
});
missions.state.index = Math.min(save.missionIndex, MISSIONS.length - 1);
if (save.missionIndex >= MISSIONS.length) missions.state.finished = true;

const allCars = () => [...parkedCars, ...traffic.cars, ...police.state.cars];

let screen = 'title';
let currentCar = null;
let camYaw = 0;
let camPos = new THREE.Vector3(0, 8, 52);
let lastHurt = -10;
let lastWantedBump = -10;
let exhaustTimer = 0;
let dustTimer = 0;
let saveTimer = 0;

function announce(message) {
  status.textContent = message;
}

function collide(x, z, radius) {
  if (Math.abs(x) > 308 || z > 366 || z < -308) return true;
  for (const c of city.colliders) {
    if (x > c.minX - radius && x < c.maxX + radius && z > c.minZ - radius && z < c.maxZ + radius) return true;
  }
  return false;
}

function putPlayerInCar(car, x, z, heading) {
  if (currentCar && currentCar !== car) currentCar.driver = null;
  currentCar = car;
  car.driver = 'player';
  car.parked = false;
  car.x = x;
  car.z = z;
  car.heading = heading;
  car.speed = car.speed || 0;
  car.mesh.position.set(x, 0, z);
  car.mesh.rotation.y = -heading;
  player.mesh.visible = false;
  player.x = x;
  player.z = z;
  player.heading = heading;
  camYaw = heading;
}

function putPlayerOnFoot(x, z, heading) {
  if (currentCar) {
    currentCar.driver = null;
    currentCar = null;
  }
  player.x = x;
  player.z = z;
  player.heading = heading;
  player.mesh.visible = true;
  player.mesh.position.set(x, 0, z);
  camYaw = heading;
}

function setTimeOfDay(t) {
  G.timeOfDay = Math.max(0, Math.min(1, t));
  city.setTimeOfDay(G.timeOfDay);
  // headlights come on as the day fades, for every car on the road
  for (const car of allCars()) setLights(car, G.timeOfDay > 0.5);
}
setTimeOfDay(G.timeOfDay);

// The staging handle: screenshot mode drives the world through this, and
// scripted play-tests read the live state through window.__teluk.
const W = {
  setTimeOfDay, putPlayerInCar, putPlayerOnFoot,
  cars: allCars(), police, missions, hud, player, traffic, pedestrians,
  get money() { return G.money; },
  set money(v) { G.money = v; },
  get camDistance() { return G.camDistance; },
  set camDistance(v) { G.camDistance = v; },
  get camHeight() { return G.camHeight; },
  set camHeight(v) { G.camHeight = v; },
  get camSide() { return G.camSide; },
  set camSide(v) { G.camSide = v; },
};

window.__teluk = {
  W, G, player, police, missions, traffic, pedestrians, audio, save,
  parkedCars, goldenCar, version: VERSION,
  get screen() { return screen; },
  get currentCar() { return currentCar; },
  startGame, putPlayerInCar, putPlayerOnFoot, setTimeOfDay,
};

// --- screens --------------------------------------------------------------
function showTitle() {
  screen = 'title';
  hud.showScreen('title');
  hud.showCrosshair(false);
  if (save.missionIndex >= MISSIONS.length) {
    // the story is over: say so plainly, never "misi 5 dari 5" again
    hud.setTitleSave(`Cerita tamat — utang lunas! Raka bebas. Uang $${save.money.toLocaleString('en-US')}. Total hadiah misi: $${TOTAL_MISSION_REWARD.toLocaleString('en-US')}.`);
  } else if (save.missionIndex > 0 || save.money !== MONEY.start) {
    hud.setTitleSave(`Lanjutan: misi ${save.missionIndex + 1} dari ${MISSIONS.length} — uang $${save.money.toLocaleString('en-US')}. Utang ke Mira: $${MONEY.debt.toLocaleString('en-US')}.`);
  } else {
    hud.setTitleSave('Permainan baru — Raka berutang $12.000 pada Mira.');
  }
  announce('Teluk Emas. Tekan Spasi atau klik Mulai.');
}

function startGame() {
  audio.ensure();
  if (save.missionIndex < MISSIONS.length && !missions.state.active && !missions.state.finished) {
    missions.start();
  } else if (missions.state.finished) {
    hud.setObjective('UTANG LUNAS. Teluk Emas akhirnya milik Raka.');
  }
  screen = 'play';
  hud.showScreen(null);
  announce('Bermain. Ikuti titik kuning di peta.');
}

function endGame(reason) {
  screen = 'over';
  hud.setOverText(reason);
  hud.showScreen('over');
  hud.showCrosshair(false);
  audio.setEngine(0, false);
  audio.setSiren(false, 0);
  police.clearWanted();
  save.money = G.money;
  writeSave(save);
  announce(`Game over. ${reason}`);
}

document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-resume').addEventListener('click', () => {
  audio.resume();
  screen = 'play';
  hud.showScreen(null);
});
document.getElementById('btn-restart').addEventListener('click', () => {
  // a clean run: no inherited manhunt, no half-finished job, Raka whole,
  // no smoke or flashes hanging in the air from the last run, and no key
  // held over from the game-over screen firing in the new run
  police.reset();
  missions.reset();
  effects.clear();
  input.reset();
  resetPlayer(player, 0, 40, 0);
  putPlayerOnFoot(0, 40, 0);
  screen = 'play';
  hud.showScreen(null);
  hud.setHealth(player.health);
  missions.start();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- combat and collisions -------------------------------------------------
function hurtPlayer(amount, reason) {
  if (G.elapsed - lastHurt < 1) return;
  lastHurt = G.elapsed;
  player.health -= amount;
  hud.setHealth(player.health);
  if (!isPlayerAlive(player)) {
    player.health = 0;
    endGame(reason);
  }
}

function gainWanted(amount) {
  if (G.elapsed - lastWantedBump < 2) return;
  lastWantedBump = G.elapsed;
  police.addWanted(amount);
}

function handleShooting() {
  if (!input.shooting() || currentCar || !isPlayerArmed(player)) return;
  const targets = [];
  for (const w of pedestrians.walkers) targets.push({ x: w.x, z: w.z, kind: 'ped', ref: w });
  for (const o of police.state.officers) targets.push({ x: o.x, z: o.z, kind: 'officer', ref: o });
  for (const car of allCars()) targets.push({ x: car.x, z: car.z, kind: 'car', ref: car });
  const ammoBefore = player.ammo;
  const hit = shootAt(player, targets);
  if (player.ammo < ammoBefore) {
    // a shot went off, hit or miss: bang, flash, heat — and the street empties
    audio.gunshot();
    startle(pedestrians.walkers, player.x, player.z, 18);
    const fx = player.x + Math.sin(player.heading) * 2;
    const fz = player.z - Math.cos(player.heading) * 2;
    effects.muzzle(fx, 1.2, fz);
    hud.setAmmo(player.ammo, true);
    if (!hit) return;
    if (hit.kind === 'ped') {
      hit.ref.panic = 3;
      gainWanted(1);
      hud.say('Pejalan kaki itu lari ketakutan!');
    } else if (hit.kind === 'officer') {
      scene.remove(hit.ref.mesh);
      police.state.officers = police.state.officers.filter((o) => o !== hit.ref);
      gainWanted(1);
      hud.say('Polisi itu tumbang!');
    } else {
      effects.impact(hit.x, 1, hit.z);
      gainWanted(1);
    }
  }
}

function handlePunch() {
  if (currentCar) return;
  const targets = [];
  for (const w of pedestrians.walkers) targets.push({ x: w.x, z: w.z, kind: 'ped', ref: w });
  for (const o of police.state.officers) targets.push({ x: o.x, z: o.z, kind: 'officer', ref: o });
  const hit = punchAt(player, targets);
  if (!hit) return;
  audio.punch();
  if (hit.kind === 'ped') {
    hit.ref.panic = 3;
    gainWanted(1);
  } else {
    scene.remove(hit.ref.mesh);
    police.state.officers = police.state.officers.filter((o) => o !== hit.ref);
    gainWanted(1);
  }
}

function handleCarContacts() {
  // an officer catching Raka on foot
  for (const o of police.state.officers) {
    if (!currentCar && Math.hypot(o.x - player.x, o.z - player.z) < 2) {
      hurtPlayer(8, 'Polisi menangkapmu di tengah kota.');
    }
  }
  if (!currentCar) return;
  // running over a pedestrian
  for (const w of pedestrians.walkers) {
    const d = Math.hypot(w.x - currentCar.x, w.z - currentCar.z);
    if (d < 2.2 && Math.abs(currentCar.speed) > 2) {
      w.panic = 3;
      w.x += (w.x - currentCar.x) * 0.6 + 2;
      gainWanted(1);
      audio.crash();
    }
  }
  // ramming a traffic car
  for (const car of traffic.cars) {
    const d = Math.hypot(car.x - currentCar.x, car.z - currentCar.z);
    if (d < 3.6) {
      if (Math.abs(currentCar.speed) > 8) {
        gainWanted(1);
        audio.crash();
        effects.spark(car.x, 1, car.z);
      }
      currentCar.speed *= 0.5;
      currentCar.x -= Math.sin(currentCar.heading) * 1.2;
      currentCar.z += Math.cos(currentCar.heading) * 1.2;
    }
  }
  // a police car ramming the player
  for (const car of police.state.cars) {
    const d = Math.hypot(car.x - currentCar.x, car.z - currentCar.z);
    if (d < 3.4) {
      hurtPlayer(8, 'Mobil polisi menabrakmu sampai tak sadarkan diri.');
      audio.crash();
      currentCar.speed *= 0.6;
    }
  }
}

// --- the fixed step ---------------------------------------------------------
function step(dt) {
  G.elapsed += dt;
  const actions = input.takeActions();

  if (screen === 'play') {
    if (actions & ACTION_PAUSE) {
      screen = 'pause';
      hud.showScreen('pause');
      audio.suspend();
      announce('Jeda.');
    }
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      hud.say(audio.isMuted() ? 'Suara mati.' : 'Suara hidup.');
    }
    if (actions & ACTION_HORN && currentCar) audio.horn();
    if (actions & ACTION_RELOAD && !currentCar) {
      reloadPlayer(player);
      hud.setAmmo(player.ammo, true);
      hud.say('Peluru diisi ulang.');
    }
    if (actions & ACTION_TAXI && currentCar) {
      missions.startTaxi(player.x, player.z, random);
    }
    if (actions & ACTION_PUNCH) handlePunch();
    if (actions & ACTION_ENTER_CAR && !currentCar) {
      const car = nearestStealable(allCars(), player.x, player.z, 4.5);
      if (car) {
        putPlayerInCar(car, car.x, car.z, car.heading);
        // every car on the street belongs to someone: taking one is a crime
        police.addWanted(WANTED.steal);
        hud.say('Mobil dicuri! Polisi mengejarmu.');
        audio.horn();
      }
    }
    if (actions & ACTION_EXIT_CAR && currentCar) {
      const side = currentCar.heading + Math.PI / 2;
      const x = currentCar.x + Math.sin(side) * 2.6;
      const z = currentCar.z - Math.cos(side) * 2.6;
      if (!collide(x, z, PLAYER.radius)) putPlayerOnFoot(x, z, currentCar.heading);
    }

    if (currentCar) {
      const drive = input.drive();
      const hit = stepPlayerCar(currentCar, drive, dt, collide);
      if (hit) audio.crash();
      if (drive.handbrake && Math.abs(currentCar.speed) > 6) {
        audio.skid();
        const bx = currentCar.x - Math.sin(currentCar.heading) * 1.6;
        const bz = currentCar.z + Math.cos(currentCar.heading) * 1.6;
        effects.brakeSmoke(bx, 0.3, bz);
      }
      player.x = currentCar.x;
      player.z = currentCar.z;
      player.heading = currentCar.heading;
      if (drive.throttle > 0) {
        exhaustTimer -= dt;
        if (exhaustTimer <= 0) {
          exhaustTimer = 0.09;
          const bx = currentCar.x - Math.sin(currentCar.heading) * 2.2;
          const bz = currentCar.z + Math.cos(currentCar.heading) * 2.2;
          effects.exhaust(bx, 0.5, bz);
        }
      }
      // dust when the wheels leave the asphalt
      if (Math.abs(currentCar.speed) > 4) {
        dustTimer -= dt;
        if (dustTimer <= 0) {
          dustTimer = 0.14;
          if (!isOnRoad(currentCar.x, currentCar.z)) effects.dust(currentCar.x, 0.4, currentCar.z);
        }
      }
      handleShooting(); // no-op in a car (shootAt is on-foot only via the guard)
    } else {
      stepPlayer(player, input.move(), camYaw, dt, collide);
      handleShooting();
    }
    handleCarContacts();

    // the world keeps living
    traffic.step(dt, currentCar);
    pedestrians.step(dt, currentCar ? { x: currentCar.x, z: currentCar.z } : { x: player.x, z: player.z });
    police.step(dt, player, !!currentCar, G.elapsed);
    missions.step(dt, {
      playerX: player.x,
      playerZ: player.z,
      inCar: !!currentCar,
      inTargetCar: currentCar === goldenCar,
      wanted: police.state.wanted,
      elapsed: G.elapsed,
      random,
    });
    effects.step(dt);
    city.update(dt, G.elapsed);

    // slow day cycle: noon drifts toward dusk over twenty minutes
    const newTime = Math.min(0.95, 0.15 + G.elapsed / 1200);
    if (Math.abs(newTime - G.timeOfDay) > 0.01) setTimeOfDay(newTime);

    // health comes back when the heat is off
    if (police.state.wanted === 0 && player.health < PLAYER.health) {
      healPlayer(player, 3 * dt);
      hud.setHealth(player.health);
    }

    // audio follows the drive
    audio.setEngine(currentCar ? Math.min(1, Math.abs(currentCar.speed) / CAR.maxSpeed) : 0, !!currentCar);
    audio.setSiren(police.state.wanted > 0, G.elapsed);

    // autosave every ten seconds
    saveTimer += dt;
    if (saveTimer > 10) {
      saveTimer = 0;
      save.money = G.money;
      writeSave(save);
    }
  } else if (screen === 'title') {
    if (actions & ACTION_CONFIRM || input.takeClick()) startGame();
    // the title screen's backdrop: traffic rolls, the city breathes
    traffic.step(dt, null);
    pedestrians.step(dt, null);
    city.update(dt, G.elapsed);
  } else if (screen === 'pause') {
    if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
      audio.resume();
      screen = 'play';
      hud.showScreen(null);
    }
  } else if (screen === 'over') {
    if (actions & ACTION_CONFIRM) {
      document.getElementById('btn-restart').click();
    }
  }

  updateHud();
  updateCamera(dt);
}

function updateHud() {
  hud.setMoney(G.money);
  hud.setHealth(player.health);
  hud.setWanted(police.state.wanted);
  hud.setSpeed(currentCar ? currentCar.speed * 3.6 : 0, !!currentCar);
  hud.setAmmo(player.ammo, !currentCar);
  hud.showCrosshair(screen === 'play' && !currentCar);
  const m = missions.current();
  if (m && missions.state.active && m.kind === 'timed-deliver') {
    hud.setTimer(missions.timer, true);
  } else {
    hud.setTimer(0, false);
  }
  minimap.draw({
    playerX: player.x,
    playerZ: player.z,
    heading: currentCar ? currentCar.heading : player.heading,
    cars: [...parkedCars, ...traffic.cars],
    policeCars: police.state.cars,
    missionTarget: missions.missionTarget(),
    taxiTarget: missions.taxiTarget(),
  });
}

function updateCamera(dt) {
  const heading = currentCar ? currentCar.heading : player.heading;
  let diff = heading - camYaw;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  camYaw += diff * Math.min(1, dt * 3.2);
  const fx = Math.sin(camYaw);
  const fz = -Math.cos(camYaw);
  const rx = Math.cos(camYaw);
  const rz = Math.sin(camYaw);
  const target = new THREE.Vector3(
    player.x - fx * G.camDistance + rx * G.camSide,
    G.camHeight + (currentCar ? 1.2 : 0.6),
    player.z - fz * G.camDistance + rz * G.camSide,
  );
  camPos.lerp(target, 1 - Math.exp(-dt * 10));
  camera.position.copy(camPos);
  camera.lookAt(player.x + fx * 6, 1.6, player.z + fz * 6);
  renderer.render(scene, camera);
}

// --- shot mode ---------------------------------------------------------------
// Shot mode stages one scene, settles the world for SETTLE_STEPS scripted
// steps (two seconds), then paints twice and raises window.__shotReady.
// The settle count lives in shots.js next to the staging itself, so the
// two can never drift apart.
function runShot(name) {
  stageShot(name, W);
  // let the world settle for two seconds of scripted play (SETTLE_STEPS at
  // 1/60 s) so the traffic is mid-flow and the chase is actually chasing
  const scripted = { throttle: 1, steer: 0, handbrake: false };
  for (let i = 0; i < SETTLE_STEPS; i += 1) {
    G.elapsed += STEP;
    if (currentCar) {
      const px = player.x, pz = player.z;
      stepPlayerCar(currentCar, scripted, STEP, collide);
      player.x = currentCar.x;
      player.z = currentCar.z;
      player.heading = currentCar.heading;
      // held police keep their staged formation: they ride along with the
      // player's delta, so the staged cruisers stay ahead of the player
      // instead of being left behind the camera as he accelerates away.
      if (police.state.held) {
        const dx = player.x - px, dz = player.z - pz;
        for (const pc of police.state.cars) {
          pc.x += dx; pc.z += dz;
          pc.mesh.position.set(pc.x, 0, pc.z);
        }
      }
    }
    traffic.step(STEP, currentCar);
    pedestrians.step(STEP, currentCar ? { x: currentCar.x, z: currentCar.z } : { x: player.x, z: player.z });
    police.step(STEP, player, !!currentCar, G.elapsed);
    missions.step(STEP, {
      playerX: player.x, playerZ: player.z, inCar: !!currentCar,
      inTargetCar: currentCar === goldenCar, wanted: police.state.wanted, elapsed: G.elapsed, random,
    });
    effects.step(STEP);
    city.update(STEP, G.elapsed);
    updateHud();
    updateCamera(STEP);
  }
  let painted = 0;
  function paint() {
    updateHud();
    updateCamera(STEP);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

// --- the live loop ------------------------------------------------------------
function runGame() {
  let accumulator = 0;
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    while (accumulator >= STEP && screen !== 'over') {
      step(STEP);
      accumulator -= STEP;
      if (screen === 'pause') break;
    }
    if (screen === 'pause' || screen === 'over') {
      updateHud();
      updateCamera(0);
    }
    accumulator = 0;
  }
  showTitle();
  requestAnimationFrame(frame);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === 'play') {
    screen = 'pause';
    hud.showScreen('pause');
    audio.suspend();
    announce('Jeda.');
  }
});

if (shot) runShot(shot);
else runGame();
