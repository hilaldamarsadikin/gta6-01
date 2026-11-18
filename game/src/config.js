// TELUK EMAS — every number that tunes the game, in one place. Positions
// are metres on the city grid: avenues run north-south, streets east-west,
// one road every CITY.block metres, +x east and -z north. Nothing in the
// other modules may hard-code a tuning value; it lives here. Changing a
// number here retunes the whole game at once — that is the point.

// The grid itself.
export const CITY = {
  block: 80, // metres between neighbouring road centrelines
  roadHalf: 8, // half the width of the asphalt
  roads: 7, // road centrelines on each axis, centred on 0
  groundSize: 640, // side of the ground plane
  beachZ: 300, // south of this line the ground turns to sand, then sea
  seaZ: 380,
};

export const STEP = 1 / 60; // fixed simulation step, in seconds

// The chase camera's resting spot: how far behind the player it sits,
// how high, and how far to the side for the three-quarter rear view.
// main.js reads these instead of burying the numbers in its own state.
// Screenshot staging overrides them per shot (see COVER_STAGING).
export const CAMERA_DEFAULTS = {
  distance: 9,
  height: 3.6,
  side: 0,
};

export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 10,
  radius: 0.55,
  height: 1.8,
  health: 100,
  punchDamage: 25,
  pistolDamage: 34,
  pistolAmmo: 12,
};

export const CAR = {
  accel: 22,
  brake: 34,
  reverseAccel: 12,
  maxSpeed: 38,
  maxReverse: 10,
  turnRate: 2.1, // radians per second at full lock, scaled with speed
  grip: 6, // how fast sideways velocity is killed (arcade drift feel)
  offroadFactor: 0.45, // speed multiplier once the wheels leave the asphalt
};

export const TRAFFIC = {
  count: 12,
  speed: 9,
  minGap: 7, // metres a traffic car leaves to the car ahead
};

export const PEDS = {
  count: 16,
  walkSpeed: 1.4,
};

export const POLICE = {
  maxCars: 4, // one cruiser per wanted star, at most four
  chaseSpeed: 30,
  spawnDistance: 90, // how far out a new cruiser appears
  ramDamage: 8,
  decaySeconds: 12, // unseen this long at low heat and one star cools off
};

export const WANTED = {
  steal: 2, // taking a car that is not yours
  hitPed: 1,
  hitCar: 1,
  shoot: 1,
  max: 5,
};

export const TAXI = {
  fare: 180,
  pickupRadius: 10, // how close the car must stop to the passenger
  dropoffRadius: 10,
  minTrip: 60, // metres from pickup to the first drop-off
  maxTrip: 140,
};

export const MONEY = {
  start: 350,
  missionReward: [400, 900, 1500, 1200, 5000],
  taxiFare: TAXI.fare,
  debt: 12000, // what Raka owes Mira; the story ends when it is paid
};

// Everything the five jobs pay out, added up: the "story complete" line
// on the title screen quotes this total.
export const TOTAL_MISSION_REWARD = MONEY.missionReward.reduce((a, b) => a + b, 0);

export const AUDIO = {
  master: 0.5,
  engineBase: 0.05,
  engineTop: 0.09,
  siren: 0.05,
  music: 0.05,
};

// HUD tuning: how many feed lines stay visible, how long a feed line may
// be, and how wide the minimap looks. The feed caps live here so hud.js
// never hard-codes a number the minimap also has to agree with; the
// minimap view lives here too, so the map and the world agree on scale.
export const HUD = {
  feedLines: 4,
  feedMaxChars: 140,
  minimapView: 220, // metres across the minimap's square
};

export const PALETTE = {
  skyDay: 0x8ec9ee,
  skyDusk: 0xff9a5c,
  sunDay: 0xfff2d8,
  sunDusk: 0xff7733,
  sea: 0x2e7f9e,
  sand: 0xe8d29a,
  grass: 0x6fae5e,
  asphalt: 0x3a3d42,
  sidewalk: 0x9a9a92,
  buildingRoof: 0x4a4a52,
};

export const SAVE_KEY = 'teluk-emas.save.v1';

// Mira's five jobs, in the order she hands them out. Each one names its
// objective text, its target point and what the player must do there.
export const MISSIONS = [
  {
    id: 'pemanasan',
    title: 'Pemanasan',
    from: 'Mira',
    text: 'Raka, utangmu 12.000 dolar. Kerja dulu, bayar nanti. Naik mobil apa saja, lalu datang ke titik kuning.',
    target: { x: 160, z: -160 },
    kind: 'drive-to',
    reward: 400,
  },
  {
    id: 'mobil-target',
    title: 'Mobil Target',
    from: 'Mira',
    text: 'Ada sedan emas parkir di dekat taman. Curi, bawa ke bengkel di pelabuhan. Jangan sampai penyok parah.',
    target: { x: 0, z: 120 },
    kind: 'steal-deliver',
    deliver: { x: 240, z: 160 },
    reward: 900,
  },
  {
    id: 'lolos-kejaran',
    title: 'Lolos dari Kejaran',
    from: 'Mira',
    text: 'Polisi sudah mengendusmu. Bintang tiga. Kabur dan hilangkan mereka dari ekormu.',
    kind: 'escape',
    wanted: 3,
    reward: 1500,
  },
  {
    id: 'antar-paket',
    title: 'Antar Paket',
    from: 'Mira',
    text: 'Paket ini harus sampai di gudang utara dalam 90 detik. Jangan tanya isinya. Jangan telat.',
    target: { x: -160, z: -240 },
    kind: 'timed-deliver',
    timeLimit: 90,
    reward: 1200,
  },
  {
    id: 'aksi-terakhir',
    title: 'Aksi Terakhir',
    from: 'Mira',
    text: 'Ini yang terakhir. Ambil tas di lobi bank, lalu bawa ke rumah aman. Setelah ini utangmu lunas.',
    target: { x: 40, z: -228 },
    kind: 'grab-escape',
    deliver: { x: -240, z: 240 },
    wanted: 4,
    reward: 5000,
  },
];

export const CONTROLS_TEXT = [
  'W A S D — jalan / mengemudi',
  'Shift — lari',
  'E — masuk / curi mobil (di dekat mobil)',
  'F — keluar mobil',
  'Klik kiri — tembak (pistol)',
  'Q — pukul',
  'R — isi ulang peluru',
  'Spasi — rem tangan (di mobil)',
  'H — klakson',
  'T — taksi (di mobil)',
  'M — suara hidup/mati',
  'P / Esc — jeda',
];

// Where the cover screenshot stages its chase: two cruisers head-on
// ahead of the player, and the tighter camera that frames all three.
// The spots are ahead of the player on his own road (negative z), facing
// him, so both light bars read in the still.
export const COVER_STAGING = {
  policeSpots: [[-5.5, -20, Math.PI], [5.5, -32, Math.PI]],
  camDistance: 7.5,
  camHeight: 3.2,
  camSide: 5.5,
};
