'use strict';
// Cosmetic unlocks.
//  - Items with `unlock: '<achievement id>'` come from achievements, items with `rank: '<RANK>'`
//    come from ranking up (both live in AVATAR_OPTIONS in config.js).
//  - Whole new SECTIONS (kill effects, bullet trails, calling cards) are unlocked by an
//    achievement; the items inside them by more achievements.

const COSMETIC_SECTIONS = {
  killFx: { label: 'KILL FX', unlock: 'chain' },        // CHAIN REACTION
  trail: { label: 'TRAIL', unlock: 'sharpshooter' },    // SHARPSHOOTER
  card: { label: 'CARD', unlock: 'win' },               // WARDEN DOWN
};

const Cosmetics = {
  rankIndex() {
    const name = Records.rank().name;
    return RANKS.findIndex(r => r[1] === name);
  },

  isUnlocked(item) {
    if (item.unlock && !Records.isUnlocked(item.unlock)) return false;
    if (item.rank && this.rankIndex() < RANKS.findIndex(r => r[1] === item.rank)) return false;
    return true;
  },

  sectionOpen(key) {
    const sec = COSMETIC_SECTIONS[key];
    return !sec || Records.isUnlocked(sec.unlock);
  },

  // What the player chose (index 0 if the section isn't open yet).
  chosen(game, key) {
    if (!this.sectionOpen(key)) return AVATAR_OPTIONS[key][0];
    return AVATAR_OPTIONS[key][game.settings.avatar[key] || 0] || AVATAR_OPTIONS[key][0];
  },

  // Items a rank gives (for the rank-up message and the achievements screen).
  rankRewards(rankName) {
    const out = [];
    for (const [key, list] of Object.entries(AVATAR_OPTIONS)) {
      for (const it of list) if (it.rank === rankName) out.push(it.name + ' ' + (SECTION_NAMES[key] || key.toUpperCase()));
    }
    return out;
  },

  // ---------- kill effects ----------
  killEffect(game, robot) {
    const fx = this.chosen(game, 'killFx').fx;
    if (!fx) return;
    const x = robot.x, y = robot.y, z = robot.def.height * 0.6;
    const B = (o) => Effects.burst(x, y, z, o);
    if (fx === 'lightning') {
      for (let i = 0; i < 6; i++) Effects.burst(x + (Math.random() - 0.5) * 0.3, y + (Math.random() - 0.5) * 0.3, Math.random() * 1.2, { count: 3, colors: ['#c0f4ff', '#40e0ff', '#ffffff'], speed: 0.4, up: 0, size: 0.03, life: 0.25, gravity: 0 });
      B({ count: 14, colors: ['#40e0ff', '#ffffff'], speed: 3, up: 2, size: 0.03, life: 0.4 });
      Effects.addLight(x, y, [0.4, 0.9, 1], 4, 1.6, 0.25);
      game.playAt('zap', x, y, 0.5, 0.1);
    } else if (fx === 'confetti') {
      B({ count: 30, colors: ['#ff4060', '#ffd040', '#40e0ff', '#60ff80', '#ff60f0'], speed: 2.5, up: 4, size: 0.035, life: 1.4, gravity: 3 });
    } else if (fx === 'pixels') {
      B({ count: 20, colors: ['#60ff80', '#20a040', '#c0ffc0'], speed: 1.5, up: 2.5, size: 0.06, life: 0.9, gravity: -0.5 });
    } else if (fx === 'fireworks') {
      Effects.burst(x, y, 1.4, { count: 36, colors: ['#ff4060', '#ffd040', '#40e0ff', '#ffffff'], speed: 4, up: 1, size: 0.03, life: 0.9, gravity: 2 });
      Effects.addLight(x, y, [1, 0.6, 0.8], 5, 1.4, 0.4);
    } else if (fx === 'golden') {
      B({ count: 24, colors: ['#ffd040', '#fff0a0', '#c09020'], speed: 2.2, up: 3.5, size: 0.04, life: 1.1, gravity: 6 });
      Effects.addLight(x, y, [1, 0.85, 0.3], 4, 1.2, 0.3);
    }
  },

  // ---------- bullet trails ----------
  trail(game, px, py, angle, dist) {
    const col = this.chosen(game, 'trail').color;
    if (!col) return;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const steps = Math.min(14, Math.max(3, Math.round(dist * 1.5)));
    for (let i = 1; i <= steps; i++) {
      const t = (i / steps) * dist;
      if (t < 0.6) continue; // not right in front of your face
      Effects.particles.push({ x: px + dx * t, y: py + dy * t, z: 0.43, vx: 0, vy: 0, vz: 0, life: 0.09, maxLife: 0.09,
        color: Effects.color(col), size: 0.02, gravity: 0, bright: true });
    }
  },

  // ---------- calling card (CSS class on the callsign box and the game-over banner) ----------
  cardClass(game) {
    return 'card-' + (this.chosen(game, 'card').css || 'steel');
  },
};

const SECTION_NAMES = { suit: 'SUIT', visor: 'EYE', helmet: 'HELMET', accessory: 'GEAR', gunSkin: 'GUN SKIN', killFx: 'KILL EFFECT', trail: 'TRAIL', card: 'CALLING CARD' };
