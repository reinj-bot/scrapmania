'use strict';
// The guns: firing, reloading, switching, the sniper scope and the gun drawn on screen.
// Numbers for each gun are in WEAPONS (config.js).

class WeaponSystem {
  constructor(game) {
    this.game = game;
    this.ammo = WEAPONS.map(w => ({ mag: w.mag, reserve: w.startReserve }));
    this.owned = WEAPONS.map((w, i) => i < BASE_WEAPONS);      // the rest come from weapon crates
    // the hotbar: the guns you have, in the order you got them (a new gun takes the first empty slot)
    this.slots = WEAPONS.map((w, i) => i).filter(i => this.owned[i]);
    this.levels = WEAPONS.map(() => ({ dmg: 0, mag: 0, reload: 0 })); // upgrade chips
    this.shotgunOnly = game.mods.includes('shotgun');
    this.current = this.shotgunOnly ? 0 : game.settings.startWeapon; // chosen in the main menu
    this.cooldown = 0;
    this.reloadTimer = 0;
    this.switchTimer = 0;
    this.switchTo = -1;
    this.bloom = 0;
    this.fireAnim = 0;
    this.recoil = 0;
    this.scoped = false;
    this.swayTime = 0;
    this.lagX = 0;      // the gun trails behind when you turn
    this.grenades = CONFIG.GRENADE.start;
    this.throwAnim = 0;
  }

  get def() { return WEAPONS[this.current]; }
  get state() { return this.ammo[this.current]; }
  get reloading() { return this.reloadTimer > 0; }
  get switching() { return this.switchTimer > 0; }

  // Numbers after upgrades.
  magSize(i = this.current) { return Math.round(WEAPONS[i].mag * (1 + UPGRADES[1].per * this.levels[i].mag)); }
  reloadTime(i = this.current) { return WEAPONS[i].reloadTime * (1 - UPGRADES[2].per * this.levels[i].reload); }
  damageMult(i = this.current) { return 1 + UPGRADES[0].per * this.levels[i].dmg; }
  upgradeCount(i = this.current) { const l = this.levels[i]; return l.dmg + l.mag + l.reload; }

  update(dt) {
    const def = this.def, st = this.state;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.fireAnim = Math.max(0, this.fireAnim - dt);
    this.recoil *= Math.pow(0.0005, dt);
    this.bloom = Math.max(0, this.bloom - dt * 0.12);
    this.swayTime += dt;
    this.throwAnim = Math.max(0, this.throwAnim - dt);
    const turn = -Input.mouseDX * 0.12 - Controls.pad.lookX * 7;
    this.lagX += (Math.max(-14, Math.min(14, turn)) - this.lagX) * Math.min(1, dt * 9);

    // number keys pick a hotbar slot (an empty slot does nothing); wheel / bumpers go round the hotbar
    for (let n = 0; n < this.slots.length; n++) {
      if (Controls.pressed('gun' + (n + 1))) this.select(this.slots[n]);
    }
    let step = Input.wheel;
    if (Controls.padPressed(PAD.RB)) step = 1;
    if (Controls.padPressed(PAD.LB)) step = -1;
    if (step) {
      const at = this.slots.indexOf(this.switching ? this.switchTo : this.current);
      this.select(this.slots[(at + Math.sign(step) + this.slots.length) % this.slots.length]);
    }

    if (this.switchTimer > 0) {
      const before = this.switchTimer;
      this.switchTimer -= dt;
      if (before > 0.18 && this.switchTimer <= 0.18) { this.current = this.switchTo; this.bloom = 0; }
      this.scoped = false;
      return;
    }

    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const take = Math.min(this.magSize() - st.mag, st.reserve);
        st.mag += take;
        st.reserve -= take;
        Sound.play('reload_end');
      }
    }

    if (Controls.pressed('reload') || Controls.padPressed(PAD.X)) this.startReload();
    if ((Controls.pressed('grenade') || Controls.padPressed(PAD.Y)) && !this.switching) this.throwGrenade();
    this.scoped = !!def.scope && (Input.rightDown || Controls.padHeld(PAD.LT)) && !this.reloading;

    const wantsFire = def.auto
      ? Input.mouseDown || Controls.padHeld(PAD.RT)
      : Input.mouseClicked || Controls.padPressed(PAD.RT);
    if (wantsFire && this.cooldown <= 0 && !this.reloading) {
      if (st.mag > 0) this.fire();
      else {
        Sound.play('empty');
        this.cooldown = 0.3;
        this.startReload();
      }
    }
    // reload by itself once the magazine runs dry
    if (st.mag === 0 && this.cooldown <= 0 && !this.reloading) this.startReload();
  }

  select(i) {
    if (this.shotgunOnly && i !== 0) { this.game.message('SHOTGUN ONLY!', '#ff6040'); return; }
    if (!this.owned[i]) return;
    if (i === this.current && !this.switching) return;
    if (this.switching && i === this.switchTo) return;
    this.reloadTimer = 0; // switching cancels a reload
    this.switchTo = i;
    this.switchTimer = 0.36;
    Sound.play('switch');
  }

  startReload() {
    const def = this.def, st = this.state;
    if (def.infinite || this.reloading || this.switching || st.mag >= this.magSize() || st.reserve <= 0) return;
    this.reloadTimer = this.reloadTime();
    this.scoped = false;
    Sound.play('reload_start');
  }

  // Sniper scope drifts slowly, so timing the shot matters.
  swayOffset() {
    if (!this.scoped) return 0;
    const t = this.swayTime, move = this.game.player.moveAmount;
    return (Math.sin(t * 1.3) * 0.0035 + Math.sin(t * 2.9) * 0.0015) * (1 + move * 3);
  }

  currentSpread() {
    const def = this.def;
    if (def.scope) return this.scoped ? def.scopedSpread : def.spread;
    return def.spread + this.bloom;
  }

  fire() {
    const def = this.def, st = this.state, game = this.game, p = game.player;
    if (!def.infinite) st.mag--; // the Tesla Cannon never runs out
    game.run.fired[def.id] = true;
    this.cooldown = def.fireDelay;
    this.fireAnim = 0.07;
    this.recoil = def.kick;
    Sound.play(def.id, def.flame ? 0.5 : 0.9, 0, def.flame ? 0.12 : 0);
    game.shake(def.shake);
    game.alertRobots(p.x, p.y, def.id === 'sniper' ? 18 : 12);
    if (!def.flame) Effects.addLight(p.x + Math.cos(p.angle) * 0.6, p.y + Math.sin(p.angle) * 0.6, def.projectile === 'plasma' ? [0.3, 0.8, 1] : [1, 0.8, 0.45], 4, 1.2, 0.07);

    const spread = this.currentSpread();
    const aim = p.angle + this.swayOffset();
    const damage = def.damage * this.damageMult() * game.dmgMult;
    let hitAny = false;
    if (def.projectile) {
      PlayerShots.fire(game, def, aim + (Math.random() * 2 - 1) * spread, damage);
    } else if (def.flame) {
      hitAny = PlayerShots.flame(game, def, aim, damage);
    } else {
      const shot = Object.assign({}, def, { damage: def.damage * this.damageMult() }); // hitscan adds the Glass Cannon bonus itself
      for (let i = 0; i < def.pellets; i++) {
        // shotgun pellets are spread evenly with a little jitter, other guns are random within the spread
        const t = def.pellets > 1 ? (i / (def.pellets - 1)) * 2 - 1 + (Math.random() - 0.5) * 0.3 : (Math.random() * 2 - 1);
        if (game.hitscan(p.x, p.y, aim + t * spread, shot)) hitAny = true;
      }
    }
    if (hitAny) game.hitMarker = 0.12;
    if (def.bloom) this.bloom = Math.min(def.maxBloom, this.bloom + def.bloom);
  }

  // Weapon crate: a new gun (switches to it), or ammo for it if you already have it.
  // Returns false if there was nothing to take.
  giveWeapon(i) {
    const w = WEAPONS[i], st = this.ammo[i];
    if (!this.owned[i]) {
      this.owned[i] = true;
      this.slots.push(i); // the first empty hotbar slot
      st.mag = this.magSize(i);
      st.reserve = w.startReserve;
      if (!this.shotgunOnly) this.select(i);
      this.game.message('NEW WEAPON: ' + w.name + ' (KEY ' + Controls.name('gun' + this.slots.length) + ')', '#40e0ff');
      return true;
    }
    if (w.infinite || st.reserve >= w.maxReserve) return false;
    st.reserve = Math.min(w.maxReserve, st.reserve + w.ammoPickup * 2);
    this.game.message(w.name + ' AMMO', '#ffd040');
    return true;
  }

  throwGrenade() {
    const game = this.game;
    if (this.grenades <= 0) { game.message('NO GRENADES - AMMO BOXES HAVE THEM', '#ff6040'); Sound.play('empty'); return; }
    if (this.throwAnim > 0) return;
    this.grenades--;
    this.throwAnim = 0.35;
    PlayerShots.throwGrenade(game, game.player.angle);
    Sound.play('throw');
  }

  // Upgrade chip: upgrades the gun in your hands (damage -> magazine -> reload, 3 levels each).
  upgrade() {
    const i = this.switching ? this.switchTo : this.current, lv = this.levels[i];
    // a gun that never runs out only gets stronger (magazine and reload mean nothing for it)
    const next = UPGRADES.filter(u => lv[u.id] < UPGRADE_MAX && (!WEAPONS[i].infinite || u.id === 'dmg'))
      .sort((a, b) => lv[a.id] - lv[b.id] || UPGRADES.indexOf(a) - UPGRADES.indexOf(b))[0];
    if (!next) { this.addAmmoPack(); this.addGrenade(); this.game.message(WEAPONS[i].name + ' IS FULLY UPGRADED - AMMO INSTEAD', '#ffd040'); return; }
    lv[next.id]++;
    this.game.message(WEAPONS[i].name + ': ' + next.name + ' UP (' + lv[next.id] + '/' + UPGRADE_MAX + ')', '#40ffb0');
  }

  addGrenade() {
    if (this.grenades >= CONFIG.GRENADE.max) return false;
    this.grenades++;
    return true;
  }

  // Ammo box: some ammo for every gun you have. Returns false if everything is already full.
  addAmmoPack() {
    let added = false;
    WEAPONS.forEach((w, i) => {
      if (!this.owned[i] || w.infinite) return;
      const st = this.ammo[i];
      if (st.reserve < w.maxReserve) {
        st.reserve = Math.min(w.maxReserve, st.reserve + w.ammoPickup);
        added = true;
      }
    });
    return added;
  }

  // Draws the gun in the bottom middle of the screen, with bob, recoil and reload dip.
  draw(ctx, lightLevel) {
    const p = this.game.player;
    if (this.scoped) return;
    const W = CONFIG.WIDTH, VH = CONFIG.VIEW_H;
    const def = this.def;
    const shade = lightLevel > 0.75 ? 0 : lightLevel > 0.5 ? 1 : lightLevel > 0.3 ? 2 : 3;
    const set = Art.weapons[def.id];
    const img = this.fireAnim > 0 ? set.fire[shade] : set.idle[shade];
    const bx = Math.sin(p.bobPhase * 0.5) * 5 * p.moveAmount;
    const by = Math.abs(Math.cos(p.bobPhase * 0.5)) * 4 * p.moveAmount;
    let lower = 0, tilt = 0;
    if (this.reloading) {
      const prog = 1 - this.reloadTimer / this.reloadTime();
      lower = Math.sin(prog * Math.PI) * 30;
      tilt = Math.sin(prog * Math.PI) * 0.35; // the gun rolls over while you swap the magazine
    }
    if (this.switching) lower = (1 - Math.abs(this.switchTimer - 0.18) / 0.18) * 70;
    if (this.throwAnim > 0) lower = Math.max(lower, Math.sin(this.throwAnim / 0.35 * Math.PI) * 26);
    const x = Math.round(W / 2 - img.width / 2 + 12 * CONFIG.GUN_SCALE + bx + this.lagX);
    const y = Math.round(VH - img.height + 6 + by + lower + this.recoil);
    if (!tilt) { ctx.drawImage(img, x, y); return; }
    ctx.save();
    ctx.translate(x + img.width / 2, y + img.height);
    ctx.rotate(-tilt);
    ctx.drawImage(img, -img.width / 2, -img.height);
    ctx.restore();
  }
}
