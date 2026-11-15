'use strict';
// Brings in robots over time (how many and how fast depends on difficulty) and refills
// the health/ammo spots on the map.

const Spawner = {
  reset(game) {
    const diff = game.diff;
    this.timer = diff.spawnInterval;
    this.pickupTimers = Level.pickupSpots.map(() => 0);
    // a few robots already wandering the base at the start (not yet aware of you)
    if (game.mode !== 'drill') for (let i = 0; i < diff.startRobots; i++) this.spawn(game, false, true);
    // every pickup spot starts stocked
    Level.pickupSpots.forEach((s, i) => this.placePickup(game, i));
    this.crateTimer = CONFIG.CRATE_FIRST;
  },

  update(dt, game) {
    const diff = game.diff;
    this.updateCrates(dt, game);
    // the longer you survive, the busier it gets (up to +60%)
    const ramp = (1 + Math.min(0.6, game.time / 400)) * MapEvents.spawnBoost(); // lockdowns bring robots faster
    // fewer reinforcements while the boss is fighting, none once it's down
    const bossFight = game.mode === 'drill' ? 0 : game.boss ? (game.boss.alive ? 0.5 : 0) : 1; // (the bonus round spawns its own)
    this.timer -= dt * ramp * bossFight;
    if (this.timer <= 0) {
      this.timer = diff.spawnInterval * (0.7 + Math.random() * 0.6);
      const alive = game.robots.filter(r => r.alive && !r.def.noSpawn).length; // mini-drones don't count
      const cap = Math.round(diff.maxAlive * Math.min(1.3, ramp));
      if (alive < cap) {
        this.spawn(game, true);
        if (alive + 1 < cap && Math.random() < diff.groupChance) this.spawn(game, true);
      }
    }

    Level.pickupSpots.forEach((spot, i) => {
      if (spot.once) return; // secret stashes don't refill
      const has = game.pickups.some(p => p.spot === i && !p.taken);
      if (has) { this.pickupTimers[i] = 0; return; }
      this.pickupTimers[i] += dt;
      if (this.pickupTimers[i] > 30) { this.pickupTimers[i] = 0; this.placePickup(game, i); }
    });
  },

  pickType(diff) {
    const w = diff.weights;
    const total = Object.values(w).reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    for (const k of Object.keys(w)) { roll -= w[k]; if (roll <= 0 && w[k] > 0) return k; }
    return 'basic';
  },

  // Prefer a pad out of the player's sight and not too close, so robots don't pop in your face.
  pickSpawn(game, quiet) {
    const p = game.player;
    const pads = Level.enemySpawns.filter(s => {
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      if (d < (quiet ? 10 : 7)) return false;
      return !game.robots.some(r => r.alive && Math.hypot(r.x - s.x, r.y - s.y) < 0.8);
    });
    const hidden = pads.filter(s => !Level.hasLOS(s.x, s.y, p.x, p.y));
    const pool = hidden.length ? hidden : pads;
    return pool.length ? pool[(Math.random() * pool.length) | 0] : null;
  },

  spawn(game, alerted, quiet = false) {
    const pad = this.pickSpawn(game, quiet);
    if (!pad) return;
    const type = this.pickType(game.diff);
    const robot = new Robot(type, pad.x, pad.y, game.diff, alerted);
    if (Math.random() < Elites.chance(game)) Elites.make(robot);
    game.robots.push(robot);
    Effects.burst(pad.x, pad.y, 0.3, { count: 18, colors: ['#40e0ff', '#ffffff', '#2080ff'], speed: 1.2, up: 3, size: 0.03, life: 0.7, gravity: 1 });
    Effects.addLight(pad.x, pad.y, [0.3, 0.8, 1], 3.5, 1.2, 0.6);
    if (!quiet) game.playAt('spawn', pad.x, pad.y, 0.8);
  },

  // Weapon crates: one at a time, at a random robot pad, holding a gun you don't have yet
  // (or, once you have them all, ammo for one).
  updateCrates(dt, game) {
    if (game.weapons.shotgunOnly || game.pickups.some(p => p.type === 'weapon' && !p.vault)) return;
    this.crateTimer -= dt;
    if (this.crateTimer > 0) return;
    this.crateTimer = CONFIG.CRATE_EVERY;
    const ws = game.weapons;
    const found = WEAPONS.map((w, i) => i).filter(i => i >= BASE_WEAPONS && !WEAPONS[i].vault); // the Tesla Cannon is only in vaults
    const missing = found.filter(i => !ws.owned[i]);
    const weapon = (missing.length ? missing : found)[(Math.random() * (missing.length || found.length)) | 0];
    const pads = Level.enemySpawns.filter(s => Math.hypot(s.x - game.player.x, s.y - game.player.y) > 4);
    const pad = pads[(Math.random() * pads.length) | 0] || Level.enemySpawns[0];
    game.pickups.push({ x: pad.x, y: pad.y, type: 'weapon', weapon, spot: -1, taken: false, life: Infinity });
    game.message('A WEAPON CRATE HAS DROPPED SOMEWHERE', '#40e0ff');
    Sound.play('weapon_drop');
  },

  placePickup(game, spotIndex) {
    const s = Level.pickupSpots[spotIndex];
    if (s.type === 'health' && game.mods.includes('nomeds')) return;
    game.pickups.push({ x: s.x, y: s.y, type: s.type, spot: spotIndex, taken: false, life: Infinity });
  },
};
