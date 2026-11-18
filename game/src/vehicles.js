// TELUK EMAS — cars: how a car looks, how one drives, and how Raka steals
// one. One builder makes every car in the game — player cars, traffic,
// police, the golden target sedan — from boxes and cylinders; driving is
// arcade physics: a heading, a speed, steering that bites harder the
// faster you go, and a grip term that kills sideways slide so the car
// feels planted but can still drift on the handbrake.
import * as THREE from '../vendor/three/three.module.min.js';
import { CAR } from './config.js';
import { isOnRoad } from './city.js';

const CAR_COLOURS = [0xc23b2e, 0x2e6fc2, 0xe8c33a, 0x3f8f4f, 0xe8e8e8, 0x22242a, 0x7d4fa3, 0xd97b2e];
const GOLD = 0xd8b25e;

// How fast the wheels spin for a given speed: every car in the game —
// player, traffic and police — uses the same factor, so their wheels agree.
export const WHEEL_SPIN = 2.4;

// The palette traffic draws from, exported so the night shot and the
// play-tests can name a colour without copying the list.
export const TRAFFIC_COLOURS = CAR_COLOURS.slice();

// The police door: white with the word POLISI in dark blue, drawn once on
// a canvas and wrapped around the door box, so a cruiser reads as police
// from any angle even before its light bar flashes.
function policeDoorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f2f2f2';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#1f3a5f';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('POLISI', 128, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeCarMesh(colour, isPolice) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: colour });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1c1f24 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x9fc4d8, emissive: 0x2a3a44, emissiveIntensity: 0.4 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 4.4), bodyMat);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 2.2), glassMat);
  cabin.position.set(0, 1.05, -0.2);
  group.add(cabin);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 0.5), bodyMat);
  nose.position.set(0, 0.45, 2.3);
  group.add(nose);
  // grille and bumpers: two dark strips that break up the flat front
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 0.06), darkMat);
  grille.position.set(0, 0.42, 2.56);
  group.add(grille);
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.18, 0.12), darkMat);
  bumper.position.set(0, 0.3, 2.5);
  group.add(bumper);
  // side mirrors
  const mirrorGeo = new THREE.BoxGeometry(0.12, 0.1, 0.22);
  for (const x of [-0.95, 0.95]) {
    const mirror = new THREE.Mesh(mirrorGeo, darkMat);
    mirror.position.set(x, 0.95, 0.7);
    group.add(mirror);
  }

  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141518 });
  const wheels = [];
  for (const [x, z] of [[-0.85, 1.45], [0.85, 1.45], [-0.85, -1.45], [0.85, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.36, z);
    group.add(wheel);
    wheels.push(wheel);
  }

  // headlights and tail lights, bright at dusk
  const headMat = new THREE.MeshLambertMaterial({ color: 0xfff6c8, emissive: 0xfff2a0, emissiveIntensity: 0.9 });
  for (const x of [-0.6, 0.6]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.08), headMat);
    lamp.position.set(x, 0.55, 2.56);
    group.add(lamp);
  }
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xc22a1e, emissive: 0xaa1408, emissiveIntensity: 0.7 });
  const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.08), tailMat);
  tailL.position.set(-0.6, 0.6, -2.24);
  group.add(tailL);
  const tailR = tailL.clone();
  tailR.position.x = 0.6;
  group.add(tailR);

  let lightBar = null;
  if (isPolice) {
    const bar = new THREE.Group();
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.16, 0.4),
      new THREE.MeshLambertMaterial({ color: 0xd21f1f, emissive: 0xd21f1f, emissiveIntensity: 1 }),
    );
    red.position.x = -0.32;
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.16, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x1f4fd2, emissive: 0x1f4fd2, emissiveIntensity: 1 }),
    );
    blue.position.x = 0.32;
    bar.add(red, blue);
    bar.position.set(0, 1.42, -0.2);
    group.add(bar);
    lightBar = { red, blue };
    // white doors with the POLISI wordmark, on a black body
    const doorTex = policeDoorTexture();
    const doorMat = new THREE.MeshLambertMaterial({ map: doorTex });
    for (const side of [-1, 1]) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 1.7), doorMat);
      door.position.set(side * 0.97, 0.62, -0.1);
      group.add(door);
    }
  }
  group.userData.wheels = wheels;
  group.userData.lightBar = lightBar;
  group.userData.tailMat = tailMat;
  group.userData.headMat = headMat;
  return group;
}

// A car is a mesh plus a small state bag: position, heading, speed, and
// who is driving it. The mesh's forward is -z in local space, so heading
// 0 points north (-z) and the mesh is rotated by -heading.
export function createCar(scene, x, z, heading, colour, isPolice) {
  const mesh = makeCarMesh(colour, isPolice);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = -heading;
  scene.add(mesh);
  return {
    mesh, x, z, heading,
    speed: 0,
    steer: 0,
    isPolice: !!isPolice,
    driver: null, // 'player' | 'traffic' | 'police' | null (parked)
    parked: false,
    brakeLight: false,
    target: false, // the golden sedan of mission two
  };
}

export function randomCarColour(random) {
  return CAR_COLOURS[Math.floor(random.next() * CAR_COLOURS.length)];
}

export function goldCarColour() {
  return GOLD;
}

// True when this is the golden sedan of mission two: the steal-deliver
// logic reads this instead of comparing colours, so a gold traffic car
// could never be mistaken for the target. The flag is set once, when the
// sedan is parked in main.js, and never changed afterwards.
export function isTargetCar(car) {
  return !!car && car.target === true;
}

// Headlights and tail lights on or off: dusk switches them on for every
// car on the road, noon switches them back off.
export function setLights(car, on) {
  const mat = car.mesh.userData.headMat;
  if (mat) mat.emissiveIntensity = on ? 1.6 : 0.9;
  const tail = car.mesh.userData.tailMat;
  if (tail) tail.emissiveIntensity = on ? 1.4 : 0.7;
}

// One arcade step for a player-driven car. `drive` is { throttle: -1..1,
// steer: -1..1, handbrake: bool }. Returns true when the car hit a wall
// this step (for the thud and the wanted logic in the caller).
export function stepPlayerCar(car, drive, dt, collide) {
  const onRoad = isOnRoad(car.x, car.z);
  const top = CAR.maxSpeed * (onRoad ? 1 : CAR.offroadFactor);
  const reverseTop = CAR.maxReverse * (onRoad ? 1 : CAR.offroadFactor);
  if (drive.throttle > 0) {
    car.speed += CAR.accel * drive.throttle * dt;
  } else if (drive.throttle < 0) {
    if (car.speed > 0.5) car.speed -= CAR.brake * dt;
    else car.speed += CAR.reverseAccel * drive.throttle * dt; // reversing: throttle is negative
  } else {
    car.speed -= Math.sign(car.speed) * 6 * dt;
    if (Math.abs(car.speed) < 0.2) car.speed = 0;
  }
  if (drive.handbrake) car.speed -= Math.sign(car.speed) * 26 * dt;
  car.speed = Math.max(-reverseTop, Math.min(top, car.speed));
  const speedFactor = Math.min(1, Math.abs(car.speed) / 12);
  car.heading += drive.steer * CAR.turnRate * speedFactor * Math.sign(car.speed || 1) * dt * (drive.handbrake ? 1.5 : 1);
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z - Math.cos(car.heading) * car.speed * dt;
  const hit = collide(nx, nz, 1.6);
  if (hit) {
    car.speed *= -0.25; // bounce off the wall, heavily damped
  } else {
    car.x = nx;
    car.z = nz;
  }
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = -car.heading;
  for (const wheel of car.mesh.userData.wheels) {
    wheel.rotation.x += car.speed * dt * WHEEL_SPIN;
  }
  // the front axle steers: wheels[0] and [1] sit at z = +1.45, the front
  // of the car, so they take the steering angle and the rears stay fixed
  car.mesh.userData.wheels[0].rotation.y = drive.steer * 0.4;
  car.mesh.userData.wheels[1].rotation.y = drive.steer * 0.4;
  car.brakeLight = drive.throttle < 0 || drive.handbrake;
  car.mesh.userData.tailMat.emissiveIntensity = car.brakeLight ? 2.2 : 0.7;
  return hit;
}

// The nearest car Raka can steal: anything drivable within reach, except
// the one he is already driving.
export function nearestStealable(cars, x, z, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    if (car.driver === 'player') continue;
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestD) {
      best = car;
      bestD = d;
    }
  }
  return best;
}
