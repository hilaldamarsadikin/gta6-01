// TELUK EMAS — the city itself: ground, road grid, buildings with painted
// facades, lamps, palms, the park, the beach and the harbour. Everything is
// built from boxes, cylinders and canvas textures so the whole city is
// local files only. Facades are deliberately varied — twelve palettes,
// awnings and shopfronts on the ground floor, windows that differ in width
// and tint from column to column, a cornice at the top and clutter on the
// roof — so no two streets read the same. Returns the colliders (building
// footprints) and the handles the main loop needs to move the sun and sea.
import * as THREE from '../vendor/three/three.module.min.js';
import { CITY, PALETTE } from './config.js';

const ROAD_CENTRES = [];
for (let i = 0; i < CITY.roads; i += 1) ROAD_CENTRES.push((i - (CITY.roads - 1) / 2) * CITY.block);

// A block centre sits halfway between two neighbouring roads.
const BLOCK_CENTRES = [];
for (let i = 0; i < CITY.roads - 1; i += 1) BLOCK_CENTRES.push((i - (CITY.roads - 2) / 2) * CITY.block);

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// Twelve facade palettes: wall, trim, glass tint and awning colour. No
// street is one colour, and no building is one flat wall. The eleventh
// (deep teal with a sand awning) breaks up the warm end of the row, so
// the harbour side of town reads cooler than the market side; the twelfth
// (warm coral with a blue awning) warms the market side back up — and with
// twelve in the deck, two neighbouring buildings rarely share a palette.
// The twelfth reuses the blue awning of the second palette on a coral wall,
// so it reads as a different shopfront rather than a repeat of it.
const FACADE_PALETTES = [
  { base: '#c98f5f', trim: '#8a5a30', glass: '#8fb8c8', awning: '#b8442c' },
  { base: '#7fa3b8', trim: '#4a6a7d', glass: '#a8c8d8', awning: '#2c6eb8' },
  { base: '#b8b0a0', trim: '#7d7466', glass: '#9fb8c8', awning: '#3f8f4f' },
  { base: '#d8b25e', trim: '#96742a', glass: '#c8a878', awning: '#7d4fa3' },
  { base: '#8a9a7d', trim: '#5c6b52', glass: '#a8c8b8', awning: '#c23b2e' },
  { base: '#a87d94', trim: '#6e4f61', glass: '#c8a8b8', awning: '#2e6fc2' },
  { base: '#c25a4a', trim: '#7d3226', glass: '#d8b8a8', awning: '#e8c33a' },
  { base: '#5f7d8a', trim: '#3a525c', glass: '#b8d8e8', awning: '#d97b2e' },
  { base: '#e0d5c0', trim: '#a89878', glass: '#a8c8d8', awning: '#3f8f4f' },
  { base: '#6e5a8a', trim: '#4a3a5e', glass: '#b8a8d8', awning: '#e8c33a' },
  { base: '#3a6a6a', trim: '#24484a', glass: '#a8d8c8', awning: '#d8b25e' },
  { base: '#e07850', trim: '#96422e', glass: '#f0c8b8', awning: '#2e6fc2' },
];

// One facade variant: a day texture (walls + glass windows + awning and
// shopfront at street level) and a lit mask (black walls + warm windows)
// used as the emissive map at dusk.
function facadePair(random, palette) {
  const floors = random.int(4, 12);
  const cols = random.int(4, 8);
  // each column gets its own window width, so the grid never looks stamped
  const colW = [];
  for (let c = 0; c < cols; c += 1) colW.push(random.range(0.42, 0.62));
  const shop = random.chance(0.45);
  const awningColour = palette.awning;
  const day = canvasTexture(256, 512, (ctx, w, h) => {
    ctx.fillStyle = palette.base;
    ctx.fillRect(0, 0, w, h);
    // a darker plinth at the bottom and a cornice at the top
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, h - 26, w, 26);
    ctx.fillStyle = palette.trim;
    ctx.fillRect(0, 6, w, 8);
    // faint grime near the bottom
    const grad = ctx.createLinearGradient(0, h - 90, 0, h);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, h - 90, w, 90);
    const cw = w / cols;
    const ch = h / floors;
    for (let f = 0; f < floors; f += 1) {
      for (let c = 0; c < cols; c += 1) {
        const ww = cw * colW[c];
        const x = c * cw + (cw - ww) / 2;
        const y = f * ch + ch * 0.25;
        const wh = ch * (f === 0 ? 0.62 : 0.5);
        ctx.fillStyle = '#20262e';
        ctx.fillRect(x, y, ww, wh);
        ctx.fillStyle = palette.glass;
        ctx.globalAlpha = 0.55;
        ctx.fillRect(x + 2, y + 2, ww - 4, wh * 0.45);
        ctx.globalAlpha = 1;
      }
    }
    if (shop) {
      // a shopfront: a darker band with a lit sign strip and an awning
      const bandY = h - 64;
      ctx.fillStyle = '#2c2f33';
      ctx.fillRect(0, bandY, w, 38);
      ctx.fillStyle = awningColour;
      ctx.fillRect(0, bandY - 8, w, 8);
      ctx.fillStyle = '#ffd23a';
      ctx.fillRect(10, bandY + 12, w - 20, 4);
      // awning stripes above the shopfront
      for (let x = 0; x < w; x += 32) {
        ctx.fillStyle = x % 64 === 0 ? awningColour : 'rgba(255,255,255,0.85)';
        ctx.fillRect(x, bandY - 26, 32, 18);
      }
    }
  });
  const lit = canvasTexture(256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    const cw = w / cols;
    const ch = h / floors;
    for (let f = 0; f < floors; f += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (random.chance(0.45)) continue;
        ctx.fillStyle = random.chance(0.8) ? '#ffd27a' : '#9fd8ff';
        ctx.fillRect(c * cw + (cw - cw * colW[c]) / 2, f * ch + ch * 0.25, cw * colW[c], ch * 0.5);
      }
    }
    if (shop) {
      ctx.fillStyle = '#ffd27a';
      ctx.fillRect(10, h - 52, w - 20, 4);
    }
  });
  return { day, lit, floors };
}

function roadTexture() {
  return canvasTexture(128, 512, (ctx, w, h) => {
    ctx.fillStyle = '#3a3d42';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2f3236';
    ctx.fillRect(0, 0, 6, h);
    ctx.fillRect(w - 6, 0, 6, h);
    ctx.fillStyle = '#e8c33a';
    for (let y = 0; y < h; y += 64) ctx.fillRect(w / 2 - 3, y + 8, 6, 34);
  });
}

// Roof clutter: a parapet rim plus an air-conditioning box and, on some
// blocks, a water tank, so the skyline is not a row of flat slabs.
function buildRoofProps(group, x, z, topY, w, d, random) {
  const rimH = 0.7;
  const rimT = 0.35;
  const rimMat = new THREE.MeshLambertMaterial({ color: 0x55555e });
  for (const [rx, rz, rw, rd] of [
    [0, -d / 2, w, rimT], [0, d / 2, w, rimT],
    [-w / 2, 0, rimT, d], [w / 2, 0, rimT, d],
  ]) {
    const rim = new THREE.Mesh(new THREE.BoxGeometry(rw, rimH, rd), rimMat);
    rim.position.set(x + rx, topY + rimH / 2, z + rz);
    group.add(rim);
  }
  const acMat = new THREE.MeshLambertMaterial({ color: 0x9a9a92 });
  const acCount = random.int(1, 3);
  for (let i = 0; i < acCount; i += 1) {
    const ac = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 1.2), acMat);
    ac.position.set(x + random.range(-w / 4, w / 4), topY + 0.4, z + random.range(-d / 4, d / 4));
    group.add(ac);
  }
  if (random.chance(0.4)) {
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.1, 2.2, 8),
      new THREE.MeshLambertMaterial({ color: 0x6a7a8a }),
    );
    tank.position.set(x + random.range(-w / 4, w / 4), topY + 1.1, z + random.range(-d / 4, d / 4));
    group.add(tank);
  }
}

export function createCity(scene, random) {
  const colliders = [];
  const lampHeads = [];
  const group = new THREE.Group();
  scene.add(group);

  // --- lights and sky -------------------------------------------------
  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(PALETTE.sunDay, 2.2);
  sun.position.set(120, 180, 60);
  scene.add(sun);
  scene.background = new THREE.Color(PALETTE.skyDay);
  scene.fog = new THREE.Fog(PALETTE.skyDay, 320, 700);

  // --- ground: grass, then sand, then sea ----------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.groundSize, CITY.groundSize),
    new THREE.MeshLambertMaterial({ color: PALETTE.grass }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 40);
  group.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.groundSize, 90),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.05, CITY.beachZ + 40);
  group.add(sand);

  const seaTexture = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#2e7f9e';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 10; i += 1) {
      ctx.beginPath();
      const y = random.range(0, h);
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(w * 0.3, y - 6, w * 0.6, y + 6, w, y);
      ctx.stroke();
    }
  });
  seaTexture.wrapS = THREE.RepeatWrapping;
  seaTexture.wrapT = THREE.RepeatWrapping;
  seaTexture.repeat.set(6, 3);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.groundSize, 260),
    new THREE.MeshLambertMaterial({ map: seaTexture }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.02, CITY.seaZ + 130);
  group.add(sea);

  // --- roads ----------------------------------------------------------
  const roadTex = roadTexture();
  roadTex.wrapS = THREE.RepeatWrapping;
  roadTex.wrapT = THREE.RepeatWrapping;
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  for (const c of ROAD_CENTRES) {
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(CITY.roadHalf * 2, CITY.groundSize), roadMat.clone());
    ns.material.map = roadTex.clone();
    ns.material.map.needsUpdate = true;
    ns.material.map.repeat.set(1, 10);
    ns.rotation.x = -Math.PI / 2;
    ns.position.set(c, 0.06, 40);
    group.add(ns);
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(CITY.groundSize, CITY.roadHalf * 2), roadMat.clone());
    ew.material.map = roadTex.clone();
    ew.material.map.needsUpdate = true;
    ew.material.map.repeat.set(10, 1);
    ew.material.map.rotation = Math.PI / 2;
    ew.material.map.center.set(0.5, 0.5);
    ew.rotation.x = -Math.PI / 2;
    ew.position.set(0, 0.06, c);
    group.add(ew);
  }

  // --- sidewalks and buildings ---------------------------------------
  const facades = FACADE_PALETTES.map((p) => facadePair(random, p));
  const roofMat = new THREE.MeshLambertMaterial({ color: PALETTE.buildingRoof });
  const sidewalkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const parkBlock = { x: 40, z: 120 }; // the green square in the middle-south
  const bankBlock = { x: 40, z: -200 }; // the bank: mission five's target
  const harbourBlocks = [{ x: 200, z: 160 }];

  function isSpecial(bx, bz) {
    if (bx === parkBlock.x && bz === parkBlock.z) return 'park';
    if (bx === bankBlock.x && bz === bankBlock.z) return 'bank';
    for (const hb of harbourBlocks) if (bx === hb.x && bz === hb.z) return 'harbour';
    return null;
  }

  for (const bx of BLOCK_CENTRES) {
    for (const bz of BLOCK_CENTRES) {
      if (bz >= CITY.beachZ - 40) continue; // the beach stays empty
      const kind = isSpecial(bx, bz);
      // sidewalk slab for the whole block
      const slab = new THREE.Mesh(new THREE.BoxGeometry(64, 0.3, 64), sidewalkMat);
      slab.position.set(bx, 0.15, bz);
      group.add(slab);
      if (kind === 'park') {
        buildPark(group, random, bx, bz);
        continue;
      }
      if (kind === 'harbour') {
        buildHarbour(group, random, bx, bz, colliders);
        continue;
      }
      if (kind === 'bank') {
        buildBank(group, random, bx, bz, colliders, facades);
        continue;
      }
      // ordinary block: 1-4 buildings around a small courtyard
      const count = random.int(1, 4);
      for (let i = 0; i < count; i += 1) {
        const w = random.range(16, 26);
        const d = random.range(16, 26);
        const h = random.range(12, 55);
        const ox = random.range(-14, 14);
        const oz = random.range(-14, 14);
        const x = bx + ox;
        const z = bz + oz;
        const facade = random.pick(facades);
        const side = new THREE.MeshLambertMaterial({ map: facade.day, emissive: 0xffffff, emissiveMap: facade.lit, emissiveIntensity: 0 });
        const mats = [side, side, roofMat, roofMat, side, side];
        const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
        building.position.set(x, h / 2 + 0.3, z);
        group.add(building);
        building.userData.litMaterial = side;
        buildRoofProps(group, x, z, h + 0.3, w, d, random);
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
      // a palm or two on the block's corners
      for (let i = 0; i < 2; i += 1) {
        if (random.chance(0.5)) buildPalm(group, random, bx + random.range(-28, 28), bz + random.range(-28, 28));
      }
    }
  }

  // --- street lamps along every road ----------------------------------
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c2f33 });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0xfff2c0, emissive: 0xffdf80, emissiveIntensity: 0 });
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 5.4, 6);
  const headGeo = new THREE.SphereGeometry(0.28, 8, 6);
  for (const c of ROAD_CENTRES) {
    for (let p = -280; p <= 280; p += 56) {
      for (const [x, z] of [[c + 9, p], [c - 9, p + 28]]) {
        if (z > CITY.beachZ) continue;
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(x, 2.7, z);
        group.add(pole);
        const head = new THREE.Mesh(headGeo, lampMat);
        head.position.set(x, 5.5, z);
        group.add(head);
        lampHeads.push(head);
      }
    }
  }

  // --- beach palms -----------------------------------------------------
  for (let x = -300; x <= 300; x += 36) {
    if (random.chance(0.6)) buildPalm(group, random, x + random.range(-8, 8), CITY.beachZ + random.range(6, 30));
  }

  function setTimeOfDay(t) {
    // t: 0 = bright noon, 1 = deep dusk. Sun drops, sky warms, lamps wake.
    const sky = new THREE.Color(PALETTE.skyDay).lerp(new THREE.Color(PALETTE.skyDusk), t);
    scene.background = sky;
    scene.fog.color.copy(sky);
    sun.color.setHex(t > 0.6 ? PALETTE.sunDusk : PALETTE.sunDay);
    sun.intensity = 2.2 - t * 1.1;
    sun.position.set(120 - t * 160, 180 - t * 130, 60);
    hemi.intensity = 0.9 - t * 0.45;
    // every lamp head shares one material, so one assignment lights the
    // whole city at dusk (the per-head loop below is a no-op safeguard —
    // the heads already reference lampMat).
    lampMat.emissiveIntensity = t * 1.6;
    for (const head of lampHeads) head.material = lampMat;
    group.traverse((obj) => {
      if (obj.userData.litMaterial) obj.userData.litMaterial.emissiveIntensity = t * 0.55;
    });
  }

  function update(dt, elapsed) {
    seaTexture.offset.x = (elapsed * 0.004) % 1;
    seaTexture.offset.y = (elapsed * 0.002) % 1;
  }

  return { colliders, setTimeOfDay, update };
}

function buildPark(group, random, bx, bz) {
  const lawn = new THREE.Mesh(
    new THREE.BoxGeometry(58, 0.4, 58),
    new THREE.MeshLambertMaterial({ color: 0x5da24e }),
  );
  lawn.position.set(bx, 0.2, bz);
  group.add(lawn);
  for (let i = 0; i < 9; i += 1) {
    buildPalm(group, random, bx + random.range(-24, 24), bz + random.range(-24, 24));
  }
  // a small pond in the middle
  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(9, 20),
    new THREE.MeshLambertMaterial({ color: 0x3a8fb5 }),
  );
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(bx, 0.45, bz);
  group.add(pond);
  // two wooden benches facing the pond, so the park reads as a place
  // people sit, not just a green square
  const benchMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
  for (const [ox, oz, rot] of [[-13, 0, Math.PI / 2], [13, 0, -Math.PI / 2]]) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 1), benchMat);
    bench.position.set(bx + ox, 0.65, bz + oz);
    bench.rotation.y = rot;
    group.add(bench);
  }
}

function buildHarbour(group, random, bx, bz, colliders) {
  const colours = [0xb8442c, 0x2c6eb8, 0x3f8f4f, 0xc9a13a, 0x7d4fa3];
  for (let i = 0; i < 10; i += 1) {
    const w = 12;
    const h = 2.6;
    const d = 2.6;
    const x = bx + random.range(-24, 24);
    const z = bz + random.range(-24, 24);
    const stack = random.int(1, 3);
    for (let s = 0; s < stack; s += 1) {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshLambertMaterial({ color: random.pick(colours) }),
      );
      box.position.set(x, 0.3 + h / 2 + s * h, z);
      box.rotation.y = random.chance(0.5) ? 0 : Math.PI / 2;
      group.add(box);
    }
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  }
  // the garage: a low shed with a warm door, the steal-deliver target
  const shed = new THREE.Mesh(
    new THREE.BoxGeometry(20, 7, 12),
    new THREE.MeshLambertMaterial({ color: 0x8a7f72 }),
  );
  shed.position.set(bx + 8, 3.8, bz - 20);
  group.add(shed);
  colliders.push({ minX: bx - 2, maxX: bx + 18, minZ: bz - 26, maxZ: bz - 14 });
}

function buildBank(group, random, bx, bz, colliders, facades) {
  // The bank: the tallest block in town, glass-blue, gold trim, steps up front.
  const facade = facades[1];
  const side = new THREE.MeshLambertMaterial({ map: facade.day, emissive: 0xffffff, emissiveMap: facade.lit, emissiveIntensity: 0 });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x3a3a44 });
  const bank = new THREE.Mesh(new THREE.BoxGeometry(34, 64, 26), [side, side, roofMat, roofMat, side, side]);
  bank.position.set(bx, 32.3, bz);
  group.add(bank);
  bank.userData.litMaterial = side;
  colliders.push({ minX: bx - 17, maxX: bx + 17, minZ: bz - 13, maxZ: bz + 13 });
  const steps = new THREE.Mesh(
    new THREE.BoxGeometry(20, 1.2, 8),
    new THREE.MeshLambertMaterial({ color: 0xb8b0a0 }),
  );
  steps.position.set(bx, 0.9, bz + 16);
  group.add(steps);
  // gold sign band
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(30, 2.4, 0.6),
    new THREE.MeshLambertMaterial({ color: 0xd8b25e, emissive: 0x8a6d1f, emissiveIntensity: 0.4 }),
  );
  sign.position.set(bx, 52, bz + 13.2);
  group.add(sign);
}

function buildPalm(group, random, x, z) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.28, 5, 6),
    new THREE.MeshLambertMaterial({ color: 0x7a5230 }),
  );
  trunk.position.set(x, 2.5, z);
  trunk.rotation.z = random.range(-0.08, 0.08);
  group.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
  for (let i = 0; i < 5; i += 1) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(1.1, 6, 4), leafMat);
    const a = (i / 5) * Math.PI * 2;
    leaf.scale.set(1.6, 0.35, 0.7);
    leaf.position.set(x + Math.cos(a) * 1.2, 5.1, z + Math.sin(a) * 1.2);
    leaf.rotation.y = -a;
    group.add(leaf);
  }
}

// True when the point is on a road (within the asphalt), used for the
// off-road speed penalty and the taxi's road test.
export function isOnRoad(x, z) {
  const half = CITY.roadHalf + 1.5;
  for (const c of ROAD_CENTRES) {
    if (Math.abs(x - c) < half || Math.abs(z - c) < half) return true;
  }
  return false;
}

// The nearest road centreline point to (x, z): traffic and the taxi use it
// so their targets are always reachable by car.
export function nearestRoadPoint(x, z) {
  let bestX = ROAD_CENTRES[0];
  let bestZ = ROAD_CENTRES[0];
  for (const c of ROAD_CENTRES) {
    if (Math.abs(x - c) < Math.abs(x - bestX)) bestX = c;
    if (Math.abs(z - c) < Math.abs(z - bestZ)) bestZ = c;
  }
  return Math.abs(x - bestX) < Math.abs(z - bestZ) ? { x: bestX, z } : { x, z: bestZ };
}
