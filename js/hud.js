'use strict';
// Status bar, crosshair, messages, damage flashes and the sniper scope overlay.

const HUD = {
  init() {
    this.bar = this.buildBar();
    this.scopeMask = this.buildScopeMask();
    this.portraits = null;
  },

  // Called when a run starts, because the portrait depends on the avatar.
  setAvatar(av) {
    this.portraits = { normal: Art.portrait(av, false), hurt: Art.portrait(av, true) };
  },

  buildBar() {
    const W = CONFIG.WIDTH, H = CONFIG.HUD_H;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const n = Art.hash(x, y, 77) * 10;
        const v = 52 + n - (y === 0 ? -30 : 0) - (y === 1 ? -14 : 0);
        ctx.fillStyle = `rgb(${v | 0},${(v + 3) | 0},${(v + 8) | 0})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    for (const [x0, x1] of this.sections) {
      ctx.fillStyle = '#121418'; ctx.fillRect(x0, 3, x1 - x0, H - 5);
      ctx.fillStyle = '#7a808a'; ctx.fillRect(x0, H - 2, x1 - x0, 1); ctx.fillRect(x1, 3, 1, H - 4);
      ctx.fillStyle = '#26292e'; ctx.fillRect(x0, 3, x1 - x0, 1); ctx.fillRect(x0, 3, 1, H - 5);
    }
    for (let x = 4; x < W; x += 24) { ctx.fillStyle = '#8a9098'; ctx.fillRect(x, 1, 1, 1); }
    return c;
  },

  sections: [[3, 76], [79, 160], [163, 221], [224, 301], [304, 381]],

  buildScopeMask() {
    const W = CONFIG.WIDTH + 120, H = CONFIG.VIEW_H;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(W, H);
    const d = new Uint32Array(img.data.buffer);
    const cx = W / 2, cy = H / 2, R = 82;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (r > R + 2) d[y * W + x] = 0xff000000;
        else if (r > R) d[y * W + x] = 0xff202020;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(cx - R, cy, R - 6, 1); ctx.fillRect(cx + 6, cy, R - 6, 1);
    ctx.fillRect(cx, cy - R, 1, R - 6); ctx.fillRect(cx, cy + 6, 1, R - 6);
    ctx.fillRect(cx - 30, cy - 1, 1, 3); ctx.fillRect(cx + 30, cy - 1, 1, 3);
    ctx.fillRect(cx - 1, cy + 30, 3, 1);
    ctx.fillStyle = '#ff2020';
    ctx.fillRect(cx, cy, 1, 1);
    return c;
  },

  // Radio message (Game.say): who is talking, and the words typed out, at the bottom of the view.
  radio(ctx, game, W, VH) {
    const r = game.radio;
    if (!r) return;
    const fade = Math.min(1, r.t * 4, (r.dur - r.t) * 2);
    if (fade <= 0) return;
    ctx.globalAlpha = 0.75 * fade;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, VH - 26, W, 22);
    ctx.globalAlpha = fade;
    Font.draw(ctx, r.who, 6, VH - 23, r.color, 1, 'left', null);
    Font.draw(ctx, r.text.slice(0, Math.floor(r.t * 40)), 6, VH - 13, '#e8ecf0', 1, 'left', null);
    ctx.globalAlpha = 1;
  },

  draw(ctx, game) {
    const W = CONFIG.WIDTH, VH = CONFIG.VIEW_H;
    const ws = game.weapons, p = game.player, def = ws.def, st = ws.state;
    const cx = W / 2, cy = VH / 2;

    if (ws.scoped) {
      const sway = ws.swayOffset() * game.cameraProjDist();
      ctx.drawImage(this.scopeMask, Math.round(-60 + sway), 0);
    } else {
      this.crosshair(ctx, cx, cy, ws.currentSpread() * game.cameraProjDist());
    }

    if (game.hitMarker > 0) {
      ctx.fillStyle = '#ffffff';
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        ctx.fillRect(cx + sx * 4, cy + sy * 4, 1, 1);
        ctx.fillRect(cx + sx * 5, cy + sy * 5, 1, 1);
      }
    }

    if (ws.reloading) {
      const prog = 1 - ws.reloadTimer / ws.reloadTime();
      Font.draw(ctx, 'RELOADING', cx, cy + 14, '#ffd040', 1, 'center');
      ctx.fillStyle = '#000'; ctx.fillRect(cx - 20, cy + 22, 40, 3);
      ctx.fillStyle = '#ffd040'; ctx.fillRect(cx - 20, cy + 22, Math.round(40 * prog), 3);
    } else if (st.mag === 0 && st.reserve === 0) {
      Font.draw(ctx, 'NO AMMO - SWITCH WEAPON', cx, cy + 14, '#ff5040', 1, 'center');
    }

    if (game.usePrompt) Font.draw(ctx, game.usePrompt, cx, cy + 30, '#40e0ff', 1, 'center');

    // boss health bar
    let my = 4;
    const boss = game.boss;
    if (boss && boss.state !== 'wreck') {
      const bw = 160, bx = Math.round(cx - bw / 2), frac = Math.max(0, boss.hp / boss.maxHp);
      const col = boss.bossPhase === 3 ? '#b08060' : boss.bossPhase === 2 ? '#ff7030' : '#e0a030';
      Font.draw(ctx, 'THE WARDEN', cx, 4, col, 1, 'center');
      ctx.fillStyle = '#000'; ctx.fillRect(bx - 1, 11, bw + 2, 6);
      ctx.fillStyle = '#3a0c0c'; ctx.fillRect(bx, 12, bw, 4);
      ctx.fillStyle = col; ctx.fillRect(bx, 12, Math.round(bw * frac), 4);
      for (const t of [0.33, 0.66]) { ctx.fillStyle = '#000'; ctx.fillRect(bx + Math.round(bw * t), 12, 1, 4); }
      my = 21;
    } else if (game.mode === 'drill' && Drill.lead && Drill.lead.state !== 'wreck') {
      const q = Drill.lead, bw = 160, bx = Math.round(cx - bw / 2), frac = Math.max(0, q.hp / q.maxHp);
      Font.draw(ctx, q.def.name, cx, 4, '#80ff40', 1, 'center');
      ctx.fillStyle = '#000'; ctx.fillRect(bx - 1, 11, bw + 2, 6);
      ctx.fillStyle = '#0c2a0c'; ctx.fillRect(bx, 12, bw, 4);
      ctx.fillStyle = '#80ff40'; ctx.fillRect(bx, 12, Math.round(bw * frac), 4);
      my = 21;
    } else if (game.miniBoss && game.miniBoss.alive) {
      const mb = game.miniBoss, bw = 110, bx = Math.round(cx - bw / 2), frac = Math.max(0, mb.hp / mb.maxHp);
      Font.draw(ctx, Elites.name(mb), cx, 4, '#ffd040', 1, 'center');
      ctx.fillStyle = '#000'; ctx.fillRect(bx - 1, 11, bw + 2, 5);
      ctx.fillStyle = '#3a2a08'; ctx.fillRect(bx, 12, bw, 3);
      ctx.fillStyle = '#ffd040'; ctx.fillRect(bx, 12, Math.round(bw * frac), 3);
      my = 20;
    }

    // messages (pickups, kills)
    for (const m of game.messages) {
      if (m.t > 2.2 && ((m.t * 8) | 0) % 2) { my += 8; continue; }
      Font.draw(ctx, m.text, cx, my, m.color, 1, 'center');
      my += 8;
    }
    Tutorial.draw(ctx, game, cx, Math.max(my + 4, 44));
    Font.draw(ctx, 'KILLS ' + game.kills, W - 4, 4, '#c8d0d8', 1, 'right');
    let ty = 4;
    if (game.mode === 'endless') { Font.draw(ctx, 'WAVE ' + game.wave, 4, ty, '#ff9040', 1, 'left'); ty += 8; }
    if (MapEvents.active) {
      const ev = MapEvents.KINDS[MapEvents.active.kind];
      Font.draw(ctx, ev.name + ' ' + Math.ceil(MapEvents.active.left) + 'S', 4, ty + 8, ev.color, 1, 'left');
    }
    const goal = game.chapter ? Campaign.hudGoal(game) : null;
    const guide = game.guide;
    if (guide && (game.time > guide.until || Math.hypot(guide.x - p.x, guide.y - p.y) < 1.5)) game.guide = null;
    if (game.guide) this.goalArrow(ctx, game, W, game.guide); // e.g. the secret room a switch opened
    else if (goal) this.goalArrow(ctx, game, W, Campaign.target(game));
    if (goal) {
      Font.draw(ctx, goal, 4, ty, '#40e0ff', 1, 'left');
    } else if (game.mode === 'drill') {
      Font.draw(ctx, Drill.lead ? Lex.q5 : Lex.d5 + game.formatTime(Math.ceil(Math.max(0, Drill.LENGTH - game.time))), 4, ty, '#80ff40', 1, 'left');
      Font.draw(ctx, Lex.q8 + game.allies.length, 4, ty + 8, '#40e0ff', 1, 'left');
    } else if (boss) {
      Font.draw(ctx, 'DESTROY THE WARDEN', 4, ty, '#ff6040', 1, 'left');
    } else {
      const left = Math.max(0, BossFight.nextAt - game.time);
      const urgent = left <= 30 && ((game.time * 4) | 0) % 2;
      const txt = 'WARDEN IN ' + game.formatTime(Math.ceil(left));
      Font.draw(ctx, txt, 4, ty, urgent ? '#ff6040' : '#c8d0d8', 1, 'left');
      const cut = BossFight.cut;
      if (cut && game.time - cut.at < 1.2) Font.draw(ctx, '-' + cut.s.toFixed(1) + 'S', 8 + txt.length * 4, ty, '#60ff80', 1, 'left');
    }

    this.combo(ctx, W, VH);
    this.toast(ctx, game, W);
    this.radio(ctx, game, W, VH);

    // full-screen color washes
    if (p.hurtTimer > 0) {
      ctx.fillStyle = `rgba(255,0,0,${Math.min(0.45, p.hurtTimer * 1.3)})`;
      ctx.fillRect(0, 0, W, VH);
    }
    if (game.flash.t > 0) {
      ctx.globalAlpha = Math.min(0.35, game.flash.t * 2);
      ctx.fillStyle = game.flash.color;
      ctx.fillRect(0, 0, W, VH);
      ctx.globalAlpha = 1;
    }
    if (p.hp < 30 && p.alive) {
      const a = 0.25 + Math.sin(game.time * 6) * 0.15;
      ctx.fillStyle = `rgba(200,0,0,${a})`;
      ctx.fillRect(0, 0, W, 4); ctx.fillRect(0, VH - 4, W, 4);
      ctx.fillRect(0, 0, 4, VH); ctx.fillRect(W - 4, 0, 4, VH);
    }

    this.statusBar(ctx, game);
  },

  // Combo counter in the bottom-right of the view, with a bar showing time left to keep it.
  combo(ctx, W, VH) {
    if (Combo.count < 2) return;
    const m = Combo.mult();
    const col = m >= 4 ? '#ff4030' : m >= 2 ? '#ff9040' : '#ffd040';
    Font.draw(ctx, 'COMBO ' + Combo.count, W - 6, VH - 24, col, 1, 'right');
    if (m > 1) Font.draw(ctx, 'X' + m, W - 6, VH - 17, col, 2, 'right');
    else Font.draw(ctx, 'X1', W - 6, VH - 17, '#7a8898', 1, 'right');
    ctx.fillStyle = '#000'; ctx.fillRect(W - 46, VH - 5, 40, 2);
    ctx.fillStyle = col; ctx.fillRect(W - 46, VH - 5, Math.round(40 * Combo.timer / Combo.WINDOW), 2);
  },

  // "ACHIEVEMENT UNLOCKED" box that slides in under the kill counter.
  // Small arrow under the top edge pointing at the nearest campaign goal, with its distance.
  goalArrow(ctx, game, W, t) {
    if (!t) return;
    const p = game.player;
    let a = Math.atan2(t.y - p.y, t.x - p.x) - p.angle;
    a = Math.atan2(Math.sin(a), Math.cos(a));
    const half = CONFIG.FOV / 2;
    const x = Math.round(W / 2 + Math.max(-1, Math.min(1, a / half)) * (W / 2 - 24));
    const y = CONFIG.VIEW_H - 12;
    const col = '#40e0ff';
    const ch = Math.abs(a) <= half ? 'V' : a < 0 ? '<' : '>';
    Font.draw(ctx, ch, x, y - 8, col, 1, 'center');
    Font.draw(ctx, Math.round(Math.hypot(t.x - p.x, t.y - p.y)) + 'M', x, y, col, 1, 'center');
  },

  toast(ctx, game, W) {
    const t = game.toasts[0];
    if (!t) return;
    const slide = Math.min(1, t.t * 5, (3.5 - t.t) * 5);
    const w = Math.max(110, Font.width(t.a.name) + 12), h = 20;
    const x = Math.round(W - 4 - w * slide), y = 13;
    ctx.fillStyle = '#e0a030'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = '#14100a'; ctx.fillRect(x, y, w, h);
    Font.draw(ctx, 'ACHIEVEMENT!', x + 5, y + 3, '#e0a030', 1, 'left');
    Font.draw(ctx, t.a.name, x + 5, y + 11, '#ffffff', 1, 'left');
  },

  CROSSHAIRS: ['CLASSIC', 'DOT', 'SMALL CROSS', 'CIRCLE'],

  crosshair(ctx, cx, cy, gap) {
    const style = Game.settings.crosshair;
    if (style === 1) { // dot
      ctx.fillStyle = '#000'; ctx.fillRect(cx - 1, cy - 1, 3, 3);
      ctx.fillStyle = '#9fff9f'; ctx.fillRect(cx, cy, 1, 1);
      return;
    }
    if (style === 2) { // small fixed cross
      ctx.fillStyle = '#000'; ctx.fillRect(cx - 3, cy - 1, 7, 3); ctx.fillRect(cx - 1, cy - 3, 3, 7);
      ctx.fillStyle = '#9fff9f'; ctx.fillRect(cx - 2, cy, 5, 1); ctx.fillRect(cx, cy - 2, 1, 5);
      return;
    }
    if (style === 3) { // circle that grows with spread
      const r = Math.max(3, Math.min(30, Math.round(gap)));
      ctx.fillStyle = '#9fff9f';
      for (let a = 0; a < 24; a++) {
        const t = a / 24 * Math.PI * 2;
        ctx.fillRect(Math.round(cx + Math.cos(t) * r), Math.round(cy + Math.sin(t) * r), 1, 1);
      }
      ctx.fillRect(cx, cy, 1, 1);
      return;
    }
    gap = Math.max(2, Math.min(40, Math.round(gap)));
    const len = 4;
    ctx.fillStyle = '#000';
    ctx.fillRect(cx - gap - len, cy - 1, len, 3); ctx.fillRect(cx + gap + 1, cy - 1, len, 3);
    ctx.fillRect(cx - 1, cy - gap - len, 3, len); ctx.fillRect(cx - 1, cy + gap + 1, 3, len);
    ctx.fillStyle = '#9fff9f';
    ctx.fillRect(cx - gap - len, cy, len, 1); ctx.fillRect(cx + gap + 1, cy, len, 1);
    ctx.fillRect(cx, cy - gap - len, 1, len); ctx.fillRect(cx, cy + gap + 1, 1, len);
    ctx.fillRect(cx, cy, 1, 1);
  },

  statusBar(ctx, game) {
    const y0 = CONFIG.VIEW_H;
    const p = game.player, ws = game.weapons, def = ws.def, st = ws.state;
    ctx.drawImage(this.bar, 0, y0);
    const label = (t, x) => Font.draw(ctx, t, x, y0 + 5, '#7a8898', 1, 'left');

    // health
    label('HEALTH', 7);
    const hpCol = p.hp > 60 ? '#60ff80' : p.hp > 30 ? '#ffd040' : '#ff4030';
    Font.draw(ctx, String(Math.ceil(p.hp)), 40, y0 + 12, hpCol, 2, 'center');
    ctx.fillStyle = '#2a0c0c'; ctx.fillRect(7, y0 + 25, 66, 2);
    ctx.fillStyle = hpCol; ctx.fillRect(7, y0 + 25, Math.round(66 * p.hp / CONFIG.PLAYER_MAX_HP), 2);

    // weapon + slots
    label('WEAPON', 83);
    // gun name, plus a green "+N" for upgrade chips used on it
    const ups = ws.upgradeCount();
    const nameW = Font.width(def.name) + (ups ? Font.width(' +' + ups) : 0);
    const nx = Math.round(120 - nameW / 2);
    Font.draw(ctx, def.name, nx, y0 + 12, '#ffffff', 1, 'left');
    if (ups) Font.draw(ctx, ' +' + ups, nx + Font.width(def.name), y0 + 12, '#40ffb0', 1, 'left');
    // the hotbar: only the guns you have, in the order you got them
    ws.slots.forEach((i, n) => {
      const x = 83 + n * 11, y = y0 + 20;
      const active = i === (ws.switching ? ws.switchTo : ws.current);
      const empty = ws.ammo[i].mag === 0 && ws.ammo[i].reserve === 0;
      ctx.fillStyle = active ? '#e0a030' : '#2a2e34';
      ctx.fillRect(x, y, 9, 8);
      Font.draw(ctx, String(n + 1), x + 5, y + 2, active ? '#111' : empty ? '#803030' : '#a0a8b0', 1, 'center', null);
    });

    // portrait + name
    if (this.portraits) {
      const img = p.hurtTimer > 0 || !p.alive ? this.portraits.hurt : this.portraits.normal;
      ctx.drawImage(img, 180, y0 + 3);
    }
    Font.draw(ctx, game.settings.username, 192, y0 + 25, '#c8d0d8', 1, 'center');

    // ammo
    label('AMMO', 228);
    if (def.infinite) {
      Font.draw(ctx, 'UNLIMITED', 268, y0 + 15, '#a070ff', 1, 'center');
    } else {
      const lowAmmo = st.mag <= Math.ceil(def.mag * 0.25);
      Font.draw(ctx, String(st.mag), 268, y0 + 12, lowAmmo ? '#ff6040' : '#ffd040', 2, 'right');
      Font.draw(ctx, '/' + st.reserve, 271, y0 + 17, '#a0a8b0', 1, 'left');
    }
    if (ws.reloading && ((game.time * 6) | 0) % 2) Font.draw(ctx, 'RELOAD', 228, y0 + 25, '#ffd040', 1, 'left', null);
    // grenades (little pips) and the dash bar
    for (let i = 0; i < CONFIG.GRENADE.max; i++) {
      ctx.fillStyle = i < ws.grenades ? '#7ab060' : '#22282e';
      ctx.fillRect(282 + i * 5, y0 + 5, 3, 4);
    }
    const dashReady = 1 - p.dashCooldown / CONFIG.DASH.cooldown;
    ctx.fillStyle = '#16181c'; ctx.fillRect(228, y0 + 29, 70, 1);
    ctx.fillStyle = dashReady >= 1 ? '#40e0ff' : '#2a6070'; ctx.fillRect(228, y0 + 29, Math.round(70 * dashReady), 1);

    // score + difficulty
    label('SCORE', 308);
    Font.draw(ctx, String(game.score), 377, y0 + 5, '#ffffff', 1, 'right');
    Font.draw(ctx, 'DIFF ' + game.diff.level, 308, y0 + 14, '#e0a030', 1, 'left');
    Font.draw(ctx, game.diff.label, 308, y0 + 23, '#7a8898', 1, 'left', null);
  },
};
