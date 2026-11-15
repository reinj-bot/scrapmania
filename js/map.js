'use strict';
// Builds the current map (from LEVELS in levels.js) into grids the renderer and robots use,
// plus the baked lighting, ray casting, doors-in-rays and robot path finding.

const LIGHT_COLORS = {
  warm: [1.0, 0.85, 0.6],
  cool: [0.75, 0.9, 1.0],
  blue: [0.4, 0.6, 1.0],
  red: [1.0, 0.25, 0.2],
  green: [0.35, 1.0, 0.45],
  orange: [1.0, 0.6, 0.25],
  cyan: [0.4, 1.0, 0.95],
};

// Wall letter -> texture name. Lowercase = the broken / used version of the same thing.
const WALL_TEXTURES = {
  '#': 'metal', P: 'panel', C: 'computer', c: 'computerBroken', L: 'light', l: 'lightBroken',
  V: 'vent', H: 'hazard', R: 'rust', X: 'crate', Y: 'reactor', D: 'door', d: 'doorRight',
  S: 'switchOff', s: 'switchOn', F: 'fuseReady', f: 'fuseSpent',
  O: 'cryoPod', K: 'basalt',
  // room machines (levels.js furniture): med tube, med cabinet, robot assembly rack, tank,
  // generator coil, lab bench, lockers, loading shutter, smelting molds, press, shelves
  M: 'medTube', E: 'medCabinet', A: 'robotRack', T: 'tank', G: 'coil', W: 'labBench',
  U: 'locker', J: 'shutter', Q: 'crucible', N: 'press', B: 'shelf',
};

// Walls that glow and light up the floor in front of them: color, radius, brightness.
const WALL_EMITTERS = {
  L: ['warm', 4.5, 0.75],
  C: ['blue', 2.2, 0.22],
  O: ['cyan', 3, 0.45],
  M: ['green', 2.4, 0.3],
  G: ['orange', 2.6, 0.35],
  Q: ['orange', 2.8, 0.4],
};

const Level = {
  W: 0, H: 0,

  // A theme swaps textures by name and tints the background light.
  THEMES: {
    foundry: { tex: {}, ambient: [1, 1, 1] },
    cryo: {
      tex: { metal: 'iceMetal', panel: 'frostPanel', rust: 'frostRust', crate: 'iceBlock', ceiling: 'iceCeiling', pipes: 'icePipes', floor: 'snow' },
      ambient: [0.9, 1.05, 1.3],
    },
    lava: {
      tex: { metal: 'scorchedMetal', ceiling: 'sootCeiling', pipes: 'sootPipes', floor: 'scorchedFloor' },
      ambient: [1.3, 0.95, 0.8],
    },
  },

  tex(name) {
    return Art.textures[this.theme.tex[name] || name];
  },

  // Builds a fresh copy of a map (called for every new run, so broken things come back).
  // lightScale < 1 darkens the map (the Lights Out challenge).
  build(mapId, lightScale = 1) {
    this.lightScale = lightScale;
    this.mapId = LEVELS[mapId] ? mapId : 'foundry';
    const L = this.layout = LEVELS[this.mapId];
    this.theme = this.THEMES[L.theme] || this.THEMES.foundry;
    Art.useRobotTheme(L.theme); // robots look different on each map
    this.wallTexMap = {};
    for (const ch of Object.keys(WALL_TEXTURES)) this.wallTexMap[ch] = this.tex(WALL_TEXTURES[ch]);

    const W = this.W = L.size, H = this.H = L.size;
    const N = W * H;
    this.wall = new Array(N).fill('#');       // wall letter, or null for open floor
    this.floorTex = new Array(N).fill(null);
    this.ceilTex = new Array(N).fill(null);
    this.blocked = new Uint8Array(N);         // walls + solid props + closed doors + lava
    this.doorAt = new Array(N).fill(null);
    const style = new Array(N).fill(null);

    const carve = (r, isRoom) => {
      for (let y = r.y; y < r.y + r.h; y++) {
        for (let x = r.x; x < r.x + r.w; x++) {
          const i = y * W + x;
          this.wall[i] = null;
          this.floorTex[i] = this.tex(r.floor || 'grate');
          this.ceilTex[i] = this.tex(isRoom ? 'ceiling' : 'pipes');
          style[i] = r.wall;
        }
      }
    };
    L.corridors.forEach(c => carve(c, false));
    L.rooms.forEach(r => carve(r, true));

    // Each wall takes the look of the area it borders.
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (this.wall[i] === null) continue;
        let s = null;
        for (let dy = -1; dy <= 1 && !s; dy++) {
          for (let dx = -1; dx <= 1 && !s; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < W && ny < H) s = style[ny * W + nx];
          }
        }
        this.wall[i] = s || '#';
      }
    }

    for (const [ch, x, y, w = 1, h = 1] of L.blocks) {
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.wall[yy * W + xx] = ch;
    }
    for (const [ch, x, y] of L.accents) {
      if (this.wall[y * W + x] !== null) this.wall[y * W + x] = ch;
    }

    this.furnish(L);

    for (let i = 0; i < N; i++) this.blocked[i] = this.wall[i] !== null ? 1 : 0;

    // Props (solid sprites that fill their tile).
    this.props = L.props.map(([kind, x, y]) => {
      this.blocked[y * W + x] = 1;
      return { kind, x: x + 0.5, y: y + 0.5 };
    });

    // Floor markings.
    for (const [x, y] of L.enemySpawns) this.floorTex[y * W + x] = Art.textures.pad;
    for (const [x, y] of L.pickupSpots) this.floorTex[y * W + x] = Art.textures.mark;

    // Lights.
    this.lights = [];
    this.lightsByTile = {};
    for (const [x, y, col, radius, intensity] of L.lamps) {
      const c = LIGHT_COLORS[col];
      this.ceilTex[y * W + x] = Art.lampTexture(c);
      this.lights.push({ x: x + 0.5, y: y + 0.5, c, radius, intensity });
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const e = WALL_EMITTERS[this.wall[y * W + x]];
        if (e) this.addWallLight(x, y, LIGHT_COLORS[e[0]], e[1], e[2]);
      }
    }
    for (const [x, y, col, radius, intensity, ignoreWalls] of L.lights || []) {
      this.lights.push({ x, y, c: LIGHT_COLORS[col], radius, intensity, ignoreWalls: !!ignoreWalls });
    }

    // Lava: glowing floor that nobody can walk on (bullets fly over it).
    for (const [lx, ly, lw, lh] of L.lava || []) {
      for (let y = ly; y < ly + lh; y++) {
        for (let x = lx; x < lx + lw; x++) {
          this.floorTex[y * W + x] = Art.textures.lava;
          this.blocked[y * W + x] = 1;
          this.lights.push({ x: x + 0.5, y: y + 0.5, c: LIGHT_COLORS.orange, radius: 2.6, intensity: 0.4 });
        }
      }
    }

    this.alarms = L.alarms.map(([x, y, col]) => ({ x: x + 0.5, y: y + 0.5, c: LIGHT_COLORS[col] }));
    this.playerStart = L.playerStart;
    this.bossSpawn = L.bossSpawn;
    this.menuCam = L.menuCam;
    this.enemySpawns = L.enemySpawns.map(([x, y]) => ({ x: x + 0.5, y: y + 0.5 }));
    this.pickupSpots = L.pickupSpots.map(([x, y, type, once]) => ({ x: x + 0.5, y: y + 0.5, type, once: once === 'once' }));

    this.buildLightmap();
    this.flow = new Int16Array(N);
    this.flowFrom = -1;
  },

  // Room machines along a room's inside walls, so you can tell what each room is for.
  // levels.js furniture: { room, ch, sides: 'nsew', step, start }. Only plain walls are used
  // (lights, screens, switches and fuse boxes stay), and only walls that face into that room.
  furnish(L) {
    const W = this.W, H = this.H, plain = ['#', 'P', 'R', 'H', 'V', 'K'];
    for (const f of L.furniture || []) {
      const r = L.rooms.find(rm => rm.name === f.room);
      if (!r) continue;
      const step = f.step || 1, start = f.start || 0;
      const inRoom = (x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
      const lines = { n: [], s: [], w: [], e: [] };
      for (let x = r.x; x < r.x + r.w; x++) { lines.n.push([x, r.y - 1]); lines.s.push([x, r.y + r.h]); }
      for (let y = r.y; y < r.y + r.h; y++) { lines.w.push([r.x - 1, y]); lines.e.push([r.x + r.w, y]); }
      for (const side of f.sides) {
        lines[side].forEach(([x, y], k) => {
          if (k < start || (k - start) % step || x < 0 || y < 0 || x >= W || y >= H) return;
          const i = y * W + x;
          if (!plain.includes(this.wall[i])) return;
          const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy])
            .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < W && ny < H && this.wall[ny * W + nx] === null);
          if (open.length && open.every(([nx, ny]) => inRoom(nx, ny))) this.wall[i] = f.ch;
        });
      }
    }
  },

  // A glowing wall lights up the open tiles next to it.
  addWallLight(x, y, c, radius, intensity) {
    const idx = y * this.W + x;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (this.isWallTile(nx, ny)) continue;
      const light = { x: x + 0.5 + dx * 0.7, y: y + 0.5 + dy * 0.7, c, radius, intensity };
      this.lights.push(light);
      (this.lightsByTile[idx] = this.lightsByTile[idx] || []).push(light);
    }
  },

  isWallTile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return true;
    return this.wall[ty * this.W + tx] !== null;
  },

  isBlocked(x, y) {
    const tx = Math.floor(x), ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return true;
    return this.blocked[ty * this.W + tx] === 1;
  },

  // Walls and closed doors stop bullets and plasma.
  blocksShot(tx, ty) {
    if (this.isWallTile(tx, ty)) return true;
    const d = this.doorAt[ty * this.W + tx];
    return !!d && d.group.open < 0.85;
  },

  // Baked colored light, stored at LIGHT_RES samples per tile. Nearest-sample lookup on purpose:
  // it gives blocky "pixel" light pools.
  buildLightmap() {
    const S = CONFIG.LIGHT_RES;
    const LW = this.W * S, LH = this.H * S;
    this.LW = LW;
    this.LH = LH;
    this.lrBase = this.lgBase = this.lbBase = null;
    this.tileTex = new Map(); // walls that got shot: their own damaged copy of the texture
    this.lr = new Float32Array(LW * LH);
    this.lg = new Float32Array(LW * LH);
    this.lb = new Float32Array(LW * LH);
    const amb = CONFIG.BRIGHTNESS * this.lightScale, t = this.theme.ambient;
    this.lr.fill(0.13 * amb * t[0]); this.lg.fill(0.135 * amb * t[1]); this.lb.fill(0.15 * amb * t[2]);
    for (const L of this.lights) this.applyLight(L, 1);
  },

  // Adds (sign 1) or removes (sign -1) one light's glow from the light map.
  applyLight(L, sign) {
    const S = CONFIG.LIGHT_RES, LW = this.LW, LH = this.LH;
    const x0 = Math.max(0, Math.floor((L.x - L.radius) * S)), x1 = Math.min(LW - 1, Math.ceil((L.x + L.radius) * S));
    const y0 = Math.max(0, Math.floor((L.y - L.radius) * S)), y1 = Math.min(LH - 1, Math.ceil((L.y + L.radius) * S));
    const k = sign * 1.3 * CONFIG.BRIGHTNESS * this.lightScale * L.intensity;
    for (let sy = y0; sy <= y1; sy++) {
      for (let sx = x0; sx <= x1; sx++) {
        const px = (sx + 0.5) / S, py = (sy + 0.5) / S;
        const d = Math.hypot(px - L.x, py - L.y);
        if (d >= L.radius) continue;
        if (this.isWallTile(Math.floor(px), Math.floor(py))) continue;
        if (!L.ignoreWalls && !this.lightReaches(L.x, L.y, px, py)) continue;
        const f = 1 - d / L.radius;
        const v = f * f * k;
        const i = sy * LW + sx;
        this.lr[i] += L.c[0] * v; this.lg[i] += L.c[1] * v; this.lb[i] += L.c[2] * v;
        if (this.lrBase) { this.lrBase[i] += L.c[0] * v; this.lgBase[i] += L.c[1] * v; this.lbBase[i] += L.c[2] * v; }
      }
    }
  },

  // Shooting a light panel or computer smashes it. Returns true if something broke.
  // Blackout: k < 1 darkens the whole light map, k = 1 puts it back.
  setDim(k) {
    if (k === 1) {
      if (this.lrBase) { this.lr = this.lrBase; this.lg = this.lgBase; this.lb = this.lbBase; this.lrBase = this.lgBase = this.lbBase = null; }
      return;
    }
    if (!this.lrBase) { this.lrBase = this.lr; this.lgBase = this.lg; this.lbBase = this.lb; }
    this.lr = this.lrBase.map(v => v * k); this.lg = this.lgBase.map(v => v * k); this.lb = this.lbBase.map(v => v * k);
  },

  // A bullet hit a wall: paint a small dent into that wall square's own copy of its texture,
  // so walls that get shot a lot look more and more battered. (Glowing / animated walls,
  // switches, fuse boxes and screens are left alone.) kind: 'bullet' or 'scorch' (plasma).
  damageWall(hit, dx, dy, hx, hy, z, kind = 'bullet') {
    const ch = hit.tile;
    if (!ch || hit.u !== undefined || 'LlCcFfSsDdY'.includes(ch)) return false;
    const idx = hit.mapY * this.W + hit.mapX;
    let entry = this.tileTex.get(idx);
    if (!entry || entry.ch !== ch) {
      const base = this.wallTexMap[ch];
      if (!base || base.emissive || base.frames.length > 1) return false;
      const data = new Uint32Array(base.data);
      entry = { ch, tex: { data, frames: [data], emissive: false, glow: base.glow }, hits: 0 };
      this.tileTex.set(idx, entry);
    }
    entry.hits++;
    // same texture position the renderer uses for this spot
    let wx = hit.side === 0 ? hy : hx;
    wx -= Math.floor(wx);
    let tx = (wx * 32) | 0;
    if ((hit.side === 0 && dx > 0) || (hit.side === 1 && dy < 0)) tx = 31 - tx;
    const ty = Math.max(1, Math.min(30, ((1 - z) * 32) | 0));
    tx = Math.max(1, Math.min(30, tx));
    const d = entry.tex.data, put = (x, y, col) => { if (x >= 0 && y >= 0 && x < 32 && y < 32) d[y * 32 + x] = col; };
    if (kind === 'scorch') {
      const dark = Art.rgb(30, 26, 24), soot = Art.rgb(60, 56, 54);
      put(tx, ty, dark); put(tx - 1, ty, soot); put(tx + 1, ty, soot); put(tx, ty - 1, soot); put(tx, ty + 1, soot);
    } else {
      const hole = Art.rgb(14, 13, 12), dent = Art.rgb(48, 46, 44), shine = Art.rgb(200, 204, 210);
      put(tx, ty, hole);
      if (Math.random() < 0.6) put(tx + (Math.random() < 0.5 ? 1 : -1), ty, dent);
      if (Math.random() < 0.6) put(tx, ty + (Math.random() < 0.5 ? 1 : -1), dent);
      put(tx - 1, ty - 1, shine); // bent bright metal on one edge
      // after a lot of hits, cracks start to spread
      if (entry.hits > 12 && Math.random() < 0.35) {
        let cx = tx, cy = ty;
        for (let i = 0; i < 4; i++) { cx += Math.random() < 0.5 ? 1 : -1; cy += 1; put(cx, cy, dent); }
      }
    }
    return true;
  },

  breakWall(tx, ty) {
    const idx = ty * this.W + tx;
    const ch = this.wall[idx];
    if (ch !== 'L' && ch !== 'C') return false;
    this.wall[idx] = ch === 'L' ? 'l' : 'c';
    for (const light of this.lightsByTile[idx] || []) this.applyLight(light, -1);
    delete this.lightsByTile[idx];
    return true;
  },

  lightReaches(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(d / 0.2);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.isWallTile(Math.floor(x0 + (x1 - x0) * t), Math.floor(y0 + (y1 - y0) * t))) return false;
    }
    return true;
  },

  // Grid ray march (DDA). Returns distance to the first wall or closed door along (dx, dy).
  castRay(px, py, dx, dy, maxDist = 64) {
    let mapX = Math.floor(px), mapY = Math.floor(py);
    const ddx = dx === 0 ? 1e30 : Math.abs(1 / dx);
    const ddy = dy === 0 ? 1e30 : Math.abs(1 / dy);
    let stepX, stepY, sideX, sideY;
    if (dx < 0) { stepX = -1; sideX = (px - mapX) * ddx; } else { stepX = 1; sideX = (mapX + 1 - px) * ddx; }
    if (dy < 0) { stepY = -1; sideY = (py - mapY) * ddy; } else { stepY = 1; sideY = (mapY + 1 - py) * ddy; }
    // the player may stand in a door tile: check that one too
    const startDoor = this.doorAt[mapY * this.W + mapX];
    if (startDoor) { const h = this.doorHit(startDoor, px, py, dx, dy, mapX, mapY, maxDist); if (h) return h; }
    let side = 0, dist = 0;
    for (let n = 0; n < 200; n++) {
      if (sideX < sideY) { dist = sideX; sideX += ddx; mapX += stepX; side = 0; }
      else { dist = sideY; sideY += ddy; mapY += stepY; side = 1; }
      if (dist > maxDist) return { dist: maxDist, side, tile: null, mapX, mapY };
      if (this.isWallTile(mapX, mapY)) return { dist, side, tile: this.wall[mapY * this.W + mapX] || '#', mapX, mapY };
      const door = this.doorAt[mapY * this.W + mapX];
      if (door) { const h = this.doorHit(door, px, py, dx, dy, mapX, mapY, maxDist); if (h) return h; }
    }
    return { dist: maxDist, side, tile: null, mapX, mapY };
  },

  // A door is a thin panel through the middle of its tile that slides sideways into the wall.
  doorHit(door, px, py, dx, dy, tx, ty, maxDist) {
    const g = door.group;
    if (g.open >= 0.999) return null;
    let t, u;
    if (door.vertical) {
      if (dx === 0) return null;
      t = (tx + 0.5 - px) / dx;
      u = py + t * dy - ty;
    } else {
      if (dy === 0) return null;
      t = (ty + 0.5 - py) / dy;
      u = px + t * dx - tx;
    }
    if (t <= 0 || t > maxDist || u < 0 || u >= 1) return null;
    // panel covers [open, 1] when sliding toward +, [0, 1 - open] when sliding toward -
    if (door.dir > 0 ? u < g.open : u > 1 - g.open) return null;
    const texU = door.dir > 0 ? u - g.open : u + g.open;
    // the half that slides toward - shows the left half of the door, the other one the right half
    return { dist: t, side: door.vertical ? 0 : 1, tile: g.locked ? g.look : door.dir < 0 ? 'D' : 'd', mapX: tx, mapY: ty, u: texU };
  },

  hasLOS(x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0;
    const d = Math.hypot(dx, dy);
    if (d < 0.01) return true;
    return this.castRay(x0, y0, dx / d, dy / d, d).dist >= d - 0.01;
  },

  // Slides a round body (radius r) along walls.
  move(ent, dx, dy, r) {
    const nx = ent.x + dx;
    if (!this.isBlocked(nx + Math.sign(dx) * r, ent.y - r * 0.95) && !this.isBlocked(nx + Math.sign(dx) * r, ent.y + r * 0.95)) ent.x = nx;
    const ny = ent.y + dy;
    if (!this.isBlocked(ent.x - r * 0.95, ny + Math.sign(dy) * r) && !this.isBlocked(ent.x + r * 0.95, ny + Math.sign(dy) * r)) ent.y = ny;
  },

  // Robots can path through doors (they open for them), but not through locked secret doors.
  passable(i) {
    if (!this.blocked[i]) return true;
    const d = this.doorAt[i];
    return !!d && !d.group.locked;
  },

  // Breadth-first "distance to the player" map. Robots walk downhill on it to find a path
  // around walls. Rebuilt when the player changes tile (or something on the map changes).
  updateFlow(px, py) {
    const W = this.W, H = this.H;
    const start = Math.floor(py) * W + Math.floor(px);
    if (start === this.flowFrom) return;
    this.flowFrom = start;
    const flow = this.flow;
    flow.fill(-1);
    const queue = new Int32Array(W * H);
    let head = 0, tail = 0;
    flow[start] = 0;
    queue[tail++] = start;
    while (head < tail) {
      const i = queue[head++];
      const x = i % W, y = (i / W) | 0;
      const d = flow[i] + 1;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (flow[j] !== -1 || !this.passable(j)) continue;
        flow[j] = d;
        queue[tail++] = j;
      }
    }
  },

  // Center of the neighbouring tile that is one step closer to the player (or null).
  flowStep(x, y) {
    const W = this.W;
    const tx = Math.floor(x), ty = Math.floor(y);
    const here = this.flow[ty * W + tx];
    let best = here < 0 ? 1e9 : here, bx = -1, by = -1;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = tx + dx, ny = ty + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= this.H) continue;
        // no diagonal corner-cutting
        if (dx && dy && (!this.passable(ty * W + nx) || !this.passable(ny * W + tx))) continue;
        const f = this.flow[ny * W + nx];
        if (f >= 0 && f < best) { best = f; bx = nx; by = ny; }
      }
    }
    return bx < 0 ? null : { x: bx + 0.5, y: by + 0.5 };
  },

  // Baked light at a world point, as [r, g, b].
  lightAt(x, y) {
    const S = CONFIG.LIGHT_RES;
    const i = Math.floor(y * S) * this.LW + Math.floor(x * S);
    if (i < 0 || i >= this.lr.length) return [0.1, 0.1, 0.1];
    return [this.lr[i], this.lg[i], this.lb[i]];
  },
};
