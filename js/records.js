'use strict';
// Everything that lasts between games: best scores (per map, difficulty and mode), lifetime totals,
// achievements (some unlock cosmetics, see `unlock` in AVATAR_OPTIONS), XP and rank. Saved in the browser.

const RANKS = [
  [0, 'RECRUIT'], [2000, 'PRIVATE'], [6000, 'CORPORAL'], [15000, 'SERGEANT'], [30000, 'LIEUTENANT'],
  [60000, 'CAPTAIN'], [100000, 'MAJOR'], [160000, 'COLONEL'], [250000, 'GENERAL'], [400000, 'LEGEND'],
];

const ACHIEVEMENT_XP = 1000;

// value(t) reads the combined totals (lifetime + the game being played). Done when value >= target.
// secret: shown as ??? until earned. unseen: not listed at all (and not counted) until earned.
const ACHIEVEMENTS = [
  { id: 'first', name: 'FIRST BLOOD', text: 'DESTROY YOUR FIRST ROBOT', target: 1, value: t => t.kills },
  { id: 'kills50', name: 'SCRAPPER', text: 'DESTROY 50 ROBOTS', target: 50, value: t => t.kills, reward: 'CAMO GUN SKIN' },
  { id: 'kills250', name: 'RECYCLER', text: 'DESTROY 250 ROBOTS', target: 250, value: t => t.kills, reward: 'CAPE' },
  { id: 'kills1000', name: 'JUNKYARD', text: 'DESTROY 1000 ROBOTS', target: 1000, value: t => t.kills, reward: 'NEON GUN SKIN' },
  { id: 'kills2500', name: 'SCRAPYARD KING', text: 'DESTROY 2500 ROBOTS', target: 2500, value: t => t.kills },
  { id: 'games10', name: 'VETERAN', text: 'PLAY 10 GAMES', target: 10, value: t => t.games },
  { id: 'bombers25', name: 'DEFUSER', text: 'DESTROY 25 BOMBERS', target: 25, value: t => t.byType.bomber || 0, reward: 'JETPACK' },
  { id: 'shield50', name: 'SHIELD BREAKER', text: 'DESTROY 50 SHIELD BOTS', target: 50, value: t => t.byType.shield || 0, reward: 'TRAIL: PLASMA' },
  { id: 'phantom30', name: 'GHOST HUNTER', text: 'DESTROY 30 PHANTOMS', target: 30, value: t => t.byType.phantom || 0, reward: 'TRAIL: LASER' },
  { id: 'carrier20', name: 'FLEET BREAKER', text: 'DESTROY 20 CARRIERS', target: 20, value: t => t.byType.carrier || 0 },
  { id: 'vandal', name: 'VANDAL', text: 'SMASH 100 LIGHTS OR SCREENS', target: 100, value: t => t.broken, reward: 'KILL EFFECT: PIXELS' },
  { id: 'chain', name: 'CHAIN REACTION', text: 'DESTROY 3 ROBOTS WITH ONE BARREL', target: 3, value: t => t.bests.barrelChain || 0, reward: 'NEW SECTION: KILL EFFECTS' },
  { id: 'electrician', name: 'ELECTRICIAN', text: 'DESTROY 5 ROBOTS WITH ELECTRIC FLOORS IN ONE GAME', target: 5, value: t => t.bests.trapKills || 0, reward: 'KILL EFFECT: LIGHTNING' },
  { id: 'sharpshooter', name: 'SHARPSHOOTER', text: 'DESTROY 20 ROBOTS WITH THE SNIPER IN ONE GAME', target: 20, value: t => t.bests.sniperKills || 0, reward: 'NEW SECTION: BULLET TRAILS' },
  { id: 'combo10', name: 'ON A ROLL', text: 'REACH A 10 KILL COMBO', target: 10, value: t => t.bests.combo || 0, reward: 'KILL EFFECT: CONFETTI' },
  { id: 'combo20', name: 'UNSTOPPABLE', text: 'REACH A 20 KILL COMBO', target: 20, value: t => t.bests.combo || 0, reward: 'TRAIL: NEON' },
  { id: 'score10k', name: 'HIGH SCORE', text: 'SCORE 10000 IN ONE GAME', target: 10000, value: t => t.bests.score || 0, reward: 'PLASMA VISOR' },
  { id: 'score25k', name: 'HIGH ROLLER', text: 'SCORE 25000 IN ONE GAME', target: 25000, value: t => t.bests.score || 0, reward: 'KILL EFFECT: FIREWORKS' },
  { id: 'secrets', name: 'EXPLORER', text: 'OPEN EVERY SECRET ROOM ON A MAP IN ONE GAME', target: 1, value: t => t.flags.secrets ? 1 : 0, reward: 'SHADOW SUIT' },
  { id: 'win', name: 'WARDEN DOWN', text: 'DEFEAT THE WARDEN', target: 1, value: t => t.bossKills, reward: 'SKULL HELMET + NEW SECTION: CALLING CARDS' },
  { id: 'win10', name: 'TOUGH NUT', text: 'DEFEAT THE WARDEN ON DIFFICULTY 10+', target: 1, value: t => t.flags.win10 ? 1 : 0, reward: 'GOLD SUIT + CARD: FLAMES' },
  { id: 'win15', name: 'HARD AS NAILS', text: 'DEFEAT THE WARDEN ON DIFFICULTY 15+', target: 1, value: t => t.flags.win15 ? 1 : 0, reward: 'GOLD GUN SKIN' },
  { id: 'win20', name: 'MACHINE BREAKER', text: 'DEFEAT THE WARDEN ON DIFFICULTY 20', target: 1, value: t => t.flags.win20 ? 1 : 0, reward: 'CROWN + ENERGY WINGS' },
  { id: 'wardens10', name: 'WARDEN SLAYER', text: 'DEFEAT THE WARDEN 10 TIMES', target: 10, value: t => t.bossKills, reward: 'CARD: CIRCUIT' },
  { id: 'allmaps', name: 'WORLD TOUR', text: 'DEFEAT THE WARDEN ON EVERY MAP', target: Object.keys(LEVELS).length, value: t => Object.keys(t.bossMaps).length, reward: 'CARD: ICE' },
  { id: 'untouchable', name: 'UNTOUCHABLE', text: 'DEFEAT A WARDEN WITHOUT TAKING DAMAGE DURING ITS FIGHT', target: 1, value: t => t.flags.untouchable ? 1 : 0, reward: 'CARD: SKULLS' },
  { id: 'shotgunOnly', name: 'BOOMSTICK', text: 'DEFEAT THE WARDEN FIRING ONLY THE SHOTGUN', target: 1, value: t => t.flags.shotgunOnly ? 1 : 0 },
  { id: 'closeCall', name: 'CLOSE CALL', text: 'DEFEAT THE WARDEN WITH LESS THAN 10 HEALTH', target: 1, value: t => t.flags.closeCall ? 1 : 0 },
  { id: 'noMeds', name: 'NO HOSPITAL', text: 'DEFEAT THE WARDEN WITHOUT PICKING UP A MEDKIT', target: 1, value: t => t.flags.noMeds ? 1 : 0 },
  { id: 'wave5', name: 'SURVIVOR', text: 'REACH WAVE 5 IN ENDLESS MODE', target: 5, value: t => t.bests.wave || 0 },
  { id: 'wave10', name: 'IMMORTAL', text: 'REACH WAVE 10 IN ENDLESS MODE', target: 10, value: t => t.bests.wave || 0 },
  { id: 'challenger', name: 'CHALLENGER', text: 'DEFEAT THE WARDEN WITH 3+ CHALLENGES ON', target: 1, value: t => t.flags.challenger ? 1 : 0 },
  { id: 'glass', name: 'GLASS JAW', text: 'DEFEAT THE WARDEN WITH GLASS CANNON ON', target: 1, value: t => t.flags.glass ? 1 : 0 },
  { id: 'lightsOut', name: 'NIGHT SHIFT', text: 'DEFEAT THE WARDEN WITH LIGHTS OUT ON', target: 1, value: t => t.flags.lightsOut ? 1 : 0 },
  { id: 'elite10', name: 'ELITE HUNTER', text: 'DESTROY 10 ELITE ROBOTS', target: 10, value: t => t.byType.elite || 0, reward: 'KILL EFFECT: GOLDEN' },
  { id: 'miniboss', name: 'BIGGER THEY ARE', text: 'DESTROY A MINI-BOSS', target: 1, value: t => t.byType.miniboss || 0, reward: 'CARD: HAZARD' },
  { id: 'campaign', name: 'LIGHTS OUT, SECTOR 7', text: 'FINISH THE STORY CAMPAIGN', target: 1, value: t => t.flags.campaign ? 1 : 0, reward: 'CARD: GOLD' },
  { id: 'overseer', name: 'WRONG PLACE, WRONG TIME', text: 'MEET THE OVERSEER (1 IN 10000)', target: 1, value: t => t.flags.overseer ? 1 : 0, secret: true },
  { id: 'x7', name: Lex.a1, text: Lex.a2, target: 1, value: t => t.flags.x7 ? 1 : 0, secret: true, unseen: true, reward: Lex.a3 },
];

const Records = {
  KEY: 'scrapProtocol.records.v1',
  data: null,

  load() {
    let d = null;
    try { d = JSON.parse(Store.get(this.KEY) || 'null'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object') d = {};
    const t = Object.assign(this.emptyTotals(), d.totals || {});
    for (const k of ['byType', 'bests', 'flags', 'bossMaps']) if (!t[k] || typeof t[k] !== 'object') t[k] = {};
    if (d.totals && d.totals.bossKills === undefined) t.bossKills = t.wins || 0; // older saves
    this.data = {
      best: d.best && typeof d.best === 'object' ? d.best : {},
      totals: t,
      unlocked: Array.isArray(d.unlocked) ? d.unlocked : [],
    };
    // a few entries were renamed: carry older saves over
    for (const [from, to] of Lex.mig) {
      this.data.unlocked = this.data.unlocked.map(id => id === from ? to : id);
      if (t.flags[from]) { t.flags[to] = t.flags[from]; delete t.flags[from]; }
      if (t.byType[from]) { t.byType[to] = (t.byType[to] || 0) + t.byType[from]; delete t.byType[from]; }
      for (const k of Object.keys(this.data.best)) {
        if (k.endsWith(':' + from)) { this.data.best[k.slice(0, -from.length) + to] = this.data.best[k]; delete this.data.best[k]; }
      }
    }
  },

  emptyTotals() {
    return { games: 0, wins: 0, kills: 0, time: 0, xp: 0, broken: 0, bossKills: 0, byType: {}, bests: {}, flags: {}, bossMaps: {} };
  },

  save() {
    Store.set(this.KEY, JSON.stringify(this.data));
  },

  key(map, level, mode) { return map + ':' + level + (mode === 'endless' ? ':endless' : mode === 'campaign' ? ':campaign' : mode === 'drill' ? ':drill' : ''); },
  best(map, level, mode) { return this.data.best[this.key(map, level, mode)] || null; },
  // Choosing the difficulty unlocks once you have won a Mission on difficulty 10 or higher.
  difficultyUnlocked() {
    return Object.entries(this.data.best).some(([k, b]) => {
      const m = /^[^:]+:(\d+)$/.exec(k); // Mission keys are "map:level" (other modes add ":mode")
      return m && Number(m[1]) >= 10 && b.won;
    });
  },
  isUnlocked(id) { return !id || this.data.unlocked.includes(id); },

  // Saved totals with the current game added in (nothing is saved here).
  liveTotals(run) {
    const s = this.data.totals;
    if (!run) return s;
    const t = {
      games: s.games + 1,
      wins: s.wins + (run.won ? 1 : 0),
      kills: s.kills + run.kills,
      time: s.time + Math.floor(run.time || 0),
      xp: s.xp,
      broken: s.broken + run.broken,
      bossKills: s.bossKills + run.bossKills,
      byType: Object.assign({}, s.byType),
      bests: Object.assign({}, s.bests),
      flags: Object.assign({}, s.flags, run.flags),
      bossMaps: Object.assign({}, s.bossMaps, run.bossMaps),
    };
    for (const [k, n] of Object.entries(run.byType)) t.byType[k] = (t.byType[k] || 0) + n;
    for (const [k, v] of Object.entries(run.bests)) t.bests[k] = Math.max(t.bests[k] || 0, v);
    return t;
  },

  // Unlocks any achievement reached right now. Returns the new ones.
  check(run) {
    const t = this.liveTotals(run);
    const fresh = ACHIEVEMENTS.filter(a => !this.data.unlocked.includes(a.id) && a.value(t) >= a.target);
    if (fresh.length) {
      fresh.forEach(a => this.data.unlocked.push(a.id));
      this.save();
    }
    return fresh;
  },

  // Called once when a game ends: commits totals, best score and XP.
  finishRun(run) {
    const late = this.check(run);
    run.unlockedNow.push(...late);
    const rankBefore = this.rank().name;
    const t = this.liveTotals(run);
    const xpGained = run.score + run.unlockedNow.length * ACHIEVEMENT_XP;
    t.xp = this.data.totals.xp + xpGained;
    this.data.totals = t;

    const k = this.key(run.map, run.level, run.mode);
    const old = this.data.best[k] || { score: 0, time: 0, won: false, wave: 0 };
    const newBest = run.score > old.score;
    this.data.best[k] = {
      score: Math.max(old.score, run.score),
      time: Math.max(old.time, Math.floor(run.time)),
      won: old.won || run.won,
      wave: Math.max(old.wave || 0, run.wave || 0),
    };
    this.save();
    const rankAfter = this.rank().name;
    return { newBest, unlocked: run.unlockedNow, xpGained, rankUp: rankAfter !== rankBefore ? rankAfter : null };
  },

  // Current rank, the next one, and how far along (0-1) you are.
  rank(xp = this.data.totals.xp) {
    let i = 0;
    while (i + 1 < RANKS.length && xp >= RANKS[i + 1][0]) i++;
    const next = RANKS[i + 1];
    const progress = next ? (xp - RANKS[i][0]) / (next[0] - RANKS[i][0]) : 1;
    return { name: RANKS[i][1], next: next ? next[1] : null, nextXp: next ? next[0] : null, xp, progress };
  },
};
