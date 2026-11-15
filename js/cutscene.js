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
  lerp(a, b, k) { return a + (b - a) * k; },

  // A spot `dist` tiles from (x, y) with a clear view of it, facing it.
  viewpoint(x, y, dist) {
    for (const d of [dist, dist + 1, dist - 1, dist + 2, dist - 2, 3]) {
      for (let k = 0; k < 48; k++) {
        const a = k / 48 * Math.PI * 2, vx = x + Math.cos(a) * d, vy = y + Math.sin(a) * d;
        if (Level.isBlocked(vx, vy) || !Level.hasLOS(vx, vy, x, y)) continue;
        return { x: vx, y: vy, angle: a + Math.PI };
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
    start(game, d) {
      const p = game.player;
      d.angle = p.angle;
      d.title = game.chapter ? 'CHAPTER ' + (Campaign.index + 1) + ': ' + game.chapter.title : LEVELS[Level.mapId].name;
      d.sub = game.chapter ? Campaign.hudGoal(game) || 'DESTROY THE WARDEN'
        : game.mode === 'endless' ? 'ENDLESS - SURVIVE AS LONG AS YOU CAN'
        : game.mode === 'drill' ? Lex.d6 + game.formatTime(Drill.LENGTH)
          : 'SURVIVE ' + game.formatTime(CONFIG.BOSS_TIME) + ', THEN DESTROY THE WARDEN';
      d.typed = 0;
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
      const lines = ['SCRAP OS V0.1', 'OPTIC SYSTEM........OK', 'TARGETING...........OK', 'THREATS DETECTED: MANY'];
      lines.forEach((l, i) => {
        const s = C.type(l, t, 0.2 + i * 0.7, 40);
        if (s) Font.draw(ctx, s, 6, 6 + i * 7, i === 3 ? '#ff6040' : '#40e0ff', 1, 'left', null);
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

  // The Warden arrives: alarm, cut to it, it powers up, name card, back to the player.
  warden: {
    length: 5.2,
    start(game, d) {
      const b = game.boss;
      d.view = Cutscene.viewpoint(b.x, b.y, 6);
      d.boss = b;
      b.timer = 1.5;
      Sound.play('boss_alarm');
    },
    tick(game, d, t, prev, dt) {
      const b = d.boss;
      if (t > 0.6) b.timer = Math.max(0, 1.5 - (t - 0.6) * 0.8); // materializes
      if (Math.random() < dt * 10 && t > 0.6 && t < 2.6) {
        Effects.burst(b.x + (Math.random() - 0.5), b.y + (Math.random() - 0.5), 0.3 + Math.random(), { count: 6, colors: ['#ff4020', '#ffffff', '#ff60f0'], speed: 2, up: 3, size: 0.04, life: 0.6 });
        Effects.addLight(b.x, b.y, [1, 0.3, 0.2], 6, 1.4, 0.3);
      }
      if (prev < 2.4 && t >= 2.4) { Sound.play('boss_roar', 1.2); game.shake(0.8); }
      if (prev < 2.4 && t >= 2.4) Sound.play('stomp', 1);
      game.shakeAmount = Math.max(0, game.shakeAmount - dt * 1.5);
      b.animTime += dt;
    },
    camera(game, d, t) {
      if (t < 0.6) return game.camera(0); // a moment of the alarm from the player's eyes
      const C = Cutscene, v = d.view, b = d.boss, k = C.ease((t - 0.6) / 4);
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
      C.bars(ctx, W, VH, Math.min(1, (t - 0.6) * 3) * (1 - C.ease((t - 4.6) / 0.5)));
      if (t > 2.4) {
        const a = Math.min(1, (t - 2.4) * 3) * (1 - C.ease((t - 4.4) / 0.5));
        const slide = Math.round((1 - C.ease((t - 2.4) * 2.5)) * 60);
        ctx.globalAlpha = Math.max(0, a);
        Font.draw(ctx, 'THE WARDEN', W / 2 - slide, VH - 46, '#ff4020', 3, 'center', '#300404');
        Font.draw(ctx, 'GUARDIAN OF SECTOR 7', W / 2 + slide, VH - 24, '#c8d0d8', 1, 'center');
        ctx.globalAlpha = 1;
      }
      C.fade(ctx, W, VH, '#000', 1 - (t - 0.6) * 4);       // quick fade in after the cut
      C.fade(ctx, W, VH, '#000', (t - 4.8) * 3);            // and out at the end
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
    start(game, d) {
      const b = game.boss;
      d.boss = b;
      d.view = Cutscene.viewpoint(b.x, b.y, 5.5);
      d.points = Math.round(b.def.score * game.diff.scoreMult * game.modMult);
      Music.play(null);
      Sound.play('boss_roar', 1);
    },
    tick(game, d, t, prev, dt) {
      const b = d.boss;
      game.shakeAmount = Math.max(0, game.shakeAmount - dt);
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
      C.fade(ctx, W, VH, '#ffffff', 0.8 - (t - 3) * 3);     // and at the final blast
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
    length: 29.5,
    CUT: 1.4, REACH: 3, GRX: 4, RX: 4.4, BACK: 5.4, TALK: 7, LINE: 3,
    SHOTS: ['warden', 'face', 'warden', 'face', 'wide', 'warden', 'wide'],
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
        if (s) Font.draw(ctx, s, 8, VH - 13, i === 3 ? '#ffd040' : '#e8ecf0', 1, 'left', null);
      }
      C.fade(ctx, W, VH, '#ffffff', 1 - (t - this.CUT) * 3);
      C.fade(ctx, W, H, '#ffffff', (t - this.length + 1.4) * 1.2);
    },
    end(game, d) {
      game.extraSprites = null;
      d.boss.windup = 0;
      d.boss.x = d.b1.x; d.boss.y = d.b1.y;
    },
  },
};
