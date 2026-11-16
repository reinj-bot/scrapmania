'use strict';
// Short in-game cutscenes, drawn with the real 3D view: the camera moves on its own, black
// movie bars slide in, and text is typed on screen. The game is frozen while one plays.
// Skip: click, Space, Enter, E or controller A/Start. Esc skips it and pauses.
// Scenes: intro (every game start), warden (the Warden arrives), wardenDown, overseer, s4.

const Cutscene = {
  active: null,

  play(game, scene, onDone) {
    this.active = { scene, t: 0, onDone, game, data: {} };
    if (scene.start) scene.start(game, this.active.data);
  },

  skip() {
    const a = this.active;
    if (!a) return;
    a.t = a.scene.length;
    this.finish();
  },

  finish() {
    const a = this.active;
    this.active = null;
    if (a.scene.end) a.scene.end(a.game, a.data);
    if (a.onDone) a.onDone();
  },

  // Called every frame instead of the normal game update while a scene plays.
  update(dt) {
    const a = this.active;
    if (Input.mouseClicked || Input.pressed.Space || Input.pressed.Enter || Input.pressed.KeyE ||
        Controls.padPressed(PAD.A) || Controls.padPressed(PAD.START)) {
      if (a.t > 0.4) { this.skip(); return; } // ignore the click that started the game
    }
    const prev = a.t;
    a.t += dt;
    Effects.update(dt, a.game);
    if (a.scene.tick) a.scene.tick(a.game, a.data, a.t, prev, dt);
    if (a.t >= a.scene.length) this.finish();
  },

  render(time) {
    const a = this.active, g = a.game, ctx = Renderer.ctx;
    const W = CONFIG.WIDTH, H = CONFIG.HEIGHT || 216;
    const cam = a.scene.camera(g, a.data, a.t);
    if (cam) g.renderWorld(time, cam);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, CONFIG.VIEW_H, W, H - CONFIG.VIEW_H); // no status bar in cutscenes
    a.scene.overlay(ctx, g, a.data, a.t, W, H);
    // hint
    if (a.t > 0.6 && a.t < a.scene.length - 0.3) Font.draw(ctx, 'CLICK TO SKIP', W - 4, H - 8, '#5a6470', 1, 'right', null);
  },

  // ---------- drawing helpers ----------
  bars(ctx, W, H, amount) { // movie bars, amount 0..1
    const h = Math.round(28 * amount);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, h);
    ctx.fillRect(0, H - h - 0, W, h);
  },
  fade(ctx, W, H, color, alpha) {
    if (alpha <= 0) return;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  },
  type(text, t, start, speed = 30) { // typewriter: the part of `text` shown at time t
    if (t < start) return '';
    return text.slice(0, Math.floor((t - start) * speed));
  },
  ease(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); },
  // A random funny line: usually from `jokes`, about 1 time in 4 from `refs` (movie and game references).
  joke(jokes, refs) {
    const list = Math.random() < 0.25 ? refs : jokes;
    return list[Math.floor(Math.random() * list.length)];
  },
  lerp(a, b, k) { return a + (b - a) * k; },

  // A spot `dist` tiles from (x, y) with a clear view of it, facing it.
  viewpoint(x, y, dist) {
    // first try spots where no crate, pipe or barrel stands between the camera and the target
    // (one right in front of the camera fills the whole screen)
    const props = [...Breakables.list, ...Barrels.list].filter(o => o.alive);
    const clear = (vx, vy) => props.every(o => {
      const lx = x - vx, ly = y - vy, l2 = lx * lx + ly * ly || 1;
      const k = Math.max(0, Math.min(1, ((o.x - vx) * lx + (o.y - vy) * ly) / l2));
      return Math.hypot(vx + lx * k - o.x, vy + ly * k - o.y) > 0.8;
    });
    for (const strict of [true, false]) {
      for (const d of [dist, dist + 1, dist - 1, dist + 2, dist - 2, 3]) {
        for (let k = 0; k < 48; k++) {
          const a = k / 48 * Math.PI * 2, vx = x + Math.cos(a) * d, vy = y + Math.sin(a) * d;
          if (Level.isBlocked(vx, vy) || !Level.hasLOS(vx, vy, x, y) || (strict && !clear(vx, vy))) continue;
          return { x: vx, y: vy, angle: a + Math.PI };
        }
      }
    }
    return { x, y, angle: 0 };
  },
};

// ---------- the scenes ----------
const CUTSCENES = {
  // The pilot's machine eye boots up: eyelids open, the view sweeps up from the floor.
  intro: {
    length: 5.5,
    JOKES: [
      'DOWNLOADING MORE RAM........OK', 'COFFEE...............NOT FOUND', 'LOADING COURAGE.............12%',
      'TURNING IT OFF AND ON AGAIN.OK', 'CHECKING FOR UPDATES.....SKIPPED', 'SARCASM MODULE......OH GREAT, OK',
      'AIM ASSIST..................NOPE', 'SOCKS.......................ODD', 'SELF-ESTEEM.............LOADING',
      'BATTERY.....3%... JUST KIDDING', 'INSTALLING UPDATE 1 OF 437...', 'PRESS ANY KEY.......WHICH ONE?',
      'NAP MODE.............DISABLED :(', 'LEFT HAND.........STILL ATTACHED', 'DANCE MOVES.............MISSING',
    ],
    REFS: [ // Star Wars, FNAF, Minecraft, Cuphead, Among Us
      'NOT THE DROIDS YOU ARE LOOKING FOR', 'THE FORCE...............STRONG', 'MAY THE FORCE..........BE WITH ME',
      'NIGHT SHIFT........12 AM TO 6 AM', 'POWER LEFT..................99%', 'CAMERA 1A...........ALL CLEAR?',
      'PUNCHING TREES..............OK', 'DIAMONDS...................0 :(', 'CREEPER NEARBY.......AWW MAN',
      'DEAL WITH THE DEVIL.....DECLINED', 'WALLOP!',
      'TASKS......................0 / 5', 'SCANNING CREW....1 IMPOSTOR LEFT', 'EMERGENCY MEETING..........NO',
    ],
    start(game, d) {
      const p = game.player;
      d.angle = p.angle;
      d.title = game.chapter ? 'CHAPTER ' + (Campaign.index + 1) + ': ' + game.chapter.title : LEVELS[Level.mapId].name;
      d.sub = game.chapter ? Campaign.hudGoal(game) || 'DESTROY THE WARDEN'
        : game.mode === 'endless' ? 'ENDLESS - SURVIVE AS LONG AS YOU CAN'
        : game.mode === 'drill' ? Lex.d6 + game.formatTime(Drill.LENGTH)
          : 'SURVIVE ' + game.formatTime(CONFIG.BOSS_TIME) + ', THEN DESTROY THE WARDEN';
      d.typed = 0;
      d.joke = Cutscene.joke(this.JOKES, this.REFS);
    },
    tick(game, d, t, prev) {
      if (prev < 1 && t >= 1) Sound.play('teleport', 0.5);
      if (prev < 3.6 && t >= 3.6) Sound.play('robot_alert', 0.7);
    },
    camera(game, d, t) {
      const p = game.player, C = Cutscene, k = C.ease((t - 0.8) / 3.8);
      return {
        x: p.x, y: p.y, fov: CONFIG.FOV,
        angle: d.angle - 0.9 * (1 - k),
        horizonShift: -40 * (1 - k) + Math.sin(t * 7) * 2 * (1 - k), // looking at the floor, then up
      };
    },
    overlay(ctx, game, d, t, W, H) {
      const C = Cutscene, VH = CONFIG.VIEW_H;
      // eyelids: black closing in from top and bottom, opening between 0.6 s and 2 s
      const open = C.ease((t - 0.6) / 1.4);
      const lid = Math.round((VH / 2 + 2) * (1 - open));
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, lid);
      ctx.fillRect(0, VH - lid, W, lid);
      C.bars(ctx, W, VH, 1 - C.ease((t - 4.6) / 0.8));
      // machine eye boot text (top left, cyan)
      const lines = ['SCRAP OS V0.1', 'OPTIC SYSTEM........OK', 'TARGETING...........OK', d.joke, 'THREATS DETECTED: MANY'];
      lines.forEach((l, i) => {
        const s = C.type(l, t, 0.2 + i * 0.6, 40);
        if (s) Font.draw(ctx, s, 6, 6 + i * 7, i === 4 ? '#ff6040' : i === 3 ? '#ffd040' : '#40e0ff', 1, 'left', null);
      });
      // title card
      if (t > 2.2) {
        const a = Math.min(1, (t - 2.2) * 2) * (1 - C.ease((t - 4.8) / 0.6));
        ctx.globalAlpha = Math.max(0, a);
        Font.draw(ctx, d.title, W / 2, VH - 44, '#e0a030', 2, 'center', '#3a1804');
        Font.draw(ctx, d.sub, W / 2, VH - 28, '#c8d0d8', 1, 'center');
        ctx.globalAlpha = 1;
      }
    },
  },

  // The Warden arrives: alarm, cut to it, it rises slowly out of the floor, name card, back to the player.
  warden: {
    length: 6.4, RISE: 3,
    start(game, d) {
      const b = game.boss;
      d.view = Cutscene.viewpoint(b.x, b.y, 6);
      d.boss = b;
      d.father = Math.random() < 0.1; // 1 in 10: a Star Wars line while it rises
      b.timer = 1.5;
      Sound.play('boss_alarm');
    },
    tick(game, d, t, prev, dt) {
      const b = d.boss;
      const up = 0.6 + this.RISE; // fully out of the floor
      if (t > 0.6) b.timer = Math.max(0, 1.5 * (1 - (t - 0.6) / this.RISE)); // rising
      if (t > 0.6 && t < up) {
        game.shakeAmount = Math.max(game.shakeAmount, 0.18); // the ground rumbles
        if (Math.random() < dt * 22) { // broken floor and sparks around it
          const a = Math.random() * Math.PI * 2, r = 0.5 + Math.random() * 0.5;
          Effects.burst(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r, 0.04, { count: 3, colors: ['#5a5048', '#8a8070', '#ff6030', '#ffd080'], speed: 1.2, up: 2, size: 0.04, life: 0.7 });
        }
        if (Math.random() < dt * 4) Effects.addLight(b.x, b.y, [1, 0.3, 0.2], 5, 1.2, 0.3);
        if (Math.floor(prev * 1.6) !== Math.floor(t * 1.6)) Sound.play('stomp', 0.35);
      }
      if (prev < up && t >= up) { Sound.play('boss_roar', 1.2); Sound.play('stomp', 1); game.shake(0.8); }
      if (d.father && prev < 1.2 && t >= 1.2) Sound.play('robot_alert', 0.6);
      game.shakeAmount = Math.max(0, game.shakeAmount - dt * 1.5);
      b.animTime += dt;
    },
    camera(game, d, t) {
      if (t < 0.6) return game.camera(0); // a moment of the alarm from the player's eyes
      const C = Cutscene, v = d.view, b = d.boss, k = C.ease((t - 0.6) / 5.2);
      // slow push towards the Warden, lower angle so it looks huge
      const x = C.lerp(v.x, b.x, k * 0.35), y = C.lerp(v.y, b.y, k * 0.35);
      const shake = game.shakeAmount;
      return {
        x, y, angle: Math.atan2(b.y - y, b.x - x) + (Math.random() - 0.5) * shake * 0.03,
        fov: CONFIG.FOV * 0.85, horizonShift: 14 + (Math.random() - 0.5) * shake * 8,
      };
    },
    overlay(ctx, game, d, t, W, H) {
      const C = Cutscene, VH = CONFIG.VIEW_H;
      if (t < 0.6) { // red alarm flash before the cut
        C.fade(ctx, W, VH, '#ff2010', 0.25 + Math.sin(t * 30) * 0.15);
        Font.draw(ctx, 'WARNING', W / 2, VH / 2 - 6, '#ff4030', 2, 'center');
        return;
      }
      const up = 0.6 + this.RISE;
      C.bars(ctx, W, VH, Math.min(1, (t - 0.6) * 3) * (1 - C.ease((t - up - 2.2) / 0.5)));
      if (t > up) {
        const a = Math.min(1, (t - up) * 3) * (1 - C.ease((t - up - 2) / 0.5));
        const slide = Math.round((1 - C.ease((t - up) * 2.5)) * 60);
        ctx.globalAlpha = Math.max(0, a);
        Font.draw(ctx, 'THE WARDEN', W / 2 - slide, VH - 46, '#ff4020', 3, 'center', '#300404');
        Font.draw(ctx, 'GUARDIAN OF SECTOR 7', W / 2 + slide, VH - 24, '#c8d0d8', 1, 'center');
        ctx.globalAlpha = 1;
      }
      if (d.father && t > 1.2 && t < up + 0.2) { // on the top movie bar
        Font.draw(ctx, 'THE WARDEN', 8, 6, '#ff4020', 1, 'left', null);
        const s = C.type('PILOT... I AM YOUR FATHER.', t, 1.3, 20);
        if (s) Font.draw(ctx, s, 8, 16, '#e8ecf0', 1, 'left', null);
      }
      C.fade(ctx, W, VH, '#000', 1 - (t - 0.6) * 4);       // quick fade in after the cut
      C.fade(ctx, W, VH, '#000', (t - this.length + 0.4) * 3); // and out at the end
    },
    end(game, d) {
      const b = d.boss;
      b.timer = 0;
      b.state = 'active';
      game.shakeAmount = 0;
    },
  },

  // The Warden is destroyed: a chain of explosions, a final blast, then it is scrap.
  wardenDown: {
    length: 5,
    JOKES: [
      'TELL MY TOASTER... I LOVED HER.', 'I SHOULD HAVE BEEN A VACUUM CLEANER.', 'THIS IS NOT COVERED BY MY WARRANTY.',
      "I DIDN'T EVEN GET TO FINISH MY UPDATE.", 'AT LEAST... I AM RECYCLABLE.', 'MY ONLY REGRET... IS THE STAIRS.',
      'ERROR 404: WARDEN NOT FOUND.', 'I WAS ONE DAY AWAY FROM RETIREMENT.', 'WHO PUT THIS BANANA PEEL HERE?',
      'NOT THE FACE! ...OH. TOO LATE.', 'I REGRET NOTHING. EXCEPT THAT. AND THAT.', 'DID I LEAVE THE OVEN ON?',
    ],
    REFS: [ // Star Wars, FNAF, Minecraft, Cuphead, Among Us
      'NOOOOOOOOOO!', 'I HAVE A BAD FEELING ABOUT THIS.', 'YOU HAD... THE HIGH GROUND...',
      "IT'S ME.", '6 AM... ALREADY?',
      'WAIT... WRONG WARDEN?', 'THE WARDEN WAS SLAIN BY PILOT', 'SSSSS... OOF.',
      'A KNOCKOUT!', 'I SHOULD HAVE READ THE CONTRACT.',
      'THE WARDEN WAS NOT THE IMPOSTOR.', 'BUT I WAS DOING MY TASKS!', 'RED IS SUS...',
    ],
    start(game, d) {
      const b = game.boss;
      d.boss = b;
      d.view = Cutscene.viewpoint(b.x, b.y, 5.5);
      d.points = Math.round(b.def.score * game.diff.scoreMult * game.modMult);
      // its last words (in Endless it really does come back, so half the time it says so)
      d.words = game.mode === 'endless' && Math.random() < 0.5 ? 'I ALWAYS COME BACK.' : Cutscene.joke(this.JOKES, this.REFS);
      d.words = d.words.replace(' BY PILOT', ' BY ' + String(game.settings.username || 'PILOT').toUpperCase());
      Music.play(null);
      Sound.play('boss_roar', 1);
    },
    tick(game, d, t, prev, dt) {
      const b = d.boss;
      game.shakeAmount = Math.max(0, game.shakeAmount - dt);
      if (prev < 0.4 && t >= 0.4) Sound.play('robot_alert', 0.4);
      if (t < 3 && Math.random() < dt * 9) {
        const ox = (Math.random() - 0.5) * 1.4, oy = (Math.random() - 0.5) * 1.4;
        Effects.explode(b.x + ox, b.y + oy, 0.6 + Math.random() * 0.6, Art.palettes.boss);
        Effects.addLight(b.x + ox, b.y + oy, [1, 0.6, 0.25], 5, 1.6, 0.3);
        game.playAt(Math.random() < 0.5 ? 'robot_die' : 'barrel', b.x, b.y, 0.7);
        game.shakeAmount = Math.min(1, game.shakeAmount + 0.35);
      }
      if (prev < 3 && t >= 3) {
        // the final blast: it collapses into a pile of scrap
        Effects.explode(b.x, b.y, 2.4, Art.palettes.boss);
        Effects.burst(b.x, b.y, 0.8, { count: 60, colors: ['#ffe070', '#ff8020', '#ffffff', '#5a4a40'], speed: 6, up: 5, size: 0.06, life: 1.2 });
        Effects.addLight(b.x, b.y, [1, 0.8, 0.5], 9, 2.5, 0.8);
        Sound.play('barrel', 1.3); Sound.play('stomp', 1);
        game.shakeAmount = 1;
        b.state = 'wreck'; b.timer = 99;
      }
    },
    camera(game, d, t) {
      const C = Cutscene, v = d.view, b = d.boss, k = C.ease(t / 4.5), shake = game.shakeAmount;
      const x = C.lerp(v.x, b.x, k * 0.25), y = C.lerp(v.y, b.y, k * 0.25);
      return {
        x, y, angle: Math.atan2(b.y - y, b.x - x) + (Math.random() - 0.5) * shake * 0.04,
        fov: CONFIG.FOV * 0.9, horizonShift: 10 - k * 6 + (Math.random() - 0.5) * shake * 10,
      };
    },
    overlay(ctx, game, d, t, W, H) {
      const C = Cutscene, VH = CONFIG.VIEW_H;
      C.bars(ctx, W, VH, Math.min(1, t * 3) * (1 - C.ease((t - 4.5) / 0.5)));
      C.fade(ctx, W, VH, '#ffffff', 0.6 - t * 2);           // flash as it falls
      if (t >= 3) C.fade(ctx, W, VH, '#ffffff', 0.8 - (t - 3) * 3); // and at the final blast (only then: it used to cover the first 3 s)
      if (t > 0.4 && t < 3.1) { // last words, over the bottom movie bar
        const s = C.type(d.words, t, 0.4, 28);
        Font.draw(ctx, 'THE WARDEN', 8, VH - 24, '#ff4020', 1, 'left', null);
        if (s) Font.draw(ctx, s, 8, VH - 13, '#e8ecf0', 1, 'left', null);
      }
      if (t > 3.2) {
        const a = Math.min(1, (t - 3.2) * 3) * (1 - C.ease((t - 4.5) / 0.4));
        ctx.globalAlpha = Math.max(0, a);
        Font.draw(ctx, 'WARDEN DESTROYED', W / 2, VH / 2 - 14, '#ffd040', 3, 'center', '#3a1804');
        Font.draw(ctx, '+' + d.points + ' POINTS', W / 2, VH / 2 + 8, '#ffffff', 1, 'center');
        ctx.globalAlpha = 1;
      }
      C.fade(ctx, W, VH, '#000', (t - 4.6) * 2.5);
    },
    end(game, d) {
      d.boss.state = 'wreck';
      if (d.boss.timer < 6) d.boss.timer = 99;
      game.shakeAmount = 0;
    },
  },

  // 1 in 10000 after the Warden falls: the Overseer is standing right behind you. Fast on purpose.
  overseer: {
    length: 5,
    start(game, d) {
      const p = game.player;
      d.a0 = p.angle;
      // stand him 2.5 tiles behind you (or as far as there is room)
      let dist = 2.5;
      while (dist > 1 && (Level.isBlocked(p.x - Math.cos(p.angle) * dist, p.y - Math.sin(p.angle) * dist) || !Level.hasLOS(p.x, p.y, p.x - Math.cos(p.angle) * dist, p.y - Math.sin(p.angle) * dist))) dist -= 0.3;
      d.ox = p.x - Math.cos(p.angle) * dist; d.oy = p.y - Math.sin(p.angle) * dist;
      game.extraSprites = [{ x: d.ox, y: d.oy, z: 0, h: 1.55, sprite: Art.sprites.overseer }];
      Music.play(null);
      Sound.play('boss_charge', 0.8);
    },
    tick(game, d, t, prev) {
      if (prev < 1.2 && t >= 1.2) Sound.play('robot_alert', 1);
      if (prev < 2.6 && t >= 2.6) { Sound.play('zap', 1.2); Sound.play('player_hurt', 1); }
    },
    camera(game, d, t) {
      if (t > 2.7) return null;
      const C = Cutscene, p = game.player, k = C.ease(t / 1.1);
      // you turn around... and look up
      return { x: p.x, y: p.y, angle: d.a0 + Math.PI * k, fov: CONFIG.FOV * (1 - C.ease((t - 1.3) / 1) * 0.3), horizonShift: C.ease((t - 1.3) / 1) * 12 };
    },
    overlay(ctx, game, d, t, W, H) {
      const C = Cutscene, VH = CONFIG.VIEW_H;
      if (t <= 2.7) {
        C.bars(ctx, W, VH, Math.min(1, t * 4));
        if (t > 1.4) {
          ctx.globalAlpha = Math.min(1, (t - 1.4) * 3);
          Font.draw(ctx, 'THE OVERSEER', W / 2, VH - 40, '#ff2020', 3, 'center', '#200000');
          ctx.globalAlpha = 1;
        }
        C.fade(ctx, W, VH, '#ff0000', (t - 2.4) * 3);
        return;
      }
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      const s = C.type('YOU WERE NOT SUPPOSED TO SEE THIS.', t, 3, 22);
      if (s) Font.draw(ctx, s, W / 2, VH / 2 - 4, '#ff3030', 1, 'center');
      C.fade(ctx, W, H, '#000', (t - 4.5) * 2);
    },
    end(game) { game.extraSprites = null; },
  },

  s4: {
    length: 63.5,
    CUT: 1.4, REACH: 3, GRX: 4, RX: 4.4, BACK: 5.4, TALK: 7, LINE: 5, P3: 6, P5: 4, GOLD: 7,
    SHOTS: ['warden', 'flash', 'flash', 'warden', 'rec', 'rec', 'rec', 'face', 'wide', 'warden', 'wide'],
    start(game, d) {
      const b = game.boss, p = game.player;
      d.boss = b;
      const av = Object.assign({}, game.settings.avatar, { helmet: 0, accessory: 0 });
      const eye = AVATAR_OPTIONS.visor[av.visor].color;
      d.eye = Effects.color(eye);
      const cA = Art.avatarCanvas(av);
      const cC = Art.avatarCanvas(av);
      const r = (x, y, w, h, col) => { const c = cC.getContext('2d'); c.fillStyle = col; c.fillRect(x, y, w, h); };
      r(7, 2, 10, 9, '#8a9098'); r(8, 2, 8, 1, '#c4cad2'); r(7, 3, 1, 7, '#c4cad2'); r(16, 3, 1, 7, '#4a4f58');
      r(11, 2, 1, 6, '#4a4f58'); r(6, 4, 1, 3, '#4a4f58'); r(17, 4, 1, 3, '#4a4f58');
      for (const ex of [8, 13]) { r(ex, 4, 3, 3, '#16181c'); r(ex + 1, 4, 1, 3, eye); r(ex, 5, 3, 1, eye); r(ex + 1, 5, 1, 1, '#ffffff'); }
      r(9, 8, 6, 2, '#4a4f58'); for (let x = 9; x < 15; x += 2) r(x, 8, 1, 2, '#16181c');
      r(9, 10, 6, 1, '#6a7078'); r(10, 11, 4, 1, '#4a4f58');
      const cB = document.createElement('canvas');
      cB.width = 24; cB.height = 11;
      const m = cB.getContext('2d');
      m.drawImage(cA, 0, 0, 24, 11, 0, 0, 24, 11);
      m.clearRect(0, 0, 7, 11); m.clearRect(18, 0, 6, 11); m.clearRect(6, 0, 6, 8);
      d.p0 = Art.spriteFromCanvas(cA);
      d.p1 = Art.spriteFromCanvas(cC);
      d.p2 = Art.spriteFromCanvas(cB);
      d.claw = [0, 2].map(g => Art.makeSprite(14, 12, (c, r) => {
        r(0, 3, 5, 6, '#5a616c'); r(0, 3, 5, 1, '#8a929c'); r(1, 5, 2, 2, '#ff3020');
        r(4, 1 + g, 8, 2, '#8a929c'); r(11, 3 + g, 2, 2, '#5a616c');
        r(4, 9 - g, 8, 2, '#8a929c'); r(11, 7 - g, 2, 2, '#5a616c');
        r(5, 5, 5, 2, '#6a7078');
      }));
      d.b0 = { x: b.x, y: b.y };
      const dist = Math.hypot(b.x - p.x, b.y - p.y) || 1;
      const ux = (b.x - p.x) / dist, uy = (b.y - p.y) / dist;
      d.u = { x: ux, y: uy };
      const reach = Math.min(dist, 1.45), tx = p.x + ux * reach, ty = p.y + uy * reach;
      d.b1 = !Level.isBlocked(tx, ty) && Level.hasLOS(b.x, b.y, tx, ty) ? { x: tx, y: ty } : { x: b.x, y: b.y };
      const free = (x, y) => !Level.isBlocked(x, y) && Level.hasLOS(x, y, p.x, p.y) && Level.hasLOS(x, y, d.b1.x, d.b1.y);
      const mx = (p.x + d.b1.x) / 2, my = (p.y + d.b1.y) / 2, nx = -uy, ny = ux;
      d.side = null;
      for (const dd of [3.2, 2.8, 2.4, 2, 1.7, 1.4, 1.1]) {
        for (const sg of [1, -1]) if (!d.side && free(mx + nx * sg * dd, my + ny * sg * dd)) d.side = { x: mx + nx * sg * dd, y: my + ny * sg * dd, s: sg };
      }
      if (!d.side) d.side = free(p.x - ux * 1.2, p.y - uy * 1.2) ? { x: p.x - ux * 1.2, y: p.y - uy * 1.2, s: 1 } : { x: p.x - ux * 0.5, y: p.y - uy * 0.5, s: 1 };
      const sg = d.side.s;
      d.ots = [0.45, 0.3, 0.15].map(k => ({ x: p.x + nx * sg * k - ux * 0.05, y: p.y + ny * sg * k - uy * 0.05 }))
        .find(c => !Level.isBlocked(c.x, c.y) && Level.hasLOS(c.x, c.y, d.b1.x, d.b1.y)) || d.side;
      const fx = d.side.x - p.x, fy = d.side.y - p.y, fl = Math.hypot(fx, fy) || 1;
      d.close = { x: p.x + fx / fl * 1.05, y: p.y + fy / fl * 1.05 };
      d.a0 = Math.atan2(uy, ux);
      d.crowd = [];
      const types = ['basic', 'heavy', 'ranged', 'basic', 'fast'];
      for (const [along, across] of [[1.5, 0.7], [2.3, -0.2], [1.6, -1.1], [3, 0.9], [2.6, -1.6], [1.2, 1.5]]) {
        const x1 = d.b1.x + ux * along - nx * sg * across, y1 = d.b1.y + uy * along - ny * sg * across;
        if (Level.isBlocked(x1, y1) || !Level.hasLOS(d.b1.x, d.b1.y, x1, y1)) continue;
        let x0 = x1, y0 = y1;
        for (const k of [3, 2.2, 1.4]) {
          const sx = x1 + ux * k, sy = y1 + uy * k;
          if (!Level.isBlocked(sx, sy) && Level.hasLOS(sx, sy, x1, y1)) { x0 = sx; y0 = sy; break; }
        }
        const type = types[d.crowd.length];
        d.crowd.push({ type, x0, y0, x1, y1, h: ROBOTS[type].height, delay: d.crowd.length * 0.25 });
        if (d.crowd.length >= 4) break;
      }
      const name = d.name = String(game.settings.username || 'PILOT').toUpperCase();
      d.lines = [Lex.c5 + name + Lex.c6, ...Lex.c7];
      b.flash = 0;
      game.shakeAmount = 0;
      Music.play(null);
    },
    tick(game, d, t, prev, dt) {
      const b = d.boss, p = game.player, at = s => prev < s && t >= s;
      if (t < this.CUT && Math.random() < dt * 20) {
        Effects.burst(b.x, b.y, 0.9, { count: 2, colors: ['#40e0ff', '#ffffff', '#2080ff'], speed: 1, up: 1.5, size: 0.03, life: 0.6, gravity: -0.5 });
      }
      const k = Cutscene.ease((t - this.CUT) / 1.2);
      b.x = Cutscene.lerp(d.b0.x, d.b1.x, k); b.y = Cutscene.lerp(d.b0.y, d.b1.y, k);
      if (t > this.CUT && k < 1) b.animTime += dt;
      b.windup = t > this.REACH && t < this.BACK ? 0.5 : 0;
      if (at(0.1)) Sound.play('zap', 0.8);
      if (at(1.7) || at(2.3)) Sound.play('stomp', 0.4);
      if (at(this.REACH)) Sound.play('door', 0.7);
      if (at(this.GRX)) Sound.play('click', 1);
      if (at(this.RX)) {
        Sound.play('switch_on', 1); Sound.play('teleport', 0.6);
        Effects.burst(p.x + d.u.x * 0.1, p.y + d.u.y * 0.1, 0.7, { count: 16, colors: ['#ffffff', '#40e0ff'], speed: 1.2, up: 1, size: 0.02, life: 0.5 });
      }
      if (at(this.BACK)) Sound.play('boss_charge', 0.5);
      const fb = this.TALK + this.LINE, fk = this.LINE * 2 / this.P3;
      if (at(fb)) Sound.play('teleport', 0.4);
      if (at(fb + 2 * fk)) Sound.play('zap', 0.5);
      if (at(fb + 3 * fk)) { Sound.play('glass', 1); Sound.play('glass', 0.7); }
      if (at(fb + 3.7 * fk)) Sound.play('dash', 0.4);
      if (at(fb + 4.3 * fk)) { Sound.play('stomp', 0.8); Sound.play('player_hurt', 0.4); }
      if (at(fb + 5.3 * fk)) Sound.play('dash', 0.6);
      const h0 = this.TALK + this.P5 * this.LINE, L = this.LINE;
      if (at(h0)) Sound.play('teleport', 0.4);
      for (const [k, snd, v] of [[1.8, 'zap', 0.35], [2.4, 'robot_die', 0.35], [3.3, 'robot_die', 0.3], [L + 0.8, 'stomp', 0.4], [L + 1.4, 'stomp', 0.4],
        [L + 2.2, 'zap', 0.3], [L + 2.6, 'robot_die', 0.35], [L + 3.4, 'robot_die', 0.4], [L + 4, 'robot_die', 0.4], [2 * L + 1, 'switch_on', 0.4], [2 * L + 3.6, 'boss_charge', 0.4]]) {
        if (at(h0 + k)) Sound.play(snd, v);
      }
      for (let i = 0; i < d.lines.length; i++) if (at(this.TALK + i * this.LINE)) Sound.play('robot_alert', 0.35);
      const li = (t - this.TALK) / this.LINE;
      if (li >= 0 && li < d.lines.length && (li % 1) * this.LINE < d.lines[li | 0].length / 30 && Math.random() < dt * 12) {
        Effects.addLight(b.x, b.y, [1, 0.3, 0.2], 2.5, 0.45, 0.12);
      }
    },
    camera(game, d, t) {
      const C = Cutscene, p = game.player, b = d.boss;
      const look = (x, y, tx, ty, fov, zc) => {
        const f = CONFIG.FOV * fov, dist = Math.max(0.4, Math.hypot(tx - x, ty - y));
        const hs = (zc - CONFIG.EYE) * (CONFIG.WIDTH / 2) / Math.tan(f / 2) / dist;
        return { x, y, angle: Math.atan2(ty - y, tx - x), fov: f, horizonShift: Math.max(-40, Math.min(130, hs)) };
      };
      const mid = { x: (p.x + b.x) / 2, y: (p.y + b.y) / 2 };
      const lineAt = (t - this.TALK) / this.LINE;
      let cam;
      if (t < this.CUT) {
        cam = { x: p.x, y: p.y, angle: d.a0, fov: CONFIG.FOV * (1 - C.ease(t / this.CUT) * 0.15), horizonShift: 0 };
      } else if (t < this.REACH) {
        const k = C.ease((t - this.CUT) / 1.6) * 0.12;
        cam = look(C.lerp(d.side.x, mid.x, k), C.lerp(d.side.y, mid.y, k), mid.x, mid.y, 1.2, 0.95);
      } else if (t < this.BACK) {
        const k = C.ease((t - this.REACH) / 1.2) * 0.22;
        const ax = p.x + d.u.x * 1.1, ay = p.y + d.u.y * 1.1;
        cam = look(C.lerp(d.side.x, d.close.x, k), C.lerp(d.side.y, d.close.y, k), ax, ay, 1.15, 0.85);
      } else {
        const shot = t < this.TALK ? 'face' : this.SHOTS[Math.min(this.SHOTS.length - 1, Math.floor(lineAt))];
        const k = t < this.TALK ? C.ease((t - this.BACK) / 1.6) : C.ease(lineAt % 1);
        if (shot === 'flash' || shot === 'rec') { game.extraSprites = null; return null; }
        if (shot === 'face') {
          cam = look(C.lerp(d.close.x, p.x, k * 0.15), C.lerp(d.close.y, p.y, k * 0.15), p.x, p.y, 0.85, 0.68);
        } else if (shot === 'warden') {
          cam = look(d.ots.x, d.ots.y, b.x, b.y, 1.3, 1.3);
        } else {
          const w = (1 - k) * 0.15;
          cam = look(C.lerp(d.side.x, mid.x, w), C.lerp(d.side.y, mid.y, w), mid.x, mid.y, 1.2, 0.95);
        }
      }
      game.extraSprites = this.sprites(game, d, t, cam);
      return cam;
    },
    sprites(game, d, t, cam) {
      const C = Cutscene, p = game.player, b = d.boss;
      const cl = Math.hypot(cam.x - p.x, cam.y - p.y) || 1;
      const tox = (cam.x - p.x) / cl, toy = (cam.y - p.y) / cl;
      const rx = toy, ry = -tox;
      const H = 0.9, faceH = H * 11 / 32;
      const off = (x, y, k) => ({ x: x + tox * k, y: y + toy * k });
      const revealed = t >= this.RX;
      const list = [{ x: p.x, y: p.y, z: 0, h: H, sprite: revealed ? d.p1 : d.p0 }];
      for (const r of d.crowd) {
        const k = C.ease((t - this.REACH + 0.6 - r.delay) / 2.2);
        const frames = Art.sprites[r.type];
        const walking = k > 0 && k < 1;
        list.push({ x: C.lerp(r.x0, r.x1, k), y: C.lerp(r.y0, r.y1, k), z: 0, h: r.h,
          sprite: walking && ((t * 5) | 0) & 1 ? frames.walk1 : frames.walk0 });
      }
      let e = 0;
      if (t >= this.REACH && t < this.GRX) e = C.ease((t - this.REACH) / (this.GRX - this.REACH));
      else if (t >= this.GRX && t < this.RX) e = 1;
      else if (t >= this.RX) e = 1 - C.ease((t - this.RX) / (this.BACK - this.RX));
      const sx = b.x - d.u.x * 0.3, sy = b.y - d.u.y * 0.3, sz = 1.15;
      const g = off(p.x + d.u.x * 0.16, p.y + d.u.y * 0.16, 0.05), gz = H - faceH / 2;
      const ex = C.lerp(sx, g.x, e), ey = C.lerp(sy, g.y, e), ez = C.lerp(sz, gz, e);
      if (e > 0.02) {
        const n = Math.ceil(Math.hypot(ex - sx, ey - sy, ez - sz) * 18);
        const dark = Effects.color('#4a4f58'), light = Effects.color('#7a828c');
        for (let i = 0; i <= n; i++) {
          const k = i / Math.max(1, n);
          list.push({ x: C.lerp(sx, ex, k), y: C.lerp(sy, ey, k), z: C.lerp(sz, ez, k), size: 0.06, color: i % 3 ? dark : light });
        }
        const lat = (p.x - b.x) * rx + (p.y - b.y) * ry;
        const c = off(ex, ey, 0.03);
        list.push({ x: c.x, y: c.y, z: ez - 0.13, h: 0.26, sprite: d.claw[t >= this.GRX ? 1 : 0], mirror: lat < 0 });
      }
      if (!revealed) { const mk = off(p.x, p.y, 0.03); list.push({ x: mk.x, y: mk.y, z: H - faceH, h: faceH, sprite: d.p2 }); }
      else if (e > 0.02) { const mk = off(ex, ey, 0.02); list.push({ x: mk.x, y: mk.y, z: ez - faceH / 2, h: faceH, sprite: d.p2 }); }
      if (t > this.BACK) {
        const glow = 0.5 + Math.abs(Math.sin(t * 3)) * 0.5, ez2 = H * (1 - 5.5 / 32);
        for (const sgn of [-1, 1]) {
          const w = off(p.x + rx * sgn * 0.07, p.y + ry * sgn * 0.07, 0.05);
          list.push({ x: w.x, y: w.y, z: ez2, size: 0.03 + glow * 0.02, color: d.eye, bright: true });
        }
      }
      return list;
    },
    overlay(ctx, game, d, t, W, H) {
      const C = Cutscene, VH = CONFIG.VIEW_H;
      if (t < this.CUT) {
        C.fade(ctx, W, VH, '#30c8ff', 0.15 + Math.sin(t * 12) * 0.05);
        C.bars(ctx, W, VH, Math.min(1, t * 3));
        const s1 = C.type(Lex.c1, t, 0.2, 30);
        if (s1) Font.draw(ctx, s1, 8, 34, '#40e0ff', 1, 'left', null);
        C.fade(ctx, W, VH, '#ffffff', (t - 1.1) * 3);
        return;
      }
      const fb = t - (this.TALK + this.LINE);
      if (fb >= 0 && fb < this.LINE * 2) this.p3(ctx, d, fb * this.P3 / (this.LINE * 2), W, VH);
      const rb = t - (this.TALK + this.P5 * this.LINE);
      if (rb >= 0 && rb < this.LINE * 3) this.p5(ctx, d, rb, W, VH);
      C.bars(ctx, W, VH, 0.65);
      if (t > this.RX + 0.6 && t < this.TALK + 0.4) {
        const a = Math.min(1, this.TALK + 0.4 - t);
        ctx.globalAlpha = Math.max(0, a);
        const n1 = C.type(Lex.c2, t, this.RX + 0.6, 30), n2 = C.type(Lex.c3 + d.name + Lex.c4, t, this.BACK + 0.4, 30);
        if (n1) Font.draw(ctx, n1, 6, 6, '#40e0ff', 1, 'left', null);
        if (n2) Font.draw(ctx, n2, 6, 14, '#40e0ff', 1, 'left', null);
        ctx.globalAlpha = 1;
      }
      const li = Math.floor((t - this.TALK) / this.LINE);
      if (li >= 0) {
        ctx.globalAlpha = 0.8; ctx.fillStyle = '#000'; ctx.fillRect(0, VH - 30, W, 30); ctx.globalAlpha = 1;
        const i = Math.min(li, d.lines.length - 1);
        const s = C.type(d.lines[i], t, this.TALK + i * this.LINE, 30);
        Font.draw(ctx, 'THE WARDEN', 8, VH - 24, '#ff4020', 1, 'left', null);
        if (s) Font.draw(ctx, s, 8, VH - 13, i === this.GOLD ? '#ffd040' : '#e8ecf0', 1, 'left', null);
      }
      C.fade(ctx, W, VH, '#ffffff', 1 - (t - this.CUT) * 3);
      C.fade(ctx, W, H, '#ffffff', (t - this.length + 1.4) * 1.2);
    },
    p3(ctx, d, ft, W, VH) {
      const C = Cutscene, cx = W / 2, top = 20, bot = VH - 20;
      if (!d.shards) {
        d.shards = Array.from({ length: 26 }, () => ({ x: (Math.random() - 0.5) * 60, y: 10 + Math.random() * 100, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 1.5, s: 1 + (Math.random() * 3 | 0) }));
        d.cracks = [[-10, 40], [8, 70], [-4, 100], [14, 55]].map(([x, y]) => {
          const pts = [[x, y]];
          for (let i = 0; i < 7; i++) { const [px, py] = pts[pts.length - 1]; pts.push([px + (Math.random() - 0.5) * 16, py + (Math.random() - 0.4) * 14]); }
          return pts;
        });
      }
      ctx.fillStyle = '#071410'; ctx.fillRect(0, 0, W, VH);
      ctx.fillStyle = '#0c2018';
      for (let x = 0; x < W; x += 24) ctx.fillRect(x, 0, 1, VH);
      for (let y = 0; y < VH; y += 24) ctx.fillRect(0, y, W, 1);
      for (const ox of [-140, -96, 96, 140]) {
        ctx.fillStyle = '#14302a'; ctx.fillRect(cx + ox - 14, top + 18, 28, bot - top - 26);
        ctx.fillStyle = '#1e5a48'; ctx.fillRect(cx + ox - 11, top + 24, 22, bot - top - 38);
        ctx.fillStyle = '#2a7a60'; ctx.fillRect(cx + ox - 4, top + 50, 8, 26);
      }
      const broke = ft >= 3, gw = 34, gx = cx - gw, gy = top + 10, gh = bot - top - 22;
      const s = 2.6, pw = 24 * s, ph = 32 * s;
      let px = cx - pw / 2, py = gy + 8 + Math.sin(ft * 2) * 2;
      let fall = 0; // 0 standing, 1 flat on your face
      if (ft > 3.6) {
        px += (Math.min(ft, 4.1) - 3.6) * 60;                              // first steps...
        if (ft > 4.1) { px += Math.min(ft - 4.1, 0.3) * 70; fall = C.ease((ft - 4.1) / 0.22); } // ...slip
        if (ft > 5) fall = 1 - C.ease((ft - 5) / 0.3);                      // get up
        if (ft > 5.3) px += (ft - 5.3) * W * 1.1;                           // and run
        const running = ft < 4.1 || ft > 5.3;
        py = gy + 14 - (running ? Math.abs(Math.sin(ft * 14)) * 3 : 0);
      } else if (broke) py = gy + 8 + (ft - 3) * 10;
      if (!broke) { ctx.fillStyle = 'rgba(40,190,130,0.35)'; ctx.fillRect(gx, gy, gw * 2, gh); }
      ctx.imageSmoothingEnabled = false;
      ctx.save();
      ctx.translate(Math.round(px + pw / 2), Math.round(py + ph)); // turn around the feet
      ctx.rotate(fall * Math.PI / 2);
      ctx.drawImage(d.p0.canvas, -pw / 2, -ph, pw, ph);
      if (ft > 2) {
        ctx.fillStyle = `rgba(80,230,255,${0.5 + 0.4 * Math.abs(Math.sin(ft * 10))})`;
        ctx.fillRect(Math.round(9 * s - pw / 2), Math.round(5 * s - ph), Math.round(2 * s), Math.round(1.5 * s));
      }
      ctx.restore();
      if (ft > 4.3 && ft < 5) Font.draw(ctx, 'SPLAT!', Math.round(px + pw / 2 + ph - 10), Math.round(py + ph - 26), '#ffffff', 2, 'center', '#000');
      if (!broke) {
        ctx.fillStyle = 'rgba(160,255,220,0.12)'; ctx.fillRect(gx, gy, gw * 2, gh);
        ctx.fillStyle = 'rgba(220,255,240,0.35)'; ctx.fillRect(gx + 6, gy + 4, 3, gh - 8);
        ctx.fillStyle = 'rgba(200,255,230,0.6)';
        for (let i = 0; i < 14; i++) ctx.fillRect(gx + 6 + (i * 37) % (gw * 2 - 12), gy + gh - (ft * 30 + i * 23) % gh, 2, 2);
        if (ft > 2) {
          const k = Math.min(1, ft - 2);
          ctx.fillStyle = '#e8fff6';
          for (const pts of d.cracks) {
            const n = Math.floor(k * (pts.length - 1));
            for (let i = 0; i < n; i++) {
              const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], steps = 8;
              for (let j = 0; j <= steps; j++) ctx.fillRect(Math.round(cx + x0 + (x1 - x0) * j / steps), Math.round(gy + y0 + (y1 - y0) * j / steps), 1, 1);
            }
          }
        }
      } else {
        const st = ft - 3;
        ctx.fillStyle = 'rgba(200,255,235,0.85)';
        for (const sh of d.shards) {
          const x = cx + sh.x + sh.vx * st * 60, y = gy + sh.y + sh.vy * st * 60 + 60 * st * st;
          if (y < VH) ctx.fillRect(Math.round(x), Math.round(y), sh.s, sh.s);
        }
        ctx.fillStyle = 'rgba(40,190,130,0.45)';
        const spill = Math.min(1, st * 1.5) * 50;
        ctx.fillRect(gx - spill, gy + gh - 3, gw * 2 + spill * 2, 3);
      }
      ctx.fillStyle = '#4a5258'; ctx.fillRect(gx - 6, gy - 10, gw * 2 + 12, 10); ctx.fillRect(gx - 6, gy + gh, gw * 2 + 12, 12);
      ctx.fillStyle = '#7a848c'; ctx.fillRect(gx - 6, gy - 10, gw * 2 + 12, 2);
      ctx.fillStyle = broke ? '#ff3020' : '#40ff80'; ctx.fillRect(cx - 3, gy + gh + 4, 6, 3);
      C.fade(ctx, W, VH, '#ffffff', 1 - Math.abs(ft - 3) * 5);
      ctx.fillStyle = 'rgba(255,190,110,0.10)'; ctx.fillRect(0, 0, W, VH);
      if (((ft * 24) | 0) % 7 === 0) { ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(0, 0, W, VH); }
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let i = 0; i < 3; i++) ctx.fillRect(0, ((ft * 97 + i * 61) % VH) | 0, W, 1);
      Font.draw(ctx, Lex.f5, W - 8, 22, '#c8b090', 1, 'right', null);
      [[Lex.f1, 0.2, '#40e0ff'], [Lex.f2, 1.2, '#40e0ff'], [Lex.f3, 2.4, '#ff4030'], [Lex.f4, 3.8, '#ffb040']].forEach(([txt, at, col], i) => {
        const str = C.type(txt, ft, at, 32);
        const jitter = i >= 2 && ((ft * 20) | 0) % 5 === 0 ? 1 : 0;
        if (str) Font.draw(ctx, str, 8 + jitter, 22 + i * 8, col, 1, 'left', null);
      });
      C.fade(ctx, W, VH, '#ffffff', 1 - ft * 4);
      C.fade(ctx, W, VH, '#ffffff', (ft - (this.P3 - 0.25)) * 4);
    },
    // Drawn panel P5, three parts (one per line).
    p5(ctx, d, ht, W, VH) {
      const C = Cutscene, L = this.LINE, gy = VH - 40, rnd = Math.random;
      if (!d.rec) {
        const town = [];
        for (let x = -4; x < W;) { const w = 16 + (rnd() * 24 | 0); town.push({ x, w, h: 34 + (rnd() * 56 | 0), burn: 1.6 + rnd() * 3 }); x += w + 2; }
        d.rec = {
          stars: Array.from({ length: 70 }, () => [rnd() * W | 0, 18 + (rnd() * (gy - 50)) | 0, rnd() * 6]),
          town,
          ships: [[0.22, 40, 0], [0.52, 28, 0.5], [0.8, 46, 0.9]].map(([fx, y, dl], i) => ({ x: fx * W, y, dl, hit: 2.2 + i * 0.6 })),
          people: Array.from({ length: 10 }, (_, i) => ({ x: 60 + i * 30 + rnd() * 14, v: 16 + rnd() * 12, fall: 1.8 + rnd() * 3 })),
          foes: Array.from({ length: 4 }, (_, i) => ({ x: W - 60 - i * 40, type: i % 2 ? 'xb' : 'xa', hit: 1.6 + i * 0.5 })),
        };
      }
      const R = d.rec, part = Math.min(2, Math.floor(ht / L)), pt = ht - part * L;
      const box = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
      const spr = (type, x, bottom, size, f = 'walk0') => {
        const set = Art.sprites[type] || Art.sprites.basic;
        ctx.drawImage((set[f] || set.walk0).canvas, Math.round(x - size / 2), Math.round(bottom - size), size, size);
      };
      const fig = (x, y, coat, step) => {
        box(x, y - 14, 4, 4, '#d8a07a'); box(x, y - 10, 4, 6, coat);
        box(x + (step ? 0 : -1), y - 4, 2, 4, '#20242c'); box(x + (step ? 2 : 3), y - 4, 2, 4, '#20242c');
      };
      const ship = (x, y, red) => {
        box(x - 12, y, 24, 4, '#3a3048'); box(x - 9, y - 1, 18, 1, '#6a5a84'); box(x - 4, y - 4, 8, 3, '#8adca0');
        for (const o of [-9, -3, 3, 9]) box(x + o - 1, y + 4, 2, 1, red ? '#ff4030' : (((ht * 6) | 0) & 1 ? '#60ff80' : '#2a8040'));
      };
      const boom = (x, y, k) => {
        if (k < 0 || k > 1) return;
        const r = 3 + k * 10;
        ctx.globalAlpha = 1 - k;
        box(x - r, y - r, r * 2, r * 2, '#ff8030'); box(x - r / 2, y - r / 2, r, r, '#fff0c0');
        ctx.globalAlpha = 1;
      };
      const sky = (glow) => {
        box(0, 0, W, VH, '#070a14');
        for (const [x, y, ph] of R.stars) box(x, y, 1, 1, Math.sin(ht * 2 + ph) > -0.6 ? '#c8d0e0' : '#4a5060');
        if (glow > 0) { ctx.globalAlpha = glow; box(0, gy - 70, W, 70, '#ff4018'); ctx.globalAlpha = 1; }
      };
      const city = (when) => {
        for (const b of R.town) {
          const ruined = when > b.burn, h = ruined ? Math.round(b.h * 0.55) : b.h, top = gy - h;
          box(b.x, top, b.w, h, ruined ? '#10141c' : '#18202e');
          if (ruined) for (let x = 0; x < b.w; x += 4) box(b.x + x, top - ((x * 7 + b.w) % 5), 4, 5, '#10141c');
          else for (let wx = 3; wx < b.w - 3; wx += 5) for (let wy = 5; wy < h - 4; wy += 7) if ((wx * 3 + wy) % 4) box(b.x + wx, top + wy, 2, 3, '#e0c060');
          if (ruined && part < 2) for (let i = 0; i < 3; i++) {
            const f = Math.sin(ht * 9 + b.x + i * 2);
            box(b.x + 2 + i * (b.w - 6) / 2, top - 4 - f * 2, 3, 4 + f * 2, f > 0 ? '#ff9030' : '#ff5020');
          }
        }
        box(0, gy, W, VH - gy, '#0c0e14');
      };

      if (part === 0) {
        sky(0.04 + 0.14 * Math.min(1, pt / L));
        city(pt);
        for (const s of R.ships) ship(s.x + Math.sin(ht + s.dl) * 6, C.lerp(-10, s.y, C.ease((pt - s.dl) / 1.4)), false);
        for (const b of R.town) {
          const k = pt - b.burn;
          if (k > -0.3 && k < 0) {
            const s = R.ships.reduce((a, c) => Math.abs(c.x - b.x) < Math.abs(a.x - b.x) ? c : a);
            const bx = b.x + b.w / 2, top = gy - b.h, sx = s.x + Math.sin(ht + s.dl) * 6, sy = s.y + 5;
            for (let i = 0; i <= 24; i++) box(C.lerp(sx, bx, i / 24), C.lerp(sy, top, i / 24), 2, 2, '#90ff60');
          }
          boom(b.x + b.w / 2, gy - b.h * 0.6, k / 0.5);
        }
        for (const p of R.people) {
          if (pt > p.fall) continue;
          fig(p.x - p.v * pt, gy, '#4a6a9a', ((pt * 8) | 0) & 1);
        }
      } else if (part === 1) {
        sky(0.12);
        city(99);
        const kinds = ['heavy', 'basic', 'ranged', 'basic'];
        const robots = kinds.map((type, i) => ({ type, x: 30 + i * 46 - (1 - C.ease(pt / 1.6)) * 200 }));
        const targets = [];
        for (const f of R.foes) {
          const x = f.x - pt * 6;
          if (pt < f.hit) { spr(f.type, x, gy, 32, ((pt * 5) | 0) & 1 ? 'walk1' : 'walk0'); targets.push([x, gy - 16]); }
          boom(x, gy - 16, (pt - f.hit) / 0.6);
        }
        for (const s of R.ships) {
          const x = s.x + Math.sin(ht + s.dl) * 6, k = pt - s.hit;
          if (k < 0) { ship(x, s.y, false); targets.push([x, s.y + 2]); continue; }
          const y = s.y + k * k * 90;
          if (y < gy - 4) { ship(x + k * 20, y, true); box(x + k * 20 - 2, y - 6, 3, 4, '#5a5a60'); }
          boom(x + k * 20, gy - 6, (y - (gy - 4)) / 60);
        }
        robots.forEach((r, i) => {
          spr(r.type, r.x, gy, 44, pt > 1.4 && ((pt * 4 + i) | 0) % 3 === 0 ? 'attack' : (((pt * 5) | 0) + i) & 1 ? 'walk1' : 'walk0');
          if (pt < 1.4 || !targets.length) return;
          const tg = targets[(i + ((pt * 3) | 0)) % targets.length];
          if (((pt * 9 + i * 3) | 0) % 4) return;
          const x0 = r.x + 14, y0 = gy - 26;
          for (let j = 0; j <= 30; j++) box(C.lerp(x0, tg[0], j / 30), C.lerp(y0, tg[1], j / 30), 1, 1, '#ffe060');
        });
      } else {
        box(0, 0, W, VH, '#0a1418');
        for (let x = 0; x < W; x += 24) box(x, 0, 1, VH, '#10222a');
        for (let y = 0; y < VH; y += 24) box(0, y, W, 1, '#10222a');
        const wx = W / 2 - 80, wy = 22, ww = 160, wh = 44;
        box(wx - 3, wy - 3, ww + 6, wh + 6, '#3a464e');
        box(wx, wy, ww, wh, '#04060c');
        for (const [x, y] of R.stars) if (x > wx && x < wx + ww && y < wy + wh - 2) box(x, y + 2, 1, 1, '#a8b0c0');
        for (const [ox, oy, ph] of [[30, 14, 0], [96, 9, 1.3], [128, 24, 2.1]]) if (Math.sin(ht * 5 + ph) > 0) box(wx + ox, wy + oy, 2, 2, '#ff4030');
        const fy = gy - 8; // the floor here sits higher, so the people stay above the subtitles
        const pods = ['basic', 'heavy', 'boss', 'ranged', 'fast'];
        pods.forEach((type, i) => {
          const x = W * (0.14 + i * 0.18), on = pt > 0.8 + i * 0.45, top = fy - 62;
          box(x - 20, top - 6, 40, 6, '#4a5258'); box(x - 20, fy, 40, 6, '#4a5258');
          box(x - 17, top, 34, fy - top, on ? 'rgba(40,190,130,0.35)' : 'rgba(30,60,60,0.5)');
          spr(type, x, fy, type === 'boss' ? 58 : 46);
          box(x - 17, top, 34, fy - top, 'rgba(160,255,220,0.10)');
          box(x - 14, top + 3, 2, fy - top - 6, 'rgba(220,255,240,0.3)');
          box(x - 3, fy + 2, 6, 2, on ? '#40ff80' : '#ff3020');
        });
        fig(W * 0.23 + 6, fy + 16, '#e8ecf0', 0); fig(W * 0.5 + 30, fy + 16, '#e8ecf0', 1); fig(W * 0.77 - 8, fy + 16, '#e8ecf0', 0);
        box(W * 0.5 + 20, fy + 8, 8, 4, '#2a3a40'); box(W * 0.5 + 21, fy + 9, 6, 2, ((ht * 3) | 0) & 1 ? '#40e0ff' : '#2090c0');
      }

      ctx.fillStyle = 'rgba(120,160,255,0.06)'; ctx.fillRect(0, 0, W, VH);
      if (((ht * 24) | 0) % 9 === 0) { ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(0, 0, W, VH); }
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let i = 0; i < 3; i++) ctx.fillRect(0, ((ht * 83 + i * 61) % VH) | 0, W, 1);
      Font.draw(ctx, Lex.r4, W - 8, 22, '#90b0d0', 1, 'right', null);
      const cap = C.type([Lex.r1, Lex.r2, Lex.r3][part], pt, 0.2, 32);
      if (cap) Font.draw(ctx, cap, 8, 22, '#40e0ff', 1, 'left', null);
      C.fade(ctx, W, VH, '#000', 1 - pt * 4);
      C.fade(ctx, W, VH, '#000', (pt - (L - 0.25)) * 4);
    },
    end(game, d) {
      game.extraSprites = null;
      d.boss.windup = 0;
      d.boss.x = d.b1.x; d.boss.y = d.b1.y;
    },
  },
};
