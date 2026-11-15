'use strict';
// Optional challenge rules, switched on in the menu before a game. Each adds a score bonus.

const MODIFIERS = [
  { id: 'shotgun', name: 'SHOTGUN ONLY', text: 'THE OTHER GUNS ARE LOCKED', bonus: 0.3 },
  { id: 'glass', name: 'GLASS CANNON', text: 'YOU AND THE ROBOTS DEAL DOUBLE DAMAGE', bonus: 0.5 },
  { id: 'horde', name: 'HORDE', text: 'TWICE AS MANY ROBOTS, ARRIVING TWICE AS FAST', bonus: 0.4 },
  { id: 'nomeds', name: 'NO MEDKITS', text: 'NO HEALTH PICKUPS AT ALL', bonus: 0.4 },
  { id: 'speed', name: 'SPEED DEMONS', text: 'ROBOTS MOVE 40% FASTER', bonus: 0.3 },
  { id: 'dark', name: 'LIGHTS OUT', text: 'THE MAP IS HALF AS BRIGHT', bonus: 0.2 },
];

const Modifiers = {
  valid(ids) {
    return Array.isArray(ids) ? ids.filter(id => MODIFIERS.some(m => m.id === id)) : [];
  },

  scoreMult(ids) {
    return 1 + MODIFIERS.filter(m => ids.includes(m.id)).reduce((s, m) => s + m.bonus, 0);
  },

  // Changes the difficulty numbers for the chosen challenges.
  applyToDiff(d, ids) {
    if (ids.includes('horde')) { d.maxAlive = Math.round(d.maxAlive * 2); d.spawnInterval *= 0.5; d.startRobots *= 2; }
    if (ids.includes('speed')) d.speed *= 1.4;
    if (ids.includes('glass')) d.damage *= 2;
    if (ids.includes('nomeds')) d.healthDrop = 0;
    return d;
  },
};
