'use strict';
// All the balance numbers live here, so tweaking the game never means digging through logic.

const CONFIG = {
  VERSION: '1.0.0',
  WIDTH: 384,            // internal resolution; the canvas is scaled up with chunky pixels
  HEIGHT: 216,
  HUD_H: 32,             // status bar at the bottom
  FOV: 66 * Math.PI / 180,
  SNIPER_ZOOM: 3.2,
  EYE: 0.5,              // eye height (walls are 1 tall)
  FOG_DIST: 15,
  PLAYER_SPEED: 4.0,     // tiles per second
  PLAYER_RADIUS: 0.24,
  PLAYER_MAX_HP: 100,
  TEX: 32,               // texture size in pixels
  LIGHT_RES: 4,          // light samples per tile (low on purpose: blocky retro lighting)
  MAX_DYNAMIC_LIGHTS: 8,
  GRENADE: { start: 2, max: 4, speed: 9, up: 3.2, fuse: 1.6, radius: 2.6, robotDamage: 160, playerDamage: 40 },
  DASH: { time: 0.18, speed: 16, cooldown: 1.05 },   // a quick burst of movement; you can't be hit during it
  OVERSEER_CHANCE: 1 / 10000,   // after you beat the Warden, very rarely... (callsign DARKSIDE = always, for testing)
  GUN_SCALE: 1.15,
  PICKUP_RANGE: 1.0,     // how close you must be to grab health, ammo, chips and guns (was 0.6)   // how big the gun in your hands is drawn (was 1.5 - it covered too much of the screen)
  CRATE_FIRST: 35,   // seconds until the first weapon crate drops
  CRATE_EVERY: 50,   // then one every this many seconds (only one on the map at a time)
  // soft light the player carries, so the area right around you is never pitch black
  // (radius in tiles; half as strong with the Lights Out challenge)
  PLAYER_LIGHT: { radius: 5.5, intensity: 0.6, color: [1, 0.95, 0.85] },
  BOSS_TIME: 180,        // seconds to survive before the Warden boss arrives (destroy it to win)
  ENDLESS_BOSS_GAP: 150, // endless mode: seconds between one Warden falling and the next arriving
  BRIGHTNESS: 1.2,       // overall map light (1 = original, 1.2 = 20% brighter)
};
CONFIG.VIEW_H = CONFIG.HEIGHT - CONFIG.HUD_H;

// Order here = number key 1-4.
// spread is in radians either side of the aim; falloff = distance where damage starts dropping.
const WEAPONS = [
  {
    id: 'shotgun', name: 'SHOTGUN',
    damage: 12, pellets: 8, spread: 0.10, range: 11, falloff: 3.5,
    fireDelay: 0.8, auto: false, mag: 6, startReserve: 24, maxReserve: 48,
    reloadTime: 1.9, hitScale: 1.15, kick: 10, shake: 0.35, ammoPickup: 8,
  },
  {
    id: 'sniper', name: 'SNIPER',
    damage: 140, pellets: 1, spread: 0.07, scopedSpread: 0.0015, range: 70, falloff: 70,
    fireDelay: 1.25, auto: false, mag: 5, startReserve: 15, maxReserve: 30,
    reloadTime: 2.4, hitScale: 0.5, kick: 14, shake: 0.3, ammoPickup: 5, scope: true,
  },
  {
    id: 'ar', name: 'ASSAULT RIFLE',
    damage: 12, pellets: 1, spread: 0.018, bloom: 0.006, maxBloom: 0.05, range: 28, falloff: 14,  // (was 15: it beat the SMG everywhere)
    fireDelay: 0.1, auto: true, mag: 30, startReserve: 120, maxReserve: 240,
    reloadTime: 1.8, hitScale: 0.85, kick: 4, shake: 0.08, ammoPickup: 45,
  },
  {
    id: 'smg', name: 'SMG',
    damage: 10, pellets: 1, spread: 0.045, bloom: 0.004, maxBloom: 0.08, range: 13, falloff: 5,  // (was 8)
    fireDelay: 0.055, auto: true, mag: 45, startReserve: 180, maxReserve: 360,
    reloadTime: 1.5, hitScale: 0.95, kick: 3, shake: 0.05, ammoPickup: 60,
  },
  // ---- found on the map in weapon crates (keys 5-7) ----
  {
    id: 'rocket', name: 'ROCKET LAUNCHER', found: true, projectile: 'rocket',
    damage: 120, radius: 2.4, speed: 10, spread: 0.004, range: 30, falloff: 30,
    fireDelay: 0.9, auto: false, mag: 3, startReserve: 6, maxReserve: 12,
    reloadTime: 2.2, hitScale: 1, kick: 16, shake: 0.4, ammoPickup: 2,
  },
  {
    id: 'plasmagun', name: 'PLASMA RIFLE', found: true, projectile: 'plasma',
    damage: 20, speed: 24, spread: 0.012, range: 40, falloff: 40,
    fireDelay: 0.12, auto: true, mag: 40, startReserve: 80, maxReserve: 160,
    reloadTime: 1.7, hitScale: 1, kick: 3, shake: 0.06, ammoPickup: 30,
  },
  {
    id: 'flamer', name: 'FLAMETHROWER', found: true, flame: true,
    damage: 5, range: 3.8, cone: 0.3, spread: 0, falloff: 4,
    fireDelay: 0.06, auto: true, mag: 100, startReserve: 100, maxReserve: 200,
    reloadTime: 2.0, hitScale: 1, kick: 1, shake: 0.03, ammoPickup: 50,
  },
  // ---- only in the secret vaults (key 8): the strongest gun, and it never runs out ----
  // A ball of lightning that flies about 9 tiles; whatever it hits gets zapped, then the lightning
  // jumps to the next robot (up to `chain` more, `jump` tiles apart - even around corners).
  {
    id: 'tesla', name: 'TESLA CANNON', found: true, vault: true, projectile: 'tesla', infinite: true,
    damage: 70, chain: 5, jump: 3.5, chainFalloff: 0.8, speed: 14, spread: 0.006, range: 9, falloff: 9,
    fireDelay: 0.45, auto: true, mag: 1, startReserve: 0, maxReserve: 0,
    reloadTime: 1, hitScale: 1, kick: 7, shake: 0.18, ammoPickup: 0,
  },
];
// The first 4 guns you always have; the rest are found in weapon crates (and the vaults).
const BASE_WEAPONS = 4;

// Upgrade chips: each chip upgrades the gun in your hands, in this order, 3 levels each.
const UPGRADES = [
  { id: 'dmg', name: 'DAMAGE', per: 0.2 },      // +20% damage per level
  { id: 'mag', name: 'MAGAZINE', per: 0.25 },   // +25% bullets per magazine
  { id: 'reload', name: 'RELOAD', per: 0.15 },  // 15% faster reload
];
const UPGRADE_MAX = 3;

// Base robot stats at difficulty 10. Difficulty multiplies these.
const ROBOTS = {
  basic: {
    name: 'DRONE', hp: 60, speed: 2.0, damage: 10, attackRange: 1.3, attackCooldown: 1.2,
    windup: 0.35, radius: 0.32, height: 0.95, score: 100, knockResist: 0.2,
  },
  fast: {
    name: 'SKITTER', hp: 28, speed: 3.9, damage: 6, attackRange: 1.1, attackCooldown: 0.7,
    windup: 0.2, radius: 0.27, height: 0.9, score: 120, knockResist: 0,
  },
  heavy: {
    name: 'BRUTE', hp: 240, speed: 1.2, damage: 28, attackRange: 1.6, attackCooldown: 1.9,
    windup: 0.6, radius: 0.42, height: 1.3, score: 300, knockResist: 0.85,
  },
  ranged: {
    name: 'SENTINEL', hp: 50, speed: 1.8, damage: 12, attackRange: 11, attackCooldown: 1.8,
    windup: 0.45, radius: 0.3, height: 1.0, score: 150, knockResist: 0.3,
    ranged: true, keepDistance: 5.5, projectileSpeed: 7,
  },
  // Rushes in, arms itself and explodes. Also explodes when shot down.
  bomber: {
    name: 'BOMBER', hp: 25, speed: 3.2, damage: 30, attackRange: 1.3, attackCooldown: 1,
    windup: 0.55, radius: 0.28, height: 1.0, score: 80, knockResist: 0,
    explodes: true, blastRadius: 2.4,
  },
  // Front shield lets only 15% of bullet damage through, except while it attacks.
  shield: {
    name: 'SHIELD BOT', hp: 90, speed: 1.6, damage: 14, attackRange: 1.4, attackCooldown: 1.6,
    windup: 0.6, radius: 0.36, height: 1.0, score: 200, knockResist: 0.7, shield: 0.15,
  },
  // Teleports around, often right behind the player.
  phantom: {
    name: 'PHANTOM', hp: 35, speed: 2.6, damage: 12, attackRange: 1.2, attackCooldown: 1.0,
    windup: 0.3, radius: 0.3, height: 1.0, score: 180, knockResist: 0.2, teleport: true,
  },
  // Slow and tough; keeps launching mini-drones.
  carrier: {
    name: 'CARRIER', hp: 320, speed: 0.8, damage: 0, attackRange: 10, attackCooldown: 4,
    windup: 0.8, radius: 0.45, height: 1.4, score: 400, knockResist: 0.95,
    carrier: true, keepDistance: 6, maxMinis: 3,
  },
  // Keeps its distance and drops mines (js/mines.js) that blow up when you step close.
  sapper: {
    name: 'SAPPER', hp: 55, speed: 2.1, damage: 24, attackRange: 0, attackCooldown: 9,
    windup: 0.3, radius: 0.3, height: 0.9, score: 160, knockResist: 0.2, keepDistance: 4.5, sapper: true,
  },
  // Never attacks: hovers behind the others and repairs them (15% every 2 s within 2.8 tiles).
  medic: {
    name: 'MEDIC BOT', hp: 70, speed: 1.9, damage: 0, attackRange: 0, attackCooldown: 9,
    windup: 0.3, radius: 0.3, height: 0.95, z: 0.12, score: 220, knockResist: 0.2,
    medic: true, healRange: 2.8, heal: 0.15, healEvery: 2,
  },
  // Leaps at you from 2.5-7 tiles away and slams down where it lands.
  jumper: {
    name: 'JUMPER', hp: 45, speed: 2.3, damage: 14, attackRange: 1.2, attackCooldown: 1.1,
    windup: 0.3, radius: 0.3, height: 0.9, score: 170, knockResist: 0.1, jumper: true,
  },
  // The boss. Arrives after CONFIG.BOSS_TIME; destroy it to win. Gets meaner as it loses health:
  // phase 1 plasma volleys, phase 2 adds ground stomps and calls in Bombers, phase 3 (below 33%) is worn out: slower, softer and rarer attacks.
  boss: {
    name: 'WARDEN', hp: 1800, speed: 1.1, damage: 9, attackRange: 12, attackCooldown: 2.4,
    windup: 0.7, radius: 0.6, height: 1.9, score: 2500, knockResist: 1, noSpawn: true,
    boss: true, keepDistance: 4, projectileSpeed: 6.5, stompRange: 3.2, stompDamage: 24,
  },
  // Launched by carriers only (never spawns on its own). Hovers at eye height.
  mini: {
    name: 'MINI-DRONE', hp: 12, speed: 3.6, damage: 4, attackRange: 1.0, attackCooldown: 0.8,
    windup: 0.2, radius: 0.2, height: 0.45, z: 0.3, score: 30, knockResist: 0, noSpawn: true,
  },
  // Only in the bonus round (drill.js).
  xa: {
    name: Lex.d9, hp: 45, speed: 2.7, damage: 8, attackRange: 1.2, attackCooldown: 1.0,
    windup: 0.3, radius: 0.3, height: 0.9, score: 90, knockResist: 0.1, noSpawn: true, foe: true,
  },
  xb: {
    name: Lex.d10, hp: 55, speed: 1.9, damage: 10, attackRange: 10, attackCooldown: 1.9,
    windup: 0.5, radius: 0.3, height: 1.05, score: 130, knockResist: 0.3, noSpawn: true, foe: true,
    ranged: true, keepDistance: 5, projectileSpeed: 7,
  },
};

const PICKUPS = {
  health: { amount: 50, height: 0.35 },
  ammo: { height: 0.35 },
  weapon: { height: 0.45 },  // weapon crate
  chip: { height: 0.22 },    // upgrade chip
};

// Menu avatar choices. `unlock` = id of a goal in records.js that must be reached first.
const AVATAR_OPTIONS = {
  suit: [
    { name: 'GREEN', color: '#3a7d44' }, { name: 'BLUE', color: '#2d5fa8' },
    { name: 'RED', color: '#a83232' }, { name: 'ORANGE', color: '#c98a1c' },
    { name: 'PURPLE', color: '#6b3fa0' }, { name: 'STEEL', color: '#5d6672' },
    { name: 'TEAL', color: '#1c8a8a' }, { name: 'WHITE', color: '#c8ccd0' },
    { name: 'SHADOW', color: '#24242c', unlock: 'secrets' },
    { name: 'GOLD', color: '#d4a020', unlock: 'win10' },
    { name: 'DESERT', color: '#b09060', rank: 'PRIVATE' },
    { name: 'NAVY', color: '#1e2e5a', rank: 'LIEUTENANT' },
    { name: 'CHROME', color: '#d0d8e0', rank: 'LEGEND' },
  ],
  visor: [
    { name: 'CYAN', color: '#4de1ff' }, { name: 'RED', color: '#ff3b3b' },
    { name: 'GOLD', color: '#ffd23b' }, { name: 'GREEN', color: '#5bff6a' },
    { name: 'PINK', color: '#ff6bf0' },
    { name: 'PLASMA', color: '#b040ff', unlock: 'score10k' },
    { name: 'AMBER', color: '#ffa020', rank: 'CORPORAL' },
    { name: 'WHITE', color: '#ffffff', rank: 'MAJOR' },
  ],
  helmet: [
    { name: 'STANDARD' }, { name: 'CRESTED' }, { name: 'HORNED' }, { name: 'DOME' },
    { name: 'SKULL', unlock: 'win' }, { name: 'CROWN', unlock: 'win20' },
    { name: 'BERET', rank: 'CAPTAIN' },
  ],
  accessory: [
    { name: 'NONE' }, { name: 'ANTENNA' }, { name: 'SHOULDER PADS' },
    { name: 'SCARF' }, { name: 'BANDOLIER' },
    { name: 'CAPE', unlock: 'kills250' }, { name: 'JETPACK', unlock: 'bombers25' },
    { name: 'MEDALS', rank: 'GENERAL' },
    { name: 'ENERGY WINGS', unlock: 'win20' },
  ],
  // Recolors the guns you hold.
  gunSkin: [
    { name: 'STANDARD' },
    { name: 'CAMO', color: '#5a7a3a', unlock: 'kills50' },
    { name: 'GOLD', color: '#e8b830', unlock: 'win15' },
    { name: 'NEON', color: '#20e0ff', unlock: 'kills1000' },
    { name: 'CRIMSON', color: '#c02030', rank: 'SERGEANT' },
    { name: 'OBSIDIAN', color: '#303040', rank: 'COLONEL' },
  ],
  // ---- sections opened by achievements (see COSMETIC_SECTIONS in cosmetics.js) ----
  killFx: [
    { name: 'STANDARD' },
    { name: 'LIGHTNING', fx: 'lightning', unlock: 'electrician' },
    { name: 'CONFETTI', fx: 'confetti', unlock: 'combo10' },
    { name: 'PIXELS', fx: 'pixels', unlock: 'vandal' },
    { name: 'FIREWORKS', fx: 'fireworks', unlock: 'score25k' },
    { name: 'GOLDEN', fx: 'golden', unlock: 'elite10' },
  ],
  trail: [
    { name: 'NONE' },
    { name: 'TRACER', color: '#ffe070' },
    { name: 'LASER', color: '#ff3030', unlock: 'phantom30' },
    { name: 'PLASMA', color: '#40c0ff', unlock: 'shield50' },
    { name: 'NEON', color: '#60ff80', unlock: 'combo20' },
  ],
  card: [
    { name: 'STEEL', css: 'steel' },
    { name: 'FLAMES', css: 'flames', unlock: 'win10' },
    { name: 'ICE', css: 'ice', unlock: 'allmaps' },
    { name: 'CIRCUIT', css: 'circuit', unlock: 'wardens10' },
    { name: 'HAZARD', css: 'hazard', unlock: 'miniboss' },
    { name: 'SKULLS', css: 'skulls', unlock: 'untouchable' },
    { name: 'GOLD', css: 'gold', unlock: 'campaign' },
    { name: Lex.a1, css: 'c7', unlock: 'x7' },
  ],
};
