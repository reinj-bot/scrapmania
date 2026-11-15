'use strict';
// Short training hints during the first game (or whenever TUTORIAL is ON in the menu).
// Each step waits until the player has done the thing, or shows for a few seconds.
// Key names follow the player's own key choices, or controller buttons if one is in use.

const Tutorial = {
  STEPS: [
    {
      text: pad => pad ? 'MOVE: LEFT STICK'
        : 'MOVE: ' + ['forward', 'left', 'back', 'right'].map(a => Controls.name(a)).join(' '),
      done: t => t.moved >= 2.5,
    },
    { text: pad => pad ? 'AIM: RIGHT STICK' : 'AIM: MOVE THE MOUSE', done: t => t.turned >= 1.2 },
    { text: pad => pad ? 'SHOOT: RT' : 'SHOOT: LEFT CLICK', done: (t, g) => Object.keys(g.run.fired).length > 0 },
    // right after shooting, so the gun is not full and reloading really starts
    { text: pad => 'RELOAD: ' + (pad ? 'X' : Controls.name('reload')), done: (t, g) => g.weapons.reloading, limit: 10 },
    {
      text: pad => pad ? 'SWITCH GUNS: LB / RB'
        : 'SWITCH GUNS: ' + [1, 2, 3, 4].map(i => Controls.name('gun' + i)).join(' ') + ' OR MOUSE WHEEL',
      done: (t, g) => g.weapons.current !== t.startGun,
      skip: g => g.weapons.shotgunOnly,
      limit: 10,
    },
    { text: () => 'SHOOT RED BARRELS TO BLOW UP ROBOTS NEAR THEM', time: 5 },
    { text: () => 'WALK OVER MEDKITS (+50 HEALTH) AND AMMO BOXES', time: 5 },
    {
      text: (pad, g) => g.mode === 'endless'
        ? 'GOAL: SURVIVE. EVERY WARDEN YOU DESTROY BRINGS A HARDER WAVE'
        : 'GOAL: SURVIVE ' + g.formatTime(CONFIG.BOSS_TIME) + ', THEN DESTROY THE WARDEN',
      time: 6,
    },
  ],

  start(game) {
    this.on = !!game.settings.tutorial;
    this.step = -1;
    this.moved = 0;
    this.turned = 0;
    this.lastX = game.player.x;
    this.lastY = game.player.y;
    this.lastAngle = game.player.angle;
    if (this.on) this.next(game);
  },

  next(game) {
    this.step++;
    this.startGun = game.weapons.current; // "switch guns" counts any change from here
    while (this.step < this.STEPS.length && this.STEPS[this.step].skip && this.STEPS[this.step].skip(game)) this.step++;
    this.t = 0;
    if (this.step >= this.STEPS.length) {
      this.on = false;
      game.settings.tutorial = false; // only once; can be switched back on in the menu
      game.saveSettings();
      game.message('TRAINING COMPLETE', '#60ff80');
    }
  },

  update(dt, game) {
    if (!this.on) return;
    const p = game.player;
    this.moved += Math.hypot(p.x - this.lastX, p.y - this.lastY);
    this.turned += Math.abs(p.angle - this.lastAngle);
    this.lastX = p.x; this.lastY = p.y; this.lastAngle = p.angle;
    this.t += dt;
    const s = this.STEPS[this.step];
    // a short pause after each finished step so the player sees it change
    // (limit: give up after that many seconds, so a hint can never get stuck)
    if (s.time ? this.t >= s.time : (this.t > 0.6 && s.done(this, game)) || (s.limit && this.t >= s.limit)) {
      Sound.play('click');
      this.next(game);
    }
  },

  text(game) {
    if (!this.on) return null;
    return this.STEPS[this.step].text(Controls.pad.active, game);
  },

  draw(ctx, game, cx, y) {
    const text = this.text(game);
    if (!text) return;
    const label = 'TRAINING ' + (this.step + 1) + '/' + this.STEPS.length;
    const w = Math.max(Font.width(text), Font.width(label)) + 10;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(Math.round(cx - w / 2), y - 3, w, 21);
    ctx.fillStyle = '#40e0ff';
    ctx.fillRect(Math.round(cx - w / 2), y - 3, w, 1);
    Font.draw(ctx, label, cx, y, '#40e0ff', 1, 'center');
    Font.draw(ctx, text, cx, y + 9, '#ffffff', 1, 'center');
  },
};
