'use strict';
// Difficulty 1-20. Every value slides smoothly between three anchor points
// (level 1, level 10, level 20), so each step is a little harder than the last.

const Difficulty = {
  MIN: 1,
  MAX: 20,

  clamp(level) {
    return Math.max(this.MIN, Math.min(this.MAX, Math.round(level) || 10));
  },

  curve(level, at1, at10, at20) {
    if (level <= 10) return at1 + (at10 - at1) * (level - 1) / 9;
    return at10 + (at20 - at10) * (level - 10) / 10;
  },

  label(level) {
    if (level <= 3) return 'VERY EASY';
    if (level <= 7) return 'EASY';
    if (level <= 12) return 'NORMAL';
    if (level <= 16) return 'HARD';
    if (level <= 19) return 'BRUTAL';
    return 'EXTREMELY HARD';
  },

  // Which robot types can appear, and how often (bigger weight = more common).
  robotWeights(level) {
    return {
      basic: 10,
      fast: level >= 3 ? (level - 2) * 0.8 : 0,
      ranged: level >= 5 ? (level - 4) * 0.7 : 0,
      heavy: level >= 7 ? (level - 6) * 0.55 : 0,
      bomber: level >= 4 ? (level - 3) * 0.6 : 0,
      shield: level >= 8 ? (level - 7) * 0.5 : 0,
      phantom: level >= 10 ? (level - 9) * 0.5 : 0,
      carrier: level >= 12 ? (level - 11) * 0.3 : 0,
      jumper: level >= 5 ? (level - 4) * 0.5 : 0,
      sapper: level >= 6 ? (level - 5) * 0.45 : 0,
      medic: level >= 9 ? (level - 8) * 0.35 : 0,
    };
  },

  get(level) {
    level = this.clamp(level);
    const c = (a, b, d) => this.curve(level, a, b, d);
    return {
      level,
      label: this.label(level),
      startRobots: Math.round(c(2, 5, 10)),
      maxAlive: Math.round(c(3, 9, 22)),
      spawnInterval: c(8, 3.2, 0.9),      // seconds between spawn waves
      groupChance: Math.max(0, (level - 8) / 15), // chance a wave brings a second robot
      speed: c(0.65, 1, 1.35),
      // (the growth from level 1 was cut by 15%: level 20 used to be 1.8 health / 2.1 damage)
      health: c(0.5, 0.925, 1.605),
      damage: c(0.3, 0.895, 1.83),
      attackRate: c(0.6, 1, 1.7),          // higher = attacks more often
      aimError: c(0.14, 0.06, 0.015),      // how far off ranged robots shoot
      healthDrop: c(0.42, 0.23, 0.13),     // chance a destroyed robot drops a medkit
      ammoDrop: c(0.4, 0.3, 0.25),
      scoreMult: c(0.5, 1, 2),
      weights: this.robotWeights(level),
    };
  },

  // Short line for the menu, e.g. "DRONE, SKITTER".
  robotList(level) {
    const w = this.robotWeights(this.clamp(level));
    return Object.keys(w).filter(k => w[k] > 0).map(k => ROBOTS[k].name).join(', ');
  },
};
