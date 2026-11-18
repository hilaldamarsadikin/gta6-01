// TELUK EMAS — Raka on foot: walking, running, punching, shooting, and
// getting in and out of cars. He is a jointed humanoid mesh with a pistol
// in his right hand when armed; movement is camera-relative, so W always
// walks away from the camera instead of toward a compass point.
import * as THREE from '../vendor/three/three.module.min.js';
import { PLAYER } from './config.js';
import { makePersonMesh } from './pedestrians.js';

export function createPlayer(scene) {
  // orange shirt, dark trousers: Raka stands out against the city
  const mesh = makePersonMesh(0xe8642a, 0x2a3242, 0xe8b98a);
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.14, 0.34),
    new THREE.MeshLambertMaterial({ color: 0x1a1a1e }),
  );
  gun.position.set(0.36, 1.05, 0.2);
  mesh.add(gun);
  mesh.userData.gun = gun;
  scene.add(mesh);
  return {
    mesh,
    x: 0,
    z: 40,
    heading: 0,
    health: PLAYER.health,
    ammo: PLAYER.pistolAmmo,
    phase: 0,
    armed: true,
    punchCooldown: 0,
    shootCooldown: 0,
  };
}

// Put Raka back on his feet at a known spot, whole again: the restart path
// and the shot stager both use this instead of poking fields one by one.
// Armed is reset too, so a restarted Raka always has his pistol in hand.
export function resetPlayer(player, x, z, heading) {
  player.x = x;
  player.z = z;
  player.heading = heading;
  player.health = PLAYER.health;
  player.ammo = PLAYER.pistolAmmo;
  player.armed = true;
  player.punchCooldown = 0;
  player.shootCooldown = 0;
  player.mesh.visible = true;
  player.mesh.position.set(x, 0, z);
  player.mesh.rotation.y = -heading;
}

// Heal by `amount`, clamped to full health; returns the new health. The
// slow regeneration while the heat is off goes through here.
export function healPlayer(player, amount) {
  player.health = Math.min(PLAYER.health, player.health + amount);
  return player.health;
}

// Reload the pistol to a full magazine and clear the shooting cooldown:
// the R key goes through here instead of poking the ammo field directly,
// so a reload always leaves the gun in a consistent state.
export function reloadPlayer(player) {
  player.ammo = PLAYER.pistolAmmo;
  player.shootCooldown = 0;
  return player.ammo;
}

// True while Raka is still standing: the main loop checks this instead of
// comparing health to zero in two places. Zero health is the only way
// down — health never goes negative in the first place.
export function isPlayerAlive(player) {
  return player.health > 0;
}

// True while Raka is holding his pistol: the HUD shows the ammo readout
// and the right arm aims forward only when this is true. Disarming is
// never done by poking the flag — the only writer is resetPlayer, so a
// restarted Raka always starts armed.
export function isPlayerArmed(player) {
  return !!player.armed;
}

// One on-foot step. `move` is { x: -1..1 strafe, y: -1..1 forward,
// run: bool } in camera space; `camHeading` is the camera's yaw. The
// collide callback answers whether (x, z) with the given radius is free.
export function stepPlayer(player, move, camHeading, dt, collide) {
  const speed = move.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const sin = Math.sin(camHeading);
  const cos = Math.cos(camHeading);
  // camera-relative: forward is away from the camera
  const mx = (sin * move.y + cos * move.x) * speed;
  const mz = (-cos * move.y + sin * move.x) * speed;
  const moving = Math.hypot(mx, mz) > 0.1;
  if (moving) {
    const wantHeading = Math.atan2(mx, -mz);
    let diff = wantHeading - player.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    player.heading += Math.max(-10 * dt, Math.min(10 * dt, diff));
    const nx = player.x + mx * dt;
    const nz = player.z + mz * dt;
    if (!collide(nx, player.z, PLAYER.radius)) player.x = nx;
    if (!collide(player.x, nz, PLAYER.radius)) player.z = nz;
    player.phase += dt * speed * 1.6;
  }
  const swing = moving ? Math.sin(player.phase) * 0.6 : 0;
  player.mesh.userData.legL.rotation.x = swing;
  player.mesh.userData.legR.rotation.x = -swing;
  player.mesh.userData.armL.rotation.x = -swing * 0.6;
  // the right arm holds the pistol forward while armed
  player.mesh.userData.armR.rotation.x = player.armed ? -1.2 : swing * 0.6;
  player.mesh.userData.gun.visible = player.armed;
  player.mesh.position.set(player.x, 0, player.z);
  player.mesh.rotation.y = -player.heading;
  if (player.punchCooldown > 0) player.punchCooldown -= dt;
  if (player.shootCooldown > 0) player.shootCooldown -= dt;
  return moving;
}

// A shot: hitscan against the nearest walker, officer or traffic car in
// front of the player within 40 m. Returns the thing hit, or null.
export function shootAt(player, targets) {
  if (player.shootCooldown > 0 || player.ammo <= 0) return null;
  player.shootCooldown = 0.28;
  player.ammo -= 1;
  const fx = Math.sin(player.heading);
  const fz = -Math.cos(player.heading);
  let best = null;
  let bestD = 40;
  for (const t of targets) {
    const dx = t.x - player.x;
    const dz = t.z - player.z;
    const along = dx * fx + dz * fz;
    if (along < 1 || along > bestD) continue;
    const side = Math.abs(dx * fz - dz * fx);
    if (side < 2.2) {
      best = t;
      bestD = along;
    }
  }
  return best;
}

// A punch: the same test at arm's length, with its own cooldown.
export function punchAt(player, targets) {
  if (player.punchCooldown > 0) return null;
  player.punchCooldown = 0.5;
  const fx = Math.sin(player.heading);
  const fz = -Math.cos(player.heading);
  let best = null;
  let bestD = 2.4;
  for (const t of targets) {
    const dx = t.x - player.x;
    const dz = t.z - player.z;
    const along = dx * fx + dz * fz;
    if (along < 0 || along > bestD) continue;
    const side = Math.abs(dx * fz - dz * fx);
    if (side < 1.4) {
      best = t;
      bestD = along;
    }
  }
  return best;
}
