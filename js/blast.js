'use strict';
// One explosion that hurts everything around it. Used by barrels and Bomber robots.

const Blast = {
  // o: { radius, robotDamage, playerDamage, scale, palette, source }
  at(x, y, game, o) {
    Effects.explode(x, y, o.scale, o.palette);
    Effects.burst(x, y, 0.4, { count: 20, colors: ['#ffe070', '#ff8020', '#ff4010'], speed: 5, up: 3, size: 0.06, life: 0.6 });
    game.playAt('barrel', x, y, 1.3);
    const R = o.radius;
    const p = game.player;
    const pd = Math.hypot(p.x - x, p.y - y);
    game.shake(Math.max(0.15, 0.8 - pd * 0.07));
    game.alertRobots(x, y, 12);

    for (const r of game.robots) {
      if (!r.targetable) continue;
      const d = Math.hypot(r.x - x, r.y - y);
      if (d >= R || !Level.hasLOS(x, y, r.x, r.y)) continue;
      r.hurt(20 + o.robotDamage * (1 - d / R), (r.x - x) / (d || 1), (r.y - y) / (d || 1), game, true, o.source);
    }
    if (pd < R && Level.hasLOS(x, y, p.x, p.y)) p.hurt(Math.round(5 + o.playerDamage * (1 - pd / R)), game, o.owner);
    Breakables.blast(x, y, R, game);
    Mines.blast(x, y, R);
    CrackedWalls.blast(x, y, R, game);
    for (const b of Barrels.list) {
      if (b.alive && Math.hypot(b.x - x, b.y - y) < R) Barrels.ignite(b, 0.12 + Math.random() * 0.12);
    }
  },
};
