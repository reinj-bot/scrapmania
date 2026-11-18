'use strict';
// The player: WASD movement with wall sliding, mouse turning, health and picking things up.

class Player {
  constructor(start) {
    this.x = start.x;
    this.y = start.y;
    this.angle = start.angle;
    this.hp = CONFIG.PLAYER_MAX_HP;
    this.alive = true;
    this.bobPhase = 0;
    this.moveAmount = 0;   // 0 standing .. 1 full run, for weapon bob
    this.hurtTimer = 0;
    this.dashTime = 0;
    this.dashCooldown = 0;
    this.dashX = 0; this.dashY = 0;
  }

  update(dt, game) {
    const sens = 0.0005 + game.settings.sensitivity * 0.00025;
    const scoped = game.weapons.scoped;
    this.angle += Input.mouseDX * sens * (scoped ? 0.3 : 1);
    // free-mouse mode: holding the cursor near a side edge keeps turning that way
    if (Input.freeMouse && !Input.locked && Input.mouseInside) {
      const edge = 0.12;
      if (Input.mouseX < edge) this.angle -= 3.2 * dt * (edge - Input.mouseX) / edge;
      if (Input.mouseX > 1 - edge) this.angle += 3.2 * dt * (Input.mouseX - 1 + edge) / edge;
    }
    if (Controls.held('turnLeft')) this.angle -= 2.6 * dt;
    if (Controls.held('turnRight')) this.angle += 2.6 * dt;
    // controller right stick turns; same speed slider as the mouse
    const pad = Controls.pad;
    this.angle += pad.lookX * (1.4 + game.settings.sensitivity * 0.3) * dt * (scoped ? 0.3 : 1);

    let fwd = -pad.moveY, side = pad.moveX;
    if (Controls.held('forward')) fwd += 1;
    if (Controls.held('back')) fwd -= 1;
    if (Controls.held('right')) side += 1;
    if (Controls.held('left')) side -= 1;
    const len = Math.hypot(fwd, side);
    const speed = CONFIG.PLAYER_SPEED * (scoped ? 0.45 : 1);

    // dash: a quick burst in the direction you're moving (forward if standing still)
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    if ((Controls.pressed('dash') || Controls.padPressed(PAD.B)) && this.dashCooldown <= 0) {
      const f = len > 0.01 ? fwd / len : 1, sd = len > 0.01 ? side / len : 0;
      const c = Math.cos(this.angle), s = Math.sin(this.angle);
      this.dashX = c * f - s * sd; this.dashY = s * f + c * sd;
      this.dashTime = CONFIG.DASH.time;
      this.dashCooldown = CONFIG.DASH.cooldown;
      Sound.play('dash');
    }
    if (this.dashTime > 0) {
      this.dashTime -= dt;
      Level.move(this, this.dashX * CONFIG.DASH.speed * dt, this.dashY * CONFIG.DASH.speed * dt, CONFIG.PLAYER_RADIUS);
      if (Math.random() < 0.6) Effects.burst(this.x, this.y, 0.2, { count: 1, colors: ['#c0f4ff', '#ffffff'], speed: 0.4, up: 0.3, size: 0.03, life: 0.25, gravity: 0 });
    }
    if (len > 0.01) {
      if (len > 1) { fwd /= len; side /= len; } // a half-pushed stick walks slower
      const c = Math.cos(this.angle), s = Math.sin(this.angle);
      const vx = (c * fwd - s * side) * speed * dt;
      const vy = (s * fwd + c * side) * speed * dt;
      Level.move(this, vx, vy, CONFIG.PLAYER_RADIUS);
      this.bobPhase += dt * 11;
    }
    this.moveAmount += ((len > 0.01 ? Math.min(1, len) : 0) - this.moveAmount) * Math.min(1, dt * 8);
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.collectPickups(game);
  }

  collectPickups(game) {
    for (const p of game.pickups) {
      if (p.taken || Math.hypot(p.x - this.x, p.y - this.y) > CONFIG.PICKUP_RANGE) continue;
      if (p.type === 'weapon') {
        if (!game.weapons.giveWeapon(p.weapon)) continue;
        Sound.play('weapon_pickup');
      } else if (p.type === 'chip') {
        game.weapons.upgrade();
        game.run.chips = (game.run.chips || 0) + 1;
        Sound.play('chip');
      } else if (p.type === 'health') {
        if (this.hp >= CONFIG.PLAYER_MAX_HP) continue;
        this.hp = Math.min(CONFIG.PLAYER_MAX_HP, this.hp + PICKUPS.health.amount);
        game.run.medkits++;
        if (game.boss && game.boss.alive) game.run.bossMeds = (game.run.bossMeds || 0) + 1;
        Sound.play('pickup_health');
        game.message('+' + PICKUPS.health.amount + ' HEALTH', '#60ff80');
      } else {
        const gotGrenade = game.weapons.addGrenade();
        if (!game.weapons.addAmmoPack() && !gotGrenade) continue;
        Sound.play('pickup_ammo');
        game.message('AMMO PICKED UP', '#ffd040');
      }
      p.taken = true;
      game.flashScreen('#ffffff', 0.12);
    }
  }

  hurt(amount, game) {
    if (!this.alive || game.state !== 'playing') return;
    if (Cutscene.active) return; // bolts still flying while a cutscene plays can't hurt you
    if (this.dashTime > 0) return; // dodged
    if (Campaign.aux) amount *= Campaign.SHIELD;
    this.hp -= amount;
    game.run.damageTaken += amount;
    if (game.boss && game.boss.alive) game.run.bossDamage += amount;
    this.hurtTimer = 0.35;
    Sound.play('player_hurt', 0.8, 0, 0.08);
    game.shake(Math.min(0.6, amount / 40));
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      game.gameOver();
    }
  }
}
