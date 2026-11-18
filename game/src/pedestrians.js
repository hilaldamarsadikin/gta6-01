// TELUK EMAS — pedestrians: townsfolk who stroll the sidewalks, cross at
// corners and scatter when a car or a gunshot comes at them. A person is a
// few boxes and a sphere with swinging legs; enough to read as a crowd at
// a glance, cheap enough to keep sixteen of them walking all day. Their
// shirts, trousers and skin tones are drawn from small palettes, so the
// crowd never looks like a row of clones.
import * as THREE from '../vendor/three/three.module.min.js';
import { PEDS } from './config.js';
import { CITY } from './config.js';

const SHIRTS = [0xd95f4b, 0x4b7fd9, 0x58b368, 0xe8c33a, 0x9a5fd9, 0xe8e8e8, 0x2a2a2e, 0xd97b2e, 0x3f8f7a, 0xc25a7a];
const PANTS = [0x2a3242, 0x4a3a2a, 0x3a3a3a, 0x5a6a7a, 0x6a5a3a];
const SKINS = [0xe8b98a, 0xc98a5a, 0x8a5a34, 0xf0c8a0, 0xa86a42];

export function makePersonMesh(shirt, pants, skin) {
  const group = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.32), shirtMat);
  torso.position.y = 1.12;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), skinMat);
  head.position.y = 1.62;
  group.add(head);
  const legGeo = new THREE.BoxGeometry(0.2, 0.62, 0.22);
  const legL = new THREE.Mesh(legGeo, pantsMat);
  legL.position.set(-0.15, 0.42, 0);
  const legR = new THREE.Mesh(legGeo, pantsMat);
  legR.position.set(0.15, 0.42, 0);
  group.add(legL, legR);
  const armGeo = new THREE.BoxGeometry(0.14, 0.55, 0.16);
  const armL = new THREE.Mesh(armGeo, shirtMat);
  armL.position.set(-0.36, 1.12, 0);
  const armR = new THREE.Mesh(armGeo, shirtMat);
  armR.position.set(0.36, 1.12, 0);
  group.add(armL, armR);
  group.userData = { legL, legR, armL, armR };
  return group;
}

// Panic every walker within `radius` of (x, z): they run away from the
// point for a moment. Gunshots call this, so a bang empties the street.
export function startle(walkers, x, z, radius) {
  for (const w of walkers) {
    const dx = w.x - x;
    const dz = w.z - z;
    const d = Math.hypot(dx, dz);
    if (d >= radius) continue;
    w.panic = 2.5;
    w.targetX = w.x + (dx / (d || 1)) * 40;
    w.targetZ = w.z + (dz / (d || 1)) * 40;
  }
}

// Place one walker at an exact spot, facing `heading`, and give it a
// short stroll from there: the walk screenshot stages its crowd this way.
// Panic is cleared, so a staged walker strolls instead of running off
// mid-shot.
export function placeWalker(walker, x, z, heading) {
  walker.x = x;
  walker.z = z;
  walker.heading = heading;
  walker.panic = 0;
  walker.targetX = x + 20;
  walker.targetZ = z + 10;
  walker.mesh.position.set(x, 0, z);
  walker.mesh.rotation.y = -heading;
}

export function createPedestrians(scene, random) {
  const walkers = [];
  for (let i = 0; i < PEDS.count; i += 1) {
    const mesh = makePersonMesh(
      SHIRTS[Math.floor(random.next() * SHIRTS.length)],
      PANTS[Math.floor(random.next() * PANTS.length)],
      SKINS[Math.floor(random.next() * SKINS.length)],
    );
    scene.add(mesh);
    walkers.push({
      mesh,
      x: random.range(-240, 240),
      z: random.range(-240, 240),
      heading: random.next() * Math.PI * 2,
      speed: PEDS.walkSpeed * random.range(0.8, 1.3),
      phase: random.next() * Math.PI * 2,
      panic: 0,
    });
  }

  function retarget(w) {
    // pick a nearby sidewalk corner to walk to, never onto the beach
    w.targetX = Math.max(-260, Math.min(260, w.x + random.range(-70, 70)));
    w.targetZ = Math.max(-260, Math.min(260, w.z + random.range(-70, 70)));
    if (w.targetZ > CITY.beachZ - 20) w.targetZ = CITY.beachZ - 20;
  }

  for (const w of walkers) retarget(w);

  // The walker nearest to (x, z), or null when the streets are empty:
  // the main loop uses this for "who did Raka just bump into" checks.
  // A plain linear scan is fine at sixteen walkers — no index needed.
  function nearestWalker(x, z) {
    let best = null;
    let bestD = Infinity;
    for (const w of walkers) {
      const d = Math.hypot(w.x - x, w.z - z);
      if (d < bestD) {
        best = w;
        bestD = d;
      }
    }
    return best;
  }

  // `danger` is a point to run from: a car (or a gunshot) nearby.
  function step(dt, danger) {
    for (const w of walkers) {
      if (danger) {
        const dx = w.x - danger.x;
        const dz = w.z - danger.z;
        const d = Math.hypot(dx, dz);
        if (d < 14) {
          w.panic = 1.2;
          w.targetX = w.x + (dx / (d || 1)) * 40;
          w.targetZ = w.z + (dz / (d || 1)) * 40;
        }
      }
      if (w.panic > 0) w.panic -= dt;
      const dx = w.targetX - w.x;
      const dz = w.targetZ - w.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 2) {
        retarget(w);
        continue;
      }
      const want = Math.atan2(dx, -dz);
      let diff = want - w.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      w.heading += Math.max(-3 * dt, Math.min(3 * dt, diff));
      const speed = w.speed * (w.panic > 0 ? 2.6 : 1);
      w.x += Math.sin(w.heading) * speed * dt;
      w.z -= Math.cos(w.heading) * speed * dt;
      w.phase += dt * speed * 4.5;
      const swing = Math.sin(w.phase) * 0.55;
      w.mesh.userData.legL.rotation.x = swing;
      w.mesh.userData.legR.rotation.x = -swing;
      w.mesh.userData.armL.rotation.x = -swing * 0.7;
      w.mesh.userData.armR.rotation.x = swing * 0.7;
      w.mesh.position.set(w.x, 0, w.z);
      w.mesh.rotation.y = -w.heading;
    }
  }

  return { walkers, step, nearestWalker, count: walkers.length };
}

// How many townsfolk the city has: main.js and the play-tests read this
// instead of hard-coding PEDS.count a second time.
