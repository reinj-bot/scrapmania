'use strict';
// A one-minute bonus round: hold out for Drill.LENGTH while friendly robots (Ally) fight with you.

// A friendly robot: follows you around and shoots the nearest enemy it can see.
// It can't be hurt (and your bullets go right past it), so it never gets in the way.
class Ally {
  constructor(type, x, y) {
    this.type = type;
    this.def = ROBOTS[type];
    this.x = x; this.y = y;
    this.gun = Ally.GUNS[type] || Ally.GUNS.basic;
    this.cooldown = Math.random();
    this.animTime = Math.random() * 10;
    this.moving = false;
    this.mirror = Math.random() < 0.5;
    this.shotTime = 0;
  }

  update(dt, game) {
    this.animTime += dt;
    this.cooldown -= dt;
    this.shotTime = Math.max(0, this.shotTime - dt);
    const p = game.player;
    // the nearest enemy it can see
    let target = null, best = 14;
    for (const r of game.robots) {
      if (!r.targetable || !r.def.foe) continue;
      const d = Math.hypot(r.x - this.x, r.y - this.y);
      if (d < best && Level.hasLOS(this.x, this.y, r.x, r.y)) { best = d; target = r; }
    }
    let mx = 0, my = 0;
    if (target) {
      const dx = target.x - this.x, dy = target.y - this.y, d = best || 1;
      if (d <= this.gun.range && this.cooldown <= 0) this.fire(target, dx / d, dy / d, game);
      if (d > this.gun.range * 0.7) { mx = dx / d; my = dy / d; }
    } else {
      // nothing to shoot: stay close to you
      const d = Math.hypot(p.x - this.x, p.y - this.y);
      if (d > 3) {
        if (Level.hasLOS(this.x, this.y, p.x, p.y)) { mx = (p.x - this.x) / d; my = (p.y - this.y) / d; }
        else { const s = Level.flowStep(this.x, this.y); if (s) { mx = s.x - this.x; my = s.y - this.y; } }
      }
    }
    // keep space from each other
    for (const o of game.allies) {
      if (o === this) continue;
      const ox = this.x - o.x, oy = this.y - o.y, d = Math.hypot(ox, oy);
      if (d > 0.001 && d < 0.8) { mx += ox / d * 1.5; my += oy / d * 1.5; }
    }
    // stay out of your way: not too close, and never right in front of your gun
    const px = this.x - p.x, py = this.y - p.y, pd = Math.hypot(px, py);
    if (pd > 0.001 && pd < 1.8) { mx += px / pd * 2; my += py / pd * 2; }
    let off = Math.atan2(py, px) - p.angle;
    off = Math.atan2(Math.sin(off), Math.cos(off));
    if (pd < 4.5 && Math.abs(off) < 0.5) {
      const side = off >= 0 ? 1 : -1;
      mx += -Math.sin(p.angle) * side * 2.5; my += Math.cos(p.angle) * side * 2.5;
    }
    const len = Math.hypot(mx, my);
    this.moving = len > 0.01;
    if (this.moving) Level.move(this, mx / len * this.def.speed * 1.1 * dt, my / len * this.def.speed * 1.1 * dt, this.def.radius);
  }

  fire(target, nx, ny, game) {
    const g = this.gun;
    this.cooldown = g.cooldown * (0.85 + Math.random() * 0.3);
    this.shotTime = 0.15;
    const dmg = g.damage * game.diff.health; // keeps up with the difficulty
    target.hurt(dmg, nx, ny, game, false, 'ally');
    // a cyan laser streak
    const d = Math.hypot(target.x - this.x, target.y - this.y);
    for (let s = 0.4; s < d; s += 0.35) {
      Effects.burst(this.x + nx * s, this.y + ny * s, 0.5, { count: 1, colors: ['#60f0ff', '#ffffff'], speed: 0, up: 0, size: 0.025, life: 0.12, gravity: 0 });
    }
    Effects.addLight(this.x + nx * 0.4, this.y + ny * 0.4, [0.4, 0.9, 1], 2.5, 0.8, 0.1);
    game.playAt('plasmagun', this.x, this.y, 0.3, 0.05);
  }

  sprite() {
    const frames = Art.sprites[this.type];
    const img = this.shotTime > 0 ? frames.attack : this.moving && ((this.animTime * 5) | 0) & 1 ? frames.walk1 : frames.walk0;
    return { x: this.x, y: this.y, z: 0, h: this.def.height, sprite: img, mirror: this.mirror, outline: Ally.OUTLINE };
  }
}
Ally.GUNS = {
  basic: { damage: 12, cooldown: 0.8, range: 9 },
  heavy: { damage: 30, cooldown: 1.6, range: 7 },
  ranged: { damage: 16, cooldown: 1.1, range: 11 },
};
Ally.OUTLINE = (0xff000000 | (255 << 16) | (230 << 8) | 80) >>> 0; // cyan glow: friend, not foe

const Drill = {
  LENGTH: 60,

  start(game) {
    game.allies = [];
    const p = game.player;
    for (const type of ['heavy', 'basic', 'ranged', 'basic', 'ranged']) {
      for (let k = 0; k < 24; k++) {
        // around you and behind you, never in front of your gun
        const a = p.angle + Math.PI / 2 + ((k * 7 + game.allies.length * 5) % 24) / 24 * Math.PI, r = 2 + (k % 3) * 0.6;
        const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
        if (Level.isBlocked(x, y) || !Level.hasLOS(p.x, p.y, x, y) || game.allies.some(o => Math.hypot(o.x - x, o.y - y) < 0.8)) continue;
        game.allies.push(new Ally(type, x, y));
        break;
      }
    }
    this.spawnTimer = 2.5;
    game.say('THE WARDEN', Lex.d4, '#ff6040');
  },

  update(dt, game) {
    for (const a of game.allies) a.update(dt, game);
    const k = Math.min(1, game.time / this.LENGTH);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 1.5 - k * 0.8;
      const alive = game.robots.filter(r => r.alive).length;
      if (alive < 7 + Math.round(k * 7)) this.spawnFoe(game);
    }
    if (game.time >= this.LENGTH) this.won(game);
  },

  spawnFoe(game) {
    const pad = Spawner.pickSpawn(game, false);
    if (!pad) return;
    const type = Math.random() < 0.3 ? 'xb' : 'xa';
    game.robots.push(new Robot(type, pad.x, pad.y, game.diff, true));
    Effects.burst(pad.x, pad.y, 0.4, { count: 18, colors: ['#80ff40', '#c040ff', '#ffffff'], speed: 1.4, up: 3, size: 0.03, life: 0.7, gravity: 1 });
    Effects.addLight(pad.x, pad.y, [0.6, 1, 0.3], 3.5, 1.2, 0.6);
    game.playAt('teleport', pad.x, pad.y, 0.7);
  },

  // Time is up: the round is won.
  won(game) {
    for (const r of game.robots) if (r.alive) { Effects.burst(r.x, r.y, 0.5, { count: 10, colors: ['#80ff40', '#ffffff'], speed: 1.5, up: 2, size: 0.03, life: 0.5 }); r.state = 'wreck'; r.timer = 0; }
    game.run.flags.drill = true;
    game.win();
  },
};
