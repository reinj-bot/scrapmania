'use strict';
// Short-lived visual stuff: sparks, debris, explosions, plasma bolts and flashes of light.

const Effects = {
  particles: [],
  explosions: [],
  projectiles: [],
  lights: [],
  numbers: [],      // floating damage numbers

  reset() {
    this.particles = [];
    this.explosions = [];
    this.projectiles = [];
    this.numbers = [];
    this.lights = [];
  },

  color(hex) {
    const [r, g, b] = Art.hexToRgb(hex);
    return Art.rgb(r, g, b);
  },

  // Burst of little squares. o: {count, colors, speed, up, size, life, gravity, bright}
  burst(x, y, z, o) {
    const cols = o.colors.map(c => this.color(c));
    for (let i = 0; i < o.count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (0.3 + Math.random() * 0.7) * o.speed;
      const life = o.life * (0.6 + Math.random() * 0.6);
      this.particles.push({
        x, y, z,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        vz: (o.up || 0) * (0.4 + Math.random() * 0.8),
        life, maxLife: life,
        color: cols[(Math.random() * cols.length) | 0],
        size: o.size * (0.6 + Math.random() * 0.8),
        gravity: o.gravity === undefined ? 9 : o.gravity,
        bright: o.bright !== false,
      });
    }
    if (this.particles.length > 600) this.particles.splice(0, this.particles.length - 600);
  },

  sparks(x, y, z, count = 6) {
    this.burst(x, y, z, { count, colors: ['#ffe070', '#ffffff', '#ffa020'], speed: 2.5, up: 2.5, size: 0.03, life: 0.35 });
  },

  dust(x, y, z) {
    this.burst(x, y, z, { count: 4, colors: ['#8a8a8a', '#5a5a5a'], speed: 0.8, up: 0.8, size: 0.04, life: 0.4, gravity: 2, bright: false });
  },

  // Robot destroyed: fireball, flying scrap in the robot's colors, sparks, a flash of light.
  explode(x, y, scale, palette) {
    this.explosions.push({ x, y, t: 0, dur: 0.55, scale });
    this.burst(x, y, 0.5 * scale, { count: 14, colors: [palette.body, palette.dark, palette.light, palette.joint], speed: 3.2, up: 4, size: 0.07 * scale, life: 1.2, bright: false });
    this.burst(x, y, 0.5 * scale, { count: 16, colors: ['#ffe070', '#ffffff', '#ff8020'], speed: 4, up: 3, size: 0.035, life: 0.5 });
    this.burst(x, y, 0.4, { count: 8, colors: ['#3a3330', '#4a4440'], speed: 0.7, up: 1.2, size: 0.12, life: 1.2, gravity: -0.4, bright: false });
    this.addLight(x, y, [1, 0.6, 0.25], 5 * scale, 1.6, 0.45);
  },

  // Hits on the same robot close together add up into one number (shotgun pellets, flames).
  damageNumber(robot, amount) {
    const n = this.numbers.find(m => m.robot === robot && m.t < 0.12);
    if (n) { n.amount += amount; return; }
    this.numbers.push({ robot, x: robot.x, y: robot.y, z: robot.def.height * 0.9 + (robot.def.z || 0), amount, t: 0 });
    if (this.numbers.length > 30) this.numbers.shift();
  },

  // Screen position of a point in the world (x, y, height z), or null if behind you or a wall.
  project(cam, x, y, z) {
    const W = CONFIG.WIDTH, VH = CONFIG.VIEW_H;
    const dirX = Math.cos(cam.angle), dirY = Math.sin(cam.angle);
    const proj = (W / 2) / Math.tan(cam.fov / 2), horizon = VH / 2 + (cam.horizonShift || 0);
    const dx = x - cam.x, dy = y - cam.y;
    const depth = dx * dirX + dy * dirY;
    if (depth < 0.3) return null;
    const sx = Math.round(W / 2 + (-dx * dirY + dy * dirX) / depth * proj);
    if (sx < 0 || sx >= W || Renderer.zbuf[sx] < depth - 0.2) return null;
    return { sx, sy: Math.round(horizon - (z - CONFIG.EYE) / depth * proj), depth };
  },

  // Drawn on top of the 3D view, hidden behind walls.
  drawNumbers(ctx, cam) {
    for (const n of this.numbers) {
      const at = this.project(cam, n.x, n.y, n.z + n.t * 0.5);
      if (!at) continue;
      const sx = at.sx, sy = at.sy;
      const big = n.amount >= 100;
      ctx.globalAlpha = Math.max(0, 1 - n.t / 0.8);
      Font.draw(ctx, String(Math.round(n.amount)), sx, sy, big ? '#ff9040' : '#ffe070', big ? 2 : 1, 'center');
      ctx.globalAlpha = 1;
    }
  },

  addLight(x, y, c, radius, intensity, life) {
    this.lights.push({ x, y, c, radius, intensity, life, maxLife: life });
  },

  shootPlasma(x, y, angle, speed, damage, owner = null) {
    this.projectiles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, damage, life: 4, t: 0, owner });
  },

  update(dt, game) {
    for (const p of this.particles) {
      p.life -= dt;
      const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
      if (Level.isWallTile(Math.floor(nx), Math.floor(ny))) { p.vx *= -0.3; p.vy *= -0.3; }
      else { p.x = nx; p.y = ny; }
      p.vz -= p.gravity * dt;
      p.z += p.vz * dt;
      if (p.z < 0.01) { p.z = 0.01; p.vz *= -0.35; p.vx *= 0.6; p.vy *= 0.6; }
      if (p.z > 0.98) { p.z = 0.98; p.vz = -Math.abs(p.vz) * 0.3; }
    }
    this.particles = this.particles.filter(p => p.life > 0);

    for (const e of this.explosions) e.t += dt;
    this.explosions = this.explosions.filter(e => e.t < e.dur);

    for (const n of this.numbers) n.t += dt;
    this.numbers = this.numbers.filter(n => n.t < 0.8);
    for (const l of this.lights) l.life -= dt;
    this.lights = this.lights.filter(l => l.life > 0);

    const pl = game.player;
    for (const b of this.projectiles) {
      b.life -= dt; b.t += dt;
      // a few sub-steps so fast bolts can't skip through the player or thin walls
      for (let s = 0; s < 3 && b.life > 0; s++) {
        b.x += b.vx * dt / 3; b.y += b.vy * dt / 3;
        const barrel = Barrels.near(b.x, b.y, 0.4);
        if (barrel) { b.life = 0; Barrels.ignite(barrel); break; } // robots can blow up barrels too
        if (Level.blocksShot(Math.floor(b.x), Math.floor(b.y))) {
          b.life = 0;
          this.burst(b.x - b.vx * 0.01, b.y - b.vy * 0.01, 0.5, { count: 8, colors: ['#ff50d0', '#ffffff'], speed: 2, up: 1.5, size: 0.03, life: 0.3 });
          this.addLight(b.x, b.y, [1, 0.3, 0.9], 2.5, 0.8, 0.15);
          game.playAt('impact', b.x, b.y, 0.6);
        } else if (pl.alive && Math.hypot(b.x - pl.x, b.y - pl.y) < 0.35) {
          b.life = 0;
          pl.hurt(b.damage, game, b.owner);
          this.burst(b.x, b.y, 0.5, { count: 8, colors: ['#ff50d0', '#ffffff'], speed: 2, up: 1.5, size: 0.03, life: 0.3 });
        }
      }
    }
    this.projectiles = this.projectiles.filter(b => b.life > 0);
  },

  // Lights for this frame: temporary flashes + one glow per plasma bolt.
  frameLights() {
    const out = this.lights.map(l => ({ x: l.x, y: l.y, c: l.c, radius: l.radius, intensity: l.intensity * (l.life / l.maxLife) }));
    for (const b of this.projectiles) out.push({ x: b.x, y: b.y, c: [1, 0.3, 0.9], radius: 2.2, intensity: 0.7 });
    return out;
  },

  addSprites(list) {
    for (const p of this.particles) list.push(p);
    for (const e of this.explosions) {
      const frames = Art.sprites.explosion;
      const f = Math.min(frames.length - 1, Math.floor(e.t / e.dur * frames.length));
      list.push({ x: e.x, y: e.y, z: 0, h: 1.3 * e.scale, sprite: frames[f], bright: true });
    }
    for (const b of this.projectiles) {
      list.push({ x: b.x, y: b.y, z: 0.42, h: 0.18, sprite: Art.sprites.plasma[((b.t * 12) | 0) & 1], bright: true });
    }
  },
};
