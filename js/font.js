'use strict';
// Tiny 3x5 pixel font, so all in-game text has the same chunky look.

const Font = {
  // Each glyph: 5 rows, 3 bits per row (4 = left pixel, 1 = right pixel).
  glyphs: {
    '0': [7, 5, 5, 5, 7], '1': [2, 6, 2, 2, 7], '2': [7, 1, 7, 4, 7], '3': [7, 1, 3, 1, 7],
    '4': [5, 5, 7, 1, 1], '5': [7, 4, 7, 1, 7], '6': [7, 4, 7, 5, 7], '7': [7, 1, 2, 2, 2],
    '8': [7, 5, 7, 5, 7], '9': [7, 5, 7, 1, 7],
    A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6],
    E: [7, 4, 6, 4, 7], F: [7, 4, 6, 4, 4], G: [3, 4, 5, 5, 3], H: [5, 5, 7, 5, 5],
    I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2], K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7],
    M: [5, 7, 7, 5, 5], N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2], P: [6, 5, 6, 4, 4],
    Q: [2, 5, 5, 6, 3], R: [6, 5, 6, 5, 5], S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2],
    U: [5, 5, 5, 5, 7], V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5],
    Y: [5, 5, 2, 2, 2], Z: [7, 1, 2, 4, 7],
    ' ': [0, 0, 0, 0, 0], ':': [0, 2, 0, 2, 0], '/': [1, 1, 2, 4, 4], '-': [0, 0, 7, 0, 0],
    '.': [0, 0, 0, 0, 2], '%': [5, 1, 2, 4, 5], '!': [2, 2, 2, 0, 2], '+': [0, 2, 7, 2, 0],
    '?': [7, 1, 3, 0, 2], '(': [1, 2, 2, 2, 1], ')': [4, 2, 2, 2, 4], "'": [2, 2, 0, 0, 0],
    '<': [1, 2, 4, 2, 1], '>': [4, 2, 1, 2, 4], '_': [0, 0, 0, 0, 7], '#': [5, 7, 5, 7, 5],
    ',': [0, 0, 0, 2, 4], '=': [0, 7, 0, 7, 0], '*': [0, 5, 2, 5, 0],
  },

  width(text, scale = 1) {
    return text.length * 4 * scale - scale;
  },

  // Draws text with a 1-pixel drop shadow. align: 'left' | 'center' | 'right'.
  draw(ctx, text, x, y, color, scale = 1, align = 'left', shadow = '#000') {
    text = String(text).toUpperCase();
    if (align === 'center') x -= Math.floor(this.width(text, scale) / 2);
    else if (align === 'right') x -= this.width(text, scale);
    x = Math.round(x); y = Math.round(y);
    if (shadow) this.raw(ctx, text, x + scale, y + scale, shadow, scale);
    this.raw(ctx, text, x, y, color, scale);
  },

  raw(ctx, text, x, y, color, scale) {
    ctx.fillStyle = color;
    for (let i = 0; i < text.length; i++) {
      const g = this.glyphs[text[i]] || this.glyphs['?'];
      for (let row = 0; row < 5; row++) {
        const bits = g[row];
        if (!bits) continue;
        for (let col = 0; col < 3; col++) {
          if (bits & (4 >> col)) ctx.fillRect(x + (i * 4 + col) * scale, y + row * scale, scale, scale);
        }
      }
    }
  },

  // Text as its own small canvas (used for big pixel titles in the HTML menus).
  toCanvas(text, color, shadow = '#000') {
    const c = document.createElement('canvas');
    c.width = this.width(String(text)) + 1;
    c.height = 6;
    this.draw(c.getContext('2d'), text, 0, 0, color, 1, 'left', shadow);
    c.className = 'pixel';
    return c;
  },
};
