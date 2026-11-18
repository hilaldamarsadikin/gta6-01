// TELUK EMAS — effects: exhaust smoke, muzzle flashes, impact puffs and
// kicked-up dust. One shared pool of sprite puffs, recycled forever, so
// the game never allocates mid-frame. A puff grows, fades and dies in
// under a second; its colour and size are chosen at the spawn site.
import * as THREE from '../vendor/three/three.module.min.js';

const POOL = 120;

export function createEffects(scene) {
  const texture = makePuffTexture();
  const puffs = [];
  for (let i = 0; i < POOL; i += 1) {
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.visible = false;
    scene.add(sprite);
    puffs.push({ sprite, life: 0, maxLife: 1, grow: 1, rise: 0 });
  }
  let next = 0;

  function makePuffTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
  }

  function spawn(x, y, z, colour, size, life, rise) {
    const puff = puffs[next];
    next = (next + 1) % POOL;
    puff.sprite.visible = true;
    puff.sprite.position.set(x, y, z);
    puff.sprite.material.color.setHex(colour);
    puff.sprite.scale.set(size, size, 1);
    puff.sprite.material.opacity = 0.85;
    puff.life = life;
    puff.maxLife = life;
    puff.grow = size * 2.2;
    puff.rise = rise;
  }

  function exhaust(x, y, z) {
    spawn(x, y, z, 0x888888, 0.5, 0.7, 1.2);
  }

  function muzzle(x, y, z) {
    spawn(x, y, z, 0xffd23a, 0.9, 0.12, 0);
  }

  function impact(x, y, z) {
    spawn(x, y, z, 0xcccccc, 0.8, 0.5, 0.6);
  }

  function bloodlessHit(x, y, z) {
    // a hit on a person or a car: a grey-white puff, no gore
    spawn(x, y, z, 0xdddddd, 0.7, 0.45, 0.8);
  }

  function dust(x, y, z) {
    // kicked up by wheels off the asphalt
    spawn(x, y, z, 0xcbb98a, 0.9, 0.8, 0.9);
  }

  function brakeSmoke(x, y, z) {
    // pale tyre smoke from a handbrake slide
    spawn(x, y, z, 0xbbbbbb, 0.7, 0.6, 1.0);
  }

  function spark(x, y, z) {
    // a hard metal-on-metal hit: a short orange flash with almost no rise,
    // so it reads as a strike, not as smoke. Car rams use this; soft hits
    // (people, dust) use the grey puffs above instead.
    spawn(x, y, z, 0xff9a3c, 0.6, 0.25, 0.2);
  }

  function step(dt) {
    for (const puff of puffs) {
      if (!puff.sprite.visible) continue;
      puff.life -= dt;
      if (puff.life <= 0) {
        puff.sprite.visible = false;
        continue;
      }
      const t = 1 - puff.life / puff.maxLife;
      puff.sprite.position.y += puff.rise * dt;
      const s = puff.sprite.scale.x + puff.grow * dt;
      puff.sprite.scale.set(s, s, 1);
      puff.sprite.material.opacity = 0.85 * (1 - t);
    }
  }

  // Hide every live puff at once: the restart path uses this so smoke
  // from the last run never hangs in the air of the new one. The ring
  // cursor restarts too, so the next spawn reuses the oldest slot.
  function clear() {
    for (const puff of puffs) {
      puff.sprite.visible = false;
      puff.life = 0;
    }
    next = 0;
  }

  // How many puffs are alive right now: play-tests read this to prove a
  // shot actually fired or a car actually smoked, without peeking at
  // the pool. Zero after clear() means the restart really cleaned up.
  // The pool is fixed at POOL sprites, so the count can never exceed 120.
  function liveCount() {
    let n = 0;
    for (const puff of puffs) if (puff.sprite.visible) n += 1;
    return n;
  }

  return { exhaust, muzzle, impact, bloodlessHit, dust, brakeSmoke, spark, step, clear, liveCount };
}
