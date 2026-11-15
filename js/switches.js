'use strict';
// Wall switches: walk up to one and press E, and the vault door right next to it slides open.
// Press it again and, 2 seconds later (CLOSE_DELAY, with warning beeps), the door slides shut:
// robots can't get in or shoot through a shut vault door, so they gather outside and wait (Game.update -> Switches.waitSpot), and sooner or later you have
// to fight your way out. The switch can be reached from inside the vault too.

const Switches = {
  CLOSE_DELAY: 2,
  list: [],

  init() {
    this.list = Level.layout.switches.map(([x, y, secret]) => ({ x, y, secret, on: false, used: false }));
  },

  door(s) { return Doors.groups.find(d => d.secret === s.secret); },

  // The switch the player is standing next to and roughly facing, if any.
  nearby(p) {
    for (const s of this.list) {
      const dx = s.x + 0.5 - p.x, dy = s.y + 0.5 - p.y;
      const d = Math.hypot(dx, dy);
      if (d > 1.6) continue;
      const facing = (dx * Math.cos(p.angle) + dy * Math.sin(p.angle)) / d;
      if (facing > 0.4) return s;
    }
    return null;
  },

  update(dt, game) {
    const s = this.nearby(game.player);
    const key = Controls.pad.active ? 'A' : Controls.name('use');
    const g = s && this.door(s);
    game.usePrompt = s ? 'PRESS ' + key + (!s.used ? ' TO USE SWITCH' : g && g.closeIn > 0 ? ' TO KEEP THE VAULT OPEN' : s.on ? ' TO CLOSE THE VAULT' : ' TO OPEN THE VAULT') : null;
    if (s && (Controls.pressed('use') || Controls.padPressed(PAD.A))) this.activate(s, game);
  },

  activate(s, game) {
    const g = this.door(s);
    Sound.play('switch_on');
    if (!s.used) {
      // the first time: the hidden door slides open and stays open
      s.used = true;
      Doors.unlockSecret(s.secret);
      if (this.list.every(sw => sw.used)) game.run.flags.secrets = true;
      game.message('CLICK! A HIDDEN DOOR SLIDES OPEN', '#40e0ff');
      if (g) game.guide = { x: g.cx, y: g.cy, label: 'SECRET ROOM', until: game.time + 20 }; // arrow on the HUD
    } else if (g.closeIn > 0) {
      g.closeIn = 0; // changed your mind during the countdown
      game.message('THE VAULT STAYS OPEN', '#40e0ff');
      return;
    } else if (g.locked) {
      g.locked = false; g.stayOpen = true;
      game.message('THE VAULT DOOR SLIDES OPEN', '#40e0ff');
    } else {
      g.closeIn = this.CLOSE_DELAY; // Doors.update counts down, then shuts it (Switches.shut)
      game.message('THE VAULT DOOR CLOSES IN ' + this.CLOSE_DELAY + ' SECONDS', '#ffd040');
      return;
    }
    s.on = !g.locked;
    Level.wall[s.y * Level.W + s.x] = s.on ? 's' : 'S';
    Level.flowFrom = -1; // robots work out their paths again
    if (g) game.playAt('door', g.cx, g.cy, 1);
  },

  // The countdown is over: the door locks and slides shut.
  shut(g, game) {
    g.closeIn = 0; g.locked = true; g.stayOpen = false;
    const s = this.list.find(sw => sw.secret === g.secret);
    if (s) { s.on = false; Level.wall[s.y * Level.W + s.x] = 'S'; }
    Level.flowFrom = -1;
    game.message('THE VAULT DOOR SLIDES SHUT', '#40e0ff');
  },

  // You shut yourself in (no robot pad can reach you): where robots should wait instead -
  // the floor right outside the shut vault door. (Level.flow must hold the map from the player.)
  waitSpot(game) {
    const L = Level, W = L.W;
    if (!L.enemySpawns.length || L.enemySpawns.some(s => L.flow[Math.floor(s.y) * W + Math.floor(s.x)] >= 0)) return null;
    const p = game.player;
    let best = null, bd = 1e9;
    for (const g of Doors.groups) {
      if (!g.secret || !g.locked) continue;
      for (const t of g.tiles) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = t.x + dx, ny = t.y + dy, j = ny * W + nx;
          if (!L.passable(j) || L.doorAt[j] || L.flow[j] >= 0) continue; // must be on the far side from you
          const d = Math.hypot(nx + 0.5 - p.x, ny + 0.5 - p.y);
          if (d < bd) { bd = d; best = { x: nx + 0.5, y: ny + 0.5 }; }
        }
      }
    }
    return best;
  },
};
