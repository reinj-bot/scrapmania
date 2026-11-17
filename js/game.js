'use strict';
// Ties everything together: game states, the main loop, shooting hits, score.
// States: 'menu' -> 'playing' <-> 'paused' -> 'over'.

const Game = {
  state: 'menu',
  settings: null,
  messages: [],
  flash: { color: '#fff', t: 0 },

  init() {
    this.canvas = document.getElementById('screen');
    Renderer.init(this.canvas);
    Art.init();
    this.settings = SaveData.load();
    Controls.use(this.settings.keys);
    Records.load();
    // Another Scrapmania window or tab changed the saves (an import, a finished game): pick them up
    // here too, so this window never writes its older copy back over them.
    window.addEventListener('storage', e => {
      if (!e.key || !e.key.startsWith('scrapProtocol.')) return;
      if (e.key === SaveData.KEY) { Object.assign(this.settings, SaveData.load()); Controls.use(this.settings.keys); }
      if (e.key === Records.KEY) Records.load();
      if (this.state === 'menu' && Menu.current === 'main') Menu.show('main');
    });
    this.resetWorld();
    HUD.init();
    Input.init(this.canvas);
    Input.onLockChange = locked => this.onLockChange(locked);
    Input.onLockError = () => this.useFreeMouse();
    Sound.setVolume(this.settings.volume / 10);
    Music.volume = this.settings.music / 10;
    this.applyVideo();
    // browsers only allow sound after the first click or key press: start the menu music then
    const firstTouch = () => {
      Sound.init();
      Music.init();
      if (this.state === 'menu') Music.play('menu');
      window.removeEventListener('pointerdown', firstTouch);
      window.removeEventListener('keydown', firstTouch);
    };
    window.addEventListener('pointerdown', firstTouch);
    window.addEventListener('keydown', firstTouch);
    this.menuCamAngle = 0;
    Menu.init(this);
    window.addEventListener('keydown', e => {
      Controls.keyboardUsed();
      if (e.code === 'Escape' && this.state === 'playing') this.pause();
      if (e.code === 'KeyP' && this.state === 'playing') this.pause();
    });
    document.addEventListener('mousedown', () => Controls.keyboardUsed());
    // playing without the mouse captured (e.g. after using a controller): a click grabs it again
    this.canvas.addEventListener('mousedown', () => {
      if (this.state === 'playing' && !Input.locked && !this.mouseFallback) this.grabMouse();
    });
    this.last = performance.now();
    requestAnimationFrame(t => this.loop(t));
  },

  // Fresh map: broken lights, used switches and blown-up barrels all come back.
  resetWorld(dark = false, map = this.settings.map) {
    Level.build(map, dark ? 0.5 : 1);
    Doors.init();
    Switches.init();
    Traps.init();
    Barrels.init();
    Gadgets.init();
    Breakables.init();
    Teleporters.init();
    CrackedWalls.init();
  },

  // ---------- run control ----------
  // opts (optional): { mode, map } - the bonus round starts this way.
  start(opts = {}) {
    Sound.init();
    Sound.setVolume(this.settings.volume / 10);
    this.mode = opts.mode || this.settings.mode;
    // locked difficulty: always 10 until a Mission is won on 10 (see Records.difficultyUnlocked)
    this.diffWasLocked = !Records.difficultyUnlocked();
    if (this.diffWasLocked) this.settings.difficulty = 10;
    this.mods = Modifiers.valid(this.settings.mods);
    this.modMult = Modifiers.scoreMult(this.mods);
    this.dmgMult = this.mods.includes('glass') ? 2 : 1;
    this.wave = 1;
    this.chapter = this.mode === 'campaign' ? CHAPTERS[this.settings.chapter] : null;
    this.altEnd = false;
    Menu.endingShown = false;
    this.diff = this.makeDiff();
    this.resetWorld(this.mods.includes('dark'), opts.map || (this.chapter ? this.chapter.map : this.settings.map));
    this.allies = [];
    this.radio = null;
    this.usePrompt = null;
    this.player = new Player(Level.playerStart);
    this.weapons = new WeaponSystem(this);
    this.robots = [];
    this.pickups = [];
    this.messages = [];
    this.score = 0;
    this.kills = 0;
    this.killsByType = {};
    this.time = 0;
    this.won = false;
    this.runResult = null;
    this.run = this.newRun();
    this.toasts = [];
    this.achTimer = 0;
    Combo.reset();
    BossFight.reset(this);
    this.hitMarker = 0;
    this.shakeAmount = 0;
    this.flash = { color: '#fff', t: 0 };
    Effects.reset();
    PlayerShots.reset();
    Mines.reset();
    Level.flowFrom = -1;
    Art.buildWeapons(this.settings.avatar);
    HUD.setAvatar(this.settings.avatar);
    Spawner.reset(this);
    // every secret vault holds the Tesla Cannon (the 'vault' gun in WEAPONS)
    const tesla = WEAPONS.findIndex(w => w.vault);
    for (const r of Level.layout.rooms) {
      if (r.name.startsWith('SECRET STASH')) this.pickups.push({ x: r.x + r.w / 2, y: r.y + r.h / 2, type: 'weapon', weapon: tesla, vault: true, spot: -1, taken: false, life: Infinity });
    }
    MapEvents.reset();
    Tutorial.start(this);
    if (this.chapter) {
      Campaign.start(this, this.settings.chapter);
      this.message('CHAPTER ' + (this.settings.chapter + 1) + ': ' + this.chapter.title, '#e0a030');
    } else if (this.mode === 'drill') {
      this.message(Lex.d1 + this.formatTime(Drill.LENGTH), '#80ff40');
    } else {
      this.message(this.mode === 'endless'
        ? 'ENDLESS: SURVIVE AS LONG AS YOU CAN'
        : 'SURVIVE ' + this.formatTime(CONFIG.BOSS_TIME) + ', THEN DESTROY THE WARDEN', '#e0a030');
    }
    if (this.mode === 'mission') this.say('COMMAND', 'PILOT, YOUR MISSION: DESTROY THE WARDEN AND STAY ALIVE. GOOD LUCK.');
    Sound.startAmbient();
    Music.init();
    Music.setDuck(1);
    Music.play('fight');
    this.hitStop = 0;
    this.extraSprites = null;
    this.lure = null;
    this.guide = null;
    Campaign.aux = null;
    this.miniBoss = null;
    this.miniAt = this.mode === 'campaign' || this.mode === 'drill' ? Infinity : CONFIG.BOSS_TIME / 2;
    if (this.mode === 'drill') Drill.start(this);
    this.applyVideo(); // color back after a death
    this.state = 'playing';
    Menu.show(null);
    // started with a controller: no click happened, so the browser won't allow capturing the mouse
    if (!Controls.pad.active) this.grabMouse();
    if (this.settings.intro) Cutscene.play(this, CUTSCENES.intro);
  },

  // Hides the window's title bar and the screen edges. Must run right after a click.
  goFullscreen() {
    if (window.desktop) return; // the desktop window is already full screen (or not) per the setting
    const el = document.documentElement;
    if (this.settings.display !== 'full' || document.fullscreenElement || !el.requestFullscreen) return;
    try { const p = el.requestFullscreen(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* not allowed here */ }
  },

  // Mouse first: asking for full screen uses up the click, and the mouse lock needs that click too.
  grabMouse() {
    if (!this.mouseFallback && !Input.lock()) this.useFreeMouse();
    this.goFullscreen();
  },

  // The browser refused to capture the mouse (some embedded browsers never allow it).
  // Keep playing: moving the mouse still aims, and the screen edges turn you.
  useFreeMouse() {
    if (this.mouseFallback) return;
    if (Input.everLocked) {
      // capture works here; the browser just blocks it for ~1 s right after Esc
      if (this.state === 'playing') this.pause();
      document.getElementById('lock-hint').textContent = 'COULD NOT CAPTURE THE MOUSE - CLICK RESUME AGAIN';
      return;
    }
    this.mouseFallback = true;
    Input.freeMouse = true;
    if (this.state === 'paused') this.unpause();
    if (this.state === 'playing') this.message('MOUSE NOT CAPTURED: SCREEN EDGES TURN YOU', '#ff9040');
  },

  pause() {
    if (this.state !== 'playing') return;
    if (Cutscene.active) Cutscene.skip(); // Esc during a cutscene: skip it, then pause
    if (this.state !== 'playing') return;  // ...unless skipping it ended the game (won, or the Overseer)
    this.state = 'paused';
    Input.unlock();
    Sound.stopAmbient();
    Music.setDuck(0.35);
    Menu.show('pause');
  },

  resume() {
    if (this.state !== 'paused') return;
    Sound.init();
    if (Controls.pad.active) { this.unpause(); return; }
    if (this.mouseFallback || Input.locked) { this.goFullscreen(); this.unpause(); return; }
    Input.lock(); // the game continues once the browser confirms the mouse lock
    this.goFullscreen();
  },

  unpause() {
    this.state = 'playing';
    Sound.startAmbient();
    Music.setDuck(1);
    Menu.show(null);
    this.last = performance.now();
  },

  onLockChange(locked) {
    if (locked && this.state === 'paused') this.unpause();
    else if (!locked && this.state === 'playing') this.pause();
  },

  // The Warden is destroyed.
  win() {
    if (this.state !== 'playing') return;
    this.state = 'over';
    this.won = true;
    this.deathTimer = 1.4;
    if (this.chapter) this.campaignWon();
    else this.message(this.mode === 'drill' ? Lex.d2 : 'MISSION COMPLETE', '#60ff80');
    // a word over the radio, with a moment to read it before the results
    if (this.mode === 'drill') { this.say('THE WARDEN', Lex.d3 + String(this.settings.username).toUpperCase() + '.', '#ff6040'); this.deathTimer = 3.6; }
    else if (this.mode === 'mission' && !this.altEnd) { this.say('COMMAND', 'GOOD JOB, PILOT. THE WARDEN IS DOWN. MISSION COMPLETE.'); this.deathTimer = 3.6; }
    this.flashScreen('#ffffff', 0.4);
    Sound.stopAmbient();
    Music.play(null);
    Sound.play('win');
    this.finishRun();
  },

  // A campaign chapter is done: unlock the next one; after the last, pick the ending.
  campaignWon() {
    const s = this.settings, last = Campaign.index === CHAPTERS.length - 1;
    s.chaptersDone = Math.max(s.chaptersDone, Campaign.index + 1);
    this.saveSettings();
    if (last) {
      this.run.flags.campaign = true;
      if (this.altEnd) this.run.flags.x7 = true;
      this.message('THE FOUNDRY CORE IS SILENT', '#60ff80');
    } else {
      this.message('CHAPTER COMPLETE', '#60ff80');
    }
  },

  // The Overseer got you (1 in 10000 after beating the Warden).
  overseerKill() {
    this.extraSprites = null;
    this.run.flags.overseer = true;
    this.player.alive = false;
    this.player.hp = 0;
    this.gameOver();
  },

  gameOver() {
    if (this.state !== 'playing') return;
    this.state = 'over';
    this.won = false;
    this.deathTimer = 1.8; // let the death moment play (in slow motion) before showing the screen
    Sound.stopAmbient();
    Music.play(null);
    Sound.play('gameover');
    this.finishRun();
  },

  // Difficulty numbers for this game: chosen level, then challenges, then endless-wave growth.
  makeDiff() {
    const ch = this.chapter;
    const level = Difficulty.clamp(this.settings.difficulty + (ch ? ch.diffBonus : 0)); // later chapters are harder
    const d = Modifiers.applyToDiff(Difficulty.get(level), this.mods);
    if (ch && ch.spawnBoost) {
      d.maxAlive = Math.round(d.maxAlive * ch.spawnBoost);
      d.spawnInterval /= ch.spawnBoost;
    }
    const w = (this.wave || 1) - 1;
    if (w > 0) {
      d.health *= 1 + 0.18 * w;
      d.damage *= 1 + 0.1 * w;
      d.speed *= Math.min(1.35, 1 + 0.05 * w);
      d.maxAlive = Math.round(d.maxAlive * (1 + 0.15 * w));
      d.spawnInterval *= Math.max(0.5, 1 - 0.08 * w);
    }
    return d;
  },

  // Everything counted during one game (for achievements, records and XP).
  newRun() {
    return {
      map: Level.mapId, level: this.settings.difficulty, mode: this.mode, mods: this.mods,
      kills: 0, byType: {}, score: 0, time: 0, won: false, wave: 1, broken: 0,
      bossKills: 0, bossMaps: {}, flags: {}, bests: {}, fired: {}, damageTaken: 0, bossDamage: 0,
      medkits: 0, blastKills: {}, trapKills: 0, sniperKills: 0, unlockedNow: [],
    };
  },

  syncRun() {
    const r = this.run;
    r.kills = this.kills;
    r.byType = this.killsByType;
    r.score = this.score;
    r.time = this.time;
    r.won = this.won;
    r.wave = this.wave;
    r.bests.score = this.score;
    r.bests.trapKills = r.trapKills;
    r.bests.sniperKills = r.sniperKills;
    if (this.mode === 'endless') r.bests.wave = this.wave;
  },

  // Live achievement check, a couple of times a second.
  checkAchievements(dt) {
    this.achTimer -= dt;
    if (this.achTimer > 0) return;
    this.achTimer = 0.5;
    this.syncRun();
    for (const a of Records.check(this.run)) {
      this.run.unlockedNow.push(a);
      this.toasts.push({ a, t: 0 });
      Sound.play('achievement');
    }
  },

  // Save best score / totals / XP at the end of a game.
  finishRun() {
    this.syncRun();
    this.runResult = Records.finishRun(this.run);
  },

  // Close the game window. Browsers only allow this for windows they opened themselves
  // (like the desktop shortcut's window); in a normal tab, tell the player to close it.
  quit() {
    Input.unlock();
    Sound.stopAmbient();
    if (window.desktop) { window.desktop.quit(); return; }
    window.close();
    setTimeout(() => Menu.hint('THIS BROWSER WILL NOT LET THE GAME CLOSE ITSELF - CLOSE THE TAB TO QUIT'), 300);
  },

  toMenu() {
    this.state = 'menu';
    Level.setDim(1);
    this.applyVideo();
    Input.unlock();
    Sound.stopAmbient();
    Music.setDuck(1);
    Music.play('menu');
    Menu.show('main');
  },

  // ---------- main loop ----------
  loop(t) {
    const dt = Math.max(0, Math.min(0.05, (t - this.last) / 1000)); // never negative (e.g. right after unpausing)
    this.last = t;
    Controls.pollPad();
    // a cutscene freezes the game and draws itself
    if (Cutscene.active) {
      Cutscene.update(dt);
      if (Cutscene.active) Cutscene.render(t / 1000);
      else if (this.state !== 'menu') this.render(t / 1000);
      Input.endFrame();
      requestAnimationFrame(tt => this.loop(tt));
      return;
    }
    if (this.state === 'playing' && (Controls.padPressed(PAD.START) || Controls.padPressed(PAD.BACK))) this.pause();
    else if (this.state === 'playing' && this.hitStop > 0) this.hitStop -= dt; // a split-second freeze on kills
    else if (this.state === 'playing') this.update(dt);
    else if (this.state !== 'over' || this.deathTimer <= 0) Menu.padNav();
    if (this.state === 'over' && this.deathTimer > 0) {
      this.deathTimer -= dt;
      if (this.radio) this.radio.t += dt;
      // losing: the world slows down and loses its color
      const slow = this.won ? dt : dt * 0.35;
      Effects.update(slow, this);
      for (const r of this.robots) r.update(slow, this);
      if (!this.won) this.applyVideo(Math.min(1, (1.8 - this.deathTimer) / 1.2));
      if (this.deathTimer <= 0) { Input.unlock(); Menu.showGameOver(this); }
    }
    if (this.state === 'menu') this.renderMenuBackground(dt, t / 1000);
    else this.render(t / 1000);
    Input.endFrame();
    requestAnimationFrame(tt => this.loop(tt));
  },

  update(dt) {
    this.time += dt;
    if (this.radio && (this.radio.t += dt) > this.radio.dur) this.radio = null;
    if (this.mode !== 'drill') BossFight.update(dt, this);
    if (this.state !== 'playing') return;
    Combo.update(dt);
    Music.intensity = this.robots.filter(r => r.alive && r.alerted).length >= 5 ? 1 : 0;
    Tutorial.update(dt, this);
    this.checkAchievements(dt);
    // achievement pop-ups show one at a time
    if (this.toasts.length) {
      this.toasts[0].t += dt;
      if (this.toasts[0].t >= 3.5) this.toasts.shift();
    }
    this.hitMarker = Math.max(0, this.hitMarker - dt);
    this.shakeAmount = Math.max(0, this.shakeAmount - dt * 1.8);
    this.flash.t = Math.max(0, this.flash.t - dt);
    for (const m of this.messages) m.t += dt;
    this.messages = this.messages.filter(m => m.t < 3);

    this.player.update(dt, this);
    this.weapons.update(dt);
    Doors.update(dt, this);
    Switches.update(dt, this);
    Gadgets.update(dt, this);
    if (this.chapter) Campaign.update(dt, this);
    if (this.mode === 'mission' || (this.chapter && this.chapter.goal === 'boss')) Campaign.tickAux(dt, this);
    Breakables.update(dt, this);
    Teleporters.update(dt, this);
    if (this.mode !== 'drill') MapEvents.update(dt, this); // no blackouts or lockdowns in the bonus round
    if (this.state !== 'playing') return;
    Barrels.update(dt, this);
    Traps.update(dt, this);
    if (this.state !== 'playing') return;
    let goal = this.lure || this.player; // an alarm button pulls every robot towards it
    Level.updateFlow(goal.x, goal.y);
    if (!this.lure) {
      // shut inside a vault: the robots gather outside its door and wait for you
      const wait = Switches.waitSpot(this);
      if (wait) { goal = wait; Level.updateFlow(wait.x, wait.y); }
    }
    for (const r of this.robots) { r.update(dt, this); if (r.elite) Elites.tick(r, dt); }
    if (this.mode === 'drill') { Drill.update(dt, this); if (this.state !== 'playing') return; }
    // halfway to the Warden: a mini-boss
    if (this.time >= this.miniAt && !this.boss) { this.miniAt = Infinity; Elites.spawnMiniBoss(this); }
    this.robots = this.robots.filter(r => !(r.state === 'wreck' && r.timer <= 0));
    this.pickups = this.pickups.filter(p => !p.taken && (p.life -= dt) > 0);
    Effects.update(dt, this);
    PlayerShots.update(dt, this);
    Mines.update(dt, this);
    Spawner.update(dt, this);
  },

  camera(time) {
    const p = this.player;
    const scoped = this.weapons.scoped;
    const shake = this.shakeAmount;
    const bob = Math.sin(p.bobPhase) * 1.5 * p.moveAmount;
    const deathDrop = this.state === 'over' && !this.won ?Math.min(1, 1.4 - this.deathTimer) * 30 : 0;
    return {
      x: p.x, y: p.y,
      angle: p.angle + (Math.random() - 0.5) * shake * 0.03,
      fov: scoped ? 2 * Math.atan(Math.tan(CONFIG.FOV / 2) / CONFIG.SNIPER_ZOOM) : CONFIG.FOV * (p.dashTime > 0 ? 1.08 : 1),
      horizonShift: bob + (Math.random() - 0.5) * shake * 8 - deathDrop,
    };
  },

  cameraProjDist() {
    const fov = this.weapons.scoped ? 2 * Math.atan(Math.tan(CONFIG.FOV / 2) / CONFIG.SNIPER_ZOOM) : CONFIG.FOV;
    return (CONFIG.WIDTH / 2) / Math.tan(fov / 2);
  },

  render(time) {
    if (!this.player) return;
    const cam = this.camera(time);
    this.renderWorld(time, cam);
    const ctx = Renderer.ctx;
    Effects.drawNumbers(ctx, cam);
    Elites.drawLabels(ctx, cam, this.robots);
    const [lr, lg, lb] = Level.lightAt(this.player.x, this.player.y);
    if (this.player.alive) this.weapons.draw(ctx, Math.max(lr, lg, lb) + (this.weapons.fireAnim > 0 ? 0.5 : 0));
    HUD.draw(ctx, this);
  },

  // The 3D view only (no gun, no HUD), from any camera - cutscenes use this too.
  renderWorld(time, cam) {
    const sprites = [];
    this.addLevelSprites(sprites, time);
    for (const r of this.robots) sprites.push(r.sprite());
    for (const a of this.allies || []) sprites.push(a.sprite());
    if (this.mode === 'drill') Drill.addSprites(sprites, time);
    for (const p of this.pickups) {
      const sprite = p.type === 'weapon' ? Art.sprites.weapon[p.weapon] : Art.sprites[p.type];
      sprites.push({ x: p.x, y: p.y, z: 0.05 + Math.sin(time * 3 + p.x) * 0.04, h: PICKUPS[p.type].height, sprite, bright: true });
    }
    Effects.addSprites(sprites);
    PlayerShots.addSprites(sprites);
    Mines.addSprites(sprites, time);
    if (this.extraSprites) sprites.push(...this.extraSprites);
    Teleporters.addSprites(sprites, time);
    MapEvents.addSprites(sprites);
    if (this.chapter) Campaign.addSprites(sprites, time);
    const lights = this.frameLights(time).concat(PlayerShots.lights(), Mines.lights(time), Gadgets.lights(time), Teleporters.lights(time), Elites.lights(this.robots, time), this.chapter ? Campaign.lights(time) : []);
    const pl = CONFIG.PLAYER_LIGHT;
    const blackout = MapEvents.isBlackout(); // your own light gets stronger in a blackout
    lights.push({ x: this.player.x, y: this.player.y, c: pl.color, radius: pl.radius * (blackout ? 1.3 : 1),
      intensity: pl.intensity * (this.mods.includes('dark') ? 0.5 : 1) * (blackout ? 1.7 : 1) });
    Renderer.render(cam, lights, sprites, time);
  },

  addLevelSprites(list, time = 0) {
    Gadgets.addSprites(list, time);
    Breakables.addSprites(list);
    for (const pr of Level.props) {
      list.push({ x: pr.x, y: pr.y, z: 0, h: pr.kind === 'pipe' ? 1 : 0.8, sprite: Art.sprites[pr.kind] });
    }
    Barrels.addSprites(list);
  },

  // Pulsing alarm lights + effect lights.
  frameLights(time) {
    const lights = Effects.frameLights();
    if (this.guide) lights.push({ x: this.guide.x, y: this.guide.y, c: [0.3, 1, 0.5], radius: 3.5, intensity: 0.8 + Math.sin(time * 5) * 0.3 });
    for (const a of Level.alarms) {
      const pulse = Math.max(0, Math.sin(time * 4 + a.x));
      if (pulse > 0.05) lights.push({ x: a.x, y: a.y, c: a.c, radius: 5, intensity: pulse * 0.9 });
    }
    return lights;
  },

  // Slow spinning view of the reactor hall behind the main menu.
  renderMenuBackground(dt, time) {
    this.menuCamAngle += dt * 0.12;
    const m = Level.menuCam;
    const cam = { x: m.x + Math.cos(time * 0.1) * 0.5, y: m.y, angle: this.menuCamAngle, fov: CONFIG.FOV, horizonShift: 0 };
    const sprites = [];
    this.addLevelSprites(sprites);
    Renderer.render(cam, this.frameLights(time), sprites, time);
    Renderer.ctx.fillStyle = '#0a0c10';
    Renderer.ctx.fillRect(0, CONFIG.VIEW_H, CONFIG.WIDTH, CONFIG.HUD_H);
  },

  // ---------- combat ----------
  // One bullet: finds the closest robot along the line, stopping at walls.
  hitscan(px, py, angle, def) {
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const wall = Level.castRay(px, py, dx, dy, def.range);
    let best = null, bestAlong = Math.min(wall.dist, def.range), barrel = null;
    const inLine = (x, y, radius) => {
      const ex = x - px, ey = y - py;
      const along = ex * dx + ey * dy;
      if (along <= 0 || along >= bestAlong) return false;
      if (Math.abs(ex * dy - ey * dx) >= radius) return false;
      bestAlong = along;
      return true;
    };
    for (const r of this.robots) {
      if (r.targetable && inLine(r.x, r.y, r.def.radius * def.hitScale)) { best = r; barrel = null; }
    }
    for (const b of Barrels.list) {
      if (b.alive && inLine(b.x, b.y, Barrels.HIT_RADIUS)) { barrel = b; best = null; }
    }
    let mine = null; // a Sapper's mine on the floor
    for (const m of Mines.list) {
      if (!m.dead && inLine(m.x, m.y, 0.3)) { mine = m; best = null; barrel = null; }
    }
    const brk = Breakables.onLine(px, py, dx, dy, bestAlong);
    Cosmetics.trail(this, px, py, angle, brk ? brk.along : bestAlong);
    if (brk) {
      Breakables.hit(brk.b, def.damage * this.dmgMult, this);
      return true;
    }
    if (mine) { Mines.shot(mine, this); return true; }
    if (barrel) {
      Effects.sparks(px + dx * (bestAlong - 0.3), py + dy * (bestAlong - 0.3), 0.4, 5);
      Barrels.ignite(barrel);
      return true;
    }
    if (best) {
      const over = Math.max(0, bestAlong - def.falloff) / Math.max(0.001, def.range - def.falloff);
      const dmg = def.damage * (1 - over * 0.75);
      const hx = px + dx * (bestAlong - best.def.radius * 0.8), hy = py + dy * (bestAlong - best.def.radius * 0.8);
      Effects.sparks(hx, hy, best.def.height * (0.3 + Math.random() * 0.5), 5);
      best.hurt(dmg * this.dmgMult, dx, dy, this, false, def.id);
      return true;
    }
    if (wall.dist < def.range) {
      const hx = px + dx * (wall.dist - 0.03), hy = py + dy * (wall.dist - 0.03);
      // bullets fly at eye height, give or take a little
      const z = CONFIG.EYE + (Math.random() + Math.random() - 1) * 0.14;
      Effects.sparks(hx, hy, z, 3);
      Effects.dust(hx, hy, z);
      const exact = px + dx * wall.dist, exactY = py + dy * wall.dist;
      if (Level.damageWall(wall, dx, dy, exact, exactY, z)) this.playAt('ricochet', hx, hy, 0.55, 0.05);
      if (wall.tile === 'F') Traps.trigger(wall.mapX, wall.mapY, this);
      else if (Level.breakWall(wall.mapX, wall.mapY)) {
        this.run.broken++;
        Effects.burst(hx, hy, 0.5, { count: 14, colors: ['#c0e8ff', '#ffffff', '#80a0b0'], speed: 2.5, up: 2, size: 0.035, life: 0.6, bright: false });
        Effects.sparks(hx, hy, 0.5, 8);
        Effects.addLight(hx, hy, [0.6, 0.8, 1], 2.5, 1, 0.12);
        this.playAt('glass', hx, hy, 0.9);
      }
    }
    return false;
  },

  // Gunfire wakes up robots nearby.
  alertRobots(x, y, radius) {
    for (const r of this.robots) {
      if (r.alive && !r.alerted && Math.hypot(r.x - x, r.y - y) < radius) r.alert(this);
    }
  },

  onRobotKilled(robot) {
    if (this.state !== 'playing') return;
    BossFight.killed(this, robot); // the Warden comes sooner
    Cosmetics.killEffect(this, robot);
    this.hitStop = robot.def.boss ? 0.3 : 0.035;
    this.kills++;
    this.killsByType[robot.type] = (this.killsByType[robot.type] || 0) + 1;
    // what killed it (for achievements)
    const src = robot.lastHit || '', run = this.run;
    if (src === 'sniper') run.sniperKills++;
    if (src === 'trap') run.trapKills++;
    if (src.startsWith('barrel#')) {
      run.blastKills[src] = (run.blastKills[src] || 0) + 1;
      run.bests.barrelChain = Math.max(run.bests.barrelChain || 0, run.blastKills[src]);
    }
    const before = Combo.mult();
    const mult = Combo.kill();
    run.bests.combo = Math.max(run.bests.combo || 0, Combo.count);
    if (mult > before) { Sound.play('combo'); this.message('COMBO X' + mult + '!', '#ff9040'); }
    const pts = Math.round(robot.def.score * this.diff.scoreMult * this.modMult * mult * (robot.elite ? (robot.elite.mini ? 6 : 3) : 1));
    this.score += pts;
    this.message('+' + pts + ' ' + (robot.elite ? Elites.name(robot) : robot.def.name) + ' DESTROYED', robot.elite ? '#ff9040' : '#ffd040');
    if (robot.elite) {
      this.killsByType.elite = (this.killsByType.elite || 0) + 1;
      if (robot.elite.mini) { this.killsByType.miniboss = (this.killsByType.miniboss || 0) + 1; this.miniBoss = null; }
      Elites.killed(robot, this);
      return; // elites drop their own loot
    }
    // upgrade chips: tough robots drop them more often, the Warden drops three
    if (robot.def.boss) {
      for (let i = 0; i < 3; i++) this.dropNear(robot.x, robot.y, (i - 1) * 0.6, 0.4, 'chip', 60);
      BossFight.defeated(this, robot);
      return;
    }
    const tough = ['heavy', 'shield', 'carrier'].includes(robot.type);
    if (Math.random() < (tough ? 0.3 : 0.06)) { this.dropPickup(robot, 'chip'); return; }
    const roll = Math.random();
    if (roll < this.diff.healthDrop) this.dropPickup(robot, 'health');
    else if (roll < this.diff.healthDrop + this.diff.ammoDrop) this.dropPickup(robot, 'ammo');
  },

  // Drop an item a little to the side of (cx, cy) - but never inside a wall: if the spot next to
  // it is blocked, it lands on (cx, cy) itself.
  dropNear(cx, cy, dx, dy, type, life, extra = {}) {
    const ok = (x, y) => !Level.isBlocked(x, y) && !Level.isWallTile(Math.floor(x), Math.floor(y));
    const x = ok(cx + dx, cy + dy) ? cx + dx : cx, y = ok(cx + dx, cy + dy) ? cy + dy : cy;
    this.pickups.push(Object.assign({ x, y, type, spot: -1, taken: false, life }, extra));
  },

  dropPickup(robot, type) {
    this.pickups.push({ x: robot.x, y: robot.y, type, spot: -1, taken: false, life: 25 });
  },

  // ---------- small helpers ----------
  playAt(name, x, y, vol = 1, minGap = 0) {
    if (!this.player) return;
    const dx = x - this.player.x, dy = y - this.player.y;
    const d = Math.hypot(dx, dy);
    const v = vol / (1 + d * 0.18);
    const pan = d > 0.1 ? (-dx * Math.sin(this.player.angle) + dy * Math.cos(this.player.angle)) / d * 0.7 : 0;
    Sound.play(name, v, pan, minGap);
  },

  // Field of view, brightness and scanlines from the OPTIONS screen.
  applyVideo(gray = 0) {
    const s = this.settings;
    CONFIG.FOV = s.fov * Math.PI / 180;
    const f = [];
    if (s.brightness !== 10) f.push('brightness(' + (s.brightness / 10) + ')');
    if (gray > 0) f.push('grayscale(' + gray.toFixed(2) + ')');
    this.canvas.style.filter = f.join(' ');
    document.getElementById('scanlines').style.display = s.scanlines ? '' : 'none';
  },

  shake(amount) {
    if (!this.settings.shake) return;
    this.shakeAmount = Math.min(1, Math.max(this.shakeAmount, amount));
  },

  message(text, color) {
    this.messages.push({ text, color, t: 0 });
    if (this.messages.length > 4) this.messages.shift();
  },

  // A short radio message at the bottom of the screen (drawn by HUD.radio).
  say(who, text, color = '#40e0ff') {
    this.radio = { who, text, color, t: 0, dur: Math.max(4, text.length / 12) };
    Sound.play('click', 0.6);
  },

  flashScreen(color, t) {
    this.flash = { color, t };
  },

  formatTime(s) {
    s = Math.floor(s);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  },

  saveSettings() {
    SaveData.save(this.settings);
  },
};

window.addEventListener('load', () => Game.init());
