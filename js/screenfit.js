'use strict';
// How the game fills the window, and the old-monitor scanlines.
// - Fill: the picture is 16:9. When the window is close to that (an app window with a title bar,
//   a 16:10 laptop screen), it is stretched a little to fill the window instead of leaving thin
//   black bars. Far-off shapes (a tall window) still keep 16:9 with bars, so nothing looks squashed.
// - Scanlines: one dark line under every game pixel row, drawn on exact screen pixels, so the lines
//   are even at any window size (a CSS stripe pattern drifted and made uneven light/dark bands).

const ScreenFit = {
  STRETCH: 0.13, // how far from 16:9 the window may be and still be filled (13%)

  init() {
    this.wrap = document.getElementById('wrap');
    this.lines = document.getElementById('scanlines');
    const again = () => this.update();
    window.addEventListener('resize', again);
    document.addEventListener('fullscreenchange', again);
    // a different screen scaling (moving the window to another monitor)
    const watchScale = () => matchMedia(`(resolution: ${devicePixelRatio}dppx)`).addEventListener('change', () => { again(); watchScale(); }, { once: true });
    watchScale();
    this.update();
  },

  update() {
    const W = innerWidth, H = innerHeight, off = (W / H) / (16 / 9);
    const fill = Math.abs(off - 1) <= this.STRETCH;
    this.wrap.classList.toggle('fill', fill);
    this.drawLines();
  },

  drawLines() {
    const r = this.wrap.getBoundingClientRect();
    const dpr = devicePixelRatio || 1;
    const h = Math.max(1, Math.round(r.height * dpr));
    if (h === this.lastH) return;
    this.lastH = h;
    const rows = CONFIG.HEIGHT || 216, s = h / rows;
    const c = document.createElement('canvas');
    c.width = 1; c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
    for (let i = 0; i < rows; i++) {
      // the bottom 40% of each game pixel row, rounded to whole screen pixels
      const y0 = Math.round(i * s), y1 = Math.round((i + 1) * s);
      const top = y0 + Math.round((y1 - y0) * 0.6);
      if (y1 > top) ctx.fillRect(0, top, 1, y1 - top);
    }
    this.lines.style.backgroundImage = `url(${c.toDataURL()})`;
  },
};
