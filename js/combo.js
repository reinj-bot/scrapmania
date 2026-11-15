'use strict';
// Kill combo: every kill within WINDOW seconds of the last one adds to the combo.
// Every 4 kills in a row raise the score multiplier (x2, x3... up to x5).

const Combo = {
  WINDOW: 4,
  MAX_MULT: 5,

  reset() {
    this.count = 0;
    this.timer = 0;
  },

  // Registers a kill and returns the score multiplier for it.
  kill() {
    this.count = this.timer > 0 ? this.count + 1 : 1;
    this.timer = this.WINDOW;
    return this.mult();
  },

  mult() {
    return Math.min(this.MAX_MULT, 1 + Math.floor(this.count / 4));
  },

  update(dt) {
    if (this.timer <= 0) return;
    this.timer -= dt;
    if (this.timer <= 0) this.count = 0;
  },
};
