'use strict';
// All maps. Each map is a grid carved out of solid wall from rooms and corridors.
// To add a map: copy one entry, change the rectangles, and give it a theme (see Level.THEMES).
// Corridors are carved first, rooms after (rooms win where they overlap).

const LEVELS = {
  // The original map: an industrial robot factory.
  foundry: {
    name: 'FOUNDRY',
    theme: 'foundry',
    size: 56,
    // Corridors first, rooms after (rooms win where they overlap).
    corridors: [
      { x: 15, y: 7, w: 26, h: 2, wall: 'V' },   // top corridor: control room -> storage
      { x: 7, y: 12, w: 2, h: 10, wall: 'R' },   // control -> server room
      { x: 15, y: 28, w: 8, h: 2, wall: 'V' },   // server -> reactor
      { x: 28, y: 9, w: 2, h: 10, wall: 'V' },   // top corridor -> reactor
      { x: 38, y: 22, w: 8, h: 2, wall: 'H' },   // reactor -> storage
      { x: 44, y: 16, w: 2, h: 6, wall: 'H' },
      { x: 30, y: 34, w: 2, h: 6, wall: 'V' },   // reactor -> hangar
      { x: 30, y: 40, w: 7, h: 2, wall: 'V' },
      { x: 50, y: 16, w: 2, h: 21, wall: 'R' },  // maintenance tunnel: storage -> hangar
      { x: 8, y: 36, w: 2, h: 6, wall: 'R' },    // server -> med lab
      { x: 15, y: 46, w: 5, h: 2, wall: 'V' },   // med lab -> pump room
      { x: 30, y: 47, w: 7, h: 2, wall: 'V' },   // pump room -> hangar
      { x: 24, y: 34, w: 2, h: 8, wall: 'R' },   // reactor -> pump room
      { x: 19, y: 9, w: 2, h: 3, wall: 'V' },    // hidden passage to secret room 1
      { x: 33, y: 46, w: 2, h: 1, wall: 'V' },   // hidden doorway to secret room 2
    ],
    rooms: [
      { name: 'CONTROL ROOM', x: 4, y: 4, w: 11, h: 8, wall: 'P', floor: 'tile' },
      { name: 'STORAGE BAY', x: 41, y: 3, w: 12, h: 13, wall: '#', floor: 'floor' },
      { name: 'SERVER ROOM', x: 3, y: 22, w: 12, h: 14, wall: 'C', floor: 'tile' },
      { name: 'REACTOR HALL', x: 23, y: 19, w: 15, h: 15, wall: '#', floor: 'grate' },
      { name: 'CARGO HANGAR', x: 37, y: 37, w: 16, h: 15, wall: 'H', floor: 'floor' },
      { name: 'MED LAB', x: 4, y: 42, w: 11, h: 9, wall: 'P', floor: 'tile' },
      { name: 'PUMP ROOM', x: 20, y: 42, w: 10, h: 10, wall: 'R', floor: 'floor' },
      { name: 'SECRET STASH 1', x: 17, y: 12, w: 6, h: 5, wall: 'R', floor: 'tile' },
      { name: 'SECRET STASH 2', x: 32, y: 43, w: 4, h: 3, wall: 'R', floor: 'tile' },
    ],
    // Room machines on the inside walls (see Level.furnish), so every room shows what it is for.
    furniture: [
      { room: 'CONTROL ROOM', ch: 'C', sides: 'ws', step: 2 },
      { room: 'STORAGE BAY', ch: 'B', sides: 'nes' },
      { room: 'SERVER ROOM', ch: 'C', sides: 'ws', step: 2 },
      { room: 'REACTOR HALL', ch: 'G', sides: 'nsew', step: 4, start: 2 },
      { room: 'CARGO HANGAR', ch: 'J', sides: 'e' },
      { room: 'CARGO HANGAR', ch: 'A', sides: 'n', step: 2, start: 1 },
      { room: 'MED LAB', ch: 'M', sides: 'ns', step: 2, start: 1 },
      { room: 'MED LAB', ch: 'E', sides: 'w' },
      { room: 'PUMP ROOM', ch: 'T', sides: 'nse', step: 2 },
    ],
    // Solid blocks inside rooms: cover, server racks, the reactor core.
    blocks: [
      ['X', 44, 6], ['X', 45, 6], ['X', 44, 7], ['X', 49, 6], ['X', 49, 7], ['X', 50, 7],
      ['X', 46, 11], ['X', 47, 11], ['X', 47, 12], ['X', 51, 12],
      ['C', 6, 24, 1, 5], ['C', 6, 30, 1, 4], ['C', 10, 24, 1, 5], ['C', 10, 30, 1, 4],
      ['Y', 29, 25, 3, 3],
      ['X', 40, 40], ['X', 41, 40], ['X', 40, 41], ['X', 47, 39], ['X', 48, 39],
      ['X', 44, 44, 2, 2], ['X', 40, 48], ['X', 41, 48], ['X', 49, 47], ['X', 50, 47], ['X', 50, 48],
    ],
    // Decorated wall spots (only applied if that spot is still a wall).
    // S = switch for a secret room, F = fuse box for an electric floor trap.
    accents: [
      ['C', 5, 3], ['C', 7, 3], ['C', 9, 3], ['C', 11, 3], ['C', 13, 3],
      ['L', 19, 6], ['L', 25, 6], ['L', 33, 6], ['L', 39, 6], ['L', 22, 9], ['L', 36, 9],
      ['L', 6, 15], ['L', 9, 19], ['L', 27, 13], ['L', 30, 16],
      ['L', 40, 12], ['L', 53, 6], ['L', 53, 12],
      ['L', 36, 44], ['L', 53, 44],
      ['L', 22, 22], ['L', 22, 32], ['L', 38, 30], ['L', 38, 20],
      ['L', 3, 45], ['L', 15, 44], ['L', 19, 44], ['L', 30, 44],
      ['S', 21, 9], ['S', 35, 46],  // right beside their hidden doors
      ['F', 38, 26], ['F', 30, 6], ['F', 53, 40],
    ],
    // Ceiling lamps: x, y, color, radius, brightness.
    lamps: [
      [6, 6, 'cool', 6, 0.9], [12, 6, 'cool', 6, 0.9], [9, 10, 'cyan', 4, 0.5],
      [46, 9, 'warm', 7, 1.0], [50, 13, 'warm', 6, 0.8], [43, 4, 'orange', 5, 0.6],
      [8, 26, 'blue', 6, 0.9], [8, 32, 'blue', 6, 0.9], [12, 29, 'blue', 5, 0.7], [4, 23, 'cyan', 4, 0.5],
      [24, 20, 'orange', 6, 0.8], [36, 20, 'orange', 6, 0.8], [24, 32, 'orange', 6, 0.8], [36, 32, 'red', 6, 0.8],
      [42, 42, 'cool', 7, 0.9], [48, 42, 'cool', 7, 0.9], [42, 49, 'cool', 7, 0.9], [48, 49, 'cool', 7, 0.9],
      [7, 45, 'cyan', 6, 0.9], [11, 47, 'cyan', 6, 0.9],
      [22, 44, 'orange', 6, 0.8], [27, 49, 'orange', 6, 0.8],
      [20, 7, 'warm', 4, 0.6], [34, 7, 'warm', 4, 0.6], [50, 22, 'red', 4, 0.6], [50, 31, 'red', 4, 0.6],
      [8, 16, 'red', 4, 0.5], [30, 37, 'warm', 4, 0.5], [16, 46, 'warm', 4, 0.5],
      [19, 14, 'green', 5, 0.9], [33, 44, 'cyan', 4, 0.8],
    ],
    // Lights that pulse every frame (alarms).
    alarms: [[38, 38, 'red'], [51, 51, 'red'], [51, 26, 'red']],
    props: [
      ['barrel', 42, 14], ['barrel', 52, 4], ['barrel', 42, 4],
      ['barrel', 51, 38], ['barrel', 38, 50], ['barrel', 51, 50], ['barrel', 14, 4],
      ['barrel', 36, 24], ['barrel', 24, 29], ['barrel', 46, 42], ['barrel', 4, 24],
      ['barrel', 12, 50], ['barrel', 21, 51],
      ['barrel', 39, 51], ['barrel', 43, 15], ['barrel', 23, 51],  // pairs that chain-react
      ['pipe', 25, 21], ['pipe', 35, 21], ['pipe', 25, 31], ['pipe', 35, 31],
      ['pipe', 22, 44], ['pipe', 27, 44], ['pipe', 22, 49], ['pipe', 27, 49],
    ],
    // Sliding doors: each is a pair of tiles that open together.
    // secret = locked and disguised as a wall until its switch is pressed.
    doors: [
      { tiles: [[15, 7], [15, 8]] },
      { tiles: [[7, 12], [8, 12]] },
      { tiles: [[36, 40], [36, 41]] },
      { tiles: [[17, 46], [17, 47]] },
      { tiles: [[44, 16], [45, 16]] },
      { tiles: [[19, 9], [20, 9]], secret: 1, look: 'V' },
      { tiles: [[33, 46], [34, 46]], secret: 2, look: 'V' },
    ],
    // Wall switches: x, y, which secret door they open (each sits right next to its door).
    switches: [[21, 9, 1], [35, 46, 2]],
    // Electric floor traps: the fuse box to shoot, and the floor area it electrifies.
    traps: [
      { fuse: [38, 26], zone: [27, 23, 7, 7] },
      { fuse: [30, 6], zone: [24, 7, 11, 2] },
      { fuse: [53, 40], zone: [46, 38, 6, 5] },
    ],
    playerStart: { x: 9.5, y: 8.5, angle: 0 },
    menuCam: { x: 26.5, y: 22.5 },
    bossSpawn: { x: 30.5, y: 21.5 },
    // extra lights not tied to a lamp or wall: x, y, color, radius, brightness, shines through walls
    lights: [[30.5, 26.5, 'green', 10, 1.3, true]],
    enemySpawns: [
      [42, 10], [52, 9], [24, 26], [36, 26], [30, 20], [30, 32], [13, 24], [4, 34],
      [39, 44], [51, 43], [46, 50], [24, 47], [13, 49], [5, 43], [51, 26],
    ],
    // x, y, type, and 'once' for secret stashes that don't refill.
    pickupSpots: [
      [13, 10, 'ammo'], [52, 15, 'health'], [23, 19, 'ammo'], [52, 40, 'health'],
      [13, 34, 'ammo'], [5, 49, 'health'], [28, 51, 'ammo'], [37, 33, 'health'], [45, 22, 'ammo'],
      [18, 13, 'health', 'once'], [21, 13, 'ammo', 'once'], [18, 16, 'ammo', 'once'], [21, 16, 'health', 'once'],
      [32, 44, 'health', 'once'], [35, 44, 'ammo', 'once'],
    ],
  },

  // Frozen research lab: ice walls, cryo pods, blue light.
  cryo: {
    name: 'CRYO LAB',
    theme: 'cryo',
    size: 48,
    corridors: [
      { x: 12, y: 5, w: 4, h: 2, wall: 'V' },    // arrival -> cryo vault
      { x: 6, y: 10, w: 2, h: 10, wall: 'V' },   // arrival -> med bay
      { x: 22, y: 11, w: 2, h: 4, wall: 'V' },   // vault -> main lab
      { x: 30, y: 6, w: 6, h: 2, wall: 'V' },    // vault -> generator
      { x: 39, y: 14, w: 2, h: 6, wall: 'V' },   // generator -> storage
      { x: 32, y: 23, w: 4, h: 2, wall: 'V' },   // main lab -> storage
      { x: 11, y: 23, w: 3, h: 2, wall: 'V' },   // med bay -> main lab
      { x: 22, y: 30, w: 2, h: 5, wall: 'V' },   // main lab -> south hall
      { x: 6, y: 29, w: 2, h: 6, wall: 'V' },    // med bay -> south hall
      { x: 36, y: 30, w: 2, h: 5, wall: 'V' },   // storage -> south hall
      { x: 38, y: 37, w: 3, h: 2, wall: 'H' },   // hidden passage to the secret room
    ],
    rooms: [
      { name: 'ARRIVAL BAY', x: 3, y: 3, w: 9, h: 7, wall: 'P', floor: 'snow' },
      { name: 'CRYO VAULT', x: 16, y: 2, w: 14, h: 9, wall: '#', floor: 'tile' },
      { name: 'MAIN LAB', x: 14, y: 15, w: 18, h: 15, wall: 'P', floor: 'tile' },
      { name: 'GENERATOR', x: 36, y: 4, w: 9, h: 10, wall: 'R', floor: 'grate' },
      { name: 'STORAGE', x: 36, y: 20, w: 9, h: 10, wall: '#', floor: 'snow' },
      { name: 'MED BAY', x: 3, y: 20, w: 8, h: 9, wall: 'P', floor: 'tile' },
      { name: 'SOUTH HALL', x: 6, y: 35, w: 32, h: 8, wall: 'H', floor: 'grate' },
      { name: 'SECRET STASH', x: 41, y: 36, w: 4, h: 4, wall: 'R', floor: 'tile' },
    ],
    blocks: [
      ['O', 18, 4], ['O', 21, 4], ['O', 24, 4], ['O', 27, 4], ['O', 18, 8], ['O', 21, 8], ['O', 24, 8], ['O', 27, 8],
      ['W', 18, 19], ['W', 19, 19], ['W', 27, 19], ['W', 28, 19], ['W', 18, 26], ['W', 19, 26], ['W', 27, 26], ['W', 28, 26], // lab benches
      ['X', 38, 24], ['X', 39, 24], ['X', 42, 22], ['X', 42, 23],
    ],
    furniture: [
      { room: 'ARRIVAL BAY', ch: 'U', sides: 'ws' },
      { room: 'CRYO VAULT', ch: 'O', sides: 'n', step: 2, start: 1 },
      { room: 'MAIN LAB', ch: 'W', sides: 'ew', step: 3, start: 1 },
      { room: 'GENERATOR', ch: 'G', sides: 'ne', step: 2, start: 1 },
      { room: 'STORAGE', ch: 'B', sides: 'es' },
      { room: 'MED BAY', ch: 'M', sides: 'w', step: 2, start: 1 },
      { room: 'MED BAY', ch: 'E', sides: 's' },
    ],
    accents: [
      ['L', 2, 6], ['L', 13, 4], ['L', 20, 1], ['L', 25, 1], ['L', 13, 18], ['L', 13, 27],
      ['L', 32, 17], ['L', 32, 27], ['L', 35, 10], ['L', 45, 8], ['L', 45, 24], ['L', 2, 24],
      ['L', 15, 43], ['L', 30, 43], ['L', 11, 34], ['C', 3, 2], ['C', 9, 2], ['C', 37, 3], ['C', 43, 3],
      ['S', 38, 36], ['F', 32, 20], ['F', 20, 43],
    ],
    lamps: [
      [7, 6, 'cool', 6, 0.9], [19, 6, 'cyan', 6, 0.9], [26, 6, 'cyan', 6, 0.9],
      [17, 18, 'cool', 7, 1], [28, 18, 'cool', 7, 1], [17, 27, 'cool', 7, 1], [28, 27, 'cool', 7, 1],
      [40, 8, 'orange', 6, 0.9], [40, 25, 'warm', 6, 0.9], [6, 24, 'cyan', 6, 0.9],
      [12, 38, 'blue', 6, 0.8], [22, 38, 'blue', 6, 0.8], [32, 38, 'blue', 6, 0.8],
      [42, 37, 'green', 4, 0.8], [6, 15, 'blue', 4, 0.5], [33, 6, 'blue', 4, 0.5],
      [23, 22, 'cool', 8, 1.0], [42, 28, 'warm', 5, 0.7], [27, 40, 'blue', 5, 0.7], [9, 7, 'cool', 4, 0.6],
    ],
    lights: [],
    alarms: [[37, 13, 'red'], [7, 41, 'red']],
    props: [
      ['barrel', 16, 21], ['barrel', 16, 22], ['barrel', 29, 22], ['barrel', 29, 23],
      ['barrel', 13, 40], ['barrel', 14, 40], ['barrel', 44, 29], ['barrel', 37, 5], ['barrel', 38, 5],
      ['pipe', 41, 7], ['pipe', 41, 10],
    ],
    doors: [
      { tiles: [[12, 5], [12, 6]] },
      { tiles: [[22, 14], [23, 14]] },
      { tiles: [[39, 19], [40, 19]] },
      { tiles: [[22, 34], [23, 34]] },
      { tiles: [[38, 37], [38, 38]], secret: 1, look: 'H' },
    ],
    switches: [[38, 36, 1]],
    traps: [
      { fuse: [32, 20], zone: [20, 20, 6, 5] },
      { fuse: [20, 43], zone: [16, 36, 10, 6] },
    ],
    playerStart: { x: 6.5, y: 6.5, angle: 0 },
    menuCam: { x: 22.5, y: 22.5 },
    bossSpawn: { x: 23.5, y: 17.5 },
    enemySpawns: [
      [29, 3], [17, 10], [15, 16], [30, 16], [15, 28], [30, 28], [43, 5], [37, 12],
      [43, 28], [37, 21], [9, 27], [9, 40], [35, 41], [27, 36],
    ],
    pickupSpots: [
      [10, 8, 'ammo'], [4, 21, 'health'], [9, 21, 'ammo'], [44, 13, 'health'], [44, 20, 'ammo'],
      [22, 16, 'health'], [16, 41, 'ammo'], [30, 36, 'health'],
      [42, 38, 'health', 'once'], [44, 36, 'ammo', 'once'], [41, 39, 'ammo', 'once'],
    ],
  },

  // Molten metal works: basalt walls and lava pits you can't walk into.
  lava: {
    name: 'LAVA FOUNDRY',
    theme: 'lava',
    size: 48,
    corridors: [
      { x: 13, y: 6, w: 5, h: 2, wall: 'R' },    // loading dock -> smelter
      { x: 6, y: 11, w: 2, h: 5, wall: 'R' },    // loading dock -> forge
      { x: 38, y: 6, w: 2, h: 2, wall: 'V' },    // smelter -> cooling tower
      { x: 27, y: 19, w: 2, h: 5, wall: 'K' },   // smelter -> slag pit
      { x: 13, y: 25, w: 5, h: 2, wall: 'R' },   // forge -> slag pit
      { x: 42, y: 21, w: 2, h: 5, wall: 'V' },   // cooling tower -> control
      { x: 38, y: 30, w: 2, h: 2, wall: 'P' },   // slag pit -> control
      { x: 27, y: 36, w: 2, h: 4, wall: 'K' },   // slag pit -> south tunnel
      { x: 42, y: 36, w: 2, h: 4, wall: 'P' },   // control -> south tunnel
      { x: 9, y: 28, w: 2, h: 12, wall: 'R' },   // forge -> south tunnel
      { x: 8, y: 34, w: 1, h: 2, wall: 'R' },    // hidden doorway to the secret room
    ],
    rooms: [
      { name: 'LOADING DOCK', x: 3, y: 3, w: 10, h: 8, wall: '#', floor: 'floor' },
      { name: 'SMELTER', x: 18, y: 3, w: 20, h: 16, wall: 'K', floor: 'grate' },
      { name: 'FORGE', x: 3, y: 16, w: 10, h: 12, wall: 'R', floor: 'floor' },
      { name: 'COOLING TOWER', x: 40, y: 3, w: 6, h: 18, wall: 'V', floor: 'grate' },
      { name: 'SLAG PIT', x: 18, y: 24, w: 20, h: 12, wall: 'K', floor: 'floor' },
      { name: 'CONTROL', x: 40, y: 26, w: 6, h: 10, wall: 'P', floor: 'tile' },
      { name: 'SOUTH TUNNEL', x: 6, y: 40, w: 38, h: 3, wall: 'R', floor: 'grate' },
      { name: 'SECRET STASH', x: 3, y: 33, w: 5, h: 4, wall: 'R', floor: 'tile' },
    ],
    // lava pools: glowing floor nobody can walk on (x, y, w, h)
    lava: [[20, 10, 7, 2], [29, 10, 7, 2], [6, 20, 3, 3], [20, 28, 4, 4], [32, 28, 4, 4]],
    blocks: [['X', 4, 4], ['X', 5, 4], ['X', 11, 9]],
    furniture: [
      { room: 'LOADING DOCK', ch: 'J', sides: 'n' },
      { room: 'SMELTER', ch: 'Q', sides: 'n', step: 3, start: 1 },
      { room: 'FORGE', ch: 'N', sides: 'w', step: 2, start: 1 },
      { room: 'FORGE', ch: 'A', sides: 's', step: 2 },
      { room: 'COOLING TOWER', ch: 'T', sides: 'e', step: 2 },
      { room: 'SLAG PIT', ch: 'Q', sides: 's', step: 3, start: 1 },
      { room: 'CONTROL', ch: 'C', sides: 'e', step: 2, start: 1 },
    ],
    accents: [
      ['L', 2, 6], ['L', 8, 2], ['L', 24, 2], ['L', 31, 2], ['L', 17, 12], ['L', 2, 20],
      ['L', 21, 36], ['L', 33, 36], ['L', 46, 27], ['L', 15, 43], ['L', 30, 43], ['L', 46, 10],
      ['C', 41, 25], ['C', 44, 25],
      ['S', 8, 33], ['F', 38, 14], ['F', 24, 36],
    ],
    lamps: [
      [7, 6, 'warm', 6, 0.9], [22, 5, 'orange', 6, 0.8], [33, 5, 'orange', 6, 0.8],
      [22, 16, 'warm', 6, 0.8], [33, 16, 'warm', 6, 0.8], [5, 18, 'orange', 6, 0.8], [10, 25, 'warm', 6, 0.8],
      [42, 6, 'cool', 5, 0.8], [42, 16, 'cool', 5, 0.8], [19, 25, 'warm', 5, 0.7], [36, 34, 'warm', 5, 0.7],
      [27, 33, 'red', 5, 0.7], [42, 30, 'cyan', 6, 0.9], [12, 41, 'warm', 5, 0.6], [25, 41, 'warm', 5, 0.6],
      [38, 41, 'warm', 5, 0.6], [5, 34, 'green', 4, 0.8],
      [27, 7, 'orange', 6, 0.8], [27, 16, 'warm', 6, 0.8], [27, 27, 'warm', 6, 0.8], [8, 25, 'warm', 5, 0.6],
    ],
    lights: [],
    alarms: [[19, 4, 'red'], [36, 35, 'red']],
    props: [
      ['barrel', 24, 7], ['barrel', 25, 7], ['barrel', 31, 15], ['barrel', 32, 15],
      ['barrel', 25, 33], ['barrel', 26, 33], ['barrel', 20, 42], ['barrel', 21, 42], ['barrel', 40, 35],
      ['pipe', 41, 10], ['pipe', 44, 10],
    ],
    doors: [
      { tiles: [[13, 6], [13, 7]] },
      { tiles: [[6, 15], [7, 15]] },
      { tiles: [[42, 21], [43, 21]] },
      { tiles: [[27, 23], [28, 23]] },
      { tiles: [[8, 34], [8, 35]], secret: 1, look: 'R' },
    ],
    switches: [[8, 33, 1]],
    traps: [
      { fuse: [38, 14], zone: [20, 13, 16, 5] },
      { fuse: [24, 36], zone: [24, 25, 8, 4] },
    ],
    playerStart: { x: 7.5, y: 6.5, angle: 0 },
    menuCam: { x: 27.5, y: 14.5 },
    bossSpawn: { x: 27.5, y: 15.5 },
    enemySpawns: [
      [19, 4], [36, 4], [19, 17], [36, 17], [44, 4], [41, 19], [19, 34], [36, 25],
      [27, 34], [44, 34], [11, 17], [4, 26], [15, 41], [35, 41],
    ],
    pickupSpots: [
      [11, 4, 'ammo'], [4, 17, 'health'], [25, 4, 'ammo'], [30, 17, 'health'], [44, 12, 'ammo'],
      [30, 34, 'health'], [41, 27, 'ammo'], [45, 35, 'health'], [24, 41, 'ammo'],
      [4, 33, 'health', 'once'], [7, 36, 'ammo', 'once'], [3, 36, 'health', 'once'],
    ],
  },
};
