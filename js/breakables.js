'use strict';
// Things you can shoot apart (besides light panels and screens on walls):
//  - crate: splinters, sometimes leaves ammo or a medkit
//  - gas canister: small blue explosion (hurts robots - and you, up close)
//  - pipe: bursts and sprays hot steam for a few seconds (burns robots that walk through it)
// Bullets, rockets, plasma, flames and explosions all count. Crates and canisters come back
// after a while (out of sight); pipes stay broken for the rest of the game.

const BREAKABLES = {
  crate: { hp: 30, count: 9, radius: 0.3, height: 0.55, restock: 60 },
  canister: { hp: 12, count: 5, radius: 0.22, height: 0.6, restock: 50, blast: { radius: 1.8, robotDamage: 90, playerDamage: 25 } },
  pipe: { hp: 40, radius: 0.25, height: 1, steamTime: 5, steamDps: 45 },
};

const Breakables = {
  list: [],
  HIT_RADIUS: 0.3,

  init() {
    // map pipes become breakable; crates and canisters are placed on open floor
    this.list = Level.props.filter(p => p.kind === 'pipe').map(p => this.make('pipe', p.x, p.y));
    Level.props = Level.props.filter(p => p.kind !== 'pipe');
    const avoid = Gadgets.list.map(g => ({ x: g.x, y: g.y }));
    const spots = Spots.pick(BREAKABLES.crate.count + BREAKABLES.canister.count, { nearWall: true, minGap: 4, seed: 'breakables', avoid });
    spots.forEach((s, i) => this.list.push(this.make(i % 3 === 2 ? 'canister' : 'crate', s.x, s.y)));
  },

  make(kind, x, y) {
    return { kind, x, y, hp: BREAKABLES[kind].hp, alive: true, timer: 0, steam: 0 };
  },

  // Is something breakable on this bullet's path before `maxAlong`? (used by Game.hitscan)
  onLine(px, py, dx, dy, maxAlong) {
    let best = null, bestAlong = maxAlong;
    for (const b of this.list) {
      if (!b.alive) continue;
      const ex = b.x - px, ey = b.y - py, along = ex * dx + ey * dy;
      if (along <= 0 || along >= bestAlong) continue;
      if (Math.abs(ex * dy - ey * dx) >= BREAKABLES[b.kind].radius) continue;
      best = b; bestAlong = along;
    }
    return best ? { b: best, along: bestAlong } : null;
  },

  near(x, y, r) {
    return this.list.find(b => b.alive && Math.hypot(b.x - x, b.y - y) < r + BREAKABLES[b.kind].radius);
  },

  hit(b, damage, game) {
    if (!b.alive) return;
    b.hp -= damage;
    Effects.sparks(b.x, b.y, BREAKABLES[b.kind].height * 0.6, 3);
    if (b.hp <= 0) this.smash(b, game);
  },

  // Explosions break everything around them.
  blast(x, y, radius, game) {
    for (const b of this.list) {
      if (b.alive && Math.hypot(b.x - x, b.y - y) < radius) this.hit(b, 999, game);
    }
  },

  smash(b, game) {
    b.alive = false;
    b.timer = BREAKABLES[b.kind].restock || 0;
    if (game.run) game.run.broken++;
    if (b.kind === 'crate') {
      Effects.burst(b.x, b.y, 0.3, { count: 16, colors: ['#9a6a3a', '#6a4422', '#c08a50'], speed: 2.5, up: 2.5, size: 0.05, life: 0.9, bright: false });
      game.playAt('glass', b.x, b.y, 0.6);
      const roll = Math.random();
      const type = roll < 0.35 ? 'ammo' : roll < 0.5 && !game.mods.includes('nomeds') ? 'health' : null;
      if (type) game.pickups.push({ x: b.x, y: b.y, type, spot: -1, taken: false, life: 25 });
    } else if (b.kind === 'canister') {
      const o = BREAKABLES.canister.blast;
      Blast.at(b.x, b.y, game, { ...o, scale: 0.8, palette: Art.palettes.canister, source: 'canister' });
    } else {
      b.steam = BREAKABLES.pipe.steamTime;
      game.playAt('zap', b.x, b.y, 0.6);
      Effects.burst(b.x, b.y, 0.6, { count: 10, colors: ['#8a8f98', '#5a3e2e', '#c0c0c0'], speed: 2, up: 2, size: 0.04, life: 0.6, bright: false });
    }
  },

  update(dt, game) {
    const p = game.player;
    for (const b of this.list) {
      if (b.steam > 0) {
        b.steam -= dt;
        if (Math.random() < dt * 30) {
          Effects.burst(b.x, b.y, 0.5 + Math.random() * 0.3, { count: 1, colors: ['#e8eef4', '#c8d0d8', '#ffffff'], speed: 1.2, up: 1.5, size: 0.08, life: 0.7, gravity: -1.5, bright: false });
        }
        // the steam burns anything standing in it
        const dps = BREAKABLES.pipe.steamDps * dt;
        for (const r of game.robots) {
          if (r.targetable && Math.hypot(r.x - b.x, r.y - b.y) < 1.1) r.hurt(dps, 0, 0, game, true, 'steam');
        }
        if (Math.hypot(p.x - b.x, p.y - b.y) < 0.9 && Math.random() < dt * 4) p.hurt(4, game);
      }
      if (b.alive || b.kind === 'pipe') continue;
      b.timer -= dt;
      if (b.timer > 0) continue;
      // come back only where the player can't see it happen
      if (Math.hypot(p.x - b.x, p.y - b.y) > 7 || !Level.hasLOS(p.x, p.y, b.x, b.y)) {
        b.alive = true; b.hp = BREAKABLES[b.kind].hp;
      } else b.timer = 3;
    }
  },

  addSprites(list) {
    for (const b of this.list) {
      const def = BREAKABLES[b.kind];
      if (b.alive) list.push({ x: b.x, y: b.y, z: 0, h: def.height, sprite: Art.sprites[b.kind] });
      else if (b.kind === 'pipe') list.push({ x: b.x, y: b.y, z: 0, h: def.height, sprite: Art.sprites.pipeBroken });
    }
  },
};
