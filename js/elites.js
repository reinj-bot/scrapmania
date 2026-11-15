'use strict';
// Elite robots: rare stronger versions of normal robots with a glowing outline, an "ELITE"
// label and one special power. They always drop an upgrade chip and score triple.
// Halfway to the Warden a MINI-BOSS arrives: a big elite with two powers and its own health bar.

const ELITE_TRAITS = {
  swift: { name: 'SWIFT', color: [64, 224, 255] },      // much faster
  armored: { name: 'ARMORED', color: [255, 208, 64] },  // a lot more health
  volatile: { name: 'VOLATILE', color: [255, 96, 48] }, // explodes when destroyed
  regen: { name: 'REGENERATING', color: [96, 255, 128] }, // heals itself over time
};

const hexOf = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');

const Elites = {
  // More elites at higher difficulty: about 4% at level 1, 13% at level 20.
  chance(game) { return Math.min(0.13, 0.03 + game.diff.level * 0.005); },

  make(r, traitCount = 1, mini = false) {
    // a mini-boss never gets the regenerating power
    const ids = Object.keys(ELITE_TRAITS).filter(id => !(mini && id === 'regen')).sort(() => Math.random() - 0.5).slice(0, traitCount);
    const c = ELITE_TRAITS[ids[0]].color;
    r.elite = { traits: ids, mini, outline: (0xff000000 | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0 };
    let hp = r.hp * (mini ? 5 : 1.8);
    if (ids.includes('armored')) hp *= 1.7;
    r.maxHp = r.hp = Math.round(hp);
    if (ids.includes('swift')) r.speed *= 1.45;
    r.damage = Math.round(r.damage * (mini ? 1.4 : 1.2));
    r.alerted = true;
    return r;
  },

  name(r) {
    return (r.elite.mini ? 'MINI-BOSS ' : 'ELITE ') + r.def.name;
  },

  // every frame, for each elite
  tick(r, dt) {
    if (!r.alive) return;
    if (r.elite.traits.includes('regen')) r.hp = Math.min(r.maxHp, r.hp + r.maxHp * 0.04 * dt);
    if (Math.random() < dt * 6) {
      const c = ELITE_TRAITS[r.elite.traits[0]].color;
      Effects.burst(r.x + (Math.random() - 0.5) * 0.4, r.y + (Math.random() - 0.5) * 0.4, Math.random() * r.def.height,
        { count: 1, colors: [hexOf(c)], speed: 0.2, up: 1.2, size: 0.025, life: 0.5, gravity: -1 });
    }
  },

  // destroyed: extra loot, and volatile ones blow up
  killed(r, game) {
    const n = r.elite.mini ? 2 : 1;
    for (let i = 0; i < n; i++) game.dropNear(r.x, r.y, (i - (n - 1) / 2) * 0.6, 0, 'chip', 40);
    if (r.elite.mini) {
      const crate = WEAPONS.map((w, i) => i).filter(i => i >= BASE_WEAPONS && !WEAPONS[i].vault);
      const missing = crate.filter(i => !game.weapons.owned[i]);
      const weapon = (missing.length ? missing : crate)[(Math.random() * (missing.length || crate.length)) | 0];
      game.dropNear(r.x, r.y, 0, 0.6, 'weapon', Infinity, { weapon });
      game.message('MINI-BOSS DOWN! IT DROPPED A WEAPON CRATE', '#60ff80');
    }
    if (r.elite.traits.includes('volatile')) {
      Blast.at(r.x, r.y, game, { radius: 2.4, robotDamage: 120, playerDamage: 30, scale: 1.3, palette: Art.palettes[r.type], source: 'volatile' });
    }
  },

  lights(robots, time) {
    const out = [];
    for (const r of robots) {
      if (!r.elite || !r.alive) continue;
      const c = ELITE_TRAITS[r.elite.traits[0]].color;
      out.push({ x: r.x, y: r.y, c: c.map(v => v / 255), radius: r.elite.mini ? 3.5 : 2.2, intensity: 0.6 + Math.sin(time * 6) * 0.2 });
    }
    return out;
  },

  // "ELITE" over their heads (hidden behind walls)
  drawLabels(ctx, cam, robots) {
    for (const r of robots) {
      if (!r.elite || !r.alive) continue;
      const at = Effects.project(cam, r.x, r.y, r.def.height + (r.def.z || 0) + 0.15);
      if (!at) continue;
      const c = ELITE_TRAITS[r.elite.traits[0]].color;
      Font.draw(ctx, r.elite.mini ? 'MINI-BOSS' : 'ELITE', at.sx, at.sy, 'rgb(' + c.join(',') + ')', 1, 'center');
    }
  },

  // ---------- the mid-game mini-boss ----------
  spawnMiniBoss(game) {
    const pad = Spawner.pickSpawn(game, false) || Level.enemySpawns[0];
    const tough = ['carrier', 'shield', 'heavy'].filter(t => Difficulty.robotWeights(game.diff.level)[t] > 0);
    const type = tough[0] || 'heavy';
    const r = new Robot(type, pad.x, pad.y, game.diff, true);
    this.make(r, 2, true);
    game.robots.push(r);
    game.miniBoss = r;
    Effects.burst(pad.x, pad.y, 0.6, { count: 30, colors: ['#ffd040', '#ffffff', '#ff8020'], speed: 2, up: 4, size: 0.04, life: 0.9 });
    Effects.addLight(pad.x, pad.y, [1, 0.8, 0.3], 6, 1.6, 1);
    Sound.play('boss_alarm');
    game.message('WARNING: A MINI-BOSS HAS ENTERED - ' + this.name(r), '#ffd040');
    game.message('POWERS: ' + r.elite.traits.map(t => ELITE_TRAITS[t].name).join(' + '), '#ffd040');
  },
};
