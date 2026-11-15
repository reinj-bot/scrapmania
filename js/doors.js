'use strict';
// Sliding doors. They open when the player or a robot comes close and close again after.
// Secret doors look like a wall and stay locked until their switch is pressed.

const Doors = {
  groups: [],

  init() {
    const W = Level.W;
    this.groups = Level.layout.doors.map(d => {
      const g = {
        secret: d.secret || 0, locked: !!d.secret, look: d.look || 'D',
        open: 0, hold: 0, moving: 0, tiles: [],
      };
      const tiles = d.tiles.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      tiles.forEach(([x, y], k) => {
        // the panel runs across the corridor; it is "vertical" when the corridor runs left-right
        const vertical = !Level.isWallTile(x - 1, y) && !Level.isWallTile(x + 1, y) &&
          !tiles.some(([ox, oy]) => oy === y && Math.abs(ox - x) === 1);
        const door = { x, y, vertical, dir: k === 0 ? -1 : 1, group: g };
        Level.doorAt[y * W + x] = door;
        Level.blocked[y * W + x] = 1;
        g.tiles.push(door);
      });
      g.cx = g.tiles.reduce((s, t) => s + t.x + 0.5, 0) / g.tiles.length;
      g.cy = g.tiles.reduce((s, t) => s + t.y + 0.5, 0) / g.tiles.length;
      return g;
    });
  },

  unlockSecret(n) {
    const g = this.groups.find(d => d.secret === n);
    if (g) { g.locked = false; g.stayOpen = true; Level.flowFrom = -1; }
    return g;
  },

  update(dt, game) {
    const W = Level.W;
    for (const g of this.groups) {
      // a vault switch was pressed to close: warning beeps, then it shuts
      if (g.closeIn > 0) {
        const before = g.closeIn;
        g.closeIn -= dt;
        if (Math.ceil(before * 2) !== Math.ceil(g.closeIn * 2)) game.playAt('mine_beep', g.cx, g.cy, 0.6);
        if (g.closeIn <= 0) Switches.shut(g, game);
      }
      if (g.locked) {
        // a vault door shut again with its switch slides closed (never onto someone standing in it)
        if (g.open > 0 && !this.occupied(g, game)) {
          if (g.moving !== -1) game.playAt('door', g.cx, g.cy, 0.7);
          g.moving = -1;
          g.open = Math.max(0, g.open - dt * 1.6);
          for (const t of g.tiles) Level.blocked[t.y * W + t.x] = g.open < 0.85 ? 1 : 0;
        } else g.moving = 0;
        continue;
      }
      let wantOpen = g.stayOpen;
      if (!wantOpen) {
        const p = game.player;
        if (Math.hypot(p.x - g.cx, p.y - g.cy) < 2) wantOpen = true;
        for (const r of game.robots) {
          if (wantOpen) break;
          if (r.alive && Math.hypot(r.x - g.cx, r.y - g.cy) < 1.7) wantOpen = true;
        }
        if (wantOpen) g.hold = 1.2;
        g.hold -= dt;
        wantOpen = g.hold > 0 || this.occupied(g, game);
      }
      const target = wantOpen ? 1 : 0;
      const before = g.open;
      g.open += Math.max(-dt * 1.6, Math.min(dt * 2.2, target - g.open));
      const moving = g.open !== before ? Math.sign(g.open - before) : 0;
      if (moving && moving !== g.moving) game.playAt('door', g.cx, g.cy, 0.7);
      g.moving = moving;
      for (const t of g.tiles) Level.blocked[t.y * W + t.x] = g.open < 0.85 ? 1 : 0;
    }
  },

  // Never close on someone standing in the doorway.
  occupied(g, game) {
    const inside = (e, r) => g.tiles.some(t => e.x + r > t.x && e.x - r < t.x + 1 && e.y + r > t.y && e.y - r < t.y + 1);
    if (inside(game.player, CONFIG.PLAYER_RADIUS)) return true;
    return game.robots.some(r => r.alive && inside(r, r.def.radius));
  },
};
