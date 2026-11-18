'use strict';
// The Warden's attacks besides the stomp:
// - volley: it stands in one spot and turns while firing, so the 5 bolts sweep across like a fan
// - missile rain: red circles on the floor around you, missiles crash down on them 1.5 s later
// - charge (from stage 2): it flashes red, then runs straight at you; if it hits a wall it is
//   stunned for 2 s and takes extra damage.

const WardenMoves = {
  SWEEP_SHOTS: 5, SWEEP_GAP: 0.1, SWEEP_STEP: 0.17,
  MISSILE_DELAY: 1.5, MISSILE_RADIUS: 1.1,
  CHARGE_WINDUP: 1.0, CHARGE_SPEED: 7.5, CHARGE_MAX: 11, STUN: 2, STUN_DAMAGE: 1.5,
  missiles: [],

  reset() { this.missiles = []; },

  // Which attack the Warden winds up next.
  pick(b, dist) {
    if (b.bossPhase >= 2 && dist < b.def.stompRange) return 'stomp';
    const r = Math.random();
    if (b.bossPhase === 1) return r < 0.3 ? 'missiles' : 'volley';
    if (r < 0.3) return 'missiles';
    if (r < 0.55 && dist > 3) return 'charge';
    return 'volley';
  },

  hitDamage(b) { return Math.round(b.def.stompDamage * b.diff.damage * (b.bossPhase === 3 ? 0.6 : 1)); },

  // ---------- turning volley ----------
  startSweep(b, game) {
    const p = game.player, base = Math.atan2(p.y - b.y, p.x - b.x);
    b.sweepDir = -(b.sweepDir || 1); // left to right, then right to left
    b.sweep = { i: 0, t: 0, base, mx: b.x + Math.cos(base) * 0.7, my: b.y + Math.sin(base) * 0.7 };
  },

  sweepTick(b, dt, game) {
    const s = b.sweep, n = this.SWEEP_SHOTS;
    s.t += dt;
    while (s.i < n && s.t >= s.i * this.SWEEP_GAP) {
      const k = (s.i - (n - 1) / 2) * b.sweepDir;
      const a = s.base + k * this.SWEEP_STEP + (Math.random() - 0.5) * b.aimError * 0.5;
      Effects.shootPlasma(s.mx, s.my, a, b.def.projectileSpeed, b.damage);
      game.playAt('plasma', b.x, b.y, 0.8, 0.05);
      b.mirror = k > 0; // it turns as it fires
      s.i++;
    }
    if (s.i >= n && s.t >= n * this.SWEEP_GAP) b.sweep = null;
  },

  // ---------- missile rain ----------
  missileRain(b, game) {
    const p = game.player, n = b.bossPhase >= 2 ? 6 : 4, damage = this.hitDamage(b);
    const spots = [{ x: p.x, y: p.y }];
    for (let i = 0; spots.length < n && i < 60; i++) {
      const a = Math.random() * Math.PI * 2, d = 1.4 + Math.random() * 2.2;
      const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
      if (Level.isBlocked(x, y) || spots.some(s => Math.hypot(s.x - x, s.y - y) < 1.3)) continue;
      spots.push({ x, y });
    }
    spots.forEach((s, i) => this.missiles.push({ x: s.x, y: s.y, t: -i * 0.12, damage, done: false }));
    game.playAt('boss_charge', b.x, b.y, 1);
    Effects.burst(b.x, b.y, 1.9, { count: 18, colors: ['#ff6030', '#ffd080', '#ffffff'], speed: 1.5, up: 6, size: 0.04, life: 0.6 });
    game.message('INCOMING MISSILES - GET OUT OF THE RED CIRCLES!', '#ff6040');
  },

  update(dt, game) {
    for (const m of this.missiles) {
      m.t += dt;
      if (m.t >= this.MISSILE_DELAY) {
        m.done = true;
        Blast.at(m.x, m.y, game, { radius: this.MISSILE_RADIUS, robotDamage: 0, playerDamage: m.damage, scale: 0.8, palette: Art.palettes.boss, source: 'bomber' });
      }
    }
    this.missiles = this.missiles.filter(m => !m.done);
  },

  // ---------- charge ----------
  startCharge(b, game) {
    const p = game.player, d = Math.hypot(p.x - b.x, p.y - b.y) || 1;
    b.charge = { dx: (p.x - b.x) / d, dy: (p.y - b.y) / d, left: this.CHARGE_MAX, t: 0, hit: false, stun: false, damage: this.hitDamage(b) };
    game.playAt('boss_roar', b.x, b.y, 0.8);
    game.playAt('dash', b.x, b.y, 1);
  },

  chargeTick(b, dt, game) {
    const c = b.charge;
    c.t += dt;
    if (c.stun) {
      if (Math.random() < dt * 12) Effects.burst(b.x, b.y, b.def.height + 0.1, { count: 1, colors: ['#ffd040', '#ffffff'], speed: 0.7, up: 0.4, size: 0.03, life: 0.4, gravity: 0 });
      if (c.t >= this.STUN) { b.charge = null; b.attackCooldown = 1; }
      return;
    }
    const step = this.CHARGE_SPEED * dt, p = game.player;
    if (Math.random() < dt * 30) Effects.burst(b.x, b.y, 0.08, { count: 2, colors: ['#8a8070', '#ff6030'], speed: 1, up: 1, size: 0.04, life: 0.4 });
    if (!c.hit && p.alive && Math.hypot(p.x - b.x, p.y - b.y) < b.def.radius + 0.45) {
      c.hit = true;
      p.hurt(c.damage, game);
      const side = (p.x - b.x) * -c.dy + (p.y - b.y) * c.dx >= 0 ? 1 : -1; // knocked out of its way, to the side
      Level.move(p, -c.dy * side * 1.1, c.dx * side * 1.1, 0.25);
      game.shake(0.8);
    }
    const nx = b.x + c.dx * step, ny = b.y + c.dy * step;
    if (Level.isBlocked(nx + c.dx * b.def.radius, ny + c.dy * b.def.radius)) {
      // crashed into a wall: dizzy and open to attack
      c.stun = true; c.t = 0;
      game.playAt('stomp', b.x, b.y, 1.3);
      game.playAt('barrel', b.x, b.y, 0.6);
      game.shake(0.9);
      Effects.burst(b.x + c.dx * 0.6, b.y + c.dy * 0.6, 1, { count: 26, colors: ['#ffd040', '#ffffff', '#8a8070'], speed: 3, up: 3, size: 0.04, life: 0.6 });
      game.message('THE WARDEN HIT THE WALL - IT IS STUNNED! HIT IT NOW!', '#60ff80');
      return;
    }
    b.x = nx; b.y = ny;
    c.left -= step;
    if (c.left <= 0) { b.charge = null; b.attackCooldown = 0.8; }
  },

  // ---------- drawing ----------
  addSprites(list) {
    const D = this.MISSILE_DELAY;
    for (const m of this.missiles) {
      if (m.t < 0) continue;
      // the target circle blinks faster as the missile gets close
      const blink = ((m.t * (4 + m.t * 10)) | 0) & 1;
      list.push({ x: m.x, y: m.y, z: 0, h: 0.12, sprite: Art.sprites.target[blink], bright: true });
      const fall = (m.t - (D - 0.35)) / 0.35;
      if (fall > 0) list.push({ x: m.x, y: m.y, z: 4 * (1 - fall), h: 0.5, sprite: Art.sprites.missile, bright: true });
    }
  },
};
