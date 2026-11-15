'use strict';
// Classic raycaster: textured floor/ceiling, walls, then sprites, all into a small pixel buffer
// that the browser scales up with hard edges.

const Renderer = {
  init(canvas) {
    this.W = CONFIG.WIDTH;
    this.VH = CONFIG.VIEW_H;
    canvas.width = CONFIG.WIDTH;
    canvas.height = CONFIG.HEIGHT;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.img = this.ctx.createImageData(this.W, this.VH);
    this.buf = new Uint32Array(this.img.data.buffer);
    this.zbuf = new Float32Array(this.W);
    this.bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const M = CONFIG.MAX_DYNAMIC_LIGHTS;
    this.dl = {
      x: new Float32Array(M), y: new Float32Array(M), r2: new Float32Array(M),
      cr: new Float32Array(M), cg: new Float32Array(M), cb: new Float32Array(M), n: 0,
    };
  },

  // Keeps the few dynamic lights nearest the camera (muzzle flash, explosions, alarms...).
  prepareLights(cam, lights) {
    const dl = this.dl;
    const sorted = lights
      .map(l => ({ l, d: (l.x - cam.x) ** 2 + (l.y - cam.y) ** 2 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, CONFIG.MAX_DYNAMIC_LIGHTS);
    dl.n = sorted.length;
    sorted.forEach(({ l }, k) => {
      dl.x[k] = l.x; dl.y[k] = l.y; dl.r2[k] = l.radius * l.radius;
      dl.cr[k] = l.c[0] * l.intensity; dl.cg[k] = l.c[1] * l.intensity; dl.cb[k] = l.c[2] * l.intensity;
    });
  },

  render(cam, lights, sprites, time) {
    const W = this.W, VH = this.VH, buf = this.buf, zbuf = this.zbuf;
    const L = Level, MW = L.W, MH = L.H, LW = L.LW, LS = CONFIG.LIGHT_RES;
    const lr = L.lr, lg = L.lg, lb = L.lb;
    const dl = this.dl;
    this.prepareLights(cam, lights);
    const nL = dl.n;

    const dirX = Math.cos(cam.angle), dirY = Math.sin(cam.angle);
    const planeLen = Math.tan(cam.fov / 2);
    const planeX = -dirY * planeLen, planeY = dirX * planeLen;
    const projDist = (W / 2) / planeLen;
    const horizon = VH / 2 + (cam.horizonShift || 0);
    const eye = CONFIG.EYE;
    const fogK = 1 / CONFIG.FOG_DIST;
    const anim = (time * 2) | 0;
    const fastAnim = (time * 12) | 0;   // electric floor flicker
    const BLACK = 0xff000000;

    // ---- floor and ceiling ----
    const rd0x = dirX - planeX, rd0y = dirY - planeY;
    const sdx = (2 * planeX) / W, sdy = (2 * planeY) / W;
    for (let y = 0; y < VH; y++) {
      const isFloor = y >= horizon;
      const p = isFloor ? (y + 0.5 - horizon) : (horizon - y - 0.5);
      const row = y * W;
      const rowDist = p > 0.25 ? (isFloor ? eye : 1 - eye) * projDist / p : 1e9;
      const fog = 1 - rowDist * fogK;
      if (fog <= 0) { buf.fill(BLACK, row, row + W); continue; }
      const stX = rowDist * sdx, stY = rowDist * sdy;
      let fx = cam.x + rowDist * rd0x, fy = cam.y + rowDist * rd0y;
      const texArr = isFloor ? L.floorTex : L.ceilTex;
      for (let x = 0; x < W; x++, fx += stX, fy += stY) {
        const tx = Math.floor(fx), ty = Math.floor(fy);
        if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) { buf[row + x] = BLACK; continue; }
        const tex = texArr[ty * MW + tx];
        if (!tex) { buf[row + x] = BLACK; continue; }
        const tdata = tex.frames.length > 1 ? tex.frames[(tex.slowAnim ? anim : fastAnim) % tex.frames.length] : tex.data;
        const texel = tdata[((((fy - ty) * 32) | 0) << 5) + (((fx - tx) * 32) | 0)];
        let r, g, b;
        if (tex.emissive) {
          r = g = b = 1.1 * (fog > 0.4 ? 1 : fog + 0.6);
        } else {
          const li = ((fy * LS) | 0) * LW + ((fx * LS) | 0);
          r = lr[li]; g = lg[li]; b = lb[li];
          for (let k = 0; k < nL; k++) {
            const ex = fx - dl.x[k], ey = fy - dl.y[k];
            const d2 = ex * ex + ey * ey;
            if (d2 < dl.r2[k]) { let f = 1 - d2 / dl.r2[k]; f *= f; r += dl.cr[k] * f; g += dl.cg[k] * f; b += dl.cb[k] * f; }
          }
          r = (((r * fog) * 10 + 0.5) | 0) / 10;
          g = (((g * fog) * 10 + 0.5) | 0) / 10;
          b = (((b * fog) * 10 + 0.5) | 0) / 10;
        }
        buf[row + x] = this.shadePixel(texel, r, g, b);
      }
    }

    // ---- walls ----
    for (let x = 0; x < W; x++) {
      const camX = 2 * (x + 0.5) / W - 1;
      const rdx = dirX + planeX * camX, rdy = dirY + planeY * camX;
      const hit = L.castRay(cam.x, cam.y, rdx, rdy, CONFIG.FOG_DIST + 1);
      const pd = Math.max(0.0001, hit.dist);
      zbuf[x] = pd;
      if (!hit.tile) continue;
      // a wall square that has been shot has its own dented texture
      const shot = L.tileTex.size ? L.tileTex.get(hit.mapY * MW + hit.mapX) : null;
      const tex = shot && shot.ch === hit.tile && hit.u === undefined ? shot.tex : (Level.wallTexMap[hit.tile] || Art.textures.metal);
      const data = tex.frames[anim % tex.frames.length];
      const hx = cam.x + pd * rdx, hy = cam.y + pd * rdy;
      let wallX = hit.side === 0 ? hy : hx;
      wallX -= Math.floor(wallX);
      let texX;
      if (hit.u !== undefined) texX = Math.min(31, (hit.u * 32) | 0); // sliding door panel
      else {
        texX = (wallX * 32) | 0;
        if ((hit.side === 0 && rdx > 0) || (hit.side === 1 && rdy < 0)) texX = 31 - texX;
      }
      const fog = Math.max(0, 1 - pd * fogK);
      let r, g, b;
      if (tex.emissive) {
        r = g = b = 1.15 * Math.max(fog, 0.45);
      } else {
        // sample the light just in front of the surface
        const sx = hx - rdx * 0.04, sy = hy - rdy * 0.04;
        const li = ((sy * LS) | 0) * LW + ((sx * LS) | 0);
        r = lr[li]; g = lg[li]; b = lb[li];
        for (let k = 0; k < nL; k++) {
          const ex = sx - dl.x[k], ey = sy - dl.y[k];
          const d2 = ex * ex + ey * ey;
          if (d2 < dl.r2[k]) { let f = 1 - d2 / dl.r2[k]; f *= f; r += dl.cr[k] * f; g += dl.cg[k] * f; b += dl.cb[k] * f; }
        }
        const side = hit.side === 1 ? 0.8 : 1;
        r = (((r * fog * side) * 10 + 0.5) | 0) / 10;
        g = (((g * fog * side) * 10 + 0.5) | 0) / 10;
        b = (((b * fog * side) * 10 + 0.5) | 0) / 10;
      }
      const lineH = projDist / pd;
      const lineTop = horizon - (1 - eye) * lineH;
      const yStart = Math.max(0, Math.ceil(lineTop - 0.5));
      const yEnd = Math.min(VH, Math.ceil(lineTop + lineH - 0.5));
      const step = 32 / lineH;
      let texPos = (yStart + 0.5 - lineTop) * step;
      const glow = tex.glow;
      if (glow) { // a machine with status lights: those pixels light themselves
        const gl = 1.15 * Math.max(fog, 0.45);
        for (let y = yStart; y < yEnd; y++, texPos += step) {
          const ti = (((texPos | 0) & 31) << 5) + texX;
          buf[y * W + x] = glow[ti] ? this.shadePixel(data[ti], gl, gl, gl) : this.shadePixel(data[ti], r, g, b);
        }
      } else {
        for (let y = yStart; y < yEnd; y++, texPos += step) {
          buf[y * W + x] = this.shadePixel(data[(((texPos | 0) & 31) << 5) + texX], r, g, b);
        }
      }
    }

    // ---- sprites (far to near) ----
    const list = [];
    for (const s of sprites) {
      const dx = s.x - cam.x, dy = s.y - cam.y;
      const depth = dx * dirX + dy * dirY;
      if (depth < 0.12 || depth > CONFIG.FOG_DIST) continue;
      list.push({ s, depth, lat: -dx * dirY + dy * dirX });
    }
    list.sort((a, b) => b.depth - a.depth);
    for (const { s, depth, lat } of list) {
      const scale = projDist / depth;
      const screenX = W / 2 + lat * scale;
      const fog = Math.max(0, 1 - depth * fogK);
      let r = 1, g = 1, b = 1;
      if (!s.bright) {
        const li = ((s.y * LS) | 0) * LW + ((s.x * LS) | 0);
        r = lr[li] || 0.1; g = lg[li] || 0.1; b = lb[li] || 0.1;
        for (let k = 0; k < nL; k++) {
          const ex = s.x - dl.x[k], ey = s.y - dl.y[k];
          const d2 = ex * ex + ey * ey;
          if (d2 < dl.r2[k]) { let f = 1 - d2 / dl.r2[k]; f *= f; r += dl.cr[k] * f; g += dl.cg[k] * f; b += dl.cb[k] * f; }
        }
        // a little self-light so robots never vanish completely in the dark
        r = Math.max(r, 0.18) * fog; g = Math.max(g, 0.18) * fog; b = Math.max(b, 0.2) * fog;
      }

      if (s.color !== undefined) { // particle: a plain square
        const size = Math.max(1, Math.round(s.size * scale));
        const cy = horizon + (eye - s.z) * scale;
        const x0 = Math.round(screenX - size / 2), y0 = Math.round(cy - size / 2);
        const col = s.bright ? s.color : this.shadePixel(s.color, r, g, b);
        for (let x = Math.max(0, x0); x < Math.min(W, x0 + size); x++) {
          if (depth >= zbuf[x]) continue;
          for (let y = Math.max(0, y0); y < Math.min(VH, y0 + size); y++) buf[y * W + x] = col;
        }
        continue;
      }

      const spr = s.sprite;
      const hPx = s.h * scale;
      const wPx = hPx * spr.w / spr.h;
      const bottom = horizon + (eye - s.z) * scale;
      const top = bottom - hPx;
      const left = screenX - wPx / 2;
      const x0 = Math.max(0, Math.ceil(left - 0.5)), x1 = Math.min(W, Math.ceil(left + wPx - 0.5));
      const y0 = Math.max(0, Math.ceil(top - 0.5)), y1 = Math.min(VH, Math.ceil(bottom - 0.5), s.sink ? Math.ceil(horizon + eye * scale - 0.5) : VH); // sink: hidden below the floor
      const fade = s.fade === undefined ? 1 : s.fade;
      const flash = s.flash || 0;
      const outline = s.outline || 0;
      const sw = spr.w, sh = spr.h, sd = spr.data;
      const ystep = sh / hPx;
      for (let x = x0; x < x1; x++) {
        if (depth >= zbuf[x]) continue;
        let tx = (((x + 0.5 - left) / wPx) * sw) | 0;
        if (s.mirror) tx = sw - 1 - tx;
        if (tx < 0 || tx >= sw) continue;
        let ty = (y0 + 0.5 - top) * ystep;
        for (let y = y0; y < y1; y++, ty += ystep) {
          const tyi = ty | 0;
          if (tyi >= sh) break;
          const texel = sd[tyi * sw + tx];
          if (!texel) continue;
          if (fade < 1 && this.bayer[(x & 3) + ((y & 3) << 2)] >= fade * 16) continue;
          let px = s.bright ? texel : this.shadePixel(texel, r, g, b);
          // elite glow: sprite pixels on the edge of the shape take the outline color
          if (outline && (tyi === 0 || tx === 0 || tx === sw - 1 || !sd[(tyi - 1) * sw + tx] || !sd[tyi * sw + tx - 1] || !sd[tyi * sw + tx + 1] || (tyi + 1 < sh && !sd[(tyi + 1) * sw + tx]))) px = outline;
          if (flash > 0) px = this.flashPixel(px, flash);
          buf[y * W + x] = px;
        }
      }
    }

    this.ctx.putImageData(this.img, 0, 0);
  },

  shadePixel(texel, r, g, b) {
    let R = (texel & 255) * r, G = ((texel >> 8) & 255) * g, B = ((texel >> 16) & 255) * b;
    if (R > 255) R = 255; if (G > 255) G = 255; if (B > 255) B = 255;
    return (0xff000000 | (B << 16) | (G << 8) | R) >>> 0;
  },

  // White hit-flash.
  flashPixel(px, k) {
    const R = px & 255, G = (px >> 8) & 255, B = (px >> 16) & 255;
    return (0xff000000 | ((B + (255 - B) * k) << 16) | ((G + (255 - G) * k) << 8) | (R + (255 - R) * k)) >>> 0;
  },
};
