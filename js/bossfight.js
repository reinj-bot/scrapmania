'use strict';
// When the Warden comes, what happens when it falls, and Endless mode's waves.
// Mission: survive CONFIG.BOSS_TIME, destroy the Warden, win.
// Endless: each Warden you destroy starts a harder wave, and a stronger Warden returns later.

const BossFight = {
  reset(game) {
    this.nextAt = CONFIG.BOSS_TIME;
    this.cut = null; // the last time cut, for the HUD
    this.warned = {};
    this.downTimer = 0;
    game.boss = null;
    game.wave = 1;
  },

  update(dt, game) {
    const left = this.nextAt - game.time;
    for (const mark of [30, 10]) {
      const key = game.wave + ':' + mark;
      if (!game.boss && left <= mark && !this.warned[key]) {
        this.warned[key] = true;
        game.message('WARNING: THE WARDEN ARRIVES IN ' + mark + ' SECONDS', '#ff6040');
        Sound.play('boss_alarm');
      }
    }
    if (!game.boss && left <= 0) this.spawn(game);
    if (this.downTimer > 0) {
      // the Warden falls apart in a chain of blasts
      this.downTimer -= dt;
      const b = game.boss;
      if (Math.random() < dt * 8) {
        Effects.explode(b.x + (Math.random() - 0.5) * 1.5, b.y + (Math.random() - 0.5) * 1.5, 0.8 + Math.random() * 0.6, Art.palettes.boss);
        game.playAt('robot_die', b.x, b.y, 0.8);
        game.shake(0.4);
      }
      if (this.downTimer <= 0) {
        if (game.mode === 'endless') this.nextWave(game);
        else game.win();
      }
    }
  },

  spawn(game) {
    const s = Level.bossSpawn;
    const b = new Robot('boss', s.x, s.y, game.diff, true);
    b.timer = 1.5; // rises slowly out of the floor (see the warden cutscene)
    game.robots.push(b);
    game.boss = b;
    game.run.bossDamage = 0;
    Effects.burst(s.x, s.y, 0.8, { count: 40, colors: ['#ff4020', '#ffffff', '#ff60f0'], speed: 2.5, up: 4, size: 0.05, life: 1 });
    Effects.addLight(s.x, s.y, [1, 0.3, 0.2], 7, 2, 1.5);
    Music.play('boss');
    this.drain(game, b);
    Cutscene.play(game, CUTSCENES.warden);
    game.message(game.mode === 'endless' ? 'THE WARDEN HAS ARRIVED!' : 'THE WARDEN HAS ARRIVED! DESTROY IT TO WIN', '#ff4020');
    Sound.play('boss_roar', 1.2);
    game.shake(0.8);
  },

  // Every robot you destroy brings the Warden sooner: 1 second per 100 health (an elite counts its
  // extra health), a mini-boss always 5 seconds. Only while you wait for the Warden.
  SECONDS_PER_HP: 0.01, MINI_SECONDS: 5,
  killed(game, r) {
    if (game.boss || game.mode === 'drill' || !isFinite(this.nextAt) || r.def.boss) return;
    const s = r.elite && r.elite.mini ? this.MINI_SECONDS : r.def.hp * (r.elite ? 1.8 : 1) * this.SECONDS_PER_HP;
    this.nextAt = Math.max(game.time, this.nextAt - s);
    if (isFinite(game.miniAt)) game.miniAt -= s; // the mini-boss still comes halfway
    // kills close together add up on the HUD
    this.cut = this.cut && game.time - this.cut.at < 1.2 ? { s: this.cut.s + s, at: game.time } : { s, at: game.time };
  },

  // The Warden arrives: 3 in 4 of the robots (never the mini-boss) sink into the floor and stream
  // their energy into it (Robot state 'drain', see enemies.js).
  DRAIN_TIME: 3,
  drain(game, boss) {
    const list = game.robots.filter(r => r !== boss && r.alive && !(r.elite && r.elite.mini)).sort(() => Math.random() - 0.5);
    const n = Math.round(list.length * 0.75);
    for (const r of list.slice(0, n)) {
      r.state = 'drain'; r.timer = this.DRAIN_TIME + Math.random() * 0.6; r.drainTotal = r.timer;
      r.windup = 0; r.leap = null; r.jumpZ = 0;
    }
    if (!n) return;
    game.message('THE ROBOTS ARE FEEDING THEIR ENERGY TO THE WARDEN!', '#ff40a0');
    game.say('COMMAND', 'WARNING: THE ROBOTS ARE SINKING INTO THE FLOOR AND GIVING THEIR ENERGY TO THE WARDEN!', '#ff40a0');
  },

  // Beating the Warden on a high difficulty: the level actually
  // played, so campaign chapters count their extra difficulty too.
  difficultyFlags(game) {
    const lv = game.diff.level, flags = game.run.flags;
    if (lv >= 10) flags.win10 = true;
    if (lv >= 15) flags.win15 = true;
    if (lv >= 20) flags.win20 = true;
  },

  // Boss destroyed: every other robot shuts down with it, and the win-type achievements are checked.
  defeated(game, boss) {
    this.downTimer = 0; // the falling-apart part is now a cutscene (CUTSCENES.wardenDown)
    for (const r of game.robots) {
      if (r === boss || !r.alive) continue;
      r.state = 'dying';
      r.timer = 0.45;
      Effects.explode(r.x, r.y, r.def.height, Art.palettes[r.type]);
    }
    const run = game.run, mods = game.mods;
    run.bossKills++;
    run.bossMaps[Level.mapId] = 1;
    this.difficultyFlags(game);
    if (run.bossDamage === 0) run.flags.untouchable = true;
    const fired = Object.keys(run.fired);
    if (fired.length === 1 && fired[0] === 'shotgun') run.flags.shotgunOnly = true;
    if (game.player.hp < 10) run.flags.closeCall = true;
    if (run.medkits === 0) run.flags.noMeds = true;
    if (mods.length >= 3) run.flags.challenger = true;
    if (mods.includes('glass')) run.flags.glass = true;
    if (mods.includes('dark')) run.flags.lightsOut = true;
    game.message('THE WARDEN IS DOWN!', '#60ff80');
    Cutscene.play(game, CUTSCENES.wardenDown, () => {
      const rare = Math.random() < CONFIG.OVERSEER_CHANCE || game.settings.username === 'DARKSIDE';
      if (rare) { Cutscene.play(game, CUTSCENES.overseer, () => game.overseerKill()); return; }
      if (game.mode === 'endless') { Music.play('fight'); boss.timer = 6; this.nextWave(game); }
      else game.win();
    });
  },

  nextWave(game) {
    game.wave++;
    game.boss = null;
    this.nextAt = game.time + CONFIG.ENDLESS_BOSS_GAP;
    game.diff = game.makeDiff();
    game.miniAt = game.time + CONFIG.ENDLESS_BOSS_GAP / 2; // a mini-boss halfway to the next Warden
    game.run.bests.wave = game.wave;
    game.message('WAVE ' + game.wave + ' - THE ROBOTS GROW STRONGER', '#ff9040');
    Sound.play('boss_alarm');
  },
};
