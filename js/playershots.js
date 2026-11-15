'use strict';
// The player's flying shots: rockets (explode) and plasma bolts (go through shields),
// plus the flamethrower's short cone of fire. The other guns hit instantly (Game.hitscan).

const PlayerShots = {
  list: [],

  reset() { this.list = []; },

  // A rocket or plasma bolt leaving the gun.
  fire(game, def, angle, damage) {
    const p = game.player;
    const x = p.x + Math.cos(angle) * 0.35, y = p.y + Math.sin(angle) * 0.35;
    this.list.push({
      kind: def.projectile, x, y, vx: Math.cos(angle) * def.speed, vy: Math.sin(angle) * def.speed,
      damage, radius: def.radius || 0, src: def.id, life: def.projectile === 'tesla' ? def.range / def.speed : 3, t: 0, def,
    });
  },

  // Flamethrower: burns every robot (and barrel) in a short cone in front of you.
  flame(game, def, angle, damage) {
    const p = game.player;
    let hit = false;
    const inCone = (x, y) => {
      const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy);
      if (d > def.range) return false;
      let da = Math.atan2(dy, dx) - angle;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      return Math.abs(da) < def.cone + 0.25 / Math.max(d, 0.5) && Level.hasLOS(p.x, p.y, x, y);
    };
    for (const r of game.robots) {
      if (!r.targetable || !inCone(r.x, r.y)) continue;
      const d = Math.hypot(r.x - p.x, r.y - p.y) || 1;
      r.hurt(damage, (r.x - p.x) / d * 0.3, (r.y - p.y) / d * 0.3, game, false, def.id);
      hit = true;
    }
    for (const b of Barrels.list) if (b.alive && inCone(b.x, b.y)) Barrels.ignite(b, 0.3);
    for (const b of Breakables.list) if (b.alive && inCone(b.x, b.y)) Breakables.hit(b, damage, game);
    // the fire itself: particles thrown forward with a little spread
    const cols = ['#ffe070', '#ff9a20', '#ff5010', '#ffffff'].map(c => Effects.color(c));
    for (let i = 0; i < 4; i++) {
      const a = angle + (Math.random() - 0.5) * def.cone * 1.6, sp = 5 + Math.random() * 3;
      const life = 0.35 + Math.random() * 0.25;
      Effects.particles.push({
        // start a step ahead and small, so the fire doesn't cover the screen
        x: p.x + Math.cos(angle) * 1.1, y: p.y + Math.sin(angle) * 1.1, z: 0.36 + Math.random() * 0.08,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 0.3 + Math.random() * 0.5,
        life, maxLife: life, color: cols[(Math.random() * cols.length) | 0],
        size: 0.03 + Math.random() * 0.04, gravity: -0.5, bright: true,
      });
    }
    Effects.addLight(p.x + Math.cos(angle) * 1.5, p.y + Math.sin(angle) * 1.5, [1, 0.55, 0.2], 3.5, 1, 0.08);
    return hit;
  },

  throwGrenade(game, angle) {
    const p = game.player, G = CONFIG.GRENADE;
    this.list.push({
      kind: 'grenade', x: p.x + Math.cos(angle) * 0.3, y: p.y + Math.sin(angle) * 0.3, z: 0.45,
      vx: Math.cos(angle) * G.speed, vy: Math.sin(angle) * G.speed, vz: G.up, life: G.fuse, t: 0, src: 'grenade',
    });
  },

  updateGrenade(g, dt, game) {
    const G = CONFIG.GRENADE;
    for (let s = 0; s < 4; s++) {
      const step = dt / 4;
      const nx = g.x + g.vx * step, ny = g.y + g.vy * step;
      // bounce off walls one direction at a time
      if (Level.blocksShot(Math.floor(nx), Math.floor(g.y))) { g.vx = -g.vx * 0.55; if (Math.abs(g.vx) > 1) game.playAt('clink', g.x, g.y, 0.5, 0.05); }
      else g.x = nx;
      if (Level.blocksShot(Math.floor(g.x), Math.floor(ny))) { g.vy = -g.vy * 0.55; if (Math.abs(g.vy) > 1) game.playAt('clink', g.x, g.y, 0.5, 0.05); }
      else g.y = ny;
      g.vz -= 9 * step;
      g.z += g.vz * step;
      if (g.z < 0.06) { // hits the floor: bounce lower each time, then roll
        g.z = 0.06;
        if (g.vz < -1.2) game.playAt('clink', g.x, g.y, 0.4, 0.05);
        g.vz = -g.vz * 0.38;
        g.vx *= 0.65; g.vy *= 0.65;
      }
    }
    g.life -= dt; g.t += dt;
    if (g.life <= 0) {
      Blast.at(g.x, g.y, game, { radius: G.radius, robotDamage: G.robotDamage, playerDamage: G.playerDamage, scale: 1.3, palette: Art.palettes.barrel, source: 'grenade' });
    }
  },

  update(dt, game) {
    for (const g of this.list) if (g.kind === 'grenade') this.updateGrenade(g, dt, game);
    for (const b of this.list) {
      if (b.kind === 'grenade') continue;
      b.life -= dt; b.t += dt;
      if (b.kind === 'tesla' && Math.random() < 0.8) { // crackling sparks around the ball
        Effects.burst(b.x, b.y, 0.4, { count: 1, colors: ['#c0f4ff', '#60c8ff', '#ffffff'], speed: 1.4, up: 0.8, size: 0.025, life: 0.2, gravity: 0 });
      }
      if (b.kind === 'rocket' && Math.random() < 0.7) {
        Effects.burst(b.x - b.vx * 0.03, b.y - b.vy * 0.03, 0.42, { count: 1, colors: ['#c0c0c0', '#808080', '#ffb040'], speed: 0.3, up: 0.3, size: 0.06, life: 0.5, gravity: -0.3 });
      }
      for (let s = 0; s < 4 && b.life > 0; s++) {
        b.x += b.vx * dt / 4; b.y += b.vy * dt / 4;
        const barrel = Barrels.near(b.x, b.y, 0.4);
        const robot = game.robots.find(r => r.targetable && Math.hypot(r.x - b.x, r.y - b.y) < r.def.radius + 0.1);
        const wall = Level.blocksShot(Math.floor(b.x), Math.floor(b.y));
        const brk = Breakables.near(b.x, b.y, 0.1);
        if (!barrel && !robot && !wall && !brk) continue;
        if (brk && b.kind === 'plasma') Breakables.hit(brk, b.damage, game);
        this.hit(b, game, robot, barrel, wall || !!brk);
        b.life = 0;
      }
      if (b.life <= 0 && b.kind === 'rocket' && !b.done) this.explode(b, game); // ran out of fuel
    }
    this.list = this.list.filter(b => b.life > 0);
  },

  hit(b, game, robot, barrel, wall) {
    if (b.kind === 'rocket') { this.explode(b, game); return; }
    if (b.kind === 'tesla') { this.teslaHit(b, game, robot, barrel); return; }
    // plasma bolt: passes through shields, sparks on walls
    if (barrel) Barrels.ignite(barrel);
    if (robot) {
      const d = Math.hypot(b.vx, b.vy) || 1;
      robot.hurt(b.damage, b.vx / d, b.vy / d, game, true, b.src);
      game.hitMarker = 0.12;
    }
    const bx = b.x - b.vx * 0.01, by = b.y - b.vy * 0.01;
    Effects.burst(bx, by, 0.45, { count: 7, colors: ['#40e0ff', '#ffffff', '#2080ff'], speed: 2, up: 1.5, size: 0.03, life: 0.3 });
    Effects.addLight(bx, by, [0.3, 0.8, 1], 2.5, 0.8, 0.15);
    if (wall) {
      game.playAt('impact', bx, by, 0.4);
      // a scorch mark where the bolt hit
      const len = Math.hypot(b.vx, b.vy) || 1, dx = b.vx / len, dy = b.vy / len;
      const back = b.x - dx * 0.5, backY = b.y - dy * 0.5;
      const w = Level.castRay(back, backY, dx, dy, 1.2);
      if (w.tile) Level.damageWall(w, dx, dy, back + dx * w.dist, backY + dy * w.dist, 0.42, 'scorch');
    }
  },

  // Tesla Cannon: zap what the ball hit, then the lightning jumps from robot to robot.
  // If it hits a wall, it still jumps to a robot close to where it hit.
  teslaHit(b, game, robot, barrel) {
    const def = b.def, d = Math.hypot(b.vx, b.vy) || 1;
    const x = b.x - b.vx / d * 0.15, y = b.y - b.vy / d * 0.15;
    if (barrel) Barrels.ignite(barrel);
    const hitList = [];
    let from = { x, y, z: 0.4 }, dmg = b.damage, target = robot;
    if (!target) target = this.nearestRobot(game, x, y, def.jump * 0.7, hitList);
    for (let n = 0; target && n <= def.chain; n++) {
      hitList.push(target);
      this.bolt(from, { x: target.x, y: target.y, z: target.def.height * 0.55 });
      const dx = target.x - from.x, dy = target.y - from.y, dl = Math.hypot(dx, dy) || 1;
      target.hurt(dmg, dx / dl, dy / dl, game, true, b.src);
      Effects.addLight(target.x, target.y, [0.5, 0.85, 1], 3, 1.4, 0.18);
      from = { x: target.x, y: target.y, z: target.def.height * 0.55 };
      dmg *= def.chainFalloff;
      target = this.nearestRobot(game, target.x, target.y, def.jump, hitList);
    }
    if (hitList.length) game.hitMarker = 0.12;
    Effects.burst(x, y, 0.45, { count: 14, colors: ['#ffffff', '#60e0ff', '#a070ff'], speed: 2.5, up: 1.5, size: 0.03, life: 0.35 });
    Effects.addLight(x, y, [0.5, 0.85, 1], 3.5, 1.6, 0.2);
    game.playAt('zap', x, y, 0.9, 0.04);
  },

  nearestRobot(game, x, y, range, skip) {
    let best = null, bd = range;
    for (const r of game.robots) {
      if (!r.targetable || skip.includes(r)) continue;
      const dd = Math.hypot(r.x - x, r.y - y);
      if (dd < bd) { bd = dd; best = r; }
    }
    return best;
  },

  // A jagged line of bright sparks between two points (the lightning).
  bolt(a, b) {
    const len = Math.hypot(b.x - a.x, b.y - a.y), steps = Math.max(3, Math.ceil(len * 5));
    const nx = -(b.y - a.y) / (len || 1), ny = (b.x - a.x) / (len || 1);
    for (let i = 0; i <= steps; i++) {
      const k = i / steps, j = (i === 0 || i === steps) ? 0 : (Math.random() - 0.5) * 0.35;
      Effects.burst(a.x + (b.x - a.x) * k + nx * j, a.y + (b.y - a.y) * k + ny * j, a.z + (b.z - a.z) * k + (Math.random() - 0.5) * 0.15,
        { count: 1, colors: i % 3 ? ['#c0f4ff', '#ffffff'] : ['#a070ff'], speed: 0, up: 0, size: 0.035, life: 0.16, gravity: 0 });
    }
  },

  explode(b, game) {
    b.done = true;
    const x = b.x - b.vx * 0.02, y = b.y - b.vy * 0.02; // just in front of what it hit
    Blast.at(x, y, game, { radius: b.radius, robotDamage: b.damage, playerDamage: 35, scale: 1.2, palette: Art.palettes.barrel, source: b.src });
  },

  lights() {
    return this.list.filter(b => b.kind !== 'grenade').map(b => b.kind === 'rocket'
      ? { x: b.x, y: b.y, c: [1, 0.6, 0.25], radius: 2.5, intensity: 0.9 }
      : b.kind === 'tesla' ? { x: b.x, y: b.y, c: [0.55, 0.8, 1], radius: 3.2, intensity: 1.3 }
        : { x: b.x, y: b.y, c: [0.3, 0.8, 1], radius: 2.2, intensity: 0.8 });
  },

  addSprites(list) {
    for (const b of this.list) {
      if (b.kind === 'grenade') {
        // blinks faster as it is about to go off
        const blink = b.life < 0.6 ? ((b.t * 16) | 0) & 1 : ((b.t * 5) | 0) & 1;
        list.push({ x: b.x, y: b.y, z: b.z - 0.06, h: 0.13, sprite: Art.sprites.grenade[blink], bright: !!blink });
        continue;
      }
      const sprite = b.kind === 'rocket' ? Art.sprites.rocket : b.kind === 'tesla' ? Art.sprites.tball[((b.t * 14) | 0) % 3] : Art.sprites.pbolt[((b.t * 12) | 0) & 1];
      list.push({ x: b.x, y: b.y, z: b.kind === 'tesla' ? 0.33 : 0.4, h: b.kind === 'rocket' ? 0.2 : b.kind === 'tesla' ? 0.3 : 0.16, sprite, bright: true });
    }
  },
};
