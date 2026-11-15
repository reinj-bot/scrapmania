'use strict';
// All graphics are generated in code at startup: wall/floor textures, robot sprites,
// weapons, the player avatar. Placeholder pixel art, but one consistent style.

const Art = {
  textures: {},
  sprites: {},
  weapons: null,

  // ---------- small helpers ----------
  rgb(r, g, b) {
    return ((255 << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255)) >>> 0;
  },

  hash(x, y, s) {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  },

  hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  },

  shadeHex(hex, f) {
    const c = this.hexToRgb(hex).map(v => Math.max(0, Math.min(255, Math.round(v * f))));
    return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  },

  // Builds a 32x32 texture (optionally several animation frames) from a color function.
  makeTex(fn, emissive = false, frameCount = 1) {
    const S = CONFIG.TEX;
    const frames = [];
    let glow = null; // pixels that light themselves (a 4th value in the color)
    for (let f = 0; f < frameCount; f++) {
      const data = new Uint32Array(S * S);
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const c = fn(x, y, f);
          if (c[3] && !emissive) (glow = glow || new Uint8Array(S * S))[y * S + x] = 1;
          data[y * S + x] = this.rgb(
            Math.max(0, Math.min(255, c[0] | 0)),
            Math.max(0, Math.min(255, c[1] | 0)),
            Math.max(0, Math.min(255, c[2] | 0)));
        }
      }
      frames.push(data);
    }
    return { data: frames[0], frames, emissive, glow };
  },

  // Adds a little grain so flat colors don't look plastic.
  grain(c, x, y, seed, amount) {
    const n = (this.hash(x, y, seed) - 0.5) * amount;
    return [c[0] + n, c[1] + n, c[2] + n];
  },

  // Sprite drawn with rectangles on a tiny canvas, then read back as pixels.
  makeSprite(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    draw(ctx, (x, y, rw, rh, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, rw, rh); });
    return this.spriteFromCanvas(c);
  },

  spriteFromCanvas(c) {
    const ctx = c.getContext('2d');
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const data = new Uint32Array(img.data.buffer.slice(0));
    // Hard edges only: pixels are either fully there or fully see-through.
    for (let i = 0; i < data.length; i++) {
      data[i] = (data[i] >>> 24) >= 128 ? (data[i] | 0xff000000) >>> 0 : 0;
    }
    return { w: c.width, h: c.height, data, canvas: c };
  },

  init() {
    this.buildTextures();
    this.buildRobotSprites();
    this.buildMiscSprites();
  },

  // ---------- textures ----------
  buildTextures() {
    const T = this.textures;
    const g = (c, x, y, s, a) => this.grain(c, x, y, s, a);
    const H = (x, y, s) => this.hash(x, y, s);

    T.metal = this.makeTex((x, y) => {
      const sx = x % 16, sy = y % 16;
      let c = [68, 74, 84];
      if (sx === 0 || sy === 0) c = [30, 33, 38];
      else if (sx === 1 || sy === 1) c = [104, 110, 122];
      else if (sx === 15 || sy === 15) c = [50, 54, 62];
      if ((sx === 3 || sx === 12) && (sy === 3 || sy === 12)) c = [140, 146, 156];
      else if ((sx === 4 || sx === 13) && (sy === 4 || sy === 13)) c = [42, 46, 52];
      return g(c, x, y, 1, 14);
    });

    T.panel = this.makeTex((x, y) => {
      let c = [52, 66, 70];
      if (y < 4) c = [34, 42, 46];
      if (y >= 14 && y <= 17) c = [30, 36, 40];
      if (y >= 15 && y <= 16 && x >= 4 && x <= 9) c = [80, 210, 190];
      if (y >= 15 && y <= 16 && x >= 22 && x <= 24) c = [220, 120, 40];
      if (y >= 25 && y <= 30 && x > 3 && x < 28 && y % 2 === 0) c = [28, 32, 34];
      if (x === 0) c = [24, 28, 30];
      else if (x === 1) c = [78, 94, 98];
      return g(c, x, y, 2, 10);
    });

    T.computer = this.makeTex((x, y, f) => {
      let c = [40, 44, 52];
      if (x < 2 || x > 29 || y < 2) c = [26, 28, 34];
      if (x >= 3 && x <= 28 && y >= 3 && y <= 14) {
        c = [10, 30, 20];
        if (y % 3 === 0 && H(x >> 1, y, f + 7) < 0.55) c = [60, 200, 90];
        if (y === 13 && x < 6 + f * 4) c = [120, 255, 140];
      }
      if ((y === 19 || y === 20 || y === 23 || y === 24) && x >= 4 && x <= 27 && x % 4 < 2) {
        const r = H((x >> 2) + f * 3, y >> 2, 9);
        c = r < 0.3 ? [230, 50, 40] : r < 0.6 ? [60, 230, 80] : r < 0.8 ? [240, 180, 40] : [30, 30, 30];
      }
      if (y >= 27 && y <= 30 && x >= 6 && x <= 25 && x % 2 === 0) c = [20, 22, 26];
      return g(c, x, y, 3, 8);
    }, false, 2);

    T.light = this.makeTex((x, y) => {
      let c = [60, 64, 72];
      if (x < 2 || x > 29 || y < 2 || y > 29) c = [36, 38, 44];
      if (x >= 4 && x <= 27 && y >= 6 && y <= 25) {
        const v = 255 - Math.abs(y - 15.5) * 3;
        c = (x % 8 === 3) ? [190, 180, 150] : [v, v * 0.95, v * 0.8];
      }
      return c;
    }, true);

    T.vent = this.makeTex((x, y) => {
      let c = [58, 62, 68];
      if (x < 2 || x > 29 || y < 2 || y > 29) c = [40, 43, 48];
      else if (x > 3 && x < 28 && y > 3 && y < 28) {
        const m = y % 6;
        c = m === 0 ? [92, 97, 104] : m === 1 ? [30, 32, 36] : m === 2 ? [18, 20, 22] : [58, 62, 68];
      }
      return g(c, x, y, 4, 10);
    });

    T.hazard = this.makeTex((x, y) => {
      if (y < 20) return T.metal.data[y * 32 + x] ? this.unpack(T.metal.data[y * 32 + x]) : [60, 60, 60];
      if (y === 20) return [26, 26, 26];
      const c = ((x + y) >> 2) & 1 ? [214, 170, 24] : [26, 26, 26];
      return g(c, x, y, 5, 16);
    });

    T.rust = this.makeTex((x, y) => {
      let c = [92, 58, 40];
      const p = H(x >> 2, y >> 2, 6);
      if (p < 0.25) c = [62, 38, 28];
      else if (p > 0.82) c = [146, 84, 42];
      if (x % 16 === 0) c = [36, 24, 18];
      if (y % 16 === 0) c = [118, 78, 54];
      return g(c, x, y, 7, 26);
    });

    T.crate = this.makeTex((x, y) => {
      let c = [74, 82, 52];
      if (Math.abs(x - y) <= 1 || Math.abs(x + y - 31) <= 1) c = [98, 108, 68];
      if (x < 3 || x > 28 || y < 3 || y > 28) c = [46, 52, 32];
      if ((x === 3 || x === 28) && y >= 3 && y <= 28) c = [110, 120, 80];
      if (y >= 13 && y <= 18 && x >= 11 && x <= 20) c = [180, 160, 60];
      return g(c, x, y, 8, 12);
    });

    T.reactor = this.makeTex((x, y, f) => {
      if (x % 8 <= 1) return [30, 50, 34];
      if (y < 2 || y > 29) return [40, 60, 44];
      const wave = 0.65 + 0.35 * Math.sin(y * 0.45 + f * Math.PI + (x >> 3));
      return [50 * wave, 235 * wave, 110 * wave];
    }, true, 2);

    // Sliding doors come in pairs: the left half (door) and the right half (doorRight) meet in
    // the middle of the doorway, where the hazard stripes and the seam are - that is where it opens.
    const doorHalf = (x, y) => {      // x = 31 is the edge that meets the other half
      let c = [86, 92, 102];
      if (y <= 2 || y >= 29) c = [44, 46, 52];                                   // top and bottom frame
      if (x <= 1) c = [44, 46, 52];                                              // edge that slides into the wall
      if (y >= 14 && y <= 16 && x > 1 && x < 24) c = [64, 68, 76];               // reinforcement band
      if (y === 15 && x % 5 === 3 && x < 24) c = [140, 146, 156];                // rivets
      if (x >= 7 && x <= 17 && y >= 5 && y <= 10) c = [36, 70, 86];              // window
      if (x >= 7 && x <= 17 && y === 5) c = [90, 130, 150];
      if (y >= 25 && y <= 28 && x > 1 && x < 24) c = ((x + y) >> 1) & 1 ? [214, 170, 24] : [30, 30, 30];
      if (x >= 24 && x <= 30 && y > 2 && y < 29) c = ((x + y) >> 2) & 1 ? [214, 170, 24] : [30, 30, 30]; // stripes at the meeting edge
      if (x === 31) c = [18, 18, 22];                                            // the seam
      if (x >= 20 && x <= 21 && y >= 19 && y <= 20) return [255, 170, 40, 1];   // little amber light
      return g(c, x, y, 10, 10);
    };
    T.door = this.makeTex(doorHalf);
    T.doorRight = this.makeTex((x, y) => doorHalf(31 - x, y));

    // Floors
    T.floor = this.makeTex((x, y) => {
      let c = ((x >> 4) + (y >> 4)) & 1 ? [58, 60, 64] : [52, 54, 58];
      if (x % 4 === 1 && y % 4 === 1) c = [82, 84, 90];
      if (x % 16 === 0 || y % 16 === 0) c = [28, 29, 32];
      return g(c, x, y, 11, 10);
    });

    T.grate = this.makeTex((x, y) => {
      let c = [12, 13, 15];
      if (x % 4 === 0 || y % 4 === 0) c = [70, 74, 80];
      if (x % 4 === 1 && y % 4 !== 0) c = [26, 28, 30];
      if (x % 16 === 0 || y % 16 === 0) c = [96, 100, 108];
      return g(c, x, y, 12, 8);
    });

    T.tile = this.makeTex((x, y) => {
      let c = ((x >> 3) + (y >> 3)) & 1 ? [46, 50, 60] : [36, 40, 48];
      if (x % 8 === 0 || y % 8 === 0) c = [22, 24, 28];
      return g(c, x, y, 13, 8);
    });

    T.pad = this.makeTex((x, y) => {
      const d = Math.hypot(x - 15.5, y - 15.5);
      let c = this.unpack(T.floor.data[y * 32 + x]);
      if (d < 14 && d > 11) c = [150, 30, 30];
      else if (d <= 11) c = [40, 22, 24];
      if (d > 6 && d < 7.5) c = [210, 70, 40];
      return c;
    });

    T.mark = this.makeTex((x, y) => {
      let c = this.unpack(T.floor.data[y * 32 + x]);
      if ((x === 4 || x === 27 || y === 4 || y === 27) && x >= 4 && x <= 27 && y >= 4 && y <= 27) c = [200, 170, 40];
      return c;
    });

    // Ceilings
    T.ceiling = this.makeTex((x, y) => {
      let c = [40, 42, 46];
      if (x % 16 === 0 || y % 16 === 0) c = [22, 23, 26];
      if (x % 16 === 8 && y % 16 === 8) c = [70, 72, 78];
      return g(c, x, y, 14, 8);
    });

    // ---- interactive / broken versions ----
    T.computerBroken = this.makeTex((x, y) => {
      let c = this.unpack(T.computer.data[y * 32 + x]);
      if (x >= 3 && x <= 28 && y >= 3 && y <= 14) {
        c = [8, 9, 10];
        if (Math.abs((x - 10) - (y - 3) * 1.6) < 0.8 || Math.abs((x - 20) + (y - 3) * 1.2) < 0.8 || (y === 8 && x > 12 && x < 20)) c = [120, 126, 134];
      }
      if (y >= 19 && y <= 24) c = [30, 30, 30];
      return c;
    });

    T.lightBroken = this.makeTex((x, y) => {
      let c = [60, 64, 72];
      if (x < 2 || x > 29 || y < 2 || y > 29) c = [36, 38, 44];
      if (x >= 4 && x <= 27 && y >= 6 && y <= 25) {
        c = [24, 24, 26];
        if (Math.abs(x - 15 - (y - 15) * 0.8) < 0.7 || Math.abs(x - 15 + (y - 15) * 1.5) < 0.7) c = [110, 110, 104];
        if (H(x >> 2, y >> 2, 41) < 0.12) c = [170, 165, 140];
      }
      return c;
    });

    const switchTex = on => this.makeTex((x, y) => {
      let c = this.unpack(T.panel.data[y * 32 + x]);
      if (x >= 9 && x <= 22 && y >= 6 && y <= 25) c = x === 9 || x === 22 || y === 6 || y === 25 ? [20, 22, 24] : [44, 46, 52];
      if (x >= 14 && x <= 17 && y >= 9 && y <= 22) c = [16, 16, 18];
      const ly = on ? 18 : 10;
      if (x >= 13 && x <= 18 && y >= ly && y <= ly + 3) c = on ? [60, 220, 90] : [210, 50, 40];
      if (x >= 14 && x <= 17 && y >= 2 && y <= 3) c = on ? [120, 255, 140] : [255, 80, 60];
      return c;
    });
    T.switchOff = switchTex(false);
    T.switchOn = switchTex(true);

    const fuseTex = ready => this.makeTex((x, y) => {
      let c = this.unpack(T.metal.data[y * 32 + x]);
      if (x >= 6 && x <= 25 && y >= 5 && y <= 27) {
        c = ready ? [200, 160, 30] : [80, 74, 60];
        if (x === 6 || x === 25 || y === 5 || y === 27) c = [40, 34, 20];
        // lightning bolt
        const bolt = (y >= 9 && y <= 16 && Math.abs(x - (19 - (y - 9) * 0.7)) < 1.3) ||
          (y === 16 && x >= 12 && x <= 18) ||
          (y >= 16 && y <= 23 && Math.abs(x - (18 - (y - 16) * 0.7)) < 1.3);
        if (bolt) c = ready ? [30, 26, 16] : [50, 46, 40];
        if (y >= 7 && y <= 8 && x >= 21 && x <= 23) c = ready ? [80, 255, 120] : [255, 50, 40];
      }
      return c;
    });
    T.fuseReady = fuseTex(true);
    T.fuseSpent = fuseTex(false);

    T.electric = this.makeTex((x, y, f) => {
      let c = [8, 18, 34];
      if (x % 16 === 0 || y % 16 === 0) c = [20, 50, 80];
      const r = H(x, y, 50 + f);
      const line = Math.abs(Math.sin(x * 0.5 + f * 2.1) * 6 + 16 - y) < 1 || Math.abs(Math.sin(y * 0.45 + f * 1.7) * 6 + 16 - x) < 1;
      if (line) c = r < 0.4 ? [255, 255, 255] : [90, 220, 255];
      else if (r < 0.05) c = [120, 230, 255];
      return c;
    }, true, 3);

    T.pipes = this.makeTex((x, y) => {
      const m = y % 8;
      let c = [24, 25, 28];
      if (m < 3) c = m === 0 ? [92, 84, 70] : m === 1 ? [70, 62, 52] : [44, 40, 34];
      if (m < 3 && x % 16 === 5) c = [120, 110, 90];
      return g(c, x, y, 15, 8);
    });

    this.buildThemeTextures();
    this.buildRoomTextures();
  },

  // Recolored copy of a texture. mul = [r, g, b] multipliers; frost adds white specks.
  tint(base, mul, frost = 0, seed = 0) {
    return this.makeTex((x, y, f) => {
      let c = this.unpack(base.frames[f][y * 32 + x]).map((v, i) => v * mul[i]);
      if (frost && this.hash(x, y, 90 + seed) < frost) c = [215, 232, 245];
      return c;
    }, base.emissive, base.frames.length);
  },

  // Room machines, so you can tell what a room is for (map.js WALL_TEXTURES / levels.js furniture).
  buildRoomTextures() {
    const T = this.textures;
    const H = (x, y, s) => this.hash(x, y, s);
    const g = (c, x, y, s, a) => this.grain(c, x, y, s, a);
    const frame = (x, y) => x < 2 || x > 29 || y < 2 || y > 29;
    const circle = (x, y, cx, cy, r) => (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r;
    const lit = c => [c[0], c[1], c[2], 1]; // glows in the dark

    // med lab: a glass healing tube full of bubbling green fluid, red cross on top
    T.medTube = this.makeTex((x, y, f) => {
      let c = [70, 76, 84];
      if (x === 0 || x === 31) c = [40, 44, 50];
      if (y <= 5) {
        c = [96, 102, 110];
        if (x >= 12 && x <= 19 && y >= 1 && y <= 4) c = [220, 224, 228];
        if ((x >= 15 && x <= 16 && y >= 1 && y <= 4) || (y >= 2 && y <= 3 && x >= 13 && x <= 18)) c = [220, 40, 40];
      } else if (y >= 27) {
        c = [60, 64, 70];
        if (y === 29 && x >= 12 && x <= 19) c = [80, 255, 140];
      } else if (x >= 6 && x <= 25) {
        const k = 0.75 + 0.25 * Math.sin(x * 0.25);
        c = [40 * k, 175 * k, 115 * k];
        if (H(x, y + f * 4, 41) < 0.05 || (x % 7 === 3 && (y + f * 3) % 9 === 0)) c = [190, 255, 220]; // bubbles
        if (x === 8 || (x === 9 && y < 20)) c = [200, 255, 230];
        if (x === 6 || x === 25) c = [130, 150, 160];
      }
      return c;
    }, true, 2);

    // med lab: white supply cabinet with a red cross
    T.medCabinet = this.makeTex((x, y) => {
      let c = [196, 200, 204];
      if (frame(x, y)) c = [120, 126, 132];
      if (x === 15 || x === 16) c = [130, 136, 142];
      if ((x === 13 || x === 18) && y >= 17 && y <= 21) c = [80, 84, 90];
      const cx = 15.5, cy = 9.5;
      if ((Math.abs(x - cx) < 1.6 && Math.abs(y - cy) < 4.6) || (Math.abs(y - cy) < 1.6 && Math.abs(x - cx) < 4.6)) return lit([230, 40, 40]);
      if (y >= 25 && y <= 27 && x > 3 && x < 28) c = [160, 166, 172];
      return g(c, x, y, 42, 8);
    });

    // factory: a half-built robot hanging in an assembly frame
    T.robotRack = this.makeTex((x, y) => {
      let c = [34, 36, 40];
      if (x <= 3 || x >= 28) c = (y >> 2) & 1 ? [200, 160, 30] : [40, 40, 40];
      if (y <= 1) c = x > 5 && x < 26 ? lit([170, 230, 255]) : [70, 74, 80];               // work light
      if (x >= 15 && x <= 16 && y <= 4 && y > 1) c = [110, 114, 120];                        // clamp
      if (x >= 12 && x <= 19 && y >= 4 && y <= 9) c = [122, 132, 148];                      // head
      if (x >= 13 && x <= 18 && y >= 6 && y <= 7) c = [20, 20, 24];                          // dark visor, not switched on
      if (x >= 10 && x <= 21 && y >= 11 && y <= 20) c = [106, 114, 128];                     // torso
      if (x >= 12 && x <= 19 && y >= 13 && y <= 18) {                                        // open chest: wires
        c = [24, 26, 30];
        if (x === 13 || x === 17) c = lit([230, 60, 40]);
        if (x === 15 || y === 16) c = lit([240, 200, 60]);
      }
      if (x >= 6 && x <= 8 && y >= 11 && y <= 20) c = [96, 104, 118];                        // one arm
      if ((x === 23 && y >= 12 && y <= 16) || (x === 24 && y >= 15 && y <= 19)) c = [200, 50, 40]; // loose wires
      if (y >= 21 && y <= 23 && x >= 12 && x <= 19) c = [70, 74, 80];                        // no legs yet
      if (y >= 28) c = ((x + y) >> 2) & 1 ? [214, 170, 24] : [26, 26, 26];
      return c[3] ? c : g(c, x, y, 43, 8);
    });

    // pumps / cooling: a big round tank with a gauge and a valve wheel
    T.tank = this.makeTex((x, y) => {
      const k = 0.5 + 0.5 * Math.sin(Math.PI * (x + 0.5) / 32);
      let c = [50 + 90 * k, 92 + 92 * k, 96 + 80 * k];
      if (y === 5 || y === 26) c = [40, 46, 50];
      if ((y === 4 || y === 27) && x % 4 === 2) c = [150, 160, 166];
      if (circle(x, y, 10, 14, 4)) c = lit([235, 236, 220]);
      if (circle(x, y, 10, 14, 4) && !circle(x, y, 10, 14, 3)) c = [60, 64, 68];
      if ((x === 10 && y >= 11 && y <= 14) || (x === 11 && y === 12)) c = lit([220, 30, 30]);
      if (x >= 9 && x <= 11 && y >= 21 && y <= 22) c = lit([80, 255, 120]);
      if (circle(x, y, 22, 17, 4) && !circle(x, y, 22, 17, 2.5)) c = [190, 40, 34];
      if ((x === 22 || y === 17) && circle(x, y, 22, 17, 3)) c = [190, 40, 34];
      if (y >= 29) c = [50, 54, 58];
      return c[3] ? c : g(c, x, y, 44, 6);
    });

    // power: a glowing generator coil
    T.coil = this.makeTex((x, y, f) => {
      let c = [44, 46, 52];
      if (frame(x, y)) c = [28, 30, 34];
      if (y <= 4 && x > 3 && x < 28) c = ((x + y) >> 2) & 1 ? [214, 170, 24] : [26, 26, 26];
      if (x >= 9 && x <= 22 && y >= 7 && y <= 26) {
        const on = (y + f) % 3 === 0;
        c = on ? [255, 210, 90] : [150, 80, 30];
        if (x === 9 || x === 22) c = [90, 50, 24];
      }
      if (x >= 14 && x <= 17 && y >= 27) c = [70, 74, 80];
      return c;
    }, true, 3);

    // lab: shelf with flasks over a white workbench and drawers
    T.labBench = this.makeTex((x, y) => {
      let c = [56, 62, 70];
      if (x === 0 || x === 31) c = [34, 38, 44];
      if (y === 11) c = [110, 116, 124];
      if (y >= 4 && y <= 10) {
        const slot = x >> 3, sx = x & 7;
        const cols = [[60, 220, 230], [220, 70, 200], [90, 230, 90], [240, 180, 40]];
        if (sx >= 2 && sx <= 5 && y >= 6) c = lit(cols[slot]);
        if (sx >= 3 && sx <= 4 && y >= 4 && y <= 5) c = [190, 210, 220];
      }
      if (y >= 13 && y <= 15) c = [214, 218, 222];
      if (y >= 16) {
        c = [80, 88, 98];
        if (x === 15 || x === 16 || y === 23) c = [50, 56, 62];
        if ((y === 19 || y === 27) && (x === 7 || x === 8 || x === 23 || x === 24)) c = [170, 176, 184];
      }
      return c[3] ? c : g(c, x, y, 45, 6);
    });

    // arrival: a row of crew lockers
    T.locker = this.makeTex((x, y) => {
      let c = [70, 90, 112];
      const lx = x % 11;
      if (lx === 0) c = [36, 44, 56];
      if (lx >= 3 && lx <= 7 && y >= 4 && y <= 9 && y % 2 === 0) c = [36, 44, 56];
      if (lx === 8 && y >= 14 && y <= 17) c = [180, 186, 192];
      if (lx === 8 && y === 12) c = lit([90, 255, 120]);
      if (lx >= 3 && lx <= 7 && y === 12) c = [220, 220, 200];
      if (y >= 29 || y <= 1) c = [44, 50, 60];
      return c[3] ? c : g(c, x, y, 46, 8);
    });

    // loading: a big roll-up shutter door
    T.shutter = this.makeTex((x, y) => {
      let c = y % 4 === 0 ? [62, 66, 70] : [110, 114, 118];
      if (x <= 1 || x >= 30) c = [46, 48, 52];
      if (y >= 27) c = ((x + y) >> 2) & 1 ? [214, 170, 24] : [26, 26, 26];
      if (y <= 2) c = [46, 48, 52];
      if (y <= 2 && x >= 13 && x <= 18) c = lit([255, 170, 40]);
      if (y >= 22 && y <= 24 && x >= 13 && x <= 18) c = [40, 40, 44];
      return c[3] ? c : g(c, x, y, 47, 8);
    });

    // smelter: glowing metal poured into ingot molds
    T.crucible = this.makeTex((x, y, f) => {
      let c = [48, 40, 38];
      if (frame(x, y)) c = [30, 26, 26];
      if (x >= 14 && x <= 17 && y <= 14) c = (y + f) % 4 < 2 ? [255, 210, 100] : [255, 150, 40];  // the pour
      for (const my of [16, 22]) {
        if (y >= my && y <= my + 3 && x >= 4 && x <= 27) {
          c = x % 6 === 3 ? [60, 52, 48] : y === my ? [90, 80, 74] : [255, 120 + ((x + f * 3) % 5) * 15, 30];
        }
      }
      return c;
    }, true, 2);

    // forge: a hydraulic press over a red-hot plate
    T.press = this.makeTex((x, y) => {
      let c = [26, 24, 24];
      if (x <= 5 || x >= 26) c = [84, 76, 70];
      if (x >= 6 && x <= 25 && y >= 3 && y <= 11) c = [112, 104, 96];
      if (x >= 6 && x <= 25 && y >= 12 && y <= 13) c = ((x + y) >> 1) & 1 ? [214, 170, 24] : [26, 26, 26];
      if (x >= 14 && x <= 17 && y <= 2) c = [150, 150, 150];
      if (y >= 22) c = [60, 56, 54];
      if (x >= 8 && x <= 23 && y >= 19 && y <= 21) return lit([255, 110 + (x % 3) * 30, 30]);
      return g(c, x, y, 48, 8);
    });

    // storage: metal shelves full of boxes and canisters
    T.shelf = this.makeTex((x, y) => {
      let c = [30, 32, 36];
      if (x <= 1 || x >= 30 || y % 10 === 9) c = [120, 120, 112];
      else {
        const row = (y / 10) | 0, item = H(x >> 3, row, 49);
        const top = row * 10 + (item < 0.5 ? 2 : 4);
        if (y >= top && (x & 7) !== 0) c = item < 0.4 ? [150, 110, 60] : item < 0.7 ? [60, 90, 150] : item < 0.85 ? [140, 40, 34] : [30, 32, 36];
      }
      if (y % 10 === 9 && x % 8 === 4) return lit([120, 220, 255]);
      return g(c, x, y, 50, 10);
    });
  },

  // Textures for the Cryo Lab and Lava Foundry maps.
  buildThemeTextures() {
    const T = this.textures;
    const H = (x, y, s) => this.hash(x, y, s);
    const g = (c, x, y, s, a) => this.grain(c, x, y, s, a);

    // ---- cryo ----
    T.iceMetal = this.tint(T.metal, [0.9, 1.05, 1.35], 0.06, 1);
    T.frostPanel = this.tint(T.panel, [0.95, 1.05, 1.3], 0.05, 2);
    T.frostRust = this.tint(T.rust, [0.7, 0.9, 1.3], 0.08, 3);
    T.iceCeiling = this.tint(T.ceiling, [0.85, 1, 1.3], 0.03, 4);
    T.icePipes = this.tint(T.pipes, [0.8, 0.95, 1.3], 0.05, 5);
    T.snow = this.makeTex((x, y) => {
      let c = ((x >> 4) + (y >> 4)) & 1 ? [150, 165, 180] : [140, 155, 172];
      if (x % 16 === 0 || y % 16 === 0) c = [96, 110, 128];
      if (H(x, y, 21) < 0.08) c = [215, 228, 240];
      return g(c, x, y, 22, 10);
    });
    T.iceBlock = this.makeTex((x, y) => {
      let c = [110, 170, 205];
      if (x < 2 || x > 29 || y < 2 || y > 29) c = [70, 120, 160];
      if (Math.abs(x - y) < 2 && x > 4 && x < 20) c = [200, 235, 250];
      if (Math.abs(x - y - 8) < 1 && x > 14 && x < 28) c = [170, 220, 240];
      if (H(x >> 1, y >> 1, 23) < 0.1) c = [140, 195, 225];
      return g(c, x, y, 24, 8);
    });
    T.cryoPod = this.makeTex((x, y) => {
      let c = [60, 70, 84];
      if (x >= 6 && x <= 25 && y >= 3 && y <= 28) {
        c = [40, 150, 190];
        // frozen robot silhouette inside the glass
        if ((x >= 12 && x <= 19 && y >= 7 && y <= 12) || (x >= 10 && x <= 21 && y >= 13 && y <= 22) ||
          (x >= 11 && x <= 14 && y >= 23 && y <= 28) || (x >= 17 && x <= 20 && y >= 23 && y <= 28)) c = [20, 70, 100];
        if (y >= 9 && y <= 10 && x >= 13 && x <= 18) c = [255, 70, 60];
        if (x === 8 || (x === 9 && y < 14)) c = [190, 240, 255];
      }
      if (x === 5 || x === 26 || y === 2 || y === 29) c = [140, 150, 160];
      return c;
    }, true);

    // ---- lava ----
    T.scorchedMetal = this.tint(T.metal, [1.1, 0.8, 0.65]);
    T.sootCeiling = this.tint(T.ceiling, [0.85, 0.65, 0.55]);
    T.sootPipes = this.tint(T.pipes, [1, 0.7, 0.55]);
    T.scorchedFloor = this.tint(T.floor, [1.05, 0.82, 0.68]);
    T.basalt = this.makeTex((x, y) => {
      const p = H(x >> 2, y >> 2, 31);
      let c = p < 0.3 ? [34, 28, 28] : p < 0.7 ? [46, 38, 36] : [58, 48, 44];
      const crack = Math.abs(Math.sin(x * 0.35) * 7 + 16 - y) < 0.8 || Math.abs(Math.sin(y * 0.5 + 2) * 5 + 8 - x) < 0.7;
      if (crack) c = [255, 120, 30];
      return g(c, x, y, 32, 10);
    });
    T.lava = this.makeTex((x, y, f) => {
      const v = Math.sin(x * 0.4 + f * 2.1) + Math.sin(y * 0.35 - f * 1.3) + Math.sin((x + y) * 0.25 + f);
      if (v > 1.4) return [255, 230, 120];
      if (v > 0.3) return [255, 140, 30];
      if (v > -0.9) return [220, 70, 15];
      return [120, 30, 10];
    }, true, 3);
    T.lava.slowAnim = true; // bubbles slowly instead of flickering
  },

  unpack(px) {
    return [px & 255, (px >> 8) & 255, (px >> 16) & 255];
  },

  // Bright ceiling lamp, tinted to the lamp's light color.
  lampTexture(col) {
    const key = col.join(',');
    if (!this.textures['lamp' + key]) {
      this.textures['lamp' + key] = this.makeTex((x, y) => {
        if (x < 4 || x > 27 || y < 4 || y > 27) return [50, 50, 54];
        if (x < 6 || x > 25 || y < 6 || y > 25) return [90, 90, 96];
        const v = (x % 6 === 0) ? 180 : 255;
        return [v * (0.55 + col[0] * 0.45), v * (0.55 + col[1] * 0.45), v * (0.55 + col[2] * 0.45)];
      }, true);
    }
    return this.textures['lamp' + key];
  },

  // ---------- robots ----------
  palettes: {
    canister: { body: '#2a5ab0', dark: '#1a3a80', light: '#5a8ae0', joint: '#e0b020' },
    basic: { body: '#7a8494', dark: '#4a525e', light: '#aab4c3', joint: '#2c3038', eye: '#ff3030', glow: '#ffc0b0', accent: '#e0a020' },
    fast: { body: '#c8a030', dark: '#7a5a18', light: '#f0d070', joint: '#2a2410', eye: '#60ff60', glow: '#d0ffd0', accent: '#ff4040' },
    heavy: { body: '#8a3b2e', dark: '#55241c', light: '#c0614a', joint: '#2a2020', eye: '#ffa020', glow: '#fff0a0', accent: '#e8d040' },
    ranged: { body: '#3e6f8a', dark: '#22404f', light: '#7fb6d1', joint: '#1a262e', eye: '#40ffe0', glow: '#ffffff', accent: '#ff40c0' },
    barrel: { body: '#9a2a1a', dark: '#5a1a10', light: '#d05030', joint: '#2a2a2a' },
    bomber: { body: '#3a3f48', dark: '#24272c', light: '#6a7280', joint: '#141414', eye: '#ff3030', glow: '#ffc0b0', accent: '#e0b020' },
    shield: { body: '#3a4a6a', dark: '#232e44', light: '#6a80a8', joint: '#161c28', eye: '#60e0ff', glow: '#ffffff', accent: '#60e0ff' },
    phantom: { body: '#3a2a4e', dark: '#1e1430', light: '#6e5a8e', joint: '#0e0816', eye: '#ff40f0', glow: '#ffffff', accent: '#c040ff', core: '#ffd040', coreGlow: '#fff4b0', coreRail: '#a08020' },
    carrier: { body: '#5a6a4a', dark: '#36402c', light: '#8a9a72', joint: '#1e2024', eye: '#ffb020', glow: '#fff0c0', accent: '#ff9a30' },
    boss: { body: '#4a4f5a', dark: '#2a2d34', light: '#7a8090', joint: '#16181c', eye: '#ff4020', glow: '#ffd0a0', accent: '#ff60f0' },
    xa: { body: '#5a2a6a', dark: '#2e1438', light: '#9a5ab0', joint: '#14081a', eye: '#80ff40', glow: '#e0ffc0', accent: '#80ff40' },
    xb: { body: '#2a5a3a', dark: '#163020', light: '#5aa070', joint: '#0a140c', eye: '#ff40c0', glow: '#ffd0f0', accent: '#c040ff' },
    sapper: { body: '#7a6a40', dark: '#463c24', light: '#a89a68', joint: '#1e1a12', eye: '#ff8020', glow: '#ffe0a0', accent: '#d03020' },
    medic: { body: '#d8dde2', dark: '#7a828c', light: '#ffffff', joint: '#3a4048', eye: '#40ff80', glow: '#e0ffe8', accent: '#30c060' },
    jumper: { body: '#4a5a8a', dark: '#2a3456', light: '#7a8ac0', joint: '#141a2a', eye: '#ff40a0', glow: '#ffd0e8', accent: '#ff40a0' },
    xq: { body: '#4a7a2a', dark: '#24400f', light: '#8ac050', joint: '#121e08', eye: '#ff3060', glow: '#ffd0e0', accent: '#c0ff40' },
    xe: { body: '#a8c870', dark: '#5a7a30', light: '#e0f0b0', joint: '#2a3a10', eye: '#ff3060', glow: '#ffffff', accent: '#80ff40' },
    mini: { body: '#8a9098', dark: '#50565e', light: '#c0c8d0', joint: '#202428', eye: '#ffb020', glow: '#ffffff', accent: '#ff9a30' },
  },

  robotDrawers: {
    basic(r, f, P) {
      const leg = (x, up) => { r(x, 22, 4, up ? 6 : 7, P.dark); r(x - 1, up ? 28 : 29, 6, up ? 2 : 3, P.joint); r(x + 1, 23, 1, 3, P.light); };
      leg(11, f === 'walk1'); leg(17, f === 'walk0');
      r(10, 11, 12, 10, P.body); r(10, 11, 12, 1, P.light); r(12, 13, 8, 5, P.dark);
      r(15, 14, 2, 2, P.accent); r(11, 20, 10, 2, P.joint);
      r(12, 3, 8, 7, P.body); r(12, 3, 8, 1, P.light); r(13, 6, 6, 2, '#1a0606');
      r(14, 6, 4, 2, P.eye); r(14, 6, 1, 1, P.glow); r(15, 0, 1, 3, P.dark); r(15, 0, 1, 1, P.accent);
      r(14, 10, 4, 1, P.joint);
      if (f === 'attack') {
        r(6, 9, 4, 6, P.dark); r(22, 9, 4, 6, P.dark);
        r(5, 7, 6, 2, '#ffe060'); r(21, 7, 6, 2, '#ffe060');
        r(4, 5, 1, 2, '#ffffff'); r(27, 5, 1, 2, '#ffffff'); r(7, 4, 1, 3, '#ffe060'); r(24, 4, 1, 3, '#ffe060');
      } else {
        const sw = f === 'walk1' ? 1 : 0;
        r(7, 12 + sw, 3, 8, P.dark); r(7, 20 + sw, 3, 2, P.joint);
        r(22, 13 - sw, 3, 8, P.dark); r(22, 21 - sw, 3, 2, P.joint);
      }
    },

    fast(r, f, P) {
      const atk = f === 'attack';
      const s = f === 'walk1' ? 1 : 0, t = 1 - s;
      // body sits high on long legs so it's level with the player's crosshair
      const y0 = atk ? 7 : 10;
      r(5, y0 + 3, 4, 2, P.dark); r(4, y0 + 5, 2, 26 - y0 - s * 2, P.joint); r(3, 30 - s * 2, 3, 2, P.dark);
      r(8, y0 + 6, 2, 25 - y0 - t * 2, P.joint);
      r(23, y0 + 3, 4, 2, P.dark); r(26, y0 + 5, 2, 26 - y0 - t * 2, P.joint); r(26, 30 - t * 2, 3, 2, P.dark);
      r(22, y0 + 6, 2, 25 - y0 - s * 2, P.joint);
      r(9, y0, 14, 7, P.body); r(11, y0 - 2, 10, 2, P.body); r(11, y0 - 2, 10, 1, P.light);
      r(9, y0 + 6, 14, 1, P.dark); r(12, y0, 2, 6, P.dark); r(18, y0, 2, 6, P.dark);
      r(12, y0 + 2, 2, 2, P.eye); r(18, y0 + 2, 2, 2, P.eye);
      r(10, y0 - 5, 1, 3, P.dark); r(21, y0 - 5, 1, 3, P.dark);
      if (atk) {
        r(11, y0 + 7, 3, 4, P.accent); r(18, y0 + 7, 3, 4, P.accent);
        r(12, y0 + 11, 1, 1, '#ffffff'); r(19, y0 + 11, 1, 1, '#ffffff');
      }
    },

    heavy(r, f, P) {
      const leg = (x, up) => { r(x, 23, 6, up ? 6 : 7, P.dark); r(x - 1, up ? 28 : 29, 8, up ? 2 : 3, P.joint); r(x + 1, 24, 1, 4, P.light); };
      leg(8, f === 'walk1'); leg(18, f === 'walk0');
      r(7, 13, 18, 10, P.body); r(7, 13, 18, 1, P.light); r(9, 15, 14, 5, P.dark);
      r(12, 16, 8, 2, P.accent); r(8, 22, 16, 2, P.joint);
      r(3, 8, 26, 6, P.body); r(3, 8, 26, 1, P.light); r(3, 13, 26, 1, P.dark);
      r(5, 10, 1, 1, P.light); r(26, 10, 1, 1, P.light);
      r(12, 4, 8, 5, P.dark); r(12, 4, 8, 1, P.body); r(13, 6, 6, 2, P.eye); r(14, 6, 2, 1, P.glow);
      if (f === 'attack') {
        r(2, 3, 6, 7, P.dark); r(1, 0, 8, 4, P.joint); r(24, 3, 6, 7, P.dark); r(23, 0, 8, 4, P.joint);
        r(2, 0, 6, 1, P.light); r(24, 0, 6, 1, P.light);
      } else {
        const sw = f === 'walk1' ? 1 : 0;
        r(2, 14 + sw, 5, 9, P.dark); r(1, 23 + sw, 7, 5, P.joint); r(2, 24 + sw, 5, 1, P.light);
        r(25, 15 - sw, 5, 9, P.dark); r(24, 24 - sw, 7, 5, P.joint); r(25, 25 - sw, 5, 1, P.light);
      }
    },

    ranged(r, f, P) {
      const atk = f === 'attack';
      const b = f === 'walk1' ? 1 : 0;
      r(9, 21, 3, 9, P.dark); r(7, 30, 6, 2, P.joint); r(20, 21, 3, 9, P.dark); r(19, 30, 6, 2, P.joint);
      r(15, 21, 2, 7, P.joint);
      r(11, 11 + b, 10, 10, P.body); r(11, 11 + b, 10, 1, P.light); r(13, 14 + b, 6, 4, P.dark);
      r(14, 15 + b, 4, 2, P.accent);
      r(11, 3 + b, 10, 7, P.body); r(12, 2 + b, 8, 1, P.light); r(14, 4 + b, 4, 4, '#05201c');
      r(15, 5 + b, 2, 2, P.eye); r(15, 5 + b, 1, 1, '#ffffff');
      r(7, 12 + b, 3, 7, P.dark); r(7, 19 + b, 3, 2, P.joint);
      r(21, 10 + b, 4, 4, P.dark); r(23, 9 + b, 8, 4, P.joint); r(23, 9 + b, 8, 1, P.light);
      r(30, 9 + b, 2, 4, atk ? P.accent : P.dark);
      if (atk) { r(28, 7 + b, 4, 8, '#ff80e0'); r(29, 8 + b, 3, 6, '#ffffff'); }
    },

    // round bomb on two wheels, red light on top
    bomber(r, f, P) {
      const atk = f === 'attack', s = f === 'walk1' ? 1 : 0;
      const body = atk ? '#7a2a20' : P.body;
      r(9, 23, 5, 7, P.joint); r(18, 23, 5, 7, P.joint); r(10, 24 + s * 3, 3, 2, '#888888'); r(19, 27 - s * 3, 3, 2, '#888888');
      r(10, 8, 12, 16, P.dark); r(8, 10, 16, 12, P.dark); r(9, 9, 14, 14, body);
      r(11, 10, 3, 3, atk ? '#ffd0c0' : P.light);
      r(8, 15, 16, 2, P.accent); for (let x = 9; x < 24; x += 3) r(x, 15, 1, 2, '#202020');
      r(12, 18, 8, 2, P.joint); r(13, 18, 2, 2, P.eye); r(17, 18, 2, 2, P.eye);
      r(16, 3, 1, 5, '#888888');
      r(15, 2, 3, 3, (s || atk) ? P.eye : '#601010');
      if (atk) { r(14, 0, 1, 2, '#ffe060'); r(18, 0, 1, 2, '#ffe060'); r(13, 3, 1, 1, '#ffffff'); r(19, 3, 1, 1, '#ffffff'); }
    },

    // bulky robot holding a see-through energy shield
    shield(r, f, P) {
      const atk = f === 'attack';
      const leg = (x, up) => { r(x, 22, 5, up ? 6 : 7, P.dark); r(x - 1, up ? 28 : 29, 7, up ? 2 : 3, P.joint); };
      leg(10, f === 'walk1'); leg(17, f === 'walk0');
      r(9, 10, 14, 12, P.body); r(9, 10, 14, 1, P.light); r(11, 12, 10, 6, P.dark);
      r(12, 2, 8, 8, P.body); r(12, 2, 8, 1, P.light); r(13, 5, 6, 2, '#061420'); r(14, 5, 4, 2, P.eye);
      r(6, 11, 3, 9, P.dark); r(23, 11, 3, 9, P.dark);
      if (atk) {
        // shield swung aside, fist forward
        r(0, 6, 4, 22, '#2a8aa8'); r(0, 6, 1, 22, '#60e0ff');
        r(22, 6, 6, 6, P.joint); r(23, 7, 4, 4, '#60e0ff');
      } else {
        for (let y = 7; y < 29; y++) for (let x = 5; x < 27; x++) {
          const edge = y === 7 || y === 28 || x === 5 || x === 26;
          if (edge) r(x, y, 1, 1, '#60e0ff');
          else if ((x + y) % 2 === 0) r(x, y, 1, 1, '#2a8aa8');
        }
        r(15, 16, 2, 2, '#c0f8ff');
      }
    },

    // hooded ghost robot, floats on a ragged trail instead of legs
    // PHANTOM: an armored hover-robot; the glowing yellow core in its chest powers its teleport
    phantom(r, f, P) {
      const atk = f === 'attack', s = f === 'walk1' ? 1 : 0;
      r(15, 0, 2, 2, P.dark); r(15, 0, 1, 1, P.eye);
      r(11, 2, 10, 8, P.body); r(11, 2, 10, 1, P.light); r(10, 4, 1, 4, P.dark); r(21, 4, 1, 4, P.dark);
      r(12, 5, 8, 2, '#0a0610'); r(13, 5, 2, 2, P.eye); r(17, 5, 2, 2, P.eye); r(13, 5, 1, 1, P.glow); r(17, 5, 1, 1, P.glow);
      r(14, 10, 4, 2, P.joint);
      r(9, 12, 14, 10, P.body); r(9, 12, 14, 1, P.light); r(9, 21, 14, 1, P.dark);
      r(7, 12, 3, 4, P.light); r(22, 12, 3, 4, P.light);
      r(13, 14, 6, 6, P.dark); r(14, 15, 4, 4, P.core); r(15, 16, 2, 2, P.coreGlow);
      r(12, 16, 1, 2, P.coreRail); r(19, 16, 1, 2, P.coreRail);
      r(11, 22, 10, 3, P.dark); r(12, 25, 8, 2, P.joint); r(13, 27, 6, 1 + s, P.core); r(14, 28 + s, 4, 2, P.coreGlow);
      if (atk) {
        r(3, 11, 6, 3, P.body); r(23, 11, 6, 3, P.body);
        for (let i = 0; i < 3; i++) { r(1, 10 + i * 2, 2, 1, P.eye); r(29, 10 + i * 2, 2, 1, P.eye); }
      } else {
        r(6, 16 + s, 3, 7, P.body); r(23, 17 - s, 3, 7, P.body);
        r(6, 23 + s, 3, 2, P.dark); r(23, 24 - s, 3, 2, P.dark);
      }
    },

    // big tracked launcher; the front bay opens to release mini-drones
    carrier(r, f, P) {
      const atk = f === 'attack', s = f === 'walk1' ? 1 : 0;
      r(1, 24, 30, 8, P.joint); for (let x = 2 + s * 2; x < 30; x += 4) r(x, 26, 2, 4, '#4a4e56');
      r(1, 24, 30, 1, '#3a3e46');
      r(2, 12, 28, 12, P.body); r(2, 12, 28, 1, P.light); r(2, 22, 28, 2, P.dark);
      r(9, 15, 14, 7, atk ? P.accent : P.dark); if (atk) r(11, 16, 10, 5, '#ffe0a0');
      for (let y = 15; y < 22; y += 2) r(9, y, 14, 1, atk ? '#ff7010' : P.joint);
      r(9, 5, 14, 7, P.body); r(9, 5, 14, 1, P.light); r(11, 7, 10, 2, '#201808'); r(12, 7, 8, 2, P.eye);
      r(25, 0, 1, 12, '#888888'); r(24, 0, 3, 1, P.accent);
      r(4, 14, 3, 3, P.eye); r(25, 14, 3, 3, P.eye);
    },

    // little hovering drone with spinning rotors
    mini(r, f, P) {
      const atk = f === 'attack', s = f === 'walk1';
      r(2, 4, 12, 2, s ? P.light : P.dark); r(18, 4, 12, 2, s ? P.dark : P.light);
      r(7, 5, 2, 4, P.joint); r(23, 5, 2, 4, P.joint);
      r(8, 9, 16, 14, P.body); r(6, 11, 20, 10, P.body); r(8, 9, 16, 1, P.light);
      r(12, 12, 8, 8, P.joint); r(13, 13, 6, 6, atk ? '#ffffff' : P.eye); r(14, 14, 2, 2, P.glow);
      r(10, 23, 2, 4, P.dark); r(20, 23, 2, 4, P.dark);
      if (atk) { r(14, 23, 4, 5, '#ffe060'); }
    },

    // SAPPER: a squat khaki robot with a rack of red mines on its back and more on its belt
    sapper(r, f, P) {
      const atk = f === 'attack';
      const leg = (x, up) => { r(x, 23, 4, up ? 5 : 6, P.dark); r(x - 1, up ? 28 : 29, 6, 2, P.joint); };
      leg(11, f === 'walk1'); leg(17, f === 'walk0');
      r(7, 10, 18, 3, P.dark); r(8, 8, 4, 2, P.accent); r(14, 8, 4, 2, P.accent); r(20, 8, 4, 2, P.accent);
      r(9, 12, 14, 11, P.body); r(9, 12, 14, 1, P.light); r(9, 19, 14, 2, P.joint);
      for (let i = 0; i < 3; i++) r(10 + i * 4, 19, 3, 2, P.accent);
      r(12, 3, 8, 6, P.body); r(12, 3, 8, 1, P.light); r(13, 5, 6, 2, '#1a1206'); r(14, 5, 4, 1, P.eye);
      r(6, 13, 3, 8, P.dark);
      if (atk) { r(22, 20, 3, 7, P.dark); r(21, 27, 5, 2, P.accent); r(22, 26, 3, 1, '#ff6040'); } // placing a mine
      else r(23, 13, 3, 8, P.dark);
    },
    // MEDIC BOT: a white hovering capsule with a green cross and repair arms
    medic(r, f, P) {
      const heal = f === 'attack';
      r(15, 0, 2, 3, P.dark); r(15, 0, 2, 1, P.eye);
      r(12, 3, 8, 5, P.body); r(13, 2, 6, 1, P.light); r(13, 5, 6, 1, P.eye);
      r(10, 8, 12, 14, P.body); r(10, 8, 12, 1, P.light); r(11, 9, 1, 12, P.light); r(21, 9, 1, 12, P.dark);
      r(14, 11, 4, 8, P.accent); r(12, 13, 8, 4, P.accent); r(15, 12, 2, 6, P.glow);
      if (heal) { r(6, 9, 4, 3, P.dark); r(22, 9, 4, 3, P.dark); r(4, 8, 3, 3, P.eye); r(25, 8, 3, 3, P.eye); r(5, 9, 1, 1, '#ffffff'); r(26, 9, 1, 1, '#ffffff'); }
      else { r(7, 11, 3, 7, P.dark); r(22, 11, 3, 7, P.dark); r(7, 18, 3, 1, P.eye); r(22, 18, 3, 1, P.eye); }
      r(12, 22, 8, 2, P.dark); r(13, 24, 6, 1, f === 'walk1' ? P.eye : P.glow); r(14, 25, 4, 1, P.eye); // hover jet
    },
    // JUMPER: a compact body on two big springs; crouches before it leaps
    jumper(r, f, P) {
      const c = f === 'attack' ? 4 : 0, s = f === 'walk1' ? 1 : 0;
      r(10, 6 + c, 2, 2, P.dark); r(20, 6 + c, 2, 2, P.dark);
      r(10, 8 + c, 12, 9, P.body); r(10, 8 + c, 12, 1, P.light);
      r(11, 11 + c, 10, 2, '#14060c'); r(12, 11 + c, 3, 2, P.eye); r(17, 11 + c, 3, 2, P.eye); r(13, 11 + c, 1, 1, P.glow); r(18, 11 + c, 1, 1, P.glow);
      r(7, 10 + c, 3, 5, P.dark); r(22, 10 + c, 3, 5, P.dark);
      const springTop = 17 + c, coils = Math.floor((29 - springTop) / 2);
      for (let i = 0; i < coils; i++) {
        const y = springTop + i * 2, off = (i + s) % 2 ? 2 : 0;
        r(9 + off, y, 4, 1, P.light); r(10 + (2 - off), y + 1, 3, 1, P.dark);
        r(19 + off, y, 4, 1, P.light); r(20 + (2 - off), y + 1, 3, 1, P.dark);
      }
      r(8, 29, 7, 2, P.joint); r(17, 29, 7, 2, P.joint); r(9, 29, 5, 1, P.accent); r(18, 29, 5, 1, P.accent);
    },

    // XA: hunched, purple, three green eyes, long clawed arms
    xa(r, f, P) {
      const atk = f === 'attack';
      const leg = (x, up) => { r(x, 22, 3, up ? 6 : 7, P.dark); r(x - 1, up ? 28 : 29, 5, 2, P.joint); };
      leg(12, f === 'walk1'); leg(18, f === 'walk0');
      r(11, 13, 10, 9, P.body); r(11, 13, 10, 1, P.light); r(13, 15, 6, 1, P.dark); r(13, 18, 6, 1, P.dark);
      r(9, 3, 14, 9, P.body); r(10, 2, 12, 1, P.light); r(9, 3, 1, 8, P.dark); r(22, 3, 1, 8, P.dark);
      r(11, 6, 3, 2, P.eye); r(15, 5, 2, 2, P.eye); r(18, 6, 3, 2, P.eye); r(12, 6, 1, 1, P.glow); r(19, 6, 1, 1, P.glow);
      r(13, 9, 6, 1, P.joint); r(12, 0, 1, 3, P.light); r(19, 0, 1, 3, P.light); r(12, 0, 1, 1, P.eye); r(19, 0, 1, 1, P.eye);
      if (atk) { // claws up
        r(6, 5, 3, 9, P.dark); r(23, 5, 3, 9, P.dark);
        r(5, 2, 1, 4, P.light); r(8, 2, 1, 4, P.light); r(23, 2, 1, 4, P.light); r(26, 2, 1, 4, P.light);
      } else {
        r(7, 13, 3, 9, P.dark); r(22, 13, 3, 9, P.dark);
        r(6, 22, 1, 3, P.light); r(9, 22, 1, 3, P.light); r(22, 22, 1, 3, P.light); r(25, 22, 1, 3, P.light);
      }
    },
    // XQ (48x48): huge, crowned, a spotted sac behind, six thin legs, scythe arms
    xq(r, f, P) {
      const atk = f === 'attack', s = f === 'walk1' ? 1 : 0;
      r(12, 26, 24, 14, P.dark); r(14, 27, 20, 11, P.body);
      for (let i = 0; i < 4; i++) r(16 + i * 5, 30 + (i % 2) * 3, 3, 2, P.accent);
      for (const [x, dir] of [[10, -1], [14, -1], [18, -1], [30, 1], [34, 1], [38, 1]]) { r(x, 38 + ((x + s) % 2), 2, 8, P.joint); r(x + dir, 45, 3, 2, P.dark); }
      r(14, 14, 20, 14, P.body); r(14, 14, 20, 2, P.light); r(18, 18, 12, 6, P.dark); r(22, 20, 4, 2, P.accent);
      r(17, 4, 14, 11, P.body); r(17, 4, 14, 1, P.light);
      for (let i = 0; i < 5; i++) r(17 + i * 3, i % 2, 2, 4, P.accent);
      r(19, 7, 3, 2, P.eye); r(26, 7, 3, 2, P.eye); r(23, 9, 2, 2, P.eye); r(20, 7, 1, 1, P.glow); r(27, 7, 1, 1, P.glow);
      r(19, 13, 3, atk ? 5 : 3, P.joint); r(26, 13, 3, atk ? 5 : 3, P.joint);
      if (atk) { r(22, 13, 4, 3, P.accent); r(6, 4, 4, 12, P.light); r(38, 4, 4, 12, P.light); r(5, 3, 2, 3, P.dark); r(41, 3, 2, 3, P.dark); }
      else { r(8, 16, 3, 12, P.light); r(37, 16, 3, 12, P.light); r(7, 27, 2, 3, P.dark); r(39, 27, 2, 3, P.dark); }
    },
    // XE: a pale spotted egg in a puddle of slime; pulses before it hatches
    xe(r, f, P) {
      const big = f === 'walk1' ? 1 : 0;
      r(8, 28, 16, 2, P.accent);
      r(12, 12 - big, 8, 2, P.body); r(11, 14 - big, 10, 2, P.body); r(10, 16 - big, 12, 10 + big, P.body); r(11, 26, 10, 2, P.dark);
      r(12, 13 - big, 3, 1, P.light); r(11, 15 - big, 2, 4, P.light);
      r(14, 18, 2, 2, P.dark); r(18, 21, 2, 2, P.dark); r(13, 23, 2, 1, P.dark);
      r(16, 16, 1, 1, f === 'attack' ? P.eye : P.accent);
    },

    // XB: tall, green, one big pink eye, a glowing gun arm
    xb(r, f, P) {
      const atk = f === 'attack';
      const leg = (x, up) => { r(x, 22, 3, up ? 6 : 7, P.dark); r(x - 1, up ? 28 : 29, 5, 2, P.joint); };
      leg(12, f === 'walk1'); leg(17, f === 'walk0');
      r(10, 12, 12, 10, P.body); r(10, 12, 12, 1, P.light); r(12, 15, 8, 4, P.dark);
      r(12, 1, 8, 10, P.body); r(12, 1, 8, 1, P.light); r(14, 4, 4, 3, P.eye); r(15, 5, 2, 1, P.glow); r(14, 8, 4, 1, P.joint);
      r(6, 13, 3, 8, P.dark); r(5, 21, 2, 2, P.light);
      r(21, 13, 8, 4, P.accent); r(21, 13, 8, 1, P.glow); r(28, 14, 2, 2, atk ? '#ffffff' : P.glow);
      if (atk) { r(29, 13, 3, 4, '#ffffff'); r(30, 12, 1, 6, P.glow); }
    },

    // the Warden: huge horned boss with arm cannons and a glowing core (48x48)
    boss(r, f, P) {
      const atk = f === 'attack', s = f === 'walk1' ? 1 : 0;
      r(12, 34 + s, 8, 9 - s, P.dark); r(10, 43, 12, 5, P.joint);
      r(28, 35 - s, 8, 8 + s, P.dark); r(26, 43, 12, 5, P.joint);
      r(13, 35, 2, 6, P.light); r(29, 35, 2, 6, P.light);
      r(10, 16, 28, 18, P.body); r(10, 16, 28, 2, P.light); r(10, 32, 28, 2, P.dark);
      r(19, 21, 10, 8, '#300808'); r(21, 23, 6, 4, atk ? '#ffffff' : P.eye); r(22, 24, 4, 2, P.glow);
      for (const [x, y] of [[12, 19], [35, 19], [12, 30], [35, 30]]) r(x, y, 1, 1, P.light);
      r(2, 12, 12, 10, P.body); r(34, 12, 12, 10, P.body); r(2, 12, 12, 2, P.light); r(34, 12, 12, 2, P.light);
      r(4, 8, 2, 4, P.light); r(9, 9, 2, 3, P.light); r(42, 8, 2, 4, P.light); r(37, 9, 2, 3, P.light);
      r(19, 5, 10, 10, P.dark); r(19, 5, 10, 1, P.body); r(20, 9, 8, 2, P.eye); r(21, 9, 2, 1, P.glow);
      r(16, 1, 3, 7, P.light); r(29, 1, 3, 7, P.light); r(16, 1, 1, 2, '#ffffff'); r(31, 1, 1, 2, '#ffffff');
      if (atk) {
        r(1, 20, 10, 9, P.dark); r(37, 20, 10, 9, P.dark);
        r(2, 22, 8, 5, P.accent); r(38, 22, 8, 5, P.accent); r(4, 23, 4, 3, '#ffffff'); r(40, 23, 4, 3, '#ffffff');
      } else {
        r(3, 22, 8, 14, P.dark); r(37, 22, 8, 14, P.dark);
        r(4, 36, 6, 3, P.joint); r(38, 36, 6, 3, P.joint); r(5, 37, 4, 1, '#ff4020'); r(39, 37, 4, 1, '#ff4020');
      }
    },
  },

  spriteSizes: { boss: 48, xq: 48 },

  // Every robot in three looks, one per map theme: normal (foundry), frosted (cryo), scorched (lava).
  // Level.build picks the set for its map with useRobotTheme.
  buildRobotSprites() {
    this.robotSets = { foundry: {}, cryo: {}, lava: {} };
    for (const type of Object.keys(this.robotDrawers)) {
      const P = this.palettes[type];
      const draw = this.robotDrawers[type];
      const size = this.spriteSizes[type] || 32;
      const raw = {};
      for (const f of ['walk0', 'walk1', 'attack']) {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        draw((x, y, rw, rh, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, rw, rh); }, f, P);
        raw[f] = c;
      }
      for (const theme of Object.keys(this.robotSets)) {
        const frames = {};
        for (const f of Object.keys(raw)) frames[f] = this.spriteFromCanvas(this.robotVariant(raw[f], theme, type));
        const base = frames.walk0.canvas;
        frames.die0 = this.deathFrame(base, 0);
        frames.die1 = this.deathFrame(base, 1);
        frames.wreck = this.deathFrame(base, 2);
        this.robotSets[theme][type] = frames;
      }
    }
    this.useRobotTheme('foundry');
  },

  useRobotTheme(theme) {
    const set = this.robotSets[theme] || this.robotSets.foundry;
    for (const type of Object.keys(set)) this.sprites[type] = set[type];
  },

  // Repaints a robot frame for a map: cryo = icy blue with frost on top edges,
  // lava = charred dark metal with glowing orange cracks. Foundry = unchanged.
  robotVariant(src, theme, type) {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(src, 0, 0);
    if (theme === 'foundry') return c;
    const img = ctx.getImageData(0, 0, c.width, c.height), d = img.data, W = c.width;
    const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < c.height && d[(y * W + x) * 4 + 3] > 128;
    const seed = type.length * 31 + (theme === 'cryo' ? 7 : 13);
    const out = new Uint8ClampedArray(d);
    // glowing parts that keep their own color on every map (e.g. the Phantom's yellow core)
    const P = this.palettes[type] || {};
    const keep = new Set([P.core, P.coreGlow, P.coreRail].filter(Boolean).map(h => parseInt(h.slice(1), 16)));
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < W; x++) {
        if (!solid(x, y)) continue;
        const i = (y * W + x) * 4, h = this.hash(x, y, seed);
        let r = d[i], g = d[i + 1], b = d[i + 2];
        if (keep.has((r << 16) | (g << 8) | b)) continue;
        const lum = (r + g + b) / 3;
        if (theme === 'cryo') {
          // cold blue tint; snow and frost where the top of a shape is exposed
          r = r * 0.6 + lum * 0.15 + 30; g = g * 0.65 + lum * 0.2 + 45; b = b * 0.6 + lum * 0.3 + 90;
          if (!solid(x, y - 1) && h < 0.75) { r = 235; g = 245; b = 255; }
          else if (!solid(x, y - 2) && h < 0.3) { r = 190; g = 225; b = 250; }
          else if (h < 0.02) { r = 255; g = 255; b = 255; }   // sparkle
        } else {
          // charred metal; glowing cracks inside the body, hot edges at the bottom
          r = r * 0.55 + 18; g = g * 0.45 + 8; b = b * 0.4 + 6;
          const inside = solid(x - 1, y) && solid(x + 1, y) && solid(x, y - 1) && solid(x, y + 1);
          if (inside && h < 0.045) { r = 255; g = 140 + h * 1500; b = 30; }
          else if (!solid(x, y + 1) && h < 0.5) { r = 220; g = 80; b = 20; }
        }
        out[i] = r; out[i + 1] = g; out[i + 2] = b;
      }
    }
    img.data.set(out);
    ctx.putImageData(img, 0, 0);
    return c;
  },

  // Death animation built from the standing frame: tilt, break apart, pile of scrap.
  deathFrame(base, stage) {
    const S = base.width, k = S / 32; // works for any square sprite size
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    if (stage === 0) {
      ctx.translate(S / 2, S - 1); ctx.rotate(0.18); ctx.drawImage(base, -S / 2, -(S - 1));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    } else if (stage === 1) {
      ctx.drawImage(base, 0, S / 2, S, S / 2, 2 * k, S / 2, S, S / 2);
      ctx.translate(10 * k, 20 * k); ctx.rotate(-0.5); ctx.drawImage(base, 0, 0, S, S / 2, -12 * k, -8 * k, S, S / 2);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    } else {
      ctx.drawImage(base, 0, 0, S, S, 2 * k, 22 * k, 28 * k, 10 * k);
    }
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = stage === 2 ? 'rgba(10,8,6,0.55)' : 'rgba(10,8,6,0.3)';
    ctx.fillRect(0, 0, S, S);
    ctx.globalCompositeOperation = 'source-over';
    if (stage < 2) {
      for (let i = 0; i < 10 * k; i++) {
        ctx.fillStyle = i % 3 ? '#ffd040' : '#ffffff';
        ctx.fillRect((this.hash(i, stage, 31) * 26 * k + 3) | 0, (this.hash(i, stage, 37) * 22 * k + 6) | 0, Math.ceil(k), Math.ceil(k));
      }
    }
    return this.spriteFromCanvas(c);
  },

  // ---------- effects, pickups, props ----------
  buildMiscSprites() {
    const S = this.sprites;

    S.explosion = [];
    for (let i = 0; i < 7; i++) {
      S.explosion.push(this.makeSprite(32, 32, (ctx, r) => {
        const R = 3 + i * 2.4;
        for (let y = 0; y < 32; y++) {
          for (let x = 0; x < 32; x++) {
            const d = Math.hypot(x - 15.5, y - 17) + (this.hash(x >> 1, y >> 1, 40 + i) - 0.5) * 4;
            if (d > R) continue;
            let col;
            if (i >= 4) {
              if (this.hash(x, y, 60 + i) < (i - 3) * 0.18) continue;
              col = d < R * 0.6 ? '#3a3330' : d < R * 0.85 ? '#5a4a40' : '#e04010';
            } else if (d < R * 0.45) col = i < 2 ? '#fffbe0' : '#ffe070';
            else if (d < R * 0.75) col = '#ffb020';
            else col = '#e04010';
            r(x, y, 1, 1, col);
          }
        }
      }));
    }

    S.plasma = [0, 1].map(f => this.makeSprite(8, 8, (ctx, r) => {
      r(2, 0, 4, 8, '#c020a0'); r(0, 2, 8, 4, '#c020a0'); r(1, 1, 6, 6, '#ff50d0');
      r(2, 2, 4, 4, f ? '#ffd0f8' : '#ffffff');
    }));

    S.rocket = this.makeSprite(8, 8, (ctx, r) => {
      r(2, 2, 4, 4, '#6e8256'); r(3, 1, 2, 6, '#4a5a3a'); r(3, 3, 2, 2, '#c03020');
      r(0, 3, 2, 2, '#ffb040'); r(1, 3, 1, 2, '#ffffff');
    });
    S.pbolt = [0, 1].map(f => this.makeSprite(8, 8, (ctx, r) => {
      r(2, 0, 4, 8, '#2080ff'); r(0, 2, 8, 4, '#2080ff'); r(1, 1, 6, 6, '#30c8ff');
      r(2, 2, 4, 4, f ? '#c0f4ff' : '#ffffff');
    }));
    S.grenade = [0, 1].map(f => this.makeSprite(8, 8, (ctx, r) => {
      r(1, 2, 6, 6, '#3a5a2a'); r(2, 2, 2, 6, '#5a7e40'); r(2, 0, 4, 2, '#8a929c'); r(5, 0, 2, 1, '#c0c8d0');
      r(3, 4, 2, 2, f ? '#ff3020' : '#601010');
    }));
    S.chip = this.makeSprite(12, 10, (ctx, r) => {
      // green circuit chip with gold pins
      for (let i = 0; i < 4; i++) { r(2 + i * 2, 0, 1, 2, '#e0c040'); r(2 + i * 2, 8, 1, 2, '#e0c040'); }
      r(1, 2, 10, 6, '#1a5a3a'); r(1, 2, 10, 1, '#40c080'); r(3, 4, 6, 2, '#40ffb0'); r(4, 4, 2, 1, '#ffffff');
    });
    // weapon crates: same crate, colored by the gun inside
    S.weapon = WEAPONS.map(w => {
      const col = { rocket: '#ff7030', plasmagun: '#30c8ff', flamer: '#ffb020', tesla: '#a070ff' }[w.id] || '#c0c0c0';
      return this.makeSprite(18, 14, (ctx, r) => {
        r(1, 2, 16, 12, '#3a4048'); r(1, 2, 16, 1, '#6a727c'); r(1, 13, 16, 1, '#20242a');
        r(1, 6, 16, 3, col); r(7, 4, 4, 7, col); r(8, 5, 2, 5, '#ffffff');
        r(0, 2, 1, 12, '#20242a'); r(17, 2, 1, 12, '#20242a'); r(3, 0, 12, 2, '#2a3038');
      });
    });

    // acid blob (2 frames) and the green puddle it leaves
    S.acid = [0, 1].map(f => this.makeSprite(8, 8, (ctx, r) => { r(2, 1, 4, 6, '#60e020'); r(1, 2, 6, 4, '#60e020'); r(2 + f, 2, 2, 2, '#e0ffa0'); }));
    S.puddle = this.makeSprite(30, 3, (ctx, r) => { r(4, 0, 22, 3, '#3a9a18'); r(1, 1, 28, 2, '#3a9a18'); r(8, 0, 6, 1, '#a0ff60'); r(18, 1, 5, 1, '#a0ff60'); });

    // a Sapper's mine: a flat disc with a red light (frame 1 = light on)
    S.mine = [0, 1].map(on => this.makeSprite(12, 6, (ctx, r) => {
      r(1, 3, 10, 3, '#3a3a3e'); r(2, 2, 8, 1, '#5a5a60'); r(1, 5, 10, 1, '#1e1e22');
      r(3, 3, 1, 1, '#d0a020'); r(8, 3, 1, 1, '#d0a020');
      r(5, 0, 2, 2, on ? '#ff3020' : '#601010'); if (on) r(5, 0, 1, 1, '#ffd0c0');
    }));

    // the Tesla Cannon's lightning ball: a crackling core, three flickering frames
    S.tball = [0, 1, 2].map(f => this.makeSprite(16, 16, (ctx, r) => {
      r(4, 4, 8, 8, '#4060ff'); r(3, 6, 10, 4, '#4060ff'); r(6, 3, 4, 10, '#4060ff');
      r(5, 5, 6, 6, '#80d0ff'); r(6, 6, 4, 4, '#ffffff');
      const arcs = [[[1, 7], [0, 3], [2, 1]], [[13, 2], [15, 6], [12, 14]], [[7, 0], [14, 9], [3, 15]]][f];
      for (const [x, y] of arcs) { r(x, y, 2, 2, '#c0f4ff'); r((x + 8) >> 1, (y + 8) >> 1, 1, 1, '#ffffff'); }
    }));

    // campaign goals
    const exitSprite = (glow, core) => this.makeSprite(16, 32, (ctx, r) => {
      // a beacon: metal base with a column of light
      r(5, 2, 6, 24, glow); r(6, 0, 4, 28, core); r(7, 0, 2, 28, '#ffffff');
      r(1, 26, 14, 6, '#4a5058'); r(1, 26, 14, 1, '#7a828c'); r(3, 28, 10, 2, glow);
    });
    S.exit = exitSprite('#30a040', '#80ff90');
    S.exitLocked = exitSprite('#a02820', '#ff6050');
    const genSprite = dead => this.makeSprite(16, 26, (ctx, r) => {
      r(2, 4, 12, 20, dead ? '#2a2e34' : '#3a4250'); r(2, 4, 12, 1, dead ? '#3a3e44' : '#6a7484');
      r(4, 7, 8, 10, dead ? '#141618' : '#103050'); r(5, 8, 6, 8, dead ? '#202428' : '#30c8ff');
      if (!dead) { r(6, 9, 2, 6, '#e0faff'); r(9, 11, 1, 3, '#e0faff'); }
      else { r(5, 9, 1, 1, '#ff8020'); r(9, 13, 1, 1, '#ffd040'); }
      r(1, 22, 14, 4, '#22262c'); r(4, 0, 2, 4, '#5a606a'); r(10, 0, 2, 4, '#5a606a');
      r(4, 19, 8, 1, dead ? '#3a3020' : '#e0b020');
    });
    S.generator = genSprite(false);
    S.generatorDead = genSprite(true);
    S.keycard = this.makeSprite(12, 8, (ctx, r) => {
      r(0, 0, 12, 8, '#d0d8e0'); r(0, 0, 12, 1, '#ffffff'); r(0, 7, 12, 1, '#8a96a4');
      r(1, 2, 4, 4, '#30c8ff'); r(6, 2, 5, 1, '#3a4250'); r(6, 4, 4, 1, '#3a4250'); r(9, 6, 2, 1, '#e0b020');
    });

    S.health = this.makeSprite(16, 12, (ctx, r) => {
      r(1, 2, 14, 10, '#d8d8d8'); r(1, 2, 14, 1, '#ffffff'); r(1, 11, 14, 1, '#909090');
      r(6, 3, 4, 8, '#d02020'); r(3, 5, 10, 4, '#d02020');
    });

    S.ammo = this.makeSprite(16, 12, (ctx, r) => {
      r(1, 4, 14, 8, '#4a5a2a'); r(1, 4, 14, 1, '#6a7e40'); r(1, 11, 14, 1, '#2e3a1a');
      for (let i = 0; i < 4; i++) { r(3 + i * 3, 1, 2, 4, '#c8a030'); r(3 + i * 3, 0, 2, 1, '#e8d080'); }
      r(4, 7, 8, 2, '#202810');
    });

    S.barrel = this.makeSprite(16, 24, (ctx, r) => {
      // red = explosive
      r(2, 2, 12, 22, '#9a2a1a'); r(3, 1, 10, 1, '#5a1a10'); r(4, 3, 2, 20, '#d05030');
      r(2, 10, 12, 4, '#e0b020'); for (let i = 0; i < 6; i++) r(2 + i * 2, 10 + (i % 2) * 2, 1, 2, '#202020');
      r(2, 5, 12, 1, '#5a1a10'); r(2, 19, 12, 1, '#5a1a10'); r(12, 2, 2, 22, '#701e12');
      r(7, 15, 2, 3, '#ffd040'); r(6, 16, 4, 1, '#ffd040');
    });

    // the Overseer (a 1-in-10000 surprise): tall, black armor, long cape, red visor
    S.overseer = this.makeSprite(24, 44, (ctx, r) => {
      r(3, 12, 18, 32, '#0c0c10'); r(2, 20, 2, 24, '#0c0c10'); r(20, 20, 2, 24, '#0c0c10');  // cape
      r(7, 12, 10, 26, '#1a1a22'); r(7, 12, 10, 1, '#3a3a48');                              // body armor
      r(9, 16, 6, 4, '#24242e'); r(10, 17, 4, 2, '#ff2020'); r(11, 17, 1, 1, '#ffa0a0');      // chest light
      r(8, 22, 8, 1, '#3a3a48'); r(8, 26, 8, 1, '#3a3a48');
      r(7, 38, 4, 6, '#14141a'); r(13, 38, 4, 6, '#14141a');                               // legs
      r(8, 2, 8, 10, '#14141a'); r(7, 4, 10, 7, '#14141a'); r(8, 2, 8, 1, '#3a3a48');         // helmet
      r(8, 6, 8, 2, '#ff1010'); r(9, 6, 2, 1, '#ffb0b0');                                    // visor slit
      r(11, 0, 2, 3, '#24242e'); r(9, 10, 6, 2, '#24242e');                                  // crest, jaw
      r(3, 12, 4, 3, '#24242e'); r(17, 12, 4, 3, '#24242e');                                 // shoulders
    });

    // ---- teleport pads (cyan pair and pink pair), their light beam, the supply-drop crate ----
    S.tpad = [['#40e0ff', '#c0f4ff', '#1a5a70'], ['#ff60f0', '#ffc0f8', '#701a68']].map(([c, l, d]) => this.makeSprite(24, 6, (ctx, r) => {
      r(2, 1, 20, 5, '#2a2e34'); r(1, 2, 22, 3, '#2a2e34');
      r(4, 2, 16, 3, d); r(5, 2, 14, 1, c); r(6, 3, 12, 1, l); r(5, 4, 14, 1, c);
    }));
    S.tbeam = [['#40e0ff', '#c0f4ff'], ['#ff60f0', '#ffc0f8']].map(([c, l]) => this.makeSprite(12, 32, (ctx, r) => {
      r(3, 0, 6, 32, c); r(5, 0, 2, 32, l);
      for (let y = 2; y < 32; y += 6) r(2, y, 8, 1, l);
    }));
    S.supplyCrate = this.makeSprite(18, 16, (ctx, r) => {
      r(0, 2, 18, 14, '#4a5260'); r(0, 2, 18, 1, '#7a828c'); r(0, 15, 18, 1, '#2a2e34');
      r(0, 7, 18, 3, '#e0b020'); for (let i = 0; i < 6; i++) r(1 + i * 3, 7, 1, 3, '#202020');
      r(7, 0, 4, 2, '#8a929c'); r(8, 11, 2, 3, '#60ff80');
    });

    // ---- gadgets (used with E) ----
    S.turret = [['#ff3020', '#6a2a24'], ['#40e0ff', '#1a5a70'], ['#4a4f58', '#2a2e34']].map(([eye, stripe]) => this.makeSprite(16, 18, (ctx, r) => {
      r(5, 10, 6, 8, '#3a3f48'); r(3, 16, 10, 2, '#2a2e34'); r(5, 10, 6, 1, '#6a727c');   // stand
      r(2, 3, 12, 7, '#5a616c'); r(2, 3, 12, 1, '#8a929c'); r(2, 9, 12, 1, '#2a2e34');    // head
      r(0, 5, 3, 2, '#2a2e34'); r(13, 5, 3, 2, '#2a2e34');                                // twin barrels
      r(6, 4, 4, 4, '#16181c'); r(7, 5, 2, 2, eye); r(3, 8, 10, 1, stripe);               // eye
      r(7, 0, 2, 3, '#4a4f58'); r(7, 0, 2, 1, eye);
    }));
    const station = (screen, icon) => [false, true].map(off => this.makeSprite(14, 22, (ctx, r) => {
      r(1, 0, 12, 22, '#3a4048'); r(1, 0, 12, 1, '#6a727c'); r(1, 21, 12, 1, '#20242a');
      r(3, 3, 8, 8, off ? '#16181c' : screen);
      if (!off) icon(r);
      r(3, 14, 8, 2, off ? '#2a2e34' : '#e0b020'); r(5, 17, 4, 3, '#22262c');
    }));
    S.healthStation = station('#103a1c', r => { r(6, 4, 2, 6, '#60ff80'); r(4, 6, 6, 2, '#60ff80'); });
    S.ammoStation = station('#3a2a08', r => { for (let i = 0; i < 3; i++) { r(4 + i * 2, 5, 1, 5, '#ffd040'); r(4 + i * 2, 4, 1, 1, '#fff0a0'); } });
    S.alarmStation = station('#3a0808', r => { r(5, 5, 4, 4, '#ff3020'); r(5, 5, 4, 1, '#ff9080'); r(4, 9, 6, 1, '#801010'); });

    // ---- breakables ----
    S.crate = this.makeSprite(14, 12, (ctx, r) => {
      r(0, 0, 14, 12, '#8a5a2e'); r(0, 0, 14, 1, '#b07a44'); r(0, 11, 14, 1, '#4a3018');
      r(0, 0, 1, 12, '#5a3a1c'); r(13, 0, 1, 12, '#5a3a1c');
      for (let i = 0; i < 12; i++) r(1 + i, 1 + Math.floor(i * 10 / 12), 1, 1, '#5a3a1c'); // diagonal brace
      r(1, 5, 12, 1, '#6a4422');
    });
    S.canister = this.makeSprite(10, 16, (ctx, r) => {
      r(1, 2, 8, 14, '#2a5ab0'); r(2, 2, 2, 14, '#5a8ae0'); r(7, 2, 2, 14, '#1a3a80');
      r(3, 0, 4, 2, '#8a929c'); r(4, 0, 2, 1, '#c0c8d0');
      r(1, 7, 8, 4, '#e0b020'); r(4, 8, 2, 2, '#202020');
    });
    S.pipeBroken = this.makeSprite(16, 32, (ctx, r) => {
      r(3, 12, 4, 20, '#6a6e78'); r(3, 12, 1, 20, '#9a9ea8'); r(9, 0, 4, 32, '#5a3e2e'); r(9, 0, 1, 32, '#8a6a52');
      r(3, 10, 1, 2, '#6a6e78'); r(5, 9, 1, 3, '#6a6e78'); r(4, 12, 2, 1, '#1a1a1a');     // jagged break
      for (const y of [15, 26]) { r(2, y, 6, 2, '#3a3d44'); }
      for (const y of [4, 15, 26]) r(8, y + 2, 6, 2, '#3a2a20');
    });

    S.pipe = this.makeSprite(16, 32, (ctx, r) => {
      r(3, 0, 4, 32, '#6a6e78'); r(3, 0, 1, 32, '#9a9ea8'); r(9, 0, 4, 32, '#5a3e2e'); r(9, 0, 1, 32, '#8a6a52');
      for (const y of [4, 15, 26]) { r(2, y, 6, 2, '#3a3d44'); r(8, y + 2, 6, 2, '#3a2a20'); }
      r(4, 20, 2, 3, '#e0a020');
    });
  },

  // A copy of a wall texture with dark cracks across it (cracked walls you can blow up).
  crackedTexture(tex) {
    const S = CONFIG.TEX, src = tex.data, data = new Uint32Array(src);
    const dark = this.rgb(18, 16, 14), edge = this.rgb(120, 118, 112);
    const crack = (x, y, dx, steps, seed) => {
      for (let i = 0; i < steps; i++) {
        if (x < 0 || y < 0 || x >= S || y >= S) return;
        data[y * S + x] = dark;
        if (x + 1 < S) data[y * S + x + 1] = edge;
        y++;
        x += this.hash(i, seed, 77) < 0.5 ? dx : 0;
        if (this.hash(i, seed, 91) < 0.15) crack(x, y, -dx, steps - i - 4, seed + 1);
      }
    };
    crack(8, 0, 1, 32, 3); crack(22, 6, -1, 26, 9); crack(4, 14, 1, 14, 17);
    return { data, frames: [data], emissive: false };
  },

  // ---------- big title logo ----------
  // Text in chunky pixel letters: colored rows (top to bottom), black outline, dark drop shadow.
  // lines: one or more text lines. unit: size of one font pixel in image pixels.
  LOGO_ORANGE: ['#fff0a0', '#ffd050', '#f0a030', '#d87020', '#a84810'],
  LOGO_CYAN: ['#ffffff', '#c0f4ff', '#60e0ff', '#30a8e0', '#2070b0'],
  bigTitle(lines, unit, rows = this.LOGO_ORANGE, shadow = '#2a1004') {
    const cols = Math.max(...lines.map(t => Font.width(t)));
    const lineH = 7; // 5 rows of letters + gap
    const mask = document.createElement('canvas');
    mask.width = cols; mask.height = lines.length * lineH;
    const mctx = mask.getContext('2d');
    lines.forEach((t, i) => Font.draw(mctx, t, Math.floor((cols - Font.width(t)) / 2), i * lineH, '#ffffff', 1, 'left', null));
    const px = mctx.getImageData(0, 0, mask.width, mask.height).data;
    const on = (x, y) => x >= 0 && y >= 0 && x < mask.width && y < mask.height && px[(y * mask.width + x) * 4 + 3] > 128;
    const out = document.createElement('canvas');
    out.width = (cols + 3) * unit; out.height = (mask.height + 3) * unit;
    const g = out.getContext('2d');
    const block = (x, y, col) => { g.fillStyle = col; g.fillRect((x + 1) * unit, (y + 1) * unit, unit, unit); };
    for (const [ox, oy, col] of [[1, 1, shadow], [0, 0, '#000000']]) { // shadow, then outline
      for (let y = -1; y <= mask.height; y++) for (let x = -1; x <= cols; x++) {
        if (on(x - ox, y - oy) || on(x - ox - 1, y - oy) || on(x - ox + 1, y - oy) || on(x - ox, y - oy - 1) || on(x - ox, y - oy + 1)) block(x, y, col);
      }
    }
    for (let y = 0; y < mask.height; y++) for (let x = 0; x < cols; x++) if (on(x, y)) block(x, y, rows[y % lineH] || rows[4]);
    out.className = 'pixel';
    return out;
  },

  // ---------- player avatar ----------
  // A human pilot who is part machine: the upper half of his RIGHT face, his RIGHT side of the
  // torso and his LEFT leg are metal. He faces the viewer, so his right side is on the LEFT of
  // the picture (x < 12). 'visor' is the color of the machine eye. 24x32 pixels.
  drawAvatar(ctx, av, ox = 0, oy = 0) {
    const suit = AVATAR_OPTIONS.suit[av.suit].color;
    const visor = AVATAR_OPTIONS.visor[av.visor].color;
    const dark = this.shadeHex(suit, 0.62);
    const light = this.shadeHex(suit, 1.35);
    const metal = '#8a9098', metalDark = '#4a4f58', metalLight = '#c4cad2', black = '#16181c';
    const pick = (k, fallback) => (AVATAR_OPTIONS[k][av[k] || 0] || {}).color || fallback;
    const skin = pick('skin', '#d8a07a'), skinDark = this.shadeHex(skin, 0.8), hair = pick('hair', '#3a2a1c'), iris = pick('eyes', '#2a1a10');
    const r = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(ox + x, oy + y, w, h); };
    const helmet = av.helmet, acc = av.accessory;

    // things worn on the back go behind everything
    if (acc === 8) { // energy wings: glowing feathers out of both shoulders
      for (const [x, y, w, col] of [[1, 9, 5, '#a0f4ff'], [0, 11, 6, '#60d8ff'], [0, 13, 5, '#40c0ff'], [0, 15, 4, '#2a9ae8'], [1, 17, 3, '#2080d0'], [2, 19, 2, '#1a60b0']]) {
        r(x, y, w, 2, col); r(23 - x - w + 1, y, w, 2, col);
      }
      r(1, 9, 1, 1, '#ffffff'); r(22, 9, 1, 1, '#ffffff'); r(3, 11, 1, 6, '#e0faff'); r(20, 11, 1, 6, '#e0faff');
    }
    if (acc === 5) { r(4, 12, 16, 19, '#8a1a1a'); r(4, 12, 16, 1, '#b02a2a'); }
    if (acc === 6) {
      r(1, 13, 3, 9, '#7a7f88'); r(20, 13, 3, 9, '#7a7f88'); r(1, 13, 3, 1, '#b0b4ba'); r(20, 13, 3, 1, '#b0b4ba');
      r(1, 22, 3, 2, '#ff9a20'); r(20, 22, 3, 2, '#ff9a20'); r(2, 24, 1, 1, '#ffe060'); r(21, 24, 1, 1, '#ffe060');
    }

    // legs: his right leg in suit trousers, his left leg is a machine with a glowing knee
    r(7, 23, 4, 7, dark); r(7, 23, 1, 7, suit); r(6, 30, 5, 2, '#222428');
    r(13, 23, 4, 7, metal); r(13, 23, 1, 7, metalLight); r(13, 26, 4, 1, metalDark); r(14, 26, 2, 1, visor);
    r(16, 24, 1, 2, metalDark); r(13, 30, 5, 2, metalDark); r(13, 30, 5, 1, metal);

    // torso: his right half is machine (ribs, a power core), his left half is the suit
    r(12, 12, 6, 9, suit); r(12, 12, 6, 1, light); r(15, 14, 1, 5, dark); r(12, 19, 6, 1, dark);
    r(6, 12, 6, 9, metal); r(6, 12, 6, 1, metalLight); r(11, 12, 1, 9, metalDark);
    r(7, 14, 4, 1, metalDark); r(7, 18, 4, 1, metalDark);
    r(7, 15, 3, 3, black); r(8, 15, 1, 3, visor); r(7, 16, 3, 1, visor);
    r(6, 21, 12, 2, '#2a2a2a'); r(11, 21, 2, 2, '#c0a040');

    // arms in suit sleeves (a metal shoulder cap on the machine side), bare hands
    r(3, 12, 3, 9, suit); r(3, 14, 3, 1, light); r(3, 17, 3, 1, dark); r(3, 12, 3, 2, metal); r(3, 12, 3, 1, metalLight);
    r(18, 12, 3, 9, suit); r(18, 12, 3, 1, light); r(18, 17, 3, 1, dark);
    r(3, 21, 3, 2, skin); r(18, 21, 3, 2, skin); r(3, 22, 3, 1, skinDark); r(18, 22, 3, 1, skinDark);

    // head
    if (helmet === 4) {
      // skull face plate
      r(7, 2, 10, 10, '#e8e4d8'); r(7, 2, 10, 1, '#ffffff'); r(8, 5, 3, 3, '#111111'); r(13, 5, 3, 3, '#111111');
      r(9, 6, 1, 1, visor); r(14, 6, 1, 1, visor); r(11, 8, 2, 1, '#111111');
      r(9, 10, 6, 1, '#111111'); r(10, 10, 1, 1, '#e8e4d8'); r(12, 10, 1, 1, '#e8e4d8');
    } else {
      // human face and neck
      r(8, 3, 9, 8, skin); r(7, 4, 1, 6, skin); r(9, 11, 6, 1, skinDark); r(8, 10, 8, 1, skinDark);
      r(17, 5, 1, 2, skinDark); // ear
      // hair on his left side and top
      r(12, 2, 5, 2, hair); r(16, 3, 1, 2, hair);
      // his left eye, brow, nose and mouth
      r(13, 4, 3, 1, hair); r(13, 5, 2, 1, '#ffffff'); r(13, 5, 1, 1, iris); // colored part toward the nose, white on the outside
      r(12, 7, 1, 2, skinDark); r(10, 9, 5, 1, '#8a4a3a');
      // upper half of his right face is a metal plate with a glowing machine eye
      r(7, 2, 5, 6, metal); r(7, 2, 5, 1, metalLight); r(7, 3, 1, 4, metalLight);
      r(11, 2, 1, 6, metalDark); r(7, 7, 5, 1, metalDark); r(6, 4, 1, 3, metalDark);
      r(8, 4, 3, 3, black); r(9, 4, 1, 3, visor); r(8, 5, 3, 1, visor); r(9, 5, 1, 1, '#ffffff');
      if (helmet === 3) {
        // dome: a glass cap over the machine side, showing the brain
        r(7, 0, 5, 2, '#d878a8'); r(8, 0, 3, 1, '#f0a0c8'); r(9, 1, 1, 1, '#a04878');
        r(6, 0, 1, 2, '#a0e0ff'); r(12, 0, 1, 2, '#a0e0ff'); r(7, 0, 1, 1, '#e0f8ff');
      }
    }
    if (helmet === 1) { r(13, 0, 2, 3, '#d03030'); r(13, 0, 2, 1, '#ff5a5a'); } // crest
    if (helmet === 5) {
      r(7, 0, 10, 2, '#e8c030'); r(7, 0, 1, 1, '#000000'); r(9, 0, 2, 1, '#000000'); r(13, 0, 2, 1, '#000000'); r(16, 0, 1, 1, '#000000');
      r(8, 0, 1, 1, '#e8c030'); r(11, 0, 2, 1, '#e8c030'); r(15, 0, 1, 1, '#e8c030'); r(11, 1, 2, 1, '#e02020');
    }
    if (helmet === 2) { r(5, 0, 2, 5, '#c8c8c0'); r(17, 0, 2, 5, '#c8c8c0'); r(5, 0, 1, 1, '#ffffff'); r(18, 0, 1, 1, '#ffffff'); }
    if (helmet === 6) { r(7, 1, 11, 2, '#8a1a1a'); r(11, 0, 6, 1, '#a02424'); r(17, 2, 1, 1, '#601010'); r(8, 1, 2, 1, '#e0c040'); } // beret

    // accessories (the antenna sticks out of the metal side of the head)
    if (acc === 1) { r(8, 0, 1, 2, '#b0b4ba'); r(8, 0, 1, 1, '#ff3030'); }
    if (acc === 2) { r(2, 11, 5, 3, '#b8bcc4'); r(17, 11, 5, 3, '#b8bcc4'); r(2, 11, 5, 1, '#e0e4ea'); r(17, 11, 5, 1, '#e0e4ea'); }
    if (acc === 3) { r(7, 11, 10, 2, '#c02828'); r(15, 13, 2, 5, '#c02828'); r(15, 17, 2, 1, '#801818'); }
    if (acc === 7) { r(14, 14, 1, 3, '#c02030'); r(16, 14, 1, 3, '#2050c0'); r(14, 17, 1, 1, '#ffd040'); r(16, 17, 1, 1, '#ffd040'); } // medals
    if (acc === 4) { for (let i = 0; i < 9; i++) { r(7 + i, 13 + i, 2, 1, '#6a4a20'); if (i % 2 === 0) r(8 + i, 12 + i, 1, 1, '#d0b040'); } }
  },

  avatarCanvas(av) {
    const c = document.createElement('canvas');
    c.width = 24; c.height = 32;
    this.drawAvatar(c.getContext('2d'), av);
    return c;
  },

  // Head-and-shoulders crop for the status bar. hurt = red tint.
  portrait(av, hurt) {
    const c = document.createElement('canvas');
    c.width = 24; c.height = 22;
    const ctx = c.getContext('2d');
    this.drawAvatar(ctx, av);
    if (hurt) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(255,0,0,0.45)';
      ctx.fillRect(0, 0, 24, 22);
    }
    return c;
  },

  // ---------- weapons (first-person view) ----------
  // Builds every weapon in a few brightness levels so the gun gets darker in dark rooms.
  buildWeapons(av) {
    const glove = this.shadeHex(AVATAR_OPTIONS.suit[av.suit].color, 0.8);
    const gloveLight = this.shadeHex(glove, 1.35);
    const gloveDark = this.shadeHex(glove, 0.65);
    const skin = AVATAR_OPTIONS.gunSkin[av.gunSkin || 0] || AVATAR_OPTIONS.gunSkin[0];
    const sleeve = '#1e2228';
    const shades = [0, 0.2, 0.4, 0.58];
    const result = {};
    for (const w of WEAPONS) {
      const set = { idle: [], fire: [] };
      // Guns are designed on a 112x72 grid and drawn CONFIG.GUN_SCALE times bigger, anchored at the bottom middle.
      const K = CONFIG.GUN_SCALE, GW = Math.round(112 * K), GH = Math.round(72 * K), MID = GW / 2;
      const scaled = ctx => (x, y, rw, rh, col) => {
        const x0 = Math.round(MID + (x - 56) * K), y0 = Math.round(GH - (72 - y) * K);
        const x1 = Math.round(MID + (x + rw - 56) * K), y1 = Math.round(GH - (72 - y - rh) * K);
        ctx.fillStyle = col; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      };
      for (const s of shades) {
        const base = document.createElement('canvas');
        base.width = GW; base.height = GH;
        const ctx = base.getContext('2d');
        const r = scaled(ctx);
        // gloved hand with finger lines, and a sleeve running down to the screen edge
        // (hands are drawn after the gun skin color so gloves keep the suit color)
        const hands = [];
        const drawHand = (x, y, hw, hh, side) => {
          for (let i = 0; y + hh - 3 + i * 9 < 72; i++) {
            const ax = side < 0 ? x - 3 - i * 5 : x + 1 + i * 5, ay = y + hh - 3 + i * 9;
            r(ax, ay, hw + 2, 10, sleeve); r(ax, ay, hw + 2, 1, '#2e343c');
          }
          r(x, y, hw, hh, glove); r(x, y, hw, 2, gloveLight);
          for (let fx = x + 3; fx < x + hw - 1; fx += 3) r(fx, y + 2, 1, hh - 3, gloveDark);
        };
        this.gunDrawers[w.id](r, (...a) => hands.push(a));
        if (skin.color) this.recolor(base, skin.color);
        hands.forEach(a => drawHand(...a));
        if (s > 0) {
          ctx.globalCompositeOperation = 'source-atop';
          ctx.fillStyle = `rgba(0,0,0,${s})`;
          ctx.fillRect(0, 0, GW, GH);
          ctx.globalCompositeOperation = 'source-over';
        }
        const fire = document.createElement('canvas');
        fire.width = GW; fire.height = GH;
        const fctx = fire.getContext('2d');
        fctx.drawImage(base, 0, 0);
        const flashY = { smg: 10, flamer: 0 }[w.id] || 0;
        const flashSize = { shotgun: 1.4, sniper: 1.2, rocket: 1.8, flamer: 1.6 }[w.id] || 1;
        const flashCols = w.id === 'plasmagun' ? ['#2080ff', '#30c8ff', '#e0faff', '#40e0ff']
          : w.id === 'tesla' ? ['#6040ff', '#80d0ff', '#ffffff', '#a070ff'] : undefined;
        this.muzzleFlash(scaled(fctx), flashY, flashSize, flashCols);
        set.idle.push(base);
        set.fire.push(fire);
      }
      result[w.id] = set;
    }
    this.weapons = result;
  },

  // Repaints a canvas in one hue, keeping its shading and its see-through parts.
  recolor(canvas, color) {
    const tmp = document.createElement('canvas');
    tmp.width = canvas.width; tmp.height = canvas.height;
    const t = tmp.getContext('2d');
    t.drawImage(canvas, 0, 0);
    t.globalCompositeOperation = 'color';
    t.fillStyle = color;
    t.fillRect(0, 0, tmp.width, tmp.height);
    t.globalCompositeOperation = 'destination-in';
    t.drawImage(canvas, 0, 0);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tmp, 0, 0);
  },

  muzzleFlash(r, y, size, cols = ['#ff9a20', '#ffe070', '#fffbe0', '#ff7010']) {
    const s = (v) => Math.round(v * size);
    r(56 - s(8), y, s(16), s(7), cols[0]);
    r(56 - s(5), y, s(10), s(9), cols[1]);
    r(56 - s(3), y, s(6), s(6), cols[2]);
    r(56 - s(14), y + 2, s(6), 2, cols[3]);
    r(56 + s(8), y + 2, s(6), 2, cols[3]);
  },

  gunDrawers: {
    shotgun(r, hand) {
      r(48, 10, 16, 32, '#34373e'); r(49, 10, 2, 32, '#6c717c'); r(56, 10, 1, 32, '#22242a'); r(61, 10, 2, 32, '#4a4e57');
      r(47, 8, 18, 4, '#25272c'); r(50, 9, 4, 2, '#000000'); r(58, 9, 4, 2, '#000000');
      r(44, 28, 24, 10, '#b0642a'); r(44, 28, 24, 1, '#d88a48');
      for (let i = 0; i < 4; i++) r(44, 30 + i * 2, 24, 1, '#7a4018');
      r(40, 40, 32, 18, '#4a4e57'); r(40, 40, 32, 2, '#7a7f8a'); r(40, 56, 32, 2, '#2a2c31');
      r(52, 44, 8, 6, '#2a2c31'); r(54, 45, 4, 4, '#c09030');
      r(46, 58, 20, 14, '#2e3036'); r(46, 58, 20, 1, '#4a4d55');
      hand(32, 29, 16, 11, -1); hand(64, 50, 15, 13, 1);
    },
    sniper(r, hand) {
      r(54, 0, 4, 40, '#2c2f35'); r(54, 0, 1, 40, '#5a5f6a'); r(53, 0, 6, 3, '#1c1e22');
      r(46, 20, 20, 14, '#1c1e22'); r(46, 20, 20, 2, '#3a3f48'); r(48, 22, 16, 10, '#2a2e36');
      r(51, 23, 10, 8, '#1d3f7a'); r(52, 24, 3, 2, '#8fc0ff'); r(44, 24, 2, 6, '#1c1e22'); r(66, 24, 2, 6, '#1c1e22');
      r(44, 36, 24, 16, '#3b4a3a'); r(44, 36, 24, 2, '#5b6e5a'); r(68, 40, 10, 3, '#8a8f98'); r(76, 38, 4, 6, '#8a8f98');
      r(48, 52, 16, 20, '#2e352d'); r(48, 52, 16, 1, '#46523f');
      hand(33, 38, 14, 10, -1); hand(62, 52, 15, 13, 1);
    },
    ar(r, hand) {
      r(54, 6, 4, 20, '#2c2f35'); r(54, 6, 1, 20, '#5a5f6a'); r(53, 4, 6, 3, '#1c1e22'); r(55, 14, 2, 4, '#1c1e22');
      r(47, 24, 18, 16, '#41454d'); r(47, 24, 18, 2, '#6a6f7a');
      for (let i = 0; i < 4; i++) r(49 + i * 4, 28, 2, 8, '#25272c');
      r(44, 40, 24, 16, '#4e535c'); r(44, 40, 24, 2, '#7a7f8a'); r(44, 47, 24, 1, '#d0a020'); r(53, 36, 6, 4, '#2a2c31');
      r(37, 46, 9, 8, '#2a2c30'); r(34, 52, 9, 8, '#2a2c30'); r(32, 58, 9, 8, '#2a2c30');
      r(50, 56, 12, 16, '#2b2d32');
      hand(36, 28, 13, 10, -1); hand(64, 50, 15, 13, 1);
    },
    smg(r, hand) {
      r(54, 18, 4, 12, '#2c2f35'); r(54, 18, 1, 12, '#5a5f6a'); r(53, 16, 6, 3, '#1c1e22');
      r(42, 30, 28, 20, '#5a5f6a'); r(42, 30, 28, 2, '#8a8f9a'); r(42, 48, 28, 2, '#33363c');
      r(42, 38, 28, 1, '#30c8d8'); r(55, 26, 2, 4, '#1c1e22');
      for (let i = 0; i < 3; i++) r(46 + i * 4, 42, 2, 4, '#33363c');
      r(52, 50, 8, 18, '#26282c'); r(52, 50, 8, 1, '#3a3d44'); r(64, 50, 2, 22, '#3a3d44');
      hand(30, 34, 14, 10, -1); hand(67, 42, 14, 13, 1);
    },
    rocket(r, hand) {
      // fat launch tube with a rocket tip peeking out, sight on the side
      r(46, 2, 20, 46, '#4a5a3a'); r(46, 2, 3, 46, '#6e8256'); r(63, 2, 3, 46, '#34402a');
      r(45, 0, 22, 5, '#2a3020'); r(49, 1, 14, 3, '#101410'); r(52, 1, 8, 2, '#c03020');
      for (const y of [14, 30]) { r(45, y, 22, 3, '#d0a020'); r(45, y, 22, 1, '#f0d060'); }
      r(66, 18, 6, 10, '#2a2c30'); r(67, 19, 4, 4, '#ff4020');
      r(42, 46, 28, 14, '#3a4430'); r(42, 46, 28, 2, '#58664a');
      r(50, 58, 12, 14, '#2a2e26');
      hand(32, 36, 14, 10, -1); hand(64, 50, 15, 13, 1);
    },
    tesla(r, hand) {
      // a heavy cannon with copper coils and a glowing lightning orb at the front
      r(49, 0, 14, 12, '#2a1a60'); r(50, 1, 12, 10, '#6050ff'); r(52, 3, 8, 6, '#a0e0ff'); r(54, 4, 4, 4, '#ffffff');
      r(47, 11, 18, 4, '#3a4050'); r(47, 11, 18, 1, '#6a7484');
      r(48, 15, 16, 22, '#3a4050'); r(48, 15, 3, 22, '#5a6474');   // barrel
      for (let i = 0; i < 4; i++) { r(45, 16 + i * 5, 22, 3, '#c07030'); r(45, 16 + i * 5, 22, 1, '#f0a860'); r(46, 18 + i * 5, 20, 1, '#6a3810'); } // copper coils
      r(41, 36, 30, 16, '#4a5262'); r(41, 36, 30, 2, '#7a8496'); r(41, 50, 30, 2, '#2a3040');
      r(46, 40, 20, 6, '#14182a'); r(48, 41, 16, 4, '#6050ff'); r(49, 42, 5, 2, '#c0f4ff');
      for (let x = 42; x < 70; x += 4) r(x, 52, 2, 2, x % 8 ? '#e0b020' : '#1a1a1a');
      r(50, 54, 12, 18, '#2e3440'); r(50, 54, 12, 1, '#4a5262');
      hand(30, 38, 14, 11, -1); hand(66, 54, 15, 13, 1);
    },

    plasmagun(r, hand) {
      // sleek white-and-blue rifle with glowing coils
      r(53, 4, 6, 22, '#c8d0d8'); r(53, 4, 2, 22, '#ffffff'); r(52, 2, 8, 3, '#2a3040');
      for (let i = 0; i < 4; i++) { r(51, 8 + i * 5, 10, 2, '#30c8ff'); r(52, 8 + i * 5, 3, 1, '#c0f4ff'); }
      r(44, 26, 24, 22, '#d8dee6'); r(44, 26, 24, 2, '#ffffff'); r(44, 46, 24, 2, '#8a96a4');
      r(48, 30, 16, 8, '#1a2a40'); r(50, 32, 12, 4, '#30c8ff'); r(51, 32, 4, 2, '#e0faff');
      r(44, 40, 24, 1, '#30c8ff');
      r(50, 48, 12, 24, '#3a4250'); r(50, 48, 12, 1, '#5a6478');
      hand(34, 30, 14, 10, -1); hand(64, 48, 15, 13, 1);
    },
    flamer(r, hand) {
      // nozzle with a pilot flame, red fuel tank underneath
      r(54, 8, 4, 22, '#3a3d44'); r(54, 8, 1, 22, '#6a6f7a'); r(52, 6, 8, 4, '#2a2c30');
      r(55, 3, 2, 3, '#40a0ff'); r(55, 4, 2, 1, '#c0e0ff');
      r(46, 28, 20, 14, '#5a5f6a'); r(46, 28, 20, 2, '#8a8f9a');
      r(40, 42, 32, 16, '#a02818'); r(40, 42, 32, 2, '#d04830'); r(40, 56, 32, 2, '#601408');
      r(44, 46, 24, 2, '#e0b020'); r(54, 50, 4, 4, '#2a2c30');
      r(50, 58, 12, 14, '#2e3036');
      hand(32, 32, 15, 10, -1); hand(64, 50, 15, 13, 1);
    },
  },
};
