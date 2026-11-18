// TELUK EMAS — the minimap: a live top-down canvas in the HUD's corner.
// Redrawn every frame from the city grid: roads, beach and sea, the park,
// the bank and the harbour as landmarks, the player arrow, traffic, police
// and the pulsing objective markers. North is up and the view follows the
// player. The mission marker is yellow, the taxi marker cyan, so the two
// jobs never blur into each other at a glance. The view width comes from
// HUD.minimapView in config.js, so the map and the world agree on scale.
import { CITY, HUD } from './config.js';

const VIEW = HUD.minimapView; // metres across the minimap's square

// Marker colours, in one place: the mission diamond, the taxi diamond and
// the two landmark squares all read from here, so a colour change in one
// place never leaves a stale twin behind in the draw code below.
const MARKER = {
  mission: '#ffd23a',
  taxi: '#3ad2ff',
  bank: '#d8b25e',
  harbour: '#4aa3d8',
};

export function createMinimap(canvas) {
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const scale = size / VIEW;
  const roads = [];
  for (let i = 0; i < CITY.roads; i += 1) {
    roads.push((i - (CITY.roads - 1) / 2) * CITY.block);
  }

  function toMap(x, z, px, pz) {
    return [size / 2 + (x - px) * scale, size / 2 + (z - pz) * scale];
  }

  function draw(state) {
    const { playerX, playerZ, heading, cars, policeCars, missionTarget, taxiTarget } = state;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#20262e';
    ctx.fillRect(0, 0, size, size);

    // beach and sea (south of the city)
    const [, beachY] = toMap(0, CITY.beachZ, playerX, playerZ);
    const [, seaY] = toMap(0, CITY.seaZ, playerX, playerZ);
    if (beachY < size) {
      ctx.fillStyle = '#c9b078';
      ctx.fillRect(0, Math.max(0, beachY), size, size);
    }
    if (seaY < size) {
      ctx.fillStyle = '#2e7f9e';
      ctx.fillRect(0, Math.max(0, seaY), size, size);
    }

    // roads
    ctx.fillStyle = '#3a3d42';
    const roadW = 16 * scale;
    for (const c of roads) {
      const [rx] = toMap(c, 0, playerX, playerZ);
      if (rx > -roadW && rx < size + roadW) ctx.fillRect(rx - roadW / 2, 0, roadW, size);
      const [, rz] = toMap(0, c, playerX, playerZ);
      if (rz > -roadW && rz < size + roadW) ctx.fillRect(0, rz - roadW / 2, size, roadW);
    }

    // the park, the bank and the harbour: three landmarks to navigate by.
    // The bank and the harbour get a tiny label so a new player can tell
    // the two gold and blue squares apart at a glance.
    const [parkX, parkZ] = toMap(40, 120, playerX, playerZ);
    const parkW = 64 * scale;
    ctx.fillStyle = '#5da24e';
    ctx.fillRect(parkX - parkW / 2, parkZ - parkW / 2, parkW, parkW);
    const [bankX, bankZ] = toMap(40, -200, playerX, playerZ);
    ctx.fillStyle = MARKER.bank;
    ctx.fillRect(bankX - 6, bankZ - 6, 12, 12);
    const [harX, harZ] = toMap(200, 160, playerX, playerZ);
    ctx.fillStyle = MARKER.harbour;
    ctx.fillRect(harX - 6, harZ - 6, 12, 12);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    // labels sit right of their squares; the bounds check keeps a label
    // from running off the canvas edge when the landmark is near it
    if (bankX > 0 && bankX < size - 34 && bankZ > 0 && bankZ < size) ctx.fillText('BANK', bankX + 9, bankZ + 3);
    if (harX > 0 && harX < size - 58 && harZ > 0 && harZ < size) ctx.fillText('PELABUHAN', harX + 9, harZ + 3);

    function dot(x, z, colour, r) {
      const [mx, my] = toMap(x, z, playerX, playerZ);
      if (mx < -10 || mx > size + 10 || my < -10 || my > size + 10) return;
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.fill();
    }

    function diamond(x, z, colour, pulse) {
      const [mx, my] = toMap(x, z, playerX, playerZ);
      if (mx < -pulse || mx > size + pulse || my < -pulse || my > size + pulse) return;
      // a faint expanding ring around the marker, so it reads from afar
      ctx.strokeStyle = colour;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx, my, pulse + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.moveTo(mx, my - pulse);
      ctx.lineTo(mx + pulse, my);
      ctx.lineTo(mx, my + pulse);
      ctx.lineTo(mx - pulse, my);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // objective markers: the mission diamond pulses yellow, the taxi one
    // pulses cyan, each with a white rim so it reads on any background
    const pulse = 5 + Math.sin(performance.now() / 200) * 2;
    if (missionTarget) diamond(missionTarget.x, missionTarget.z, MARKER.mission, pulse);
    if (taxiTarget) diamond(taxiTarget.x, taxiTarget.z, MARKER.taxi, pulse);

    // traffic (white) and police (red, bigger)
    for (const car of cars || []) dot(car.x, car.z, '#ffffff', 2.5);
    for (const car of policeCars || []) dot(car.x, car.z, '#ff4d4d', 3.5);

    // the player arrow, gold with a dark rim
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(heading);
    ctx.fillStyle = MARKER.mission;
    ctx.strokeStyle = '#1a1a1e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(6, 6);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // scale bar: a 40-metre bar at the bottom, so the map's zoom reads
    // without guessing — one bar is half a city block, roughly.
    const barLen = 40 * scale;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(8, size - 10);
    ctx.lineTo(8 + barLen, size - 10);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('40 m', 8 + barLen + 4, size - 7);

    // north marker and frame
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('U', 6, 14);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, size - 2, size - 2);
  }

  return { draw };
}
