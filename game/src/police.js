// TELUK EMAS — the law: the wanted stars, the police cars that chase the
// player, and the heat that cools when Raka stays out of sight. A police
// car steers straight at the player and rams; several of them at high
// wanted levels box the player in. On foot, an officer runs the player
// down. The fleet can be held in place — the cover screenshot stages a
// chase that way, with the light bars still flashing.
import { createCar } from './vehicles.js';
import { POLICE, WANTED } from './config.js';
import { makePersonMesh } from './pedestrians.js';

// How fast an officer runs the player down on foot, and how close he
// must get before he stops and the catch counts. The catch distance is
// the same 2 m the main loop uses to hurt the player, so the two agree.
const OFFICER_SPEED = 5.2;
const OFFICER_CATCH = 2;

export function createPolice(scene, random) {
  const state = {
    wanted: 0,
    unseenTimer: 0,
    cars: [],
    officers: [],
    held: false, // when true, the fleet stays where it is (screenshot staging)
  };

  function spawnCarAt(x, z, heading) {
    const car = createCar(scene, x, z, heading, 0x1a1c20, true);
    car.driver = 'police';
    car.speed = 0;
    state.cars.push(car);
    return car;
  }

  function spawnCarNear(px, pz) {
    const angle = random.next() * Math.PI * 2;
    const x = px + Math.sin(angle) * POLICE.spawnDistance;
    const z = pz + Math.cos(angle) * POLICE.spawnDistance;
    return spawnCarAt(x, z, 0);
  }

  function spawnOfficer(px, pz) {
    const mesh = makePersonMesh(0x1f3a5f, 0x1f3a5f, 0xe8b98a);
    mesh.position.set(px + 6, 0, pz + 6);
    scene.add(mesh);
    const officer = { mesh, x: px + 6, z: pz + 6, heading: 0, phase: 0 };
    state.officers.push(officer);
    return officer;
  }

  function removeCar(car) {
    scene.remove(car.mesh);
  }

  function addWanted(amount) {
    state.wanted = Math.min(WANTED.max, state.wanted + amount);
    state.unseenTimer = 0;
  }

  function clearWanted() {
    state.wanted = 0;
    state.unseenTimer = 0;
    for (const car of state.cars) removeCar(car);
    for (const officer of state.officers) scene.remove(officer.mesh);
    state.cars = [];
    state.officers = [];
  }

  // Full reset: the restart button uses this so a new run never inherits
  // the previous run's manhunt.
  function reset() {
    clearWanted();
    state.held = false;
  }

  function setHeld(value) {
    state.held = !!value;
  }

  // How many police cars the heat calls for: one per star, capped.
  function wantedCarCount() {
    return Math.min(POLICE.maxCars, state.wanted);
  }

  // The current wanted level, 0..5: the HUD and the mission logic read
  // this instead of reaching into state.wanted from outside. It is cheap
  // to call every frame, so the HUD never caches a stale star count.
  function getWanted() {
    return state.wanted;
  }

  // How many cruisers are on the road right now: the cover shot asserts
  // two, the escape mission asserts the fleet matches the heat.
  function carCount() {
    return state.cars.length;
  }

  // Alternate the roof bar's red and blue halves. The chase step calls
  // this every frame; the held (staged) chase calls it without moving.
  function flashBars(elapsed) {
    const flash = Math.sin(elapsed * 14) > 0;
    for (const car of state.cars) {
      const bar = car.mesh.userData.lightBar;
      if (!bar) continue;
      bar.red.material.emissiveIntensity = flash ? 2.4 : 0.2;
      bar.blue.material.emissiveIntensity = flash ? 0.2 : 2.4;
    }
  }

  function step(dt, player, playerInCar, elapsed) {
    const px = player.x;
    const pz = player.z;
    let nearestPolice = Infinity;
    for (const car of state.cars) {
      nearestPolice = Math.min(nearestPolice, Math.hypot(px - car.x, pz - car.z));
    }
    if (state.held) {
      flashBars(elapsed);
      return nearestPolice;
    }
    // keep the fleet at the right size for the heat
    while (state.cars.length < wantedCarCount()) spawnCarNear(px, pz);
    while (state.cars.length > wantedCarCount()) {
      removeCar(state.cars.pop());
    }
    // Officers on foot only join the chase at three stars and up: two of
    // them at three stars, three at four or five. They leave as soon as
    // Raka gets in a car — on wheels, the cruisers do the chasing.
    if (state.wanted >= 3 && state.officers.length < (state.wanted >= 4 ? 3 : 2) && !playerInCar) {
      spawnOfficer(px, pz);
    }
    if (state.wanted < 3 || playerInCar) {
      for (const officer of state.officers) scene.remove(officer.mesh);
      state.officers = [];
    }

    for (const car of state.cars) {
      const dx = px - car.x;
      const dz = pz - car.z;
      const dist = Math.hypot(dx, dz);
      nearestPolice = Math.min(nearestPolice, dist);
      const wantHeading = Math.atan2(dx, -dz);
      let diff = wantHeading - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.heading += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff));
      const targetSpeed = dist > 10 ? POLICE.chaseSpeed : POLICE.chaseSpeed * 0.4;
      car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z -= Math.cos(car.heading) * car.speed * dt;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = -car.heading;
      for (const wheel of car.mesh.userData.wheels) wheel.rotation.x += car.speed * dt * 2.4;
    }
    flashBars(elapsed);

    for (const officer of state.officers) {
      const dx = px - officer.x;
      const dz = pz - officer.z;
      const dist = Math.hypot(dx, dz);
      nearestPolice = Math.min(nearestPolice, dist);
      const wantHeading = Math.atan2(dx, -dz);
      officer.heading = wantHeading;
      const speed = dist > OFFICER_CATCH ? OFFICER_SPEED : 0;
      officer.x += Math.sin(officer.heading) * speed * dt;
      officer.z -= Math.cos(officer.heading) * speed * dt;
      officer.phase += dt * speed * 4.5;
      const swing = Math.sin(officer.phase) * 0.55;
      officer.mesh.userData.legL.rotation.x = swing;
      officer.mesh.userData.legR.rotation.x = -swing;
      officer.mesh.position.set(officer.x, 0, officer.z);
      officer.mesh.rotation.y = -officer.heading;
    }

    // heat cools when no police is near: the player has slipped away
    if (state.wanted > 0) {
      if (nearestPolice > 70) {
        state.unseenTimer += dt;
        if (state.unseenTimer > POLICE.decaySeconds) {
          state.wanted = Math.max(0, state.wanted - 1);
          state.unseenTimer = 0;
        }
      } else {
        state.unseenTimer = 0;
      }
    }
    return nearestPolice;
  }

  return { state, addWanted, clearWanted, reset, setHeld, flashBars, step, spawnCarNear, spawnCarAt, getWanted, carCount };
}
