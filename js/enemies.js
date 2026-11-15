'use strict';
// Robots. Every type shares this one brain; the numbers and flags in ROBOTS (config.js)
// make them differ (ranged, explodes, shield, teleport, carrier...).
// States: spawning -> active -> dying -> wreck (then removed).

class Robot {
  constructor(type, x, y, diff, alerted) {
    const def = ROBOTS[type];
    this.type = type;
    this.def = def;
    this.x = x;
    this.y = y;
    this.diff = diff;
    this.maxHp = this.hp = Math.round(def.hp * diff.health);
    this.speed = def.speed * diff.speed;
    this.damage = Math.max(1, Math.round(def.damage * diff.damage));
    this.cooldownBase = def.attackCooldown / diff.attackRate;
    this.aimError = diff.aimError;
    this.state = 'spawning';
    this.timer = 0.7;
    this.alerted = alerted;
    this.attackCooldown = 1 + Math.random();
    this.windup = 0;
    this.flash = 0;
    this.pain = 0;
    this.shieldDown = 0;       // shield bot: shield lowered after an attack
    this.phase = null;         // phantom: 'out' / 'in' while teleporting
    this.phaseTimer = 0;
    this.teleportCooldown = 2 + Math.random() * 2;
    this.parent = null;        // mini-drone: the carrier that launched it
    this.bossPhase = 1;        // boss: 1-3, gets meaner as it loses health
    this.summonTimer = 8;
    this.nextAttack = null;
    this.extraVolley = 0;
    this.animTime = Math.random() * 10;
    this.knockX = 0;
    this.knockY = 0;
    this.strafe = Math.random() < 0.5 ? -1 : 1;
    this.strafeTimer = 0;
    this.wanderAngle = Math.random() * Math.PI * 2;
    this.mirror = Math.random() < 0.5;
    this.mineTimer = 2 + Math.random() * 2;      // sapper
    this.healTimer = 1;                          // medic
    this.leapCooldown = 1.5 + Math.random();     // jumper
    this.leap = null;
    this.jumpZ = 0;
  }

  get alive() { return this.state === 'spawning' || this.state === 'active'; }
  // Can be hit right now (a teleporting phantom can't).
  get targetable() { return this.alive && !this.phase; }

  update(dt, game) {
    this.animTime += dt;
    this.flash = Math.max(0, this.flash - dt);

    if (this.state === 'spawning') {
      this.timer -= dt;
      if (this.timer <= 0) this.state = 'active';
      return;
    }
    if (this.state === 'drain') {
      // sinking into the floor, its energy streaming to the Warden
      this.timer -= dt;
      const b = game.boss;
      if (b && Math.random() < dt * 14) {
        const k = Math.random(), h = this.def.height * 0.5 * (this.timer / this.drainTotal);
        Effects.burst(this.x + (b.x - this.x) * k, this.y + (b.y - this.y) * k, h + (1.2 - h) * k + (Math.random() - 0.5) * 0.15,
          { count: 1, colors: ['#ff40a0', '#ff80d0', '#ffffff'], speed: 0.15, up: 0.2, size: 0.03, life: 0.3, gravity: 0 });
      }
      if (Math.random() < dt * 8) Effects.burst(this.x, this.y, 0.05, { count: 2, colors: ['#ff40a0', '#ffffff'], speed: 0.6, up: 1.5, size: 0.025, life: 0.4, gravity: -0.5 });
      if (this.timer <= 0) { this.state = 'wreck'; this.timer = 0; }
      return;
    }
    if (this.state === 'dying') {
      this.timer -= dt;
      if (this.timer <= 0) { this.state = 'wreck'; this.timer = 6; }
      return;
    }
    if (this.state === 'wreck') {
      this.timer -= dt;
      return;
    }

    const p = game.player;
    const dx = p.x - this.x, dy = p.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (this.phase) { this.updateTeleport(dt, game); return; }

    const lured = game.lure && dist > 5 && !this.def.boss;
    const sees = !lured && dist < 18 && Level.hasLOS(this.x, this.y, p.x, p.y);
    if (!this.alerted && ((sees && dist < 14) || dist < 3)) this.alert(game);

    this.attackCooldown -= dt;
    this.pain = Math.max(0, this.pain - dt);
    this.shieldDown = Math.max(0, this.shieldDown - dt);

    // knockback from being shot
    if (this.knockX || this.knockY) {
      Level.move(this, this.knockX * dt, this.knockY * dt, this.def.radius);
      const k = Math.pow(0.002, dt);
      this.knockX *= k; this.knockY *= k;
      if (Math.abs(this.knockX) + Math.abs(this.knockY) < 0.05) this.knockX = this.knockY = 0;
    }

    if (this.def.boss) this.updateBoss(dt, game);
    if (this.def.medic) { if (this.pain <= 0) this.updateMedic(dt, game, dist); return; }
    if (this.def.sapper) this.updateSapper(dt, game);
    if (this.def.jumper && this.updateJumper(dt, game, dx, dy, dist, sees)) return;

    // attack wind-up: stand still, then strike
    if (this.windup > 0) {
      this.windup -= dt;
      if (this.windup <= 0) this.strike(game, dist);
      return;
    }
    if (this.pain > 0 || !p.alive) return;

    if (this.def.teleport && this.alerted && dist > 1.8) {
      this.teleportCooldown -= dt;
      if (this.teleportCooldown <= 0) { this.startTeleport(game); return; }
    }

    const inRange = dist <= this.def.attackRange;
    if (this.alerted && sees && inRange && this.attackCooldown <= 0 && this.canAttack()) {
      this.windup = this.def.windup;
      if (this.def.boss) this.nextAttack = this.bossPhase >= 2 && dist < this.def.stompRange ? 'stomp' : 'volley';
      const sound = this.def.boss ? 'boss_charge' : this.def.ranged ? 'plasma' : this.def.explodes ? 'bomber_arm' : 'robot_windup';
      game.playAt(sound, this.x, this.y, this.def.ranged ? 0.25 : 0.7);
      return;
    }

    this.move(dt, game, dx, dy, dist, sees);
  }

  canAttack() {
    if (!this.def.carrier) return true;
    return this.minis().length < this.def.maxMinis;
  }

  minis() {
    return Game.robots.filter(r => r.parent === this && r.alive);
  }

  move(dt, game, dx, dy, dist, sees) {
    let mx = 0, my = 0, speed = this.speed;
    if (!this.alerted) {
      // idle: amble around slowly
      this.strafeTimer -= dt;
      if (this.strafeTimer <= 0) { this.wanderAngle += (Math.random() - 0.5) * 2.5; this.strafeTimer = 1 + Math.random() * 2; }
      mx = Math.cos(this.wanderAngle); my = Math.sin(this.wanderAngle);
      speed *= 0.3;
    } else if (sees) {
      const nx = dx / dist, ny = dy / dist;
      this.strafeTimer -= dt;
      if (this.strafeTimer <= 0) { this.strafe = -this.strafe; this.strafeTimer = 1 + Math.random() * 1.5; }
      if (this.def.keepDistance) {
        // ranged robots and carriers keep their distance and side-step
        // (an angry boss comes in close to stomp)
        const keep = this.def.boss && this.bossPhase >= 2 ? 2.2 : this.def.keepDistance;
        const toward = dist > keep + 1.5 ? 1 : dist < keep - 1 ? -0.8 : 0;
        mx = nx * toward - ny * this.strafe * 0.7;
        my = ny * toward + nx * this.strafe * 0.7;
      } else if (dist > this.def.attackRange * 0.75) {
        const zig = this.type === 'fast' || this.type === 'mini' ? 0.45 : 0.15;
        mx = nx - ny * this.strafe * zig;
        my = ny + nx * this.strafe * zig;
      }
    } else {
      // can't see the player: follow the path map around walls
      const step = Level.flowStep(this.x, this.y);
      if (step) { mx = step.x - this.x; my = step.y - this.y; }
    }

    // keep a little space from other robots
    for (const o of game.robots) {
      if (o === this || !o.alive) continue;
      const ox = this.x - o.x, oy = this.y - o.y;
      const d = Math.hypot(ox, oy);
      const min = this.def.radius + o.def.radius;
      if (d > 0.001 && d < min) { mx += ox / d * 1.5; my += oy / d * 1.5; }
    }

    const len = Math.hypot(mx, my);
    if (len < 0.001) return;
    const before = this.x + this.y;
    Level.move(this, mx / len * speed * dt, my / len * speed * dt, this.def.radius);
    if (!this.alerted && Math.abs(this.x + this.y - before) < 0.0001) this.wanderAngle += Math.PI * 0.7;
  }

  strike(game, dist) {
    this.attackCooldown = this.cooldownBase * (0.8 + Math.random() * 0.4);
    const p = game.player;
    if (this.def.boss) { this.bossStrike(game, dist); return; }
    if (this.def.explodes) {
      this.hp = 0;
      this.die(game, true); // blew itself up: no points for the player
      return;
    }
    if (this.def.carrier) {
      this.launchMini(game);
      return;
    }
    if (this.def.ranged) {
      const a = Math.atan2(p.y - this.y, p.x - this.x) + (Math.random() * 2 - 1) * this.aimError;
      Effects.shootPlasma(this.x + Math.cos(a) * 0.4, this.y + Math.sin(a) * 0.4, a, this.def.projectileSpeed, this.damage);
      game.playAt('plasma', this.x, this.y, 0.8);
      return;
    }
    if (this.def.shield) this.shieldDown = 0.8; // stays open a moment after swinging
    game.playAt('robot_attack', this.x, this.y, 0.8);
    if (dist <= this.def.attackRange + 0.35 && Level.hasLOS(this.x, this.y, p.x, p.y)) {
      p.hurt(this.damage, game);
      Effects.sparks(p.x + (this.x - p.x) * 0.4, p.y + (this.y - p.y) * 0.4, 0.5, 5);
    }
  }

  launchMini(game) {
    const p = game.player;
    const a = Math.atan2(p.y - this.y, p.x - this.x);
    const x = this.x + Math.cos(a) * 0.7, y = this.y + Math.sin(a) * 0.7;
    if (Level.isBlocked(x, y)) return;
    const m = new Robot('mini', x, y, this.diff, true);
    m.parent = this;
    m.timer = 0.25;
    game.robots.push(m);
    Effects.burst(x, y, 0.6, { count: 10, colors: ['#ffb020', '#ffffff'], speed: 1.5, up: 1.5, size: 0.03, life: 0.4 });
    game.playAt('launch', this.x, this.y, 0.9);
  }

  // ---- sapper: drops a mine every few seconds while it is after you (3 at most at a time) ----
  updateSapper(dt, game) {
    this.mineTimer -= dt;
    if (!this.alerted || this.mineTimer > 0) return;
    this.mineTimer = 3.5 + Math.random() * 2;
    if (Mines.count(this) < 3 && !Level.isBlocked(this.x, this.y)) Mines.place(this.x, this.y, this, game);
  }

  // ---- medic: stays near hurt robots (away from you) and repairs them ----
  updateMedic(dt, game, dist) {
    const p = game.player, def = this.def;
    let target = null, worst = 1, nearest = null, nd = 99;
    for (const r of game.robots) {
      if (r === this || !r.alive || r.def.boss || r.def.medic || (r.elite && r.elite.mini)) continue;
      const d = Math.hypot(r.x - this.x, r.y - this.y);
      if (d < nd) { nd = d; nearest = r; }
      const f = r.hp / r.maxHp;
      if (d < 9 && f < worst) { worst = f; target = r; }
    }
    const goal = target || nearest;
    let mx = 0, my = 0;
    if (goal) {
      const gx = goal.x - this.x, gy = goal.y - this.y, gd = Math.hypot(gx, gy) || 1;
      if (gd > 1.6) { mx = gx / gd; my = gy / gd; }
    } else if (!this.alerted) {
      mx = Math.cos(this.wanderAngle) * 0.3; my = Math.sin(this.wanderAngle) * 0.3;
    }
    if (dist < 4.5 && dist > 0.01) { mx -= (p.x - this.x) / dist * 1.3; my -= (p.y - this.y) / dist * 1.3; } // keeps away from you
    for (const o of game.robots) {
      if (o === this || !o.alive) continue;
      const ox = this.x - o.x, oy = this.y - o.y, d = Math.hypot(ox, oy);
      if (d > 0.001 && d < this.def.radius + o.def.radius) { mx += ox / d * 1.5; my += oy / d * 1.5; }
    }
    const len = Math.hypot(mx, my);
    if (len > 0.01) Level.move(this, mx / len * this.speed * dt, my / len * this.speed * dt, def.radius);
    // the repair pulse
    this.healTimer -= dt;
    if (this.healTimer > 0) return;
    this.healTimer = def.healEvery;
    let healed = 0;
    for (const r of game.robots) {
      if (r === this || !r.alive || r.def.boss || (r.elite && r.elite.mini) || r.hp >= r.maxHp) continue; // never the Warden or a mini-boss
      if (Math.hypot(r.x - this.x, r.y - this.y) > def.healRange) continue;
      r.hp = Math.min(r.maxHp, r.hp + r.maxHp * def.heal);
      this.healBeam(r);
      healed++;
    }
    if (healed) {
      this.windup = 0; this.shieldDown = 0.4; // shows its "healing" pose for a moment
      game.playAt('heal', this.x, this.y, 0.8);
      Effects.addLight(this.x, this.y, [0.3, 1, 0.5], 3, 1, 0.3);
    }
  }

  healBeam(r) {
    const steps = Math.max(3, Math.ceil(Math.hypot(r.x - this.x, r.y - this.y) * 5));
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      Effects.burst(this.x + (r.x - this.x) * k, this.y + (r.y - this.y) * k, 0.6 + (r.def.height * 0.5 - 0.6) * k,
        { count: 1, colors: ['#40ff80', '#e0ffe8'], speed: 0.2, up: 0.3, size: 0.03, life: 0.35, gravity: -0.3 });
    }
    Effects.burst(r.x, r.y, r.def.height * 0.5, { count: 8, colors: ['#40ff80', '#ffffff'], speed: 1, up: 1.2, size: 0.03, life: 0.5, gravity: -0.5 });
  }

  // ---- jumper: leaps at you, slams down where it lands ----
  updateJumper(dt, game, dx, dy, dist, sees) {
    if (this.leap) {
      const L = this.leap;
      L.t += dt;
      const k = Math.min(1, L.t / L.dur);
      Level.move(this, L.vx * dt, L.vy * dt, this.def.radius);
      this.jumpZ = Math.sin(k * Math.PI) * 0.9;
      if (k >= 1) {
        this.leap = null; this.jumpZ = 0;
        this.leapCooldown = 2.5 + Math.random() * 1.5;
        const p = game.player, pd = Math.hypot(p.x - this.x, p.y - this.y);
        Effects.burst(this.x, this.y, 0.05, { count: 14, colors: ['#8a8a8a', '#5a5a5a', '#ff40a0'], speed: 2.2, up: 1.2, size: 0.04, life: 0.45, bright: false });
        game.playAt('stomp', this.x, this.y, 0.6);
        if (pd < 1.4 && p.alive) p.hurt(Math.round(this.damage * 1.3), game);
      }
      return true;
    }
    this.leapCooldown -= dt;
    if (this.alerted && sees && dist > 2.5 && dist < 7 && this.leapCooldown <= 0 && this.windup <= 0 && this.pain <= 0) {
      const dur = 0.6, reach = dist - 0.6;
      this.leap = { t: 0, dur, vx: dx / dist * reach / dur, vy: dy / dist * reach / dur };
      game.playAt('jump', this.x, this.y, 0.8);
      return true;
    }
    return false;
  }

  // ---- boss ----
  updateBoss(dt, game) {
    const frac = this.hp / this.maxHp;
    const phase = frac < 0.33 ? 3 : frac < 0.66 ? 2 : 1;
    if (phase > this.bossPhase) {
      this.bossPhase = phase;
      if (phase === 2) game.message('THE WARDEN IS ANGRY - IT CALLS FOR BOMBERS!', '#ff6040');
      if (phase === 3) {
        game.message('THE WARDEN IS ENRAGED!', '#ff2020');
        this.speed *= 1.4;
        this.cooldownBase *= 0.6;
      }
      game.playAt('boss_roar', this.x, this.y, 1.2);
      game.shake(0.5);
    }
    if (this.bossPhase >= 2) {
      this.summonTimer -= dt;
      if (this.summonTimer <= 0) { this.summonTimer = 12; this.summonBombers(game); }
    }
    if (this.extraVolley > 0) {
      this.extraVolley -= dt;
      if (this.extraVolley <= 0) this.fireVolley(game);
    }
  }

  bossStrike(game, dist) {
    if (this.nextAttack === 'stomp') {
      // shockwave ring around its feet; only hurts if you're close
      for (let i = 0; i < 28; i++) {
        const a = i / 28 * Math.PI * 2;
        for (const d of [1, 2, 3]) {
          Effects.burst(this.x + Math.cos(a) * d, this.y + Math.sin(a) * d, 0.05, { count: 1, colors: ['#ffb040', '#c0c0c0'], speed: 1, up: 2.5, size: 0.05, life: 0.4 });
        }
      }
      Effects.addLight(this.x, this.y, [1, 0.6, 0.3], 4, 1.2, 0.3);
      game.playAt('stomp', this.x, this.y, 1.3);
      game.shake(0.7);
      if (dist < this.def.stompRange) game.player.hurt(Math.round(this.def.stompDamage * this.diff.damage), game);
      return;
    }
    this.fireVolley(game);
    if (this.bossPhase === 3) this.extraVolley = 0.35; // enraged: fires twice
  }

  fireVolley(game) {
    const p = game.player;
    const n = this.bossPhase === 3 ? 7 : 5;
    const base = Math.atan2(p.y - this.y, p.x - this.x);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.17 + (Math.random() - 0.5) * this.aimError;
      Effects.shootPlasma(this.x + Math.cos(a) * 0.7, this.y + Math.sin(a) * 0.7, a, this.def.projectileSpeed, this.damage);
    }
    game.playAt('plasma', this.x, this.y, 1.2);
  }

  summonBombers(game) {
    for (const side of [-1, 1]) {
      const a = Math.atan2(game.player.y - this.y, game.player.x - this.x) + side * 1.2;
      const x = this.x + Math.cos(a) * 1.2, y = this.y + Math.sin(a) * 1.2;
      if (Level.isBlocked(x, y)) continue;
      game.robots.push(new Robot('bomber', x, y, this.diff, true));
      Effects.burst(x, y, 0.4, { count: 14, colors: ['#ff6040', '#ffffff'], speed: 1.4, up: 2, size: 0.03, life: 0.5 });
    }
    game.playAt('spawn', this.x, this.y, 1);
  }

  // ---- phantom teleport ----
  startTeleport(game) {
    this.phase = 'out';
    this.phaseTimer = 0.35;
    this.teleportCooldown = 2.5 + Math.random() * 2.5;
    game.playAt('teleport', this.x, this.y, 0.8);
    this.teleportBurst();
  }

  updateTeleport(dt, game) {
    this.phaseTimer -= dt;
    if (this.phaseTimer > 0) return;
    if (this.phase === 'out') {
      this.relocate(game);
      this.phase = 'in';
      this.phaseTimer = 0.35;
      this.teleportBurst();
      game.playAt('teleport', this.x, this.y, 0.8);
    } else {
      this.phase = null;
      this.attackCooldown = Math.min(this.attackCooldown, 0.3); // strike soon after appearing
    }
  }

  // Try to reappear behind the player (or at least beside them), on open floor they could reach.
  relocate(game) {
    const p = game.player;
    for (let i = 0; i < 12; i++) {
      const spread = i < 6 ? 1.2 : 3.5;
      const a = p.angle + Math.PI + (Math.random() - 0.5) * spread;
      const d = 1.8 + Math.random() * 1.8;
      const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
      const r = this.def.radius;
      if (Level.isBlocked(x - r, y - r) || Level.isBlocked(x + r, y - r) || Level.isBlocked(x - r, y + r) || Level.isBlocked(x + r, y + r)) continue;
      if (!Level.hasLOS(p.x, p.y, x, y)) continue;
      this.x = x; this.y = y;
      return;
    }
  }

  teleportBurst() {
    Effects.burst(this.x, this.y, 0.5, { count: 14, colors: ['#c040ff', '#ff60f0', '#ffffff'], speed: 1.6, up: 1.5, size: 0.03, life: 0.45, gravity: 0 });
  }

  alert(game) {
    if (this.alerted) return;
    this.alerted = true;
    game.playAt('robot_alert', this.x, this.y, 0.7);
  }

  // explosive = barrels, bombers, electric floors (these ignore shields).
  // source = what did it ('ar', 'sniper', 'barrel#3', 'trap'...) so kills can be credited.
  hurt(amount, dirX, dirY, game, explosive = false, source = null) {
    if (!this.targetable) return;
    if (this.def.boss && source === 'bomber') return; // its own Bombers don't hurt it
    if (source) this.lastHit = source;
    if (this.state === 'spawning') this.state = 'active';
    if (this.def.shield && !explosive && this.windup <= 0 && this.shieldDown <= 0) {
      amount *= this.def.shield;
      game.playAt('shield_ping', this.x, this.y, 0.6, 0.06);
      Effects.burst(this.x - dirX * 0.35, this.y - dirY * 0.35, 0.5, { count: 4, colors: ['#60e0ff', '#ffffff'], speed: 1.5, up: 1, size: 0.03, life: 0.25 });
    }
    this.hp -= amount;
    if (game.settings.damageNumbers && amount >= 1) Effects.damageNumber(this, amount);
    this.flash = 0.1;
    this.alert(game);
    const push = (1 - this.def.knockResist) * Math.min(4, amount * 0.08);
    this.knockX += dirX * push;
    this.knockY += dirY * push;
    // big hits can interrupt (heavy robots shrug most of it off; bombers can't be stopped)
    if (!this.def.explodes && Math.random() < (amount / this.maxHp) * 2 * (1 - this.def.knockResist)) {
      this.pain = 0.18;
      this.windup = 0;
    }
    game.playAt('robot_hurt', this.x, this.y, 0.7, 0.05);
    if (this.hp <= 0) this.die(game);
  }

  die(game, selfDestruct = false) {
    this.state = 'dying';
    this.timer = 0.45;
    this.windup = 0;
    if (this.def.explodes) {
      // nothing left of a bomber: the blast is the whole show
      this.state = 'wreck';
      this.timer = 0;
      Blast.at(this.x, this.y, game, {
        radius: this.def.blastRadius, robotDamage: 120, playerDamage: this.damage, source: 'bomber',
        scale: 1.1, palette: Art.palettes[this.type],
      });
    } else {
      Effects.explode(this.x, this.y, this.def.height, Art.palettes[this.type]);
      game.playAt('robot_die', this.x, this.y, 1);
      game.shake(Math.max(0, 0.35 - Math.hypot(game.player.x - this.x, game.player.y - this.y) * 0.03));
    }
    if (!selfDestruct) game.onRobotKilled(this);
  }

  // What to draw this frame.
  sprite() {
    const frames = Art.sprites[this.type];
    let img, fade = 1, flash = this.flash > 0 ? 0.75 : 0;
    let z = this.def.z ? this.def.z + Math.sin(this.animTime * 5) * 0.03 : 0;
    const speed = this.type === 'fast' || this.type === 'mini' || this.type === 'bomber' ? 9 : 5;
    if (this.state === 'drain') {
      // glowing pink and sinking into the floor (the renderer hides what is below the floor)
      const k = 1 - this.timer / this.drainTotal;
      const glow = ((this.animTime * 10) | 0) & 1 ? 0xffa040ff : 0xffd080ff;
      return { x: this.x, y: this.y, z: -k * this.def.height, h: this.def.height, sprite: frames.walk0, mirror: this.mirror, outline: glow, sink: true };
    }
    if (this.state === 'spawning') { img = frames.walk0; fade = 1 - this.timer / 0.7; }
    else if (this.state === 'dying') { img = this.timer > 0.22 ? frames.die0 : frames.die1; z = 0; }
    else if (this.state === 'wreck') { img = frames.wreck; fade = Math.min(1, this.timer / 1.5); z = 0; }
    else if (this.windup > 0 || this.shieldDown > 0) img = frames.attack;
    else img = ((this.animTime * speed) | 0) & 1 ? frames.walk1 : frames.walk0;
    if (this.leap) img = frames.attack;
    if (this.alive) z += this.jumpZ;

    if (this.def.teleport && this.alive) {
      // ghostly flicker, fading out/in while teleporting
      fade = 0.6 + 0.3 * Math.abs(Math.sin(this.animTime * 7));
      if (this.phase === 'out') fade *= this.phaseTimer / 0.35;
      if (this.phase === 'in') fade *= 1 - this.phaseTimer / 0.35;
    }
    if (this.def.explodes && this.windup > 0 && ((this.animTime * 12) | 0) % 2) flash = 0.7; // about to blow
    const outline = this.elite && this.state !== 'wreck' ? this.elite.outline : 0;
    return { x: this.x, y: this.y, z, h: this.def.height, sprite: img, flash, fade, mirror: this.mirror, outline };
  }
}
