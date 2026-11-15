'use strict';
// Story campaign: 5 chapters on the 3 maps, each with its own goal, story text before it,
// and the ending after the last one.

const CHAPTERS = [
  {
    id: 'wake', title: 'WAKE UP', map: 'foundry', goal: 'exit', diffBonus: 0,
    story: [
      'You wake up on a cold steel floor in the Sector 7 Foundry. Your right eye sees the world in numbers.',
      'Alarms. Every robot in the building is hunting you, and you don\'t remember why.',
      'Find the way out of the assembly hall.',
    ],
  },
  {
    id: 'cold', title: 'COLD STORAGE', map: 'cryo', goal: 'generators', count: 4, diffBonus: 1,
    story: [
      'The exit led down into the Cryo Lab. Rows of frozen pods line the walls. Most of them are empty.',
      'Four generators keep the lab sealed.',
      'Walk up to each one and overload it to break through.',
    ],
  },
  {
    id: 'melt', title: 'MELTDOWN', map: 'lava', goal: 'keycards', count: 3, diffBonus: 2,
    story: [
      'Beyond the lab lies the Lava Foundry, where old machines are melted down for scrap.',
      'The door to the core needs three security keycards, and they are somewhere in these halls.',
      'Find all three, then reach the exit.',
    ],
  },
  {
    id: 'hold', title: 'HOLD THE LINE', map: 'cryo', goal: 'survive', time: 120, diffBonus: 3, spawnBoost: 1.3,
    story: [
      'You called the lift to the foundry core. It is old and it is slow.',
      'The robots know exactly where you are going, and they are all coming at once.',
      'Stay alive for two minutes until the lift arrives.',
    ],
  },
  {
    id: 'core', title: 'THE WARDEN', map: 'foundry', goal: 'boss', bossTime: 40, diffBonus: 4,
    story: [
      'The lift opens into the foundry core. Something huge is powering up in the dark.',
      'It was built for one job: to stop you.',
      'A broken line of text flickers in your machine eye: "...SUBJECT 01... WHEN IT IS WEAK, ITS CORE OPENS... GET CLOSE... CONNECT..."',
      'Destroy the Warden.',
    ],
  },
];

const ENDINGS = {
  normal: {
    title: 'THE END?',
    story: [
      'The Warden crashes down and the core goes dark. One by one, the robots stop moving.',
      'You walk out of Sector 7 into grey daylight. It\'s over.',
      'But your machine eye keeps blinking the same word, again and again: PROTOCOL.',
      'Maybe there is more to this story.',
    ],
  },
  b: { title: Lex.e1, story: Lex.e2 },
  c: { title: Lex.e3, story: Lex.e4 },
};

const Campaign = {
  // ---------- setup ----------
  start(game, index) {
    const ch = CHAPTERS[index];
    this.index = index;
    this.ch = ch;
    this.done = false;
    this.aux = null;
    this.objects = [];       // exit, generators, keycards (each { kind, x, y, done })
    this.found = 0;
    this.timeLeft = ch.time || 0;
    if (ch.goal === 'exit') this.objects.push({ kind: 'exit', ...this.farSpots(game.player, 1)[0] });
    if (ch.goal === 'generators') this.farSpots(game.player, ch.count).forEach(s => this.objects.push({ kind: 'generator', ...s }));
    if (ch.goal === 'keycards') {
      // the furthest spot is the exit (locked until all cards are found), the next ones hold the cards
      const [exit, ...cards] = this.farSpots(game.player, ch.count + 1);
      cards.forEach(s => this.objects.push({ kind: 'keycard', ...s }));
      this.objects.push({ kind: 'exit', locked: true, ...exit });
    }
    BossFight.nextAt = ch.goal === 'boss' ? ch.bossTime : Infinity;
  },

  // Reachable floor spots, spread out and far from the start (walks the map from the player).
  farSpots(from, n) {
    if (!n) return [];
    const W = Level.W, H = Level.H, dist = new Int32Array(W * H).fill(-1);
    // normal doors open for you, so walk through them; locked secret doors and walls stop the search
    const open1 = (x, y) => {
      if (!Level.isBlocked(x + 0.5, y + 0.5)) return true;
      const d = Level.doorAt[y * W + x];
      return !!d && !d.group.locked;
    };
    const sx = Math.floor(from.x), sy = Math.floor(from.y), queue = [sy * W + sx];
    dist[queue[0]] = 0;
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q], x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, j = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || dist[j] >= 0 || !open1(nx, ny)) continue;
        dist[j] = dist[i] + 1;
        queue.push(j);
      }
    }
    // keep away from walls a little: only tiles whose 4 neighbours are open too
    const open = queue.filter(i => {
      const x = i % W, y = (i / W) | 0;
      if (Level.doorAt[i]) return false;
      return [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => !Level.isBlocked(x + dx + 0.5, y + dy + 0.5));
    });
    const picks = [];
    for (let k = 0; k < n; k++) {
      // furthest from the start AND from everything already picked
      let best = -1, bestScore = -1;
      for (const i of open) {
        const x = i % W, y = (i / W) | 0;
        let score = dist[i];
        for (const p of picks) score = Math.min(score, Math.hypot(p.x - x, p.y - y) * 1.5);
        if (score > bestScore) { bestScore = score; best = i; }
      }
      if (best < 0) break;
      picks.push({ x: (best % W) + 0.5, y: ((best / W) | 0) + 0.5 });
    }
    return picks;
  },

  // ---------- every frame ----------
  update(dt, game) {
    if (this.done) return;
    const ch = this.ch, p = game.player;
    if (ch.goal === 'survive') {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) { this.complete(game); return; }
    }
    for (const o of this.objects) {
      if (o.done) continue;
      const d = Math.hypot(o.x - p.x, o.y - p.y);
      if (o.kind === 'keycard' && d < 0.7) {
        o.done = true;
        this.found++;
        Sound.play('chip');
        const left = this.objects.filter(x => x.kind === 'keycard' && !x.done).length;
        game.message(left ? 'KEYCARD FOUND - ' + left + ' TO GO' : 'ALL KEYCARDS FOUND - THE EXIT IS OPEN', '#40e0ff');
        if (!left) this.objects.forEach(x => { if (x.kind === 'exit') x.locked = false; });
      }
      if (o.kind === 'generator' && d < 1.4) {
        game.usePrompt = 'PRESS ' + (Controls.pad.active ? 'A' : Controls.name('use')) + ' TO OVERLOAD GENERATOR';
        if (Controls.pressed('use') || Controls.padPressed(PAD.A)) {
          o.done = true;
          this.found++;
          game.usePrompt = null;
          Effects.explode(o.x, o.y, 0.9, Art.palettes.barrel);
          Effects.addLight(o.x, o.y, [0.3, 0.8, 1], 6, 2, 0.8);
          game.playAt('zap', o.x, o.y, 1.2);
          game.shake(0.3);
          game.alertRobots(o.x, o.y, 14);
          const left = this.objects.filter(x => x.kind === 'generator' && !x.done).length;
          game.message(left ? 'GENERATOR OVERLOADED - ' + left + ' TO GO' : 'ALL GENERATORS DOWN', '#40e0ff');
          if (!left) this.complete(game);
        }
      }
      if (o.kind === 'exit' && d < 0.9) {
        if (o.locked) {
          if (!this.lockedNote || game.time - this.lockedNote > 3) {
            this.lockedNote = game.time;
            game.message('LOCKED - FIND ALL THE KEYCARDS FIRST', '#ff6040');
          }
        } else { o.done = true; this.complete(game); }
      }
    }
  },

  complete(game) {
    if (this.done) return;
    this.done = true;
    game.win();
  },

  AUX_T: 1, AUX_R: 4.5, AUX_S: 3.5, SHIELD: 0.35,

  tickAux(dt, game) {
    const b = game.boss, p = game.player;
    if (!b || !b.alive || b.hp > b.maxHp * 0.33) { this.aux = null; return; }
    if (Math.random() < dt * 6) Effects.burst(b.x, b.y, 1, { count: 1, colors: ['#40e0ff', '#ffffff'], speed: 0.8, up: 1.5, size: 0.03, life: 0.5 });
    const d = Math.hypot(b.x - p.x, b.y - p.y);
    if (this.aux) {
      b.hp = Math.max(b.hp, 1);
      if (d > this.AUX_R) { this.aux = null; return; }
      this.aux.t += dt;
      game.usePrompt = Lex.h1;
      if (this.aux.t >= this.AUX_T) this.auxDone(game);
      return;
    }
    if (d < this.AUX_S && !game.usePrompt && (Controls.pressed('use') || Controls.padPressed(PAD.A))) {
      this.aux = { t: 0 };
      Sound.play('switch_on');
    }
  },

  auxDone(game) {
    const b = game.boss, run = game.run;
    this.aux = null;
    game.altEnd = true;
    run.flags.x7 = true;
    run.bossKills++;
    run.bossMaps[Level.mapId] = 1;
    BossFight.difficultyFlags(game);
    game.robots = game.robots.filter(r => r === b);
    Cutscene.play(game, CUTSCENES.s4, () => game.win());
  },

  // ---------- drawing ----------
  hudGoal(game) {
    const ch = this.ch, objs = this.objects;
    if (ch.goal === 'exit') return 'REACH THE EXIT';
    if (ch.goal === 'generators') return 'GENERATORS ' + this.found + '/' + ch.count;
    if (ch.goal === 'keycards') return this.found < ch.count ? 'KEYCARDS ' + this.found + '/' + ch.count : 'REACH THE EXIT';
    if (ch.goal === 'survive') return 'LIFT ARRIVES IN ' + game.formatTime(Math.max(0, Math.ceil(this.timeLeft)));
    return null; // boss: the normal Warden countdown / health bar
  },

  // Where the arrow at the top of the screen points: the nearest unfinished goal.
  target(game) {
    const p = game.player;
    const open = this.objects.filter(o => !o.done && !(o.kind === 'exit' && o.locked));
    let best = null, bd = Infinity;
    for (const o of open) { const d = Math.hypot(o.x - p.x, o.y - p.y); if (d < bd) { bd = d; best = o; } }
    return best;
  },

  addSprites(list, time) {
    for (const o of this.objects) {
      if (o.kind === 'keycard' && o.done) continue;
      const sprite = o.kind === 'exit' ? (o.locked ? Art.sprites.exitLocked : Art.sprites.exit)
        : o.kind === 'generator' ? (o.done ? Art.sprites.generatorDead : Art.sprites.generator)
        : Art.sprites.keycard;
      const z = o.kind === 'keycard' ? 0.15 + Math.sin(time * 3 + o.x) * 0.05 : 0;
      const h = o.kind === 'keycard' ? 0.25 : o.kind === 'exit' ? 1 : 0.8;
      list.push({ x: o.x, y: o.y, z, h, sprite, bright: !(o.kind === 'generator' && o.done) });
    }
  },

  lights(time) {
    return this.objects.filter(o => !o.done || o.kind === 'exit').map(o => {
      const c = o.kind === 'exit' ? (o.locked ? [1, 0.25, 0.2] : [0.3, 1, 0.4]) : o.kind === 'generator' ? [0.3, 0.8, 1] : [0.3, 0.9, 1];
      return { x: o.x, y: o.y, c, radius: 3.5, intensity: 0.7 + Math.sin(time * 4 + o.x) * 0.2 };
    });
  },
};
