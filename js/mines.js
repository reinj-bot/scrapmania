'use strict';
// Mines dropped by Sappers. A mine needs a moment to arm; when you step close it beeps, then
// blows up. Shooting a mine (or an explosion next to it) sets it off - from a safe distance.

const Mines = {
  ARM_TIME: 0.8,     // seconds before a fresh mine can go off
  TRIGGER: 1.1,      // how close you must step to set it off
  FUSE: 0.45,        // beeping time between stepping close and the blast
  LIFE: 45,          // an untouched mine shuts down after this long
  list: [],

  reset() { this.list = []; },

  place(x, y, owner, game) {
    this.list.push({ x, y, owner, damage: owner.damage, t: 0, fuse: -1, dead: false });
    game.playAt('mine_place', x, y, 0.7);
  },

  count(owner) { return this.list.filter(m => !m.dead && m.owner === owner).length; },

  update(dt, game) {
    const p = game.player;
    for (const m of this.list) {
      if (m.dead) continue;
      m.t += dt;
      if (m.fuse < 0 && m.t > this.ARM_TIME && p.alive && Math.hypot(p.x - m.x, p.y - m.y) < this.TRIGGER) {
        m.fuse = this.FUSE;
        game.playAt('mine_beep', m.x, m.y, 1);
      }
      if (m.fuse >= 0) {
        m.fuse -= dt;
        if (m.fuse <= 0) this.boom(m, game);
      } else if (m.t > this.LIFE) {
        m.dead = true; // fizzles out
        Effects.burst(m.x, m.y, 0.05, { count: 6, colors: ['#808080', '#505050'], speed: 0.8, up: 1, size: 0.03, life: 0.4, bright: false });
      }
    }
    this.list = this.list.filter(m => !m.dead);
  },

  boom(m, game) {
    if (m.dead) return;
    m.dead = true;
    Blast.at(m.x, m.y, game, { owner: m.owner, radius: 1.9, robotDamage: 60, playerDamage: m.damage, scale: 0.8, palette: Art.palettes.sapper, source: 'mine' });
  },

  // A bullet hit it: it goes off almost at once.
  shot(m, game) {
    if (m.fuse < 0 || m.fuse > 0.08) m.fuse = 0.08;
    Effects.sparks(m.x, m.y, 0.08, 6);
    game.playAt('mine_beep', m.x, m.y, 0.8);
  },

  // Explosions nearby set mines off too (a chain of blasts).
  blast(x, y, radius) {
    for (const m of this.list) {
      if (!m.dead && m.fuse < 0 && Math.hypot(m.x - x, m.y - y) < radius) m.fuse = 0.15 + Math.random() * 0.15;
    }
  },

  addSprites(list, time) {
    for (const m of this.list) {
      const fast = m.fuse >= 0 ? 16 : m.t < this.ARM_TIME ? 0 : 2.5;
      const on = fast ? ((time * fast) | 0) & 1 : 0;
      list.push({ x: m.x, y: m.y, z: 0, h: 0.13, sprite: Art.sprites.mine[on], bright: !!on });
    }
  },

  lights(time) {
    return this.list.filter(m => m.fuse >= 0 || ((time * 2.5) | 0) & 1)
      .map(m => ({ x: m.x, y: m.y, c: [1, 0.2, 0.1], radius: m.fuse >= 0 ? 2.2 : 1.2, intensity: m.fuse >= 0 ? 1.2 : 0.5 }));
  },
};
