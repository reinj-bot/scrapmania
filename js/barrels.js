'use strict';
// Explosive barrels: shoot one and it blows up, hurting every robot nearby, the player
// too if they're close, and setting off other barrels. They're restocked after a while.

const Barrels = {
  RADIUS: 2.8,
  ROBOT_DAMAGE: 180,   // at the center, less further out
  PLAYER_DAMAGE: 50,
  RESPAWN_TIME: 45,
  HIT_RADIUS: 0.33,

  list: [],

  init() {
    this.list = Level.props.filter(p => p.kind === 'barrel')
      .map(p => ({ x: p.x, y: p.y, tx: Math.floor(p.x), ty: Math.floor(p.y), alive: true, fuse: 0, timer: 0 }));
    Level.props = Level.props.filter(p => p.kind !== 'barrel');
  },

  // Short delay so chain reactions ripple instead of all going off at once.
  ignite(b, delay = 0.02) {
    if (!b.alive || b.fuse > 0) return;
    b.fuse = delay;
  },

  near(x, y, r) {
    return this.list.find(b => b.alive && Math.hypot(b.x - x, b.y - y) < r);
  },

  update(dt, game) {
    for (const b of this.list) {
      if (b.alive) {
        if (b.fuse > 0) { b.fuse -= dt; if (b.fuse <= 0) this.explode(b, game); }
        continue;
      }
      b.timer -= dt;
      if (b.timer > 0) continue;
      // restock out of sight-range, and only if nothing is standing there
      const p = game.player;
      const clear = Math.hypot(p.x - b.x, p.y - b.y) > 5 &&
        !game.robots.some(r => r.alive && Math.hypot(r.x - b.x, r.y - b.y) < 1);
      if (clear) {
        b.alive = true;
        b.fuse = 0;
        Level.blocked[b.ty * Level.W + b.tx] = 1;
        Level.flowFrom = -1;
      } else b.timer = 2;
    }
  },

  explode(b, game) {
    b.alive = false;
    b.timer = this.RESPAWN_TIME;
    Level.blocked[b.ty * Level.W + b.tx] = 0;
    Level.flowFrom = -1;

    Blast.at(b.x, b.y, game, {
      radius: this.RADIUS, robotDamage: this.ROBOT_DAMAGE, playerDamage: this.PLAYER_DAMAGE,
      scale: 1.4, palette: Art.palettes.barrel,
      source: 'barrel#' + (this.blastCount = (this.blastCount || 0) + 1), // each blast counted on its own
    });
  },

  addSprites(list) {
    for (const b of this.list) {
      if (b.alive) list.push({ x: b.x, y: b.y, z: 0, h: 0.8, sprite: Art.sprites.barrel, flash: b.fuse > 0 ? 0.6 : 0 });
    }
  },
};
