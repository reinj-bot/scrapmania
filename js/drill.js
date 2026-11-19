'use strict';
// A bonus round: hold out for Drill.LENGTH while friendly robots (Ally) fight with you, then a big
// enemy (the lead, ROBOTS.xq) lands; destroying her wins. She lays eggs (xe) and spits acid.

// A friendly robot: follows you around and shoots the nearest enemy it can see. Enemies close to it
// and acid can hurt it (your bullets go right past it).
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
    this.maxHp = this.hp = Ally.HP[type] || 140;
    this.flash = 0;
  }

  hurt(amount, game) {
    if (this.dead) return;
    this.hp -= amount;
    this.flash = 0.15;
    if (this.hp > 0) return;
    this.dead = true;
    Effects.explode(this.x, this.y, this.def.height, Art.palettes[this.type]);
    game.playAt('robot_die', this.x, this.y, 1);
    game.message(Lex.q7, '#ff6040');
  }

  update(dt, game) {
    this.animTime += dt;
    this.flash = Math.max(0, this.flash - dt);
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
    return { x: this.x, y: this.y, z: 0, h: this.def.height, sprite: img, mirror: this.mirror, outline: Ally.OUTLINE, flash: this.flash > 0 ? 0.6 : 0 };
  }
}
Ally.GUNS = {
  basic: { damage: 12, cooldown: 0.8, range: 9 },
  heavy: { damage: 30, cooldown: 1.6, range: 7 },
  ranged: { damage: 16, cooldown: 1.1, range: 11 },
};
Ally.HP = { heavy: 260, basic: 140, ranged: 110 };
Ally.OUTLINE = (0xff000000 | (255 << 16) | (230 << 8) | 80) >>> 0; // cyan glow: friend, not foe

const Drill = {
  LENGTH: 30,          // seconds until the lead lands
  EGG_EVERY: 6,
  lead: null,
  acids: [],
  puddles: [],

  start(game) {
    game.allies = [];
    this.lead = null; this.acids = []; this.puddles = []; this.burn = 0;
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
    game.allies = game.allies.filter(a => !a.dead);
    if (!this.lead && game.time >= this.LENGTH) this.landLead(game);
    const k = Math.min(1, game.time / this.LENGTH);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = (1.5 - k * 0.8) * (this.lead ? 1.7 : 1); // fewer once she is here
      const alive = game.robots.filter(r => r.alive).length;
      if (alive < 7 + Math.round(k * 7)) this.spawnFoe(game);
    }
    this.updateAcid(dt, game);
    this.foesVsAllies(game);
    if (this.lead && !this.lead.alive) this.won(game);
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

  // the lead comes down on the pad furthest from you
  landLead(game) {
    const p = game.player;
    const pad = Level.enemySpawns.slice().sort((a, b) => Math.hypot(b.x - p.x, b.y - p.y) - Math.hypot(a.x - p.x, a.y - p.y))[0];
    const q = new Robot('xq', pad.x, pad.y, game.diff, true);
    q.timer = 1.5;
    game.robots.push(q);
    this.lead = q;
    Effects.burst(pad.x, pad.y, 1, { count: 50, colors: ['#80ff40', '#c0ff40', '#ffffff'], speed: 3, up: 5, size: 0.05, life: 1.2 });
    Effects.addLight(pad.x, pad.y, [0.5, 1, 0.3], 8, 2, 1.5);
    game.message(Lex.q3, '#80ff40');
    game.say('THE WARDEN', Lex.q4, '#ff6040');
    Sound.play('boss_alarm'); Sound.play('boss_roar', 1.2);
    game.shake(0.8);
  },

  // every few seconds she lays two eggs next to her
  leadTick(q, dt, game) {
    q.eggTimer -= dt;
    if (q.eggTimer > 0 || q.state !== 'active') return;
    q.eggTimer = this.EGG_EVERY;
    for (let n = 0, tries = 0; n < 2 && tries < 12; tries++) {
      const a = Math.random() * Math.PI * 2, x = q.x + Math.cos(a) * 1.3, y = q.y + Math.sin(a) * 1.3;
      if (Level.isBlocked(x, y)) continue;
      game.robots.push(new Robot('xe', x, y, game.diff, true));
      Effects.burst(x, y, 0.2, { count: 8, colors: ['#80ff40', '#e0f0b0'], speed: 1, up: 1.5, size: 0.03, life: 0.4 });
      n++;
    }
    game.playAt('mine_place', q.x, q.y, 0.8);
  },

  hatch(egg, game) {
    egg.state = 'wreck'; egg.timer = 0;
    game.robots.push(new Robot('xa', egg.x, egg.y, game.diff, true));
    Effects.burst(egg.x, egg.y, 0.3, { count: 14, colors: ['#80ff40', '#e0f0b0', '#ffffff'], speed: 1.8, up: 2, size: 0.035, life: 0.5 });
    game.playAt('hatch', egg.x, egg.y, 0.9);
  },

  // three blobs of acid in an arc towards you; each leaves a burning puddle where it lands
  spit(q, game) {
    const p = game.player, d = Math.hypot(p.x - q.x, p.y - q.y) || 1;
    const nx = -(p.y - q.y) / d, ny = (p.x - q.x) / d;
    for (const side of [-1, 0, 1]) {
      const tx = p.x + nx * side * 1.2 + (Math.random() - 0.5) * 0.6, ty = p.y + ny * side * 1.2 + (Math.random() - 0.5) * 0.6;
      this.acids.push({ x0: q.x, y0: q.y, x1: tx, y1: ty, x: q.x, y: q.y, z: 1, t: 0, dur: 0.5 + Math.hypot(tx - q.x, ty - q.y) / 9, damage: q.damage, owner: q });
    }
    game.playAt('spit', q.x, q.y, 1);
  },

  updateAcid(dt, game) {
    const p = game.player;
    for (const a of this.acids) {
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      const nx = a.x0 + (a.x1 - a.x0) * k, ny = a.y0 + (a.y1 - a.y0) * k;
      const hitWall = Level.isWallTile(Math.floor(nx), Math.floor(ny));
      if (!hitWall) { a.x = nx; a.y = ny; }
      a.z = 1 - k + Math.sin(k * Math.PI) * 1.1;
      if (k >= 1 || hitWall) {
        a.done = true;
        this.puddles.push({ x: a.x, y: a.y, life: 5 });
        Effects.burst(a.x, a.y, 0.1, { count: 12, colors: ['#60e020', '#a0ff60'], speed: 1.6, up: 1.2, size: 0.035, life: 0.4 });
        game.playAt('impact', a.x, a.y, 0.6, 0.05);
        if (Math.hypot(p.x - a.x, p.y - a.y) < 0.7) p.hurt(a.damage, game, a.owner);
      }
    }
    this.acids = this.acids.filter(a => !a.done);
    for (const pu of this.puddles) pu.life -= dt;
    this.puddles = this.puddles.filter(pu => pu.life > 0);
    // standing in acid burns (you and your allies)
    this.burn += dt;
    if (this.burn < 0.4) return;
    this.burn = 0;
    const inAcid = (x, y) => this.puddles.some(pu => Math.hypot(x - pu.x, y - pu.y) < 0.85);
    if (inAcid(p.x, p.y)) p.hurt(Math.max(1, Math.round(5 * game.diff.damage)), game, this.lead);
    for (const al of game.allies) if (inAcid(al.x, al.y)) al.hurt(8, game);
  },

  // enemies that get close to one of your allies (closer than you) attack it instead
  foesVsAllies(game) {
    const p = game.player;
    for (const r of game.robots) {
      if (r.state !== 'active' || !r.def.foe || r.def.egg || r.def.lead || r.def.ranged) continue;
      if (r.attackCooldown > 0 || r.windup > 0) continue;
      const pd = Math.hypot(p.x - r.x, p.y - r.y);
      let target = null, td = r.def.attackRange + 0.4;
      for (const a of game.allies) { const d = Math.hypot(a.x - r.x, a.y - r.y); if (d < td && d < pd) { td = d; target = a; } }
      if (!target) continue;
      r.attackCooldown = r.cooldownBase;
      target.hurt(r.damage, game);
      Effects.sparks(target.x, target.y, 0.5, 4);
      game.playAt('robot_attack', r.x, r.y, 0.6, 0.05);
    }
  },

  addSprites(list, time) {
    for (const a of this.acids) list.push({ x: a.x, y: a.y, z: a.z - 0.1, h: 0.22, sprite: Art.sprites.acid[((time * 10) | 0) & 1], bright: true });
    for (const pu of this.puddles) list.push({ x: pu.x, y: pu.y, z: 0, h: 0.08, sprite: Art.sprites.puddle, bright: true, fade: Math.min(1, pu.life) });
  },

  // the lead is down: the round is won
  won(game) {
    for (const r of game.robots) if (r.alive) { Effects.burst(r.x, r.y, 0.5, { count: 10, colors: ['#80ff40', '#ffffff'], speed: 1.5, up: 2, size: 0.03, life: 0.5 }); r.state = 'wreck'; r.timer = 0; }
    this.acids = []; this.puddles = [];
    game.message(Lex.q6, '#80ff40');
    game.run.flags.drill = true;
    game.run.flags.x8 = true;
    game.win();
  },
};
