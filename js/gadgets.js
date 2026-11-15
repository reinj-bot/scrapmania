'use strict';
// Things on the map you use with E:
//  - turret: stand next to it for 3 seconds to hack it, then it shoots robots for a minute
//  - health station / ammo station: a refill, then a recharge wait
//  - alarm button: every robot on the map runs to it for 10 seconds
// They are placed automatically (same spots every game on a map): against a wall, spread out,
// reachable from the start.

const GADGETS = {
  turret: { count: 3, use: 'HACK TURRET', hack: 3, active: 60, recharge: 45, range: 12, fireDelay: 0.22, damage: 16 },
  health: { count: 2, use: 'USE HEALTH STATION', amount: 40, recharge: 60 },
  ammo: { count: 2, use: 'USE AMMO STATION', recharge: 45 },
  alarm: { count: 2, use: 'PRESS ALARM BUTTON', lure: 10, recharge: 40 },
};

const Gadgets = {
  list: [],

  init() {
    this.list = [];
    const kinds = Object.keys(GADGETS);
    const total = kinds.reduce((n, k) => n + GADGETS[k].count, 0);
    const spots = Spots.pick(total, { nearWall: true, minGap: 6, seed: 'gadgets' });
    let i = 0;
    for (const kind of kinds) {
      for (let n = 0; n < GADGETS[kind].count && i < spots.length; n++, i++) {
        this.list.push({ kind, x: spots[i].x, y: spots[i].y, state: 'ready', timer: 0, progress: 0, fireTimer: 0 });
      }
    }
  },

  // ---------- every frame ----------
  update(dt, game) {
    const p = game.player;
    for (const g of this.list) {
      const def = GADGETS[g.kind];
      if (g.state === 'recharge' && (g.timer -= dt) <= 0) g.state = 'ready';
      if (g.kind === 'turret') this.updateTurret(g, def, dt, game);
    }
    if (game.lure && (game.lure.time -= dt) <= 0) { game.lure = null; Level.flowFrom = -1; }

    // the gadget you're standing at (only if no switch is asking for E already)
    if (game.usePrompt) return;
    let near = null, nd = 1.5;
    for (const g of this.list) {
      const d = Math.hypot(g.x - p.x, g.y - p.y);
      if (d < nd) { nd = d; near = g; }
    }
    if (!near) return;
    const def = GADGETS[near.kind], key = Controls.pad.active ? 'A' : Controls.name('use');
    if (near.state === 'hacking') { game.usePrompt = 'HACKING... ' + Math.floor(near.progress / def.hack * 100) + '% - STAY CLOSE'; return; }
    if (near.state === 'active') { game.usePrompt = 'TURRET ONLINE: ' + Math.ceil(near.timer) + 'S'; return; }
    if (near.state === 'recharge') { game.usePrompt = 'RECHARGING: ' + Math.ceil(near.timer) + 'S'; return; }
    if (near.kind === 'health' && game.mods.includes('nomeds')) { game.usePrompt = 'OFFLINE (NO MEDKITS CHALLENGE)'; return; }
    game.usePrompt = 'PRESS ' + key + ' TO ' + def.use;
    if (Controls.pressed('use') || Controls.padPressed(PAD.A)) this.use(near, def, game);
  },

  use(g, def, game) {
    const p = game.player;
    if (g.kind === 'turret') {
      g.state = 'hacking'; g.progress = 0;
      Sound.play('switch_on');
      game.message('HACKING THE TURRET - STAY CLOSE FOR ' + def.hack + ' SECONDS', '#40e0ff');
    } else if (g.kind === 'health') {
      if (p.hp >= CONFIG.PLAYER_MAX_HP) { game.message('HEALTH ALREADY FULL', '#a0a8b0'); return; }
      p.hp = Math.min(CONFIG.PLAYER_MAX_HP, p.hp + def.amount);
      game.run.medkits++; // counts as a medkit (achievements)
      if (game.boss && game.boss.alive) game.run.bossMeds = (game.run.bossMeds || 0) + 1;
      this.recharge(g, def);
      Sound.play('pickup_health');
      game.message('+' + def.amount + ' HEALTH', '#60ff80');
      game.flashScreen('#60ff80', 0.15);
    } else if (g.kind === 'ammo') {
      const nade = game.weapons.addGrenade();
      if (!game.weapons.addAmmoPack() && !nade) { game.message('AMMO ALREADY FULL', '#a0a8b0'); return; }
      game.weapons.addAmmoPack();
      this.recharge(g, def);
      Sound.play('pickup_ammo');
      game.message('AMMO REFILLED', '#ffd040');
    } else if (g.kind === 'alarm') {
      game.lure = { x: g.x, y: g.y, time: def.lure };
      Level.flowFrom = -1;
      for (const r of game.robots) if (r.alive && !r.alerted) r.alert(game);
      this.recharge(g, def);
      game.playAt('boss_alarm', g.x, g.y, 1);
      game.message('ALARM! EVERY ROBOT IS HEADING FOR THE BUTTON', '#ff6040');
    }
  },

  recharge(g, def) { g.state = 'recharge'; g.timer = def.recharge; },

  updateTurret(g, def, dt, game) {
    const p = game.player;
    if (g.state === 'hacking') {
      if (Math.hypot(g.x - p.x, g.y - p.y) > 2.2) {
        g.state = 'ready';
        game.message('HACK CANCELLED - YOU MOVED AWAY', '#ff6040');
        return;
      }
      g.progress += dt;
      if (g.progress >= def.hack) {
        g.state = 'active'; g.timer = def.active;
        Sound.play('achievement', 0.6);
        game.message('TURRET HACKED - IT FIGHTS FOR YOU NOW', '#40e0ff');
      }
      return;
    }
    if (g.state !== 'active') return;
    g.timer -= dt;
    if (g.timer <= 0) { this.recharge(g, def); game.message('TURRET OFFLINE - RECHARGING', '#a0a8b0'); return; }
    g.fireTimer -= dt;
    if (g.fireTimer > 0) return;
    // nearest robot it can see
    let target = null, td = def.range;
    for (const r of game.robots) {
      if (!r.targetable) continue;
      const d = Math.hypot(r.x - g.x, r.y - g.y);
      if (d < td && Level.hasLOS(g.x, g.y, r.x, r.y)) { td = d; target = r; }
    }
    if (!target) return;
    g.fireTimer = def.fireDelay;
    g.aim = Math.atan2(target.y - g.y, target.x - g.x);
    const d = td || 1;
    target.hurt(def.damage * game.dmgMult, (target.x - g.x) / d, (target.y - g.y) / d, game, false, 'turret');
    Effects.sparks(target.x, target.y, target.def.height * 0.6, 3);
    Effects.addLight(g.x, g.y, [0.4, 0.9, 1], 3, 1, 0.06);
    // a short tracer line of sparks along the shot
    for (let k = 1; k < 4; k++) {
      const t = k / 4;
      Effects.burst(g.x + (target.x - g.x) * t, g.y + (target.y - g.y) * t, 0.55, { count: 1, colors: ['#c0f4ff'], speed: 0.1, up: 0, size: 0.025, life: 0.08, gravity: 0 });
    }
    game.playAt('smg', g.x, g.y, 0.5, 0.05);
  },

  // ---------- drawing ----------
  addSprites(list, time) {
    for (const g of this.list) {
      let sprite;
      if (g.kind === 'turret') sprite = Art.sprites.turret[g.state === 'active' ? 1 : g.state === 'hacking' ? (((time * 6) | 0) & 1) : g.state === 'recharge' ? 2 : 0];
      else sprite = Art.sprites[g.kind + 'Station'][g.state === 'recharge' ? 1 : 0];
      list.push({ x: g.x, y: g.y, z: 0, h: g.kind === 'turret' ? 0.75 : 0.85, sprite, bright: g.state !== 'recharge' });
    }
  },

  lights(time) {
    const out = [];
    for (const g of this.list) {
      if (g.state === 'recharge') continue;
      const c = g.kind === 'health' ? [0.3, 1, 0.4] : g.kind === 'ammo' ? [1, 0.85, 0.3] : g.kind === 'alarm' ? [1, 0.2, 0.15]
        : g.state === 'active' ? [0.3, 0.9, 1] : [1, 0.3, 0.2];
      out.push({ x: g.x, y: g.y, c, radius: 2.5, intensity: 0.55 + Math.sin(time * 3 + g.x) * 0.1 });
    }
    return out;
  },
};

// Shared helper: good spots on the current map, the same ones every game (seeded by map + name).
const Spots = {
  // n spots on reachable open floor; nearWall = touching a wall; minGap = tiles between spots.
  pick(n, { nearWall = false, minGap = 5, seed = 'x', avoid = [] } = {}) {
    const W = Level.W, H = Level.H;
    let h = 2166136261;
    for (const ch of Level.mapId + seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    const rand = () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
    const start = Level.playerStart, startI = Math.floor(start.y) * W + Math.floor(start.x);
    const seen = new Uint8Array(W * H), queue = [startI];
    seen[startI] = 1;
    const walkable = (x, y) => {
      if (!Level.isBlocked(x + 0.5, y + 0.5)) return true;
      const d = Level.doorAt[y * W + x];
      return !!d && !d.group.locked;
    };
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q], x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, j = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[j] || !walkable(nx, ny)) continue;
        seen[j] = 1;
        queue.push(j);
      }
    }
    const taken = avoid.slice();
    for (const s of Level.pickupSpots) taken.push(s);
    for (const s of Level.enemySpawns) taken.push(s);
    for (const b of Barrels.list) taken.push(b);
    for (const s of Switches.list) taken.push({ x: s.x + 0.5, y: s.y + 0.5 });
    taken.push(start);
    const cands = queue.filter(i => {
      const x = i % W, y = (i / W) | 0;
      if (Level.doorAt[i] || Level.isBlocked(x + 0.5, y + 0.5)) return false;
      const walls = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => Level.isWallTile(x + dx, y + dy)).length;
      return nearWall ? walls === 1 : walls === 0; // one wall behind (not a corridor), or fully open
    });
    const picks = [];
    for (let tries = 0; tries < cands.length * 2 && picks.length < n; tries++) {
      const i = cands[(rand() * cands.length) | 0];
      const x = (i % W) + 0.5, y = ((i / W) | 0) + 0.5;
      if (taken.some(t => Math.hypot(t.x - x, t.y - y) < 2.5)) continue;
      if (picks.some(t => Math.hypot(t.x - x, t.y - y) < minGap)) continue;
      picks.push({ x, y });
    }
    return picks;
  },
};
