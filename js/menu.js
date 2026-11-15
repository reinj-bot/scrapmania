'use strict';
// The HTML screens on top of the game: main menu (pilot, map, mode, difficulty, settings),
// challenges, achievements & records, pause menu and game-over screen.
// Every change is saved right away.

const Menu = {
  lockHintShown: false,

  init(game) {
    this.game = game;
    const $ = id => document.getElementById(id);
    this.$ = $;
    this.screens = {
      main: $('menu'), pause: $('pause'), over: $('gameover'), records: $('records'),
      challenges: $('challenges'), controls: $('controls-screen'), story: $('story'),
      splash: $('splash'), title: $('title-screen'), options: $('options'),
      confirm: $('confirm'), help: $('help'), credits: $('credits'), transfer: $('transfer'),
    };
    const s = game.settings;

    $('title').appendChild(Art.bigTitle(['SCRAPMANIA'], 3));
    $('big-title').appendChild(Art.bigTitle(['SCRAPMANIA'], 6));
    $('splash-logo').appendChild(Art.bigTitle(['REINJ GAMES'], 5, Art.LOGO_CYAN, '#04223a'));
    $('version-tag').textContent = 'V' + CONFIG.VERSION;
    $('pause-title').appendChild(Font.toCanvas('PAUSED', '#e0a030', '#5a2a08'));
    $('records-title').appendChild(Font.toCanvas('ACHIEVEMENTS', '#e0a030', '#5a2a08'));
    $('challenges-title').appendChild(Font.toCanvas('CHALLENGES', '#e0a030', '#5a2a08'));
    $('controls-title').appendChild(Font.toCanvas('CONTROLS', '#e0a030', '#5a2a08'));
    $('options-title').appendChild(Font.toCanvas('OPTIONS', '#e0a030', '#5a2a08'));
    this.screens.over.querySelector('[data-act=drill]').textContent = Lex.d8;
    this.initTransfer();
    $('help-title').appendChild(Font.toCanvas('HOW TO PLAY', '#e0a030', '#5a2a08'));
    $('confirm-title').appendChild(Font.toCanvas('QUIT?', '#ff6040', '#400808'));
    $('menu-version').textContent = 'V' + CONFIG.VERSION + ' - REINJ GAMES';
    $('confirm-yes').addEventListener('click', () => { Sound.play('click'); game.quit(); });
    $('confirm-no').addEventListener('click', () => { Sound.play('click'); this.show(this.backTo || 'main'); });
    this.lostTitle = Font.toCanvas('SYSTEM FAILURE', '#ff4030', '#400808');
    this.wonTitle = Font.toCanvas('MISSION COMPLETE', '#60ff80', '#0a3a14');
    $('over-title').appendChild(this.lostTitle);

    // name
    const name = $('username');
    name.value = s.username;
    name.addEventListener('input', () => {
      const clean = name.value.toUpperCase().replace(/[^A-Z0-9 \-_.!]/g, '').slice(0, 12);
      if (clean !== name.value) name.value = clean;
      s.username = clean.trim() || 'RECRUIT';
      game.saveSettings();
    });

    // avatar + gun skin (locked choices are skipped until their achievement is earned)
    const labels = { suit: 'SUIT', skin: 'SKIN', hair: 'HAIR', eyes: 'EYE COLOR', visor: 'CYBER EYE', helmet: 'HELMET', accessory: 'GEAR', gunSkin: 'GUN SKIN' };
    for (const [k, sec] of Object.entries(COSMETIC_SECTIONS)) labels[k] = sec.label;
    this.sectionRows = {};
    for (const key of Object.keys(labels)) {
      const row = document.createElement('div');
      $('custom-rows').appendChild(row);
      if (COSMETIC_SECTIONS[key]) this.sectionRows[key] = row; // hidden until its achievement is earned
      this.optionRow(row, labels[key],
        () => AVATAR_OPTIONS[key][s.avatar[key]].name,
        dir => { s.avatar[key] = this.nextUnlocked(AVATAR_OPTIONS[key], s.avatar[key], dir); this.drawAvatar(); this.showCard(); });
    }
    this.drawAvatar();

    // which gun you're holding when the game starts
    this.optionRow($('start-gun'), 'START GUN', () => (s.startWeapon + 1) + ' - ' + WEAPONS[s.startWeapon].name, dir => {
      s.startWeapon = (s.startWeapon + dir + BASE_WEAPONS) % BASE_WEAPONS;
    });

    // map and mode
    const mapIds = Object.keys(LEVELS);
    this.optionRow($('map-row'), 'MAP', () => LEVELS[s.map].name, dir => {
      s.map = mapIds[(mapIds.indexOf(s.map) + dir + mapIds.length) % mapIds.length];
      game.resetWorld();
      this.showDifficulty();
    });
    const modes = ['mission', 'endless', 'campaign'];
    this.optionRow($('mode-row'), 'MODE', () => s.mode.toUpperCase(), dir => {
      s.mode = modes[(modes.indexOf(s.mode) + dir + modes.length) % modes.length];
      this.showDifficulty();
    });
    // campaign: pick any chapter you have reached
    this.optionRow($('chapter-row'), 'CHAPTER', () => (s.chapter + 1) + ' - ' + CHAPTERS[s.chapter].title, dir => {
      const open = Math.min(s.chaptersDone, CHAPTERS.length - 1) + 1;
      s.chapter = (s.chapter + dir + open) % open;
      this.showDifficulty();
    });
    this.chapterRowRefresh = () => $('chapter-row').querySelector('.custom-value').textContent = (s.chapter + 1) + ' - ' + CHAPTERS[s.chapter].title;
    $('story-btn').addEventListener('click', () => { Sound.play('click'); const go = this.storyNext; this.storyNext = null; if (go) go(); });

    // difficulty
    const diff = $('difficulty');
    const setDiff = v => {
      s.difficulty = Difficulty.clamp(v);
      diff.value = s.difficulty;
      this.showDifficulty();
      game.saveSettings();
    };
    diff.value = s.difficulty;
    diff.addEventListener('input', () => setDiff(Number(diff.value)));
    $('diff-down').addEventListener('click', () => { setDiff(s.difficulty - 1); Sound.play('click'); });
    $('diff-up').addEventListener('click', () => { setDiff(s.difficulty + 1); Sound.play('click'); });

    // settings
    const sens = $('sensitivity'), vol = $('volume'), mus = $('music');
    sens.value = s.sensitivity;
    vol.value = s.volume;
    mus.value = s.music;
    mus.addEventListener('input', () => { s.music = Number(mus.value); Music.setVolume(s.music / 10); game.saveSettings(); });
    sens.addEventListener('input', () => { s.sensitivity = Number(sens.value); game.saveSettings(); });
    vol.addEventListener('input', () => {
      s.volume = Number(vol.value);
      Sound.setVolume(s.volume / 10);
      game.saveSettings();
    });

    // full screen or a normal window
    this.optionRow($('display-row'), 'DISPLAY', () => (s.display === 'full' ? 'FULL SCREEN' : 'WINDOW'), () => {
      s.display = s.display === 'full' ? 'window' : 'full';
      if (window.desktop) { window.desktop.setFullscreen(s.display === 'full'); return; }
      if (s.display === 'full') game.goFullscreen();
      else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      // the desktop shortcut opens already full screen; only F11 can undo that
      if (s.display === 'window' && !document.fullscreenElement &&
          window.innerHeight >= screen.height - 2 && window.innerWidth >= screen.width - 2) {
        this.hint('PRESS F11 TO LEAVE FULL SCREEN');
      }
    });
    this.optionRow($('tutorial-row'), 'TUTORIAL', () => (s.tutorial ? 'ON' : 'OFF'), () => { s.tutorial = !s.tutorial; });
    this.optionRow($('intro-row'), 'INTRO SCENE', () => (s.intro ? 'ON' : 'OFF'), () => { s.intro = !s.intro; });
    this.optionRow($('numbers-row'), 'DAMAGE NUMBERS', () => (s.damageNumbers ? 'ON' : 'OFF'), () => { s.damageNumbers = !s.damageNumbers; });
    this.optionRow($('shake-row'), 'SCREEN SHAKE', () => (s.shake ? 'ON' : 'OFF'), () => { s.shake = !s.shake; });
    this.optionRow($('scanlines-row'), 'SCANLINES', () => (s.scanlines ? 'ON' : 'OFF'), () => { s.scanlines = !s.scanlines; game.applyVideo(); });
    this.optionRow($('crosshair-row'), 'CROSSHAIR', () => HUD.CROSSHAIRS[s.crosshair], dir => {
      s.crosshair = (s.crosshair + dir + HUD.CROSSHAIRS.length) % HUD.CROSSHAIRS.length;
    });
    const fov = $('fov'), bright = $('brightness');
    fov.value = s.fov; bright.value = s.brightness;
    $('fov-val').textContent = s.fov;
    fov.addEventListener('input', () => { s.fov = Number(fov.value); $('fov-val').textContent = s.fov; game.applyVideo(); game.saveSettings(); });
    bright.addEventListener('input', () => { s.brightness = Number(bright.value); game.applyVideo(); game.saveSettings(); });

    // key remapping: click an action, then press its new key
    this.waitingFor = null;
    window.addEventListener('keydown', e => {
      if (!this.waitingFor) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.code !== 'Escape') {
        Controls.bind(this.waitingFor, e.code);
        s.keys = Controls.keys;
        game.saveSettings();
        Sound.play('click');
      }
      this.waitingFor = null;
      this.showKeys();
    }, true);
    $('keys-reset').addEventListener('click', () => {
      Controls.use(s.keys = Controls.defaults());
      game.saveSettings();
      Sound.play('click');
      this.showKeys();
    });

    // buttons
    $('play-btn').addEventListener('click', () => (s.mode === 'campaign' ? this.briefing() : game.start()));
    $('records-btn').addEventListener('click', () => { Sound.play('click'); this.showRecords(); });
    $('challenges-btn').addEventListener('click', () => { Sound.play('click'); this.showChallenges(); });
    document.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
      Sound.play('click');
      const act = b.dataset.act;
      if (act === 'resume') game.resume();
      else if (act === 'restart') (game.mode === 'drill' ? game.start({ mode: 'drill', map: Level.mapId })
        : game.mode === 'campaign' && game.state !== 'paused' ? this.briefing() : game.start());
      else if (act === 'drill') game.start({ mode: 'drill', map: Level.mapId });
      else if (act === 'next') { s.chapter = Math.min(CHAPTERS.length - 1, s.chapter + 1); game.saveSettings(); this.briefing(); }
      else if (act === 'menu') game.toMenu();
      else if (act === 'quit') this.confirmQuit();
      else if (act === 'help') { this.backTo = 'main'; this.showHelp(); }
      else if (act === 'credits') { this.backTo = 'main'; this.showCredits(); }
      else if (act === 'controls') { this.backTo = game.state === 'paused' ? 'pause' : 'main'; this.showKeys(); }
      else if (act === 'options') {
        this.backTo = game.state === 'paused' ? 'pause' : 'main';
        // importing restarts the game, so the progress buttons are only there from the main menu
        $('progress-buttons').classList.toggle('hidden', game.state === 'paused');
        this.show('options');
      }
      else if (act === 'back') { this.show(['controls', 'options', 'help', 'credits'].includes(this.current) ? this.backTo || 'main' : 'main'); }
    }));

    // a soft tick when the mouse moves onto a button
    let lastHover = null;
    document.addEventListener('mouseover', e => {
      const b = e.target.closest && e.target.closest('button');
      if (b && b !== lastHover && Sound.ctx) Sound.play('hover', 1, 0, 0.04);
      lastHover = b;
    });

    // DISPLAY: FULL - every click or key press (not Esc) puts the game in full screen if it isn't,
    // so the app window's title bar and the Windows taskbar are gone from the very first click.
    // (A browser only allows full screen from a real click or key press, not from a mouse-button press.)
    const toFull = e => { if (!(e.type === 'keydown' && e.code === 'Escape')) game.goFullscreen(); };
    document.addEventListener('click', toFull);
    document.addEventListener('keydown', toFull);

    // start-up: studio splash, then the title screen; any key or click moves on
    this.show('splash');
    this.splashTimer = setTimeout(() => this.toTitle(), 2700);
    const advance = e => {
      if (this.current === 'splash') { this.toTitle(); return; }
      if (this.current === 'title') {
        if (e && e.code === 'Escape') return;
        Sound.play('click');
        this.show('main');
        window.removeEventListener('keydown', advance);
        window.removeEventListener('pointerdown', advance);
      }
    };
    this.advanceTitle = advance;
    window.addEventListener('keydown', advance);
    window.addEventListener('pointerdown', advance);
  },

  toTitle() {
    clearTimeout(this.splashTimer);
    if (this.current === 'splash') this.show('title');
  },

  // One "LABEL  <  value  >" row. change(dir) updates the setting; it is saved afterwards.
  optionRow(row, label, text, change) {
    row.className = 'custom-row';
    row.innerHTML = `<span class="custom-label">${label}</span><button class="arrow" data-dir="-1">&lt;</button><span class="custom-value"></span><button class="arrow" data-dir="1">&gt;</button>`;
    const value = row.querySelector('.custom-value');
    const refresh = () => { value.textContent = text(); };
    row.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      change(Number(b.dataset.dir));
      refresh();
      this.game.saveSettings();
      Sound.play('click');
    }));
    refresh();
  },

  nextUnlocked(options, current, dir) {
    let i = current;
    for (let n = 0; n < options.length; n++) {
      i = (i + dir + options.length) % options.length;
      if (Cosmetics.isUnlocked(options[i])) return i;
    }
    return current;
  },

  drawAvatar() {
    const c = this.$('avatar-preview');
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    Art.drawAvatar(ctx, this.game.settings.avatar);
  },

  showRank() {
    const r = Records.rank();
    this.$('rank-box').innerHTML =
      `<div class="rank-name">${r.name}</div>` +
      `<div class="xp-bar"><div style="width:${Math.round(r.progress * 100)}%"></div></div>` +
      `<div class="rank-xp">${r.next ? r.xp + ' / ' + r.nextXp + ' XP' : r.xp + ' XP - MAX RANK'}</div>`;
  },

  // Story screen: a title, a few paragraphs and one button.
  showStory(title, lines, button, onContinue) {
    this.$('story-title').replaceChildren(Font.toCanvas(title, '#e0a030', '#5a2a08'));
    this.$('story-text').innerHTML = lines.map(l => `<p>${l}</p>`).join('');
    this.$('story-btn').textContent = button;
    this.show('story');
    this.storyNext = onContinue;
  },

  // Chapter briefing before a campaign chapter; START begins it (that click also captures the mouse).
  briefing() {
    const s = this.game.settings, ch = CHAPTERS[s.chapter];
    this.showStory('CHAPTER ' + (s.chapter + 1) + ': ' + ch.title, ch.story, 'START', () => this.game.start());
  },

  showDifficulty() {
    const s = this.game.settings;
    // the difficulty choice stays hidden (and the game stays on 10) until you win on difficulty 10
    const unlocked = Records.difficultyUnlocked();
    if (!unlocked) s.difficulty = 10;
    this.$('diff-controls').classList.toggle('hidden', !unlocked);
    const level = s.difficulty;
    const campaign = s.mode === 'campaign';
    this.$('map-row').classList.toggle('hidden', campaign);
    this.$('chapter-row').classList.toggle('hidden', !campaign);
    if (this.chapterRowRefresh) this.chapterRowRefresh();
    const d = Difficulty.get(level);
    const best = Records.best(s.map, level, s.mode);
    const endless = s.mode === 'endless';
    let bestText = 'BEST HERE: NOT PLAYED YET';
    if (best) {
      bestText = `BEST HERE: ${best.score} PTS &middot; ${this.game.formatTime(best.time)}` +
        (endless ? ` &middot; WAVE ${best.wave || 1}` : best.won ? ' &middot; WARDEN DEFEATED' : '');
    }
    this.$('mission-goal').textContent = campaign
      ? 'CAMPAIGN: ' + CHAPTERS.length + ' CHAPTERS TO THE FOUNDRY CORE.'
      : endless
        ? 'ENDLESS: EVERY WARDEN YOU DESTROY BRINGS A HARDER WAVE.'
        : 'SURVIVE ' + this.game.formatTime(CONFIG.BOSS_TIME) + ', THEN DESTROY THE WARDEN.';
    if (campaign) bestText = 'CHAPTERS CLEARED: ' + s.chaptersDone + ' / ' + CHAPTERS.length +
      (s.chaptersDone < CHAPTERS.length ? '' : ' &middot; CAMPAIGN COMPLETE');
    this.$('diff-num').textContent = level;
    this.$('diff-label').textContent = d.label;
    this.$('diff-info').innerHTML =
      `ROBOTS: ${Difficulty.robotList(level)}<br>` +
      `UP TO ${d.maxAlive} AT ONCE &middot; NEW ONE EVERY ~${d.spawnInterval.toFixed(1)}S &middot; ` +
      `HEALTH x${d.health.toFixed(1)} &middot; DAMAGE x${d.damage.toFixed(1)}<br>` +
      `<span class="best">${bestText}</span>`;
    const mods = Modifiers.valid(s.mods);
    this.$('challenges-btn').textContent = mods.length
      ? `CHALLENGES: ${mods.length} ON (+${Math.round((Modifiers.scoreMult(mods) - 1) * 100)}% SCORE)`
      : 'CHALLENGES';
  },

  showChallenges() {
    const s = this.game.settings;
    const list = this.$('challenges-list');
    const render = () => {
      s.mods = Modifiers.valid(s.mods);
      list.innerHTML = MODIFIERS.map(m => {
        const on = s.mods.includes(m.id);
        return `<button class="mod ${on ? 'on' : ''}" data-mod="${m.id}"><b>${on ? '[ON] ' : '[  ] '}${m.name}</b>` +
          `<span>${m.text}</span><em>+${Math.round(m.bonus * 100)}% SCORE</em></button>`;
      }).join('');
      this.$('challenges-total').textContent = s.mods.length
        ? `SCORE BONUS: +${Math.round((Modifiers.scoreMult(s.mods) - 1) * 100)}%`
        : 'NO CHALLENGES ON - NORMAL GAME';
      list.querySelectorAll('[data-mod]').forEach(b => b.addEventListener('click', () => {
        const id = b.dataset.mod;
        s.mods = s.mods.includes(id) ? s.mods.filter(x => x !== id) : s.mods.concat(id);
        this.game.saveSettings();
        Sound.play('click');
        render();
      }));
    };
    render();
    this.show('challenges');
  },

  showRecords() {
    const t = Records.data.totals, s = this.game.settings, r = Records.rank();
    const list = ACHIEVEMENTS.filter(a => !a.unseen || Records.isUnlocked(a.id));
    const done = list.filter(a => Records.isUnlocked(a.id)).length;
    const nextGifts = r.next ? Cosmetics.rankRewards(r.next) : [];
    let html = (r.next ? `<div class="rec-totals best">NEXT RANK: ${r.next} AT ${r.nextXp} XP${nextGifts.length ? ' - UNLOCKS ' + nextGifts.join(', ') : ''}</div>` : '') +
      `<div class="rec-totals">RANK ${r.name} (${r.xp} XP) &middot; GAMES ${t.games} &middot; WARDENS DEFEATED ${t.bossKills} &middot; ROBOTS DESTROYED ${t.kills}</div>`;
    html += `<h2>ACHIEVEMENTS ${done} / ${list.length}</h2><div class="goals">`;
    for (const a of list) {
      const got = Records.isUnlocked(a.id);
      const v = Math.min(a.target, a.value(t));
      const pct = got ? 100 : Math.floor(v / a.target * 100);
      const hidden = a.secret && !got;
      html += `<div class="goal ${got ? 'done' : ''}">` +
        `<div class="goal-top"><span><b>${hidden ? '???' : a.name}</b> - ${hidden ? 'SECRET ACHIEVEMENT' : a.text}</span><i>${a.reward && !hidden ? 'REWARD: ' + a.reward : ''}</i></div>` +
        `<div class="goal-bar"><div style="width:${pct}%"></div></div>` +
        (a.target > 1 && !got ? `<div class="goal-num">${v} / ${a.target}</div>` : '') + '</div>';
    }
    const mode = s.mode === 'endless' ? 'ENDLESS' : 'MISSION';
    html += `</div><h2>BEST SCORES - ${LEVELS[s.map].name} - ${mode}</h2><div class="bests">`;
    let any = false;
    for (let lv = 1; lv <= 20; lv++) {
      const b = Records.best(s.map, lv, s.mode);
      if (!b) continue;
      any = true;
      html += `<span>DIFF ${lv}</span><span>${b.score} PTS</span><span>${this.game.formatTime(b.time)}</span>` +
        `<span>${s.mode === 'endless' ? 'WAVE ' + (b.wave || 1) : b.won ? 'WON' : ''}</span>`;
    }
    html += any ? '</div>' : '</div><div class="rec-empty">NO GAMES HERE YET</div>';
    this.$('records-body').innerHTML = html;
    this.show('records');
  },

  // name: 'main' | 'pause' | 'over' | 'records' | 'challenges' | 'controls' | null (hide all)
  show(name) {
    this.current = name;
    for (const [k, el] of Object.entries(this.screens)) el.classList.toggle('hidden', k !== name);
    if (name === 'pause') this.$('pause-tip').innerHTML = Tips.html();
    this.lockHintShown = false;
    this.waitingFor = null;
    this.$('lock-hint').textContent = '';
    this.$('menu-hint').textContent = '';
    if (name === 'main' && this.linkImport) { this.linkImport(); return; }
    if (name === 'main') { this.showDifficulty(); this.showRank(); this.showControlsLine(); this.showSections(); this.showCard(); }
  },

  // ---------- EXPORT / IMPORT PROGRESS (js/transfer.js) ----------
  initTransfer() {
    const $ = id => document.getElementById(id);
    const code = $('transfer-code'), msg = $('transfer-msg'), go = $('transfer-go');
    const say = (text, color = '#e0a030') => { msg.textContent = text; msg.style.color = color; };
    const title = text => $('transfer-title').replaceChildren(Font.toCanvas(text, '#e0a030', '#5a2a08'));
    let pending = null; // an import waiting for the second "are you sure" click
    const open = mode => {
      Sound.play('click');
      this.transferMode = mode;
      pending = null;
      go.textContent = 'IMPORT';
      const ex = mode === 'export';
      title(ex ? 'EXPORT PROGRESS' : 'IMPORT PROGRESS');
      $('transfer-help').innerHTML = ex
        ? 'THIS CODE HOLDS ALL YOUR PROGRESS. COPY IT OR SAVE IT AS A FILE,<br>THEN USE IMPORT PROGRESS IN THE OTHER COPY OF SCRAPMANIA.'
        : 'PASTE A PROGRESS CODE (CTRL+V) OR LOAD A PROGRESS FILE.<br>IT REPLACES THE PROGRESS IN THIS COPY OF THE GAME.';
      code.value = ex ? Transfer.exportCode() : '';
      code.readOnly = ex;
      for (const id of ['transfer-copy', 'transfer-save']) $(id).classList.toggle('hidden', !ex);
      for (const id of ['transfer-load', 'transfer-go']) $(id).classList.toggle('hidden', ex);
      say('');
      this.show('transfer');
      if (ex) code.select(); else code.focus();
    };
    $('export-btn').addEventListener('click', () => open('export'));
    // a link with "#progress=<code>" opens IMPORT with that code filled in and asks to confirm
    // (the code stays in this PC: the part after # is never sent to the website)
    const fromLink = /^#progress=(.+)$/.exec(location.hash);
    if (fromLink) {
      history.replaceState(null, '', location.pathname + location.search);
      this.linkImport = () => { this.linkImport = null; open('import'); code.value = decodeURIComponent(fromLink[1]); go.click(); };
    }
    $('import-btn').addEventListener('click', () => open('import'));
    $('transfer-back').addEventListener('click', () => { Sound.play('click'); this.show('options'); });
    $('transfer-copy').addEventListener('click', () => {
      Sound.play('click');
      code.select();
      const done = () => say('COPIED! NOW PASTE IT IN THE OTHER COPY OF THE GAME.', '#60ff80');
      // the clipboard API can be missing (e.g. a page opened as a file): fall back to the old way
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(code.value).then(done, () => { document.execCommand('copy'); done(); });
      else { document.execCommand('copy'); done(); }
    });
    $('transfer-save').addEventListener('click', () => {
      Sound.play('click');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([code.value], { type: 'text/plain' }));
      a.download = 'scrapmania-progress.txt';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      say('SAVED AS SCRAPMANIA-PROGRESS.TXT (IN YOUR DOWNLOADS).', '#60ff80');
    });
    $('transfer-load').addEventListener('click', () => { Sound.play('click'); $('transfer-file').click(); });
    $('transfer-file').addEventListener('change', e => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      f.text().then(t => { code.value = t.trim(); pending = null; go.textContent = 'IMPORT'; say('FILE LOADED. PRESS IMPORT.'); });
      e.target.value = '';
    });
    code.addEventListener('input', () => { pending = null; go.textContent = 'IMPORT'; say(''); });
    go.addEventListener('click', () => {
      Sound.play('click');
      const data = Transfer.parse(code.value);
      if (!data) { pending = null; go.textContent = 'IMPORT'; say('THAT IS NOT A SCRAPMANIA PROGRESS CODE.', '#ff6040'); return; }
      if (pending !== code.value) {
        pending = code.value;
        go.textContent = 'YES, REPLACE';
        say('LOAD ' + Transfer.describe(data) + '? THE PROGRESS IN THIS COPY WILL BE REPLACED.', '#ffd040');
        return;
      }
      say('IMPORTING...', '#60ff80');
      Transfer.apply(data);
    });
  },

  confirmQuit() {
    const paused = this.game.state === 'paused';
    this.backTo = paused ? 'pause' : 'main';
    this.$('confirm-text').textContent = paused ? 'THIS GAME WILL NOT BE SAVED. CLOSE SCRAPMANIA?' : 'CLOSE SCRAPMANIA?';
    this.show('confirm');
  },

  // A page that explains the game: goal, controls, guns, robots, pickups.
  showHelp() {
    const k = id => Controls.name(id);
    const img = c => `<img src="${c.toDataURL()}" alt="">`;
    const robotInfo = {
      basic: 'AVERAGE AT EVERYTHING.', fast: 'SMALL, FAST, FRAGILE.', ranged: 'KEEPS ITS DISTANCE AND SHOOTS PLASMA. DODGE IT.',
      heavy: 'SLOW AND TOUGH. HITS VERY HARD.', bomber: 'ROLLS AT YOU AND EXPLODES. SHOOT IT EARLY.',
      shield: 'ITS SHIELD BLOCKS BULLETS. HIT IT WHILE IT ATTACKS, OR USE EXPLOSIONS AND PLASMA.',
      phantom: 'TELEPORTS, OFTEN BEHIND YOU.', carrier: 'LAUNCHES MINI-DRONES. TAKE IT OUT FIRST.',
      jumper: 'LEAPS AT YOU FROM A DISTANCE AND SLAMS DOWN. DASH AWAY WHEN IT CROUCHES.',
      sapper: 'DROPS MINES THAT BLOW UP WHEN YOU STEP CLOSE. SHOOT THE MINES FROM AFAR.',
      medic: 'REPAIRS THE ROBOTS AROUND IT AND RUNS FROM YOU. DESTROY IT FIRST.',
      boss: 'THE WARDEN. THREE STAGES: VOLLEYS, THEN STOMPS AND BOMBERS. BELOW A THIRD OF ITS HEALTH IT WEARS OUT: SLOWER, SOFTER HITS, FEWER ROBOTS.',
    };
    let html = '<h2>THE GOAL</h2><p><b>MISSION:</b> SURVIVE ' + this.game.formatTime(CONFIG.BOSS_TIME) +
      ', THEN DESTROY THE WARDEN. <b>ENDLESS:</b> EVERY WARDEN BRINGS A HARDER WAVE. <b>CAMPAIGN:</b> FIVE STORY CHAPTERS.</p>';
    html += '<h2>CONTROLS</h2><p>' + [k('forward'), k('left'), k('back'), k('right')].join(' ') + ' MOVE &middot; MOUSE AIM &middot; LEFT CLICK SHOOT &middot; RIGHT CLICK SCOPE &middot; ' +
      k('reload') + ' RELOAD &middot; ' + k('use') + ' USE &middot; ' + k('grenade') + ' GRENADE &middot; ' + k('dash') + ' DASH (YOU CAN\'T BE HIT DURING IT) &middot; 1-7 OR WHEEL SWITCH GUN &middot; ESC PAUSE. A CONTROLLER WORKS TOO. CHANGE KEYS IN CONTROLS.</p>';
    html += '<h2>WEAPONS</h2><p>YOU START WITH THE SHOTGUN, SNIPER, ASSAULT RIFLE AND SMG. <b>WEAPON CRATES</b> DROP DURING THE GAME WITH THE ROCKET LAUNCHER, PLASMA RIFLE AND FLAMETHROWER. GREEN <b>UPGRADE CHIPS</b> FROM ROBOTS POWER UP THE GUN IN YOUR HANDS.</p>';
    html += '<h2>ROBOTS</h2><div class="help-grid">';
    for (const [type, text] of Object.entries(robotInfo)) {
      html += img(Art.sprites[type].walk0.canvas || Art.sprites[type].walk0) + `<span><b>${ROBOTS[type].name}</b> - ${text}</span>`;
    }
    html += '</div><h2>PICKUPS AND THE MAP</h2><div class="help-grid">';
    const items = [['health', 'MEDKIT: +' + PICKUPS.health.amount + ' HEALTH.'], ['ammo', 'AMMO FOR EVERY GUN YOU HAVE.'],
      ['chip', 'UPGRADE CHIP.'], ['barrel', 'RED BARREL: SHOOT IT TO BLOW UP NEARBY ROBOTS.']];
    for (const [s, text] of items) html += img(Art.sprites[s].canvas || Art.sprites[s]) + `<span>${text}</span>`;
    const gadgets = [[Art.sprites.turret[1], 'TURRET: STAND NEXT TO IT AND PRESS ' + k('use') + '. STAY CLOSE FOR ' + GADGETS.turret.hack + ' SECONDS TO HACK IT - THEN IT SHOOTS ROBOTS FOR YOU FOR ' + GADGETS.turret.active + ' SECONDS.'],
      [Art.sprites.healthStation[0], 'HEALTH STATION (' + k('use') + '): +40 HEALTH, THEN IT RECHARGES.'], [Art.sprites.ammoStation[0], 'AMMO STATION (' + k('use') + '): REFILLS AMMO.'],
      [Art.sprites.alarmStation[0], 'ALARM BUTTON (' + k('use') + '): EVERY ROBOT RUNS TO IT FOR 10 SECONDS.'],
      [Art.sprites.crate, 'CRATE: SHOOT IT OPEN - SOMETIMES AMMO OR A MEDKIT INSIDE.'], [Art.sprites.canister, 'GAS CANISTER: SMALL EXPLOSION WHEN SHOT.'],
      [Art.sprites.pipe, 'PIPES BURST WHEN SHOT AND SPRAY BURNING STEAM.'],
      [Art.sprites.tpad[0], 'TELEPORT PAD: STEP ON IT TO COME OUT OF THE OTHER PAD OF THE SAME COLOR (ROBOTS TOO).'],
      [Art.sprites.supplyCrate, 'EVENTS: BLACKOUTS, LOCKDOWNS (DOORS SEAL, ROBOTS POUR IN) AND SUPPLY DROPS HAPPEN DURING A GAME.']];
    for (const [s, text] of gadgets) html += img(s.canvas || s) + `<span>${text}</span>`;
    html += '</div><p>CRACKED WALLS: BLOW ONE UP WITH A GRENADE, ROCKET OR BARREL FOR A SHORTCUT AND A HIDDEN CACHE. YELLOW FUSE BOXES ELECTRIFY THE FLOOR WHEN SHOT. WALL SWITCHES (' + k('use') + ') OPEN SECRET ROOMS. LIGHTS AND SCREENS BREAK.</p>';
    this.$('help-body').innerHTML = html;
    this.show('help');
  },

  showCredits() {
    const roll = this.$('credits-roll');
    const section = (title, ...lines) => `<h3>${title}</h3>` + lines.map(l => `<div>${l}</div>`).join('');
    roll.innerHTML = '';
    roll.appendChild(Art.bigTitle(['SCRAPMANIA'], 5));
    roll.insertAdjacentHTML('beforeend',
      section('A GAME BY', 'REINJ GAMES') +
      section('GAME DESIGN AND DIRECTION', 'REINJ') +
      section('PROGRAMMING, ART, SOUND AND MUSIC', 'MADE IN CODE BY REINJ', 'WITH THE HELP OF CLAUDE (ANTHROPIC)') +
      section('PLAYTESTING', 'REINJ') +
      section('BUILT WITH', 'HTML, JAVASCRIPT AND ELECTRON') +
      section('SPECIAL THANKS', 'EVERYONE WHO PLAYS THIS GAME') +
      '<h3>&nbsp;</h3><div>THANK YOU FOR PLAYING</div><div class="small">&copy; 2026 REINJ GAMES - VERSION ' + CONFIG.VERSION + '</div>');
    // restart the scroll every time
    roll.style.animation = 'none'; void roll.offsetHeight; roll.style.animation = '';
    this.show('credits');
  },

  // Cosmetic sections appear once their achievement is earned.
  showSections() {
    for (const [key, row] of Object.entries(this.sectionRows || {})) row.classList.toggle('hidden', !Cosmetics.sectionOpen(key));
  },

  showCard() {
    const el = this.$('username');
    el.className = Cosmetics.cardClass(this.game);
  },

  // A short orange note under the menu (or the pause buttons).
  hint(text) {
    const el = this.screens.pause.classList.contains('hidden') ? this.$('menu-hint') : this.$('lock-hint');
    el.textContent = text;
  },

  showControlsLine() {
    const k = id => Controls.name(id);
    this.$('controls-line').innerHTML =
      `${k('forward')} ${k('left')} ${k('back')} ${k('right')} MOVE &middot; MOUSE AIM &middot; LEFT CLICK SHOOT &middot; ` +
      `RIGHT CLICK SNIPER SCOPE &middot; ${k('reload')} RELOAD &middot; ${k('use')} USE &middot; ` +
      `${k('gun1')}-${k('gun8')} OR WHEEL: SWITCH GUN &middot; ESC PAUSE &middot; CONTROLLER WORKS TOO`;
  },

  showKeys() {
    const list = this.$('keys-list');
    let html = '';
    for (const a of ACTIONS) {
      const waiting = this.waitingFor === a.id;
      html += `<button class="key-row ${waiting ? 'waiting' : ''}" data-key="${a.id}"><span>${a.label}</span>` +
        `<b>${waiting ? 'PRESS A KEY...' : Controls.name(a.id)}</b></button>`;
    }
    for (const [label, key] of [['SHOOT', 'LEFT CLICK'], ['SNIPER SCOPE', 'RIGHT CLICK'], ['NEXT GUN', 'MOUSE WHEEL'], ['PAUSE', 'ESC']]) {
      html += `<div class="key-row fixed"><span>${label}</span><b>${key}</b></div>`;
    }
    list.innerHTML = html;
    list.querySelectorAll('[data-key]').forEach(b => b.addEventListener('click', () => {
      this.waitingFor = this.waitingFor === b.dataset.key ? null : b.dataset.key;
      Sound.play('click');
      this.showKeys();
    }));
    if (this.screens.controls.classList.contains('hidden')) {
      const waiting = this.waitingFor;
      this.show('controls');
      this.waitingFor = waiting;
    }
  },

  // ---------- controller in menus ----------
  // D-pad / left stick moves between buttons, A presses, B goes back, Start resumes.
  padNav() {
    const pad = Controls.pad, game = this.game;
    if (!pad.buttons.length) { this.stickWas = 0; return; }
    const screen = Object.values(this.screens).find(el => !el.classList.contains('hidden'));
    if (!screen) return;
    if ((this.current === 'splash' || this.current === 'title') && pad.buttons.some((b, i) => b && !pad.prev[i])) {
      this.advanceTitle(null);
      return;
    }
    if (game.state === 'paused' && Controls.padPressed(PAD.START)) { game.resume(); return; }
    const items = Array.from(screen.querySelectorAll('button, input')).filter(e => e.offsetParent);
    if (!items.length) return;
    // stick acts like the d-pad, one step per push
    const stick = Math.abs(pad.moveY) > 0.6 ? Math.sign(pad.moveY) * 2 : Math.abs(pad.moveX) > 0.6 ? Math.sign(pad.moveX) : 0;
    const stickNew = stick !== this.stickWas ? stick : 0;
    this.stickWas = stick;
    let move = 0;
    if (Controls.padPressed(PAD.DOWN) || stickNew === 2) move = 1;
    if (Controls.padPressed(PAD.UP) || stickNew === -2) move = -1;
    let side = 0;
    if (Controls.padPressed(PAD.RIGHT) || stickNew === 1) side = 1;
    if (Controls.padPressed(PAD.LEFT) || stickNew === -1) side = -1;
    let cur = items.indexOf(document.activeElement);
    if (side && cur >= 0 && items[cur].type === 'range') {
      const r = items[cur];
      r.value = Number(r.value) + side * Number(r.step || 1);
      r.dispatchEvent(new Event('input'));
    } else if (side) move = side;
    if (move) {
      cur = cur < 0 ? 0 : (cur + move + items.length) % items.length;
      this.padFocus(items[cur]);
      Sound.play('click');
    }
    if (Controls.padPressed(PAD.A) && cur >= 0 && items[cur].tagName === 'BUTTON') items[cur].click();
    if (Controls.padPressed(PAD.B)) {
      const back = screen.querySelector('[data-act=back], [data-act=resume]');
      if (back) back.click();
    }
  },

  padFocus(el) {
    document.querySelectorAll('.pad-focus').forEach(e => e.classList.remove('pad-focus'));
    el.classList.add('pad-focus');
    el.focus();
  },

  showGameOver(game) {
    this.$('stat-score').textContent = game.score;
    this.$('stat-kills').textContent = game.kills;
    this.$('stat-time').textContent = game.formatTime(game.time) + (game.mode === 'endless' ? ' (WAVE ' + game.wave + ')' : '');
    const camp = game.mode === 'campaign', last = camp && Campaign.index === CHAPTERS.length - 1;
    // after the final chapter, the ending comes first, then this screen
    if ((game.altEnd || game.mode === 'drill' || (camp && game.won && last)) && game.won && !this.endingShown) {
      this.endingShown = true;
      const end = game.altEnd ? ENDINGS.b : game.mode === 'drill' ? ENDINGS.c : ENDINGS.normal;
      const story = () => this.showStory(end.title, end.story, 'CONTINUE', () => this.showGameOver(game));
      story();
      return;
    }
    this.$('stat-map').textContent = (camp ? 'CHAPTER ' + (Campaign.index + 1) + ': ' + Campaign.ch.title : LEVELS[Level.mapId].name + (game.mode === 'drill' ? Lex.d7 : '')) +
      (game.mods.length ? ' + ' + game.mods.length + ' CHALLENGES' : '');
    const title = camp && game.won && !last ? Font.toCanvas('CHAPTER COMPLETE', '#60ff80', '#0a3a14') : game.won ? this.wonTitle : this.lostTitle;
    this.$('over-title').replaceChildren(title);
    const next = this.screens.over.querySelector('[data-act=next]');
    next.classList.toggle('hidden', !(camp && game.won && !last));
    this.screens.over.querySelector('[data-act=drill]').classList.toggle('hidden', !(game.altEnd && game.won));
    this.screens.over.querySelector('[data-act=restart]').textContent = camp ? (game.won && !last ? 'PLAY AGAIN' : 'RETRY CHAPTER') : 'RESTART';
    this.screens.over.querySelector('[data-act=restart]').classList.toggle('big', !(camp && game.won && !last) && !game.altEnd);
    this.$('stat-diff').textContent = game.diff.level + ' - ' + game.diff.label;
    const r = game.runResult;
    let extra = '';
    if (game.diffWasLocked && Records.difficultyUnlocked()) {
      extra += '<div class="new-best">DIFFICULTY UNLOCKED! CHOOSE ANY LEVEL FROM 1 TO 20 IN THE MAIN MENU</div>';
    }
    if (r) {
      if (r.newBest) extra += '<div class="new-best">NEW BEST SCORE!</div>';
      extra += `<div class="xp">+${r.xpGained} XP</div>`;
      if (r.rankUp) {
        const gifts = Cosmetics.rankRewards(r.rankUp);
        extra += `<div class="new-best">RANK UP: ${r.rankUp}!${gifts.length ? ' UNLOCKED ' + gifts.join(', ') : ''}</div>`;
      }
      const shown = r.unlocked.slice(0, 4);
      for (const a of shown) extra += `<div class="unlock">ACHIEVEMENT: ${a.name}${a.reward ? ' - UNLOCKED ' + a.reward : ''}</div>`;
      if (r.unlocked.length > shown.length) extra += `<div class="unlock">+${r.unlocked.length - shown.length} MORE ACHIEVEMENTS</div>`;
    }
    this.$('over-extra').innerHTML = extra;
    const card = this.$('over-card');
    card.className = 'calling-card ' + Cosmetics.cardClass(game);
    card.innerHTML = game.settings.username + '<span>' + Records.rank().name + '</span>';
    this.$('over-tip').innerHTML = game.won ? '' : Tips.html();
    this.show('over');
  },
};
