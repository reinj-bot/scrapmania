'use strict';
// Saves the player's name, avatar and settings so they survive a restart.
// (Best scores and unlocks are saved separately, in records.js.)

// Where saves go: real files in the desktop version (window.desktop, see desktop/preload.js),
// browser storage when the game runs in a browser. If the desktop version has no file yet,
// it reads browser storage once, so older progress carries over.
const Store = {
  get(key) {
    if (window.desktop) {
      const text = window.desktop.readSave(key);
      if (text !== null) return text;
    }
    try { return localStorage.getItem(key); } catch (e) { return null; }
  },

  set(key, text) {
    if (window.desktop) { window.desktop.writeSave(key, text); return; }
    try { localStorage.setItem(key, text); } catch (e) { /* private mode: just don't save */ }
  },
};

const SaveData = {
  KEY: 'scrapProtocol.save.v1',

  defaults() {
    const avatar = {};
    for (const k of Object.keys(AVATAR_OPTIONS)) avatar[k] = 0;
    return {
      username: 'RECRUIT',
      difficulty: 10,
      sensitivity: 5,
      volume: 7,
      music: 6,
      fov: 66,            // field of view in degrees
      brightness: 10,     // 10 = normal (shown as a brightness filter on the picture)
      shake: true,
      scanlines: true,
      crosshair: 0,       // index in HUD.CROSSHAIRS
      intro: true,        // the intro cutscene at the start of every game
      damageNumbers: true,
      startWeapon: 2,
      map: 'foundry',
      mode: 'mission',
      chapter: 0,          // campaign chapter chosen in the menu
      chaptersDone: 0,     // how many campaign chapters are cleared (unlocks the next)
      mods: [],
      display: 'full',
      tutorial: true,
      keys: Controls.defaults(),
      avatar,
    };
  },

  load() {
    const d = this.defaults();
    try {
      const raw = Store.get(this.KEY);
      if (!raw) return d;
      const s = JSON.parse(raw);
      const avatar = {};
      for (const k of Object.keys(AVATAR_OPTIONS)) {
        avatar[k] = this.num(s.avatar && s.avatar[k], 0, AVATAR_OPTIONS[k].length - 1, 0);
      }
      return {
        username: typeof s.username === 'string' && s.username.trim() ? s.username.slice(0, 12) : d.username,
        difficulty: Difficulty.clamp(s.difficulty),
        sensitivity: this.num(s.sensitivity, 1, 10, d.sensitivity),
        volume: this.num(s.volume, 0, 10, d.volume),
        music: this.num(s.music, 0, 10, d.music),
        fov: this.num(s.fov, 55, 100, d.fov),
        brightness: this.num(s.brightness, 6, 16, d.brightness),
        shake: s.shake !== false,
        scanlines: s.scanlines !== false,
        crosshair: this.num(s.crosshair, 0, 3, 0),
        intro: s.intro !== false,
        damageNumbers: s.damageNumbers !== false,
        startWeapon: this.num(s.startWeapon, 0, BASE_WEAPONS - 1, d.startWeapon),
        map: LEVELS[s.map] ? s.map : d.map,
        mode: ['endless', 'campaign'].includes(s.mode) ? s.mode : 'mission',
        chaptersDone: this.num(s.chaptersDone, 0, CHAPTERS.length, 0),
        chapter: Math.min(this.num(s.chapter, 0, CHAPTERS.length - 1, 0), this.num(s.chaptersDone, 0, CHAPTERS.length, 0)),
        mods: Modifiers.valid(s.mods),
        display: s.display === 'window' ? 'window' : 'full',
        tutorial: s.tutorial !== false,
        keys: Controls.valid(s.keys),
        avatar,
      };
    } catch (e) {
      return d;
    }
  },

  save(data) {
    Store.set(this.KEY, JSON.stringify(data));
  },

  num(v, min, max, fallback) {
    v = Math.round(Number(v));
    return Number.isFinite(v) && v >= min && v <= max ? v : fallback;
  },
};
