'use strict';
// Electric floor traps: shoot a yellow fuse box and the floor nearby is electrified for a
// few seconds, frying robots (and the player) standing on it. Then it needs to recharge.

const Traps = {
  ACTIVE_TIME: 4,
  RECHARGE_TIME: 20,
  TICK: 0.25,
  ROBOT_DAMAGE: 15,  // per tick (60 per second)
  PLAYER_DAMAGE: 6,  // per tick (24 per second)

  list: [],

  init() {
    const W = Level.W;
    this.list = Level.layout.traps.map(t => {
      const [fx, fy] = t.fuse, [zx, zy, zw, zh] = t.zone;
      const tiles = new Set();
      for (let y = zy; y < zy + zh; y++) {
        for (let x = zx; x < zx + zw; x++) if (Level.wall[y * W + x] === null) tiles.add(y * W + x);
      }
      return { fx, fy, tiles, cx: zx + zw / 2, cy: zy + zh / 2, active: 0, cooldown: 0, tick: 0, saved: null };
    });
  },

  // Called when a bullet hits a wall tile.
  trigger(tx, ty, game) {
    const t = this.list.find(t => t.fx === tx && t.fy === ty);
    if (!t || t.active > 0 || t.cooldown > 0) return false;
    t.active = this.ACTIVE_TIME;
    t.cooldown = this.ACTIVE_TIME + this.RECHARGE_TIME;
    t.tick = 0;
    Level.wall[ty * Level.W + tx] = 'f';
    t.saved = new Map();
    for (const i of t.tiles) { t.saved.set(i, Level.floorTex[i]); Level.floorTex[i] = Art.textures.electric; }
    game.playAt('zap', t.cx, t.cy, 1.2);
    game.message('FLOOR ELECTRIFIED!', '#40e0ff');
    return true;
  },

  update(dt, game) {
    const W = Level.W;
    for (const t of this.list) {
      if (t.cooldown > 0) {
        t.cooldown -= dt;
        if (t.cooldown <= 0) Level.wall[t.fy * W + t.fx] = 'F';
      }
      if (t.active <= 0) continue;
      t.active -= dt;
      t.tick -= dt;
      if (t.tick <= 0) {
        t.tick = this.TICK;
        this.zap(t, game);
      }
      if (t.active <= 0) {
        for (const [i, tex] of t.saved) Level.floorTex[i] = tex;
        t.saved = null;
      }
    }
  },

  onTrap(t, x, y) {
    return t.tiles.has(Math.floor(y) * Level.W + Math.floor(x));
  },

  zap(t, game) {
    for (const r of game.robots) {
      if (r.targetable && this.onTrap(t, r.x, r.y)) {
        Effects.sparks(r.x, r.y, r.def.height * 0.5, 4);
        r.hurt(this.ROBOT_DAMAGE, 0, 0, game, true, 'trap'); // shields don't stop electricity
      }
    }
    const p = game.player;
    if (this.onTrap(t, p.x, p.y)) p.hurt(this.PLAYER_DAMAGE, game);
    // random sparks over the floor and a flickering blue light
    const tiles = [...t.tiles];
    for (let k = 0; k < 3; k++) {
      const i = tiles[(Math.random() * tiles.length) | 0];
      Effects.burst((i % Level.W) + Math.random(), Math.floor(i / Level.W) + Math.random(), 0.05,
        { count: 4, colors: ['#80f0ff', '#ffffff'], speed: 1.2, up: 2, size: 0.03, life: 0.3 });
    }
    Effects.addLight(t.cx, t.cy, [0.4, 0.8, 1], 5, 0.6 + Math.random() * 0.6, this.TICK);
    game.playAt('zap', t.cx, t.cy, 0.5, 0.2);
  },
};
