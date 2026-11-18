// TELUK EMAS — traffic: ordinary cars that drive the road grid all day.
// Each car follows a rectangular loop of road centrelines; at a corner it
// picks a new direction, so the flow never looks scripted. They keep their
// distance from the car ahead, slow for the player's car, and show their
// brake lights when they slow down.
import { createCar, randomCarColour } from './vehicles.js';
import { TRAFFIC, CITY } from './config.js';

const ROAD_CENTRES = [];
for (let i = 0; i < CITY.roads; i += 1) {
  ROAD_CENTRES.push((i - (CITY.roads - 1) / 2) * CITY.block);
}

// How far ahead a traffic car looks for cross traffic rolling through
// the junction in front of it. Past this distance the junction is the
// next car's problem, not this one's.
const CROSS_CHECK = 12;

function pickLoop(random) {
  // a rectangle on the grid: pick two roads each way, at least 80 m apart.
  // A few tries at most: if the draws keep landing close together, take
  // the widest rectangle seen instead of rolling forever.
  let best = null;
  let bestSpan = -1;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const xs = [random.pick(ROAD_CENTRES), random.pick(ROAD_CENTRES)];
    const zs = [random.pick(ROAD_CENTRES), random.pick(ROAD_CENTRES)];
    const minX = Math.min(xs[0], xs[1]);
    const maxX = Math.max(xs[0], xs[1]);
    const minZ = Math.min(zs[0], zs[1]);
    const maxZ = Math.max(zs[0], zs[1]);
    const span = Math.min(maxX - minX, maxZ - minZ);
    if (span > bestSpan) {
      bestSpan = span;
      best = [
        { x: minX, z: minZ }, { x: maxX, z: minZ },
        { x: maxX, z: maxZ }, { x: minX, z: maxZ },
      ];
    }
    if (maxX - minX >= 80 && maxZ - minZ >= 80) return best;
  }
  return best;
}

export function createTraffic(scene, random) {
  const cars = [];
  for (let i = 0; i < TRAFFIC.count; i += 1) {
    const loop = pickLoop(random);
    const start = loop[Math.floor(random.next() * loop.length)];
    const car = createCar(scene, start.x, start.z, random.next() * Math.PI * 2, randomCarColour(random), false);
    car.driver = 'traffic';
    car.loop = loop;
    car.loopIndex = 0;
    car.speed = TRAFFIC.speed * random.range(0.8, 1.1);
    cars.push(car);
  }

  // The traffic car nearest to (x, z): the ram check and the play-tests
  // use this instead of scanning the fleet twice. Parked and police cars
  // are not in this list, so this only ever returns a traffic car — the
  // caller never has to filter the driver field again.
  function nearestTrafficCar(x, z) {
    let best = null;
    let bestD = Infinity;
    for (const car of cars) {
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < bestD) {
        best = car;
        bestD = d;
      }
    }
    return best;
  }

  function step(dt, playerCar) {
    for (const car of cars) {
      if (car.driver !== 'traffic') continue;
      const target = car.loop[(car.loopIndex + 1) % car.loop.length];
      const dx = target.x - car.x;
      const dz = target.z - car.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 4) {
        car.loopIndex = (car.loopIndex + 1) % car.loop.length;
        continue;
      }
      const wantHeading = Math.atan2(dx, -dz);
      let diff = wantHeading - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      // slow down for anything stopped ahead on the same road
      let blocked = false;
      const fx = Math.sin(car.heading);
      const fz = -Math.cos(car.heading);
      for (const other of cars) {
        if (other === car || other.driver !== 'traffic') continue;
        const ox = other.x - car.x;
        const oz = other.z - car.z;
        if (ox * fx + oz * fz > 0 && Math.hypot(ox, oz) < TRAFFIC.minGap) blocked = true;
      }
      // and for cross traffic rolling through the junction ahead
      for (const other of cars) {
        if (other === car || other.driver !== 'traffic') continue;
        const ox = other.x - car.x;
        const oz = other.z - car.z;
        const along = ox * fx + oz * fz;
        const side = Math.abs(ox * fz - oz * fx);
        if (along > 0 && along < CROSS_CHECK && side < 4) blocked = true;
      }
      if (playerCar) {
        const ox = playerCar.x - car.x;
        const oz = playerCar.z - car.z;
        if (ox * fx + oz * fz > 0 && Math.hypot(ox, oz) < TRAFFIC.minGap + 2) blocked = true;
      }
      const targetSpeed = blocked ? 0 : TRAFFIC.speed;
      const slowing = targetSpeed < car.speed - 0.5;
      car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 2);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z -= Math.cos(car.heading) * car.speed * dt;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = -car.heading;
      car.mesh.userData.tailMat.emissiveIntensity = slowing ? 2.2 : 0.7;
      for (const wheel of car.mesh.userData.wheels) wheel.rotation.x += car.speed * dt * 2.4;
    }
  }

  return { cars, step, nearestTrafficCar };
}
