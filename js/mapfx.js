'use strict';
// More things on the maps:
//  - Teleporters: 2 pairs of glowing pads per map; step on one, come out of the other (robots too).
//  - CrackedWalls: a few thin walls look cracked; any explosion next to one knocks it down,
//    opening a shortcut and dropping a small supply cache.
//  - MapEvents: during a game, now and then: BLACKOUT, LOCKDOWN or SUPPLY DROP.

const Teleporters = {
  pads: [],
  COLORS: [[0.3, 0.9, 1], [1, 0.35, 0.95]],

  init() {
    const avoid = Gadgets.list.concat(Breakables.list).map(o => ({ x: o.x, y: o.y }));
    const s = Spots.pick(4, { minGap: 9, seed: 'teleports', avoid });
    this.pads = [];
    if (s.length < 4) return;
    // pair the four spots so both pairs are as far apart as possible
    const D = (a, b) => Math.hypot(s[a].x - s[b].x, s[a].y - s[b].y);
    const pairings = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];
    const best = pairings.reduce((b, p) => Math.min(D(...p[0]), D(...p[1])) > Math.min(D(...b[0]), D(...b[1])) ? p : b);
    best.forEach(([a, b], color) => {
      const A = { x: s[a].x, y: s[a].y, color }, B = { x: s[b].x, y: s[b].y, color };
      A.to = B; B.to = A;
      this.pads.push(A, B);
    });
  },

  update(dt, game) {
    this.move(game.player, game, true);
    for (const r of game.robots) if (r.alive && r.alerted && !r.def.boss && r.state === 'active') this.move(r, game, false);
  },

  // Step on a pad -> appear on its partner. You must step off the arrival pad before it works again.
  move(who, game, isPlayer) {
    if (who.tpLock) {
      if (Math.hypot(who.x - who.tpLock.x, who.y - who.tpLock.y) > 1) who.tpLock = null;
      return;
    }
    for (const pad of this.pads) {
      if (Math.hypot(who.x - pad.x, who.y - pad.y) > 0.5) continue;
      const out = pad.to;
      this.zap(pad, game); this.zap(out, game);
      who.x = out.x; who.y = out.y;
      who.tpLock = out;
      if (isPlayer) { game.flashScreen('#40e0ff', 0.2); Sound.play('teleport', 1); game.run.teleports = (game.run.teleports || 0) + 1; }
      else game.playAt('teleport', out.x, out.y, 0.7);
      return;
    }
  },

  zap(pad, game) {
    const c = this.COLORS[pad.color];
    Effects.burst(pad.x, pad.y, 0.3, { count: 16, colors: pad.color ? ['#ff60f0', '#ffffff'] : ['#40e0ff', '#ffffff'], speed: 1.5, up: 3, size: 0.03, life: 0.6, gravity: -1 });
    Effects.addLight(pad.x, pad.y, c, 4, 1.6, 0.4);
  },

  addSprites(list, time) {
    for (const pad of this.pads) {
      list.push({ x: pad.x, y: pad.y, z: 0, h: 0.12, sprite: Art.sprites.tpad[pad.color], bright: true });
      list.push({ x: pad.x, y: pad.y, z: 0.05, h: 1.1, sprite: Art.sprites.tbeam[pad.color], bright: true, fade: 0.35 + Math.sin(time * 4 + pad.x) * 0.1 });
    }
  },

  lights(time) {
    return this.pads.map(p => ({ x: p.x, y: p.y, c: this.COLORS[p.color], radius: 2.5, intensity: 0.6 + Math.sin(time * 4 + p.x) * 0.15 }));
  },
};

const CrackedWalls = {
  list: [],
  COUNT: 3,

  init() {
    this.list = [];
    const W = Level.W, H = Level.H;
    const open = (x, y) => x > 0 && y > 0 && x < W - 1 && y < H - 1 && !Level.isWallTile(x, y);
    const plain = ['#', 'P', 'R', 'H', 'V', 'K'];
    const isPlain = (x, y) => plain.includes(Level.wall[y * W + x]);
    const cands = [];
    for (let y = 2; y < H - 3; y++) {
      for (let x = 2; x < W - 3; x++) {
        if (!isPlain(x, y)) continue;
        // a wall one or two tiles thick with floor on both sides
        for (const [dx, dy] of [[1, 0], [0, 1]]) {
          for (const thick of [1, 2]) {
            const tiles = [[x, y]];
            if (thick === 2) { if (!isPlain(x + dx, y + dy)) continue; tiles.push([x + dx, y + dy]); }
            const a = [x - dx, y - dy], b = [x + dx * thick, y + dy * thick];
            if (!open(...a) || !open(...b)) continue;
            const walk = this.walkDistance(a, b);
            // a long way round, or no way at all (a back door into a secret room)
            if (walk >= 6) cands.push({ x, y, tiles, a, b, walk: Math.min(walk, 40) });
          }
        }
      }
    }
    cands.sort((p, q) => q.walk - p.walk || p.x - q.x || p.y - q.y);
    for (const c of cands) {
      if (this.list.length >= this.COUNT) break;
      if (this.list.some(o => Math.hypot(o.x - c.x, o.y - c.y) < 4)) continue;
      if (Math.hypot(c.x + 0.5 - Level.playerStart.x, c.y + 0.5 - Level.playerStart.y) < 4) continue;
      this.list.push({ x: c.x, y: c.y, tiles: c.tiles, a: c.a, b: c.b, open: false });
    }
    // they look cracked
    Level.wallTexMap.Z = Art.crackedTexture(Level.tex('metal'));
    for (const c of this.list) for (const [tx, ty] of c.tiles) Level.wall[ty * W + tx] = 'Z';
  },

  // Steps from one side of the wall to the other, walking around it (Infinity if there's no way).
  walkDistance(a, b) {
    const W = Level.W, H = Level.H, dist = new Int32Array(W * H).fill(-1);
    const q = [a[1] * W + a[0]];
    dist[q[0]] = 0;
    const target = b[1] * W + b[0];
    for (let h = 0; h < q.length; h++) {
      const i = q[h];
      if (i === target) return dist[i];
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, j = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || dist[j] >= 0) continue;
        if (Level.isWallTile(nx, ny) && !Level.doorAt[j]) continue;
        dist[j] = dist[i] + 1;
        q.push(j);
      }
    }
    return Infinity;
  },

  // Called by every explosion (Blast.at).
  blast(x, y, radius, game) {
    for (const c of this.list) {
      if (!c.open && c.tiles.some(([tx, ty]) => Math.hypot(tx + 0.5 - x, ty + 0.5 - y) < radius + 0.6)) this.knockDown(c, game);
    }
  },

  knockDown(c, game) {
    const W = Level.W, S = CONFIG.LIGHT_RES;
    c.open = true;
    const n = c.a[1] * W + c.a[0];
    for (const [tx, ty] of c.tiles) {
      const i = ty * W + tx;
      Level.wall[i] = null;
      Level.blocked[i] = 0;
      // floor, ceiling and light copied from the sides it opens onto
      Level.floorTex[i] = Level.floorTex[n];
      Level.ceilTex[i] = Level.ceilTex[n];
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
        const li = (ty * S + sy) * Level.LW + tx * S + sx;
        const la = (c.a[1] * S + sy) * Level.LW + c.a[0] * S + sx, lb = (c.b[1] * S + sy) * Level.LW + c.b[0] * S + sx;
        for (const arr of [Level.lr, Level.lg, Level.lb, Level.lrBase, Level.lgBase, Level.lbBase]) if (arr) arr[li] = (arr[la] + arr[lb]) / 2;
      }
    }
    Level.flowFrom = -1;
    const cx = c.x + 0.5, cy = c.y + 0.5;
    Effects.burst(cx, cy, 0.5, { count: 30, colors: ['#5a5f6a', '#8a8f98', '#3a3d44'], speed: 3, up: 3, size: 0.07, life: 1.2, bright: false });
    Effects.burst(cx, cy, 0.3, { count: 10, colors: ['#8a8a8a', '#5a5a5a'], speed: 0.8, up: 1, size: 0.15, life: 1.6, gravity: -0.3, bright: false });
    game.playAt('stomp', cx, cy, 1);
    game.shake(0.3);
    game.run.broken++;
    // a little supply cache was hidden in the wall
    game.pickups.push({ x: cx, y: cy, type: 'chip', spot: -1, taken: false, life: Infinity });
    game.pickups.push({ x: cx + 0.35, y: cy + 0.2, type: 'ammo', spot: -1, taken: false, life: Infinity });
    game.message('A CRACKED WALL COLLAPSED - SHORTCUT AND A HIDDEN CACHE!', '#40e0ff');
  },
};

const MapEvents = {
  KINDS: {
    blackout: { name: 'BLACKOUT', time: 20, color: '#8a96ff' },
    lockdown: { name: 'LOCKDOWN', time: 25, color: '#ff4030' },
    supply: { name: 'SUPPLY DROP', time: 0, color: '#ffd040' },
  },

  reset() {
    this.active = null;
    this.last = null;
    this.next = 50 + Math.random() * 20;
    this.drops = [];
    Level.setDim(1);
  },

  update(dt, game) {
    this.updateDrops(dt, game);
    const a = this.active;
    if (a) {
      a.left -= dt;
      if (a.kind === 'lockdown' && ((game.time * 2) | 0) % 2 && Math.random() < dt * 2) game.flashScreen('#ff2010', 0.12);
      if (a.left <= 0) this.stop(game);
      return;
    }
    if (game.time < this.next) return;
    if (game.boss || Cutscene.active) { this.next = game.time + 10; return; } // not during the Warden fight
    const kinds = Object.keys(this.KINDS).filter(k => k !== this.last);
    this.start(kinds[(Math.random() * kinds.length) | 0], game);
    this.next = game.time + 70 + Math.random() * 30;
  },

  start(kind, game) {
    const def = this.KINDS[kind];
    this.last = kind;
    if (kind === 'supply') { this.supplyDrop(game); return; }
    this.active = { kind, left: def.time };
    if (kind === 'blackout') {
      Level.setDim(0.25);
      Sound.play('zap', 1.2);
      game.message('BLACKOUT! THE POWER IS DOWN', def.color);
    } else {
      // every normal door slams shut (not if someone is standing in it), robots pour in
      this.sealed = [];
      for (const g of Doors.groups) {
        if (g.secret || g.locked || Doors.occupied(g, game)) continue;
        g.locked = true; g.open = 0;
        for (const t of g.tiles) Level.blocked[t.y * Level.W + t.x] = 1;
        this.sealed.push(g);
      }
      Level.flowFrom = -1;
      for (let i = 0; i < 3; i++) Spawner.spawn(game, true);
      Sound.play('boss_alarm');
      game.message('LOCKDOWN! THE DOORS ARE SEALED', def.color);
    }
  },

  stop(game) {
    const a = this.active;
    this.active = null;
    if (a.kind === 'blackout') { Level.setDim(1); game.message('POWER RESTORED', '#a0a8b0'); }
    if (a.kind === 'lockdown') {
      for (const g of this.sealed || []) g.locked = false;
      this.sealed = [];
      Level.flowFrom = -1;
      game.message('LOCKDOWN OVER - DOORS OPEN', '#a0a8b0');
    }
  },

  // Spawner runs faster during a lockdown.
  spawnBoost() { return this.active && this.active.kind === 'lockdown' ? 2.5 : 1; },
  isBlackout() { return !!(this.active && this.active.kind === 'blackout'); },

  // ---- supply drop: a crate falls from the ceiling somewhere ----
  supplyDrop(game) {
    const spot = Spots.pick(1, { minGap: 1, seed: 'drop' + Math.floor(game.time) })[0];
    if (!spot) return;
    this.drops.push({ x: spot.x, y: spot.y, z: 1.1, vz: 0 });
    game.guide = { x: spot.x, y: spot.y, label: 'SUPPLY DROP', until: game.time + 30 };
    Sound.play('weapon_drop');
    game.message('SUPPLY DROP! FOLLOW THE ARROW', '#ffd040');
  },

  updateDrops(dt, game) {
    for (const d of this.drops) {
      if (d.landed) continue;
      d.vz -= 6 * dt;
      d.z += d.vz * dt;
      if (d.z > 0) continue;
      d.z = 0; d.landed = true;
      game.playAt('stomp', d.x, d.y, 0.9);
      Effects.burst(d.x, d.y, 0.1, { count: 14, colors: ['#8a8a8a', '#5a5a5a'], speed: 1.5, up: 1, size: 0.08, life: 0.9, gravity: -0.3, bright: false });
      const items = ['chip', 'ammo', game.mods.includes('nomeds') ? 'ammo' : 'health'];
      items.forEach((type, k) => game.dropNear(d.x, d.y, (k - 1) * 0.4, 0.3, type, Infinity));
    }
    this.drops = this.drops.filter(d => !d.landed);
  },

  addSprites(list) {
    for (const d of this.drops) list.push({ x: d.x, y: d.y, z: d.z, h: 0.5, sprite: Art.sprites.supplyCrate });
  },
};
