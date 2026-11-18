// TELUK EMAS — the story: Mira's five jobs for Raka, plus the taxi side
// hustle. A mission is a small state machine — reach a point, steal a car,
// lose the police, beat a clock, grab a bag and run — and the beacon in
// the world plus the minimap blip always show where to go next. Taxi
// targets are always snapped to the nearest road, so a fare can never ask
// Raka to drive into a building or out to sea.
import * as THREE from '../vendor/three/three.module.min.js';
import { MISSIONS, MONEY, TAXI, TOTAL_MISSION_REWARD } from './config.js';
import { nearestRoadPoint } from './city.js';

// How close Raka must get to a mission point for it to count: one number
// for every arrival check, so the drive-to, deliver and grab legs all
// forgive the same distance. The grab itself is tighter (GRAB_RADIUS,
// 10 m) because Raka is on foot there, close enough to reach the bag
// by hand.
const ARRIVE_RADIUS = 12;
const GRAB_RADIUS = 10;

function makeBeacon(scene) {
  const group = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30;
  group.add(beam);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.4, 3.4, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.2;
  group.add(ring);
  group.visible = false;
  scene.add(group);
  return group;
}

export function createMissions(scene, hooks) {
  const beacon = makeBeacon(scene);
  const state = {
    index: 0, // which job of Mira's is current
    phase: 'to-target', // to-target | deliver | escape | grabbed | done
    timer: 0,
    active: false,
    taxi: { active: false, phase: 'pickup', target: null, fare: 0 },
    finished: false,
  };

  function current() {
    return MISSIONS[state.index] || null;
  }

  // "3 / 5": how far through the story Raka is, for the HUD and the
  // title screen. A finished story reads "5 / 5" — the clamp keeps the
  // finished index (5) from ever printing as "6 / 5".
  function missionProgress() {
    return `${Math.min(state.index + (state.finished ? 1 : 0), MISSIONS.length)} / ${MISSIONS.length}`;
  }

  function missionTarget() {
    const m = current();
    if (!m || state.finished) return null;
    if (m.kind === 'steal-deliver') return state.phase === 'deliver' ? m.deliver : m.target;
    if (m.kind === 'grab-escape') return state.phase === 'grabbed' ? m.deliver : m.target;
    if (m.kind === 'escape') return null;
    return m.target;
  }

  function start() {
    const m = current();
    if (!m) {
      state.finished = true;
      return;
    }
    state.active = true;
    state.phase = 'to-target';
    state.timer = m.timeLimit || 0;
    if (m.wanted) hooks.onWantedSet(m.wanted);
    hooks.onObjective(`${m.title} — ${m.text}`);
  }

  function completeMission() {
    const m = current();
    hooks.onReward(m.reward);
    hooks.onObjective(`Selesai: ${m.title}. Mira membayar $${m.reward}.`);
    hooks.onMissionComplete(state.index);
    state.index += 1;
    state.active = false;
    if (state.index >= MISSIONS.length) {
      state.finished = true;
      beacon.visible = false;
      hooks.onObjective(`UTANG LUNAS. Raka bebas — Teluk Emas akhirnya miliknya. Total hadiah misi: $${TOTAL_MISSION_REWARD}.`);
      return;
    }
    start();
  }

  function failMission(text) {
    const m = current();
    state.phase = 'to-target';
    state.timer = m.timeLimit || 0;
    hooks.onObjective(text);
  }

  // Back to the beginning of the current job: the restart button's path.
  // The current job is kept, so a game over mid-story resumes that job —
  // but a finished story (index past the last job) restarts from job one,
  // otherwise the restart would land in a story with no jobs left.
  function reset() {
    if (state.finished) {
      state.index = 0;
      state.finished = false;
    }
    state.phase = 'to-target';
    state.timer = 0;
    state.active = false;
    state.taxi = { active: false, phase: 'pickup', target: null, fare: 0 };
    beacon.visible = false;
  }

  // The taxi hustle: Raka picks up a passenger and drops them off for
  // cash. The pickup point is drawn on a ring around the car, then snapped
  // to the nearest road so it is always reachable.
  function startTaxi(px, pz, random) {
    if (state.taxi.active) return;
    const angle = random.next() * Math.PI * 2;
    const dist = TAXI.minTrip + random.next() * (TAXI.maxTrip - TAXI.minTrip);
    const raw = { x: px + Math.sin(angle) * dist, z: pz + Math.cos(angle) * dist };
    state.taxi = {
      active: true,
      phase: 'pickup',
      target: nearestRoadPoint(raw.x, raw.z),
      fare: TAXI.fare,
    };
    hooks.onObjective('Taksi: jemput penumpang di titik kuning.');
  }

  function taxiTarget() {
    return state.taxi.active ? state.taxi.target : null;
  }

  function step(dt, ctx) {
    // beacon follows the current objective (mission first, taxi second)
    const target = missionTarget() || taxiTarget();
    if (target) {
      beacon.visible = true;
      beacon.position.set(target.x, 0, target.z);
      beacon.rotation.y += dt * 0.8;
      const pulse = 1 + Math.sin(ctx.elapsed * 4) * 0.12;
      beacon.scale.set(pulse, 1, pulse);
    } else {
      beacon.visible = false;
    }

    if (!state.active || state.finished) {
      stepTaxi(ctx);
      return;
    }
    const m = current();
    const px = ctx.playerX;
    const pz = ctx.playerZ;

    if (m.kind === 'drive-to') {
      if (ctx.inCar && Math.hypot(px - m.target.x, pz - m.target.z) < ARRIVE_RADIUS) completeMission();
    } else if (m.kind === 'steal-deliver') {
      if (state.phase === 'to-target') {
        if (ctx.inTargetCar) state.phase = 'deliver';
      } else if (Math.hypot(px - m.deliver.x, pz - m.deliver.z) < ARRIVE_RADIUS && ctx.inTargetCar) {
        completeMission();
      }
    } else if (m.kind === 'escape') {
      if (ctx.wanted === 0) completeMission();
    } else if (m.kind === 'timed-deliver') {
      state.timer -= dt;
      if (Math.hypot(px - m.target.x, pz - m.target.z) < ARRIVE_RADIUS) {
        completeMission();
      } else if (state.timer <= 0) {
        failMission('Telat! Paketnya batal. Mira memberi kesempatan kedua — cepat, 90 detik lagi.');
      }
    } else if (m.kind === 'grab-escape') {
      if (state.phase === 'to-target') {
        if (!ctx.inCar && Math.hypot(px - m.target.x, pz - m.target.z) < GRAB_RADIUS) {
          state.phase = 'grabbed';
          hooks.onWantedSet(m.wanted);
          hooks.onObjective('Tas didapat! Bawa ke rumah aman di barat daya. Polisi sudah di ekormu.');
        }
      } else if (Math.hypot(px - m.deliver.x, pz - m.deliver.z) < ARRIVE_RADIUS) {
        completeMission();
      }
    }
    stepTaxi(ctx);
  }

  function stepTaxi(ctx) {
    const taxi = state.taxi;
    if (!taxi.active) return;
    const px = ctx.playerX;
    const pz = ctx.playerZ;
    if (taxi.phase === 'pickup') {
      if (ctx.inCar && Math.hypot(px - taxi.target.x, pz - taxi.target.z) < TAXI.pickupRadius) {
        taxi.phase = 'dropoff';
        const rng = ctx.random || Math;
        const angle = rng.next ? rng.next() * Math.PI * 2 : Math.random() * Math.PI * 2;
        const dist = TAXI.minTrip + (rng.next ? rng.next() : Math.random()) * (TAXI.maxTrip - TAXI.minTrip);
        const raw = { x: px + Math.sin(angle) * dist, z: pz + Math.cos(angle) * dist };
        taxi.target = nearestRoadPoint(raw.x, raw.z);
        hooks.onObjective('Penumpang naik. Antar ke titik kuning.');
      }
    } else if (ctx.inCar && Math.hypot(px - taxi.target.x, pz - taxi.target.z) < TAXI.dropoffRadius) {
      // the drop-off only counts from the car: the passenger paid for a ride
      state.taxi.active = false;
      hooks.onReward(taxi.fare);
      hooks.onObjective(`Taksi selesai. Penumpang membayar $${taxi.fare}.`);
    }
  }

  return {
    state, current, start, step, startTaxi, taxiTarget, missionTarget, reset, missionProgress,
    get timer() { return state.timer; },
    get finished() { return state.finished; },
  };
}
