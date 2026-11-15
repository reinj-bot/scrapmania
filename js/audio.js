'use strict';
// Every sound is made on the fly with the Web Audio API (no sound files needed).

const Sound = {
  ctx: null,
  master: null,
  noiseBuf: null,
  volume: 0.7,
  ambient: null,
  lastPlayed: {},

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  },

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  },

  out(pan) {
    if (!pan || !this.ctx.createStereoPanner) return this.master;
    const p = this.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    p.connect(this.master);
    return p;
  },

  // Filtered noise burst: gunshots, explosions, clicks.
  noise(t, dur, o, dest) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = o.type || 'lowpass';
    f.frequency.setValueAtTime(o.freq || 1000, t);
    if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(o.freqEnd, t + dur);
    f.Q.value = o.q || 1;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(o.gain || 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  },

  // Simple oscillator with a pitch slide.
  tone(t, dur, o, dest) {
    const osc = this.ctx.createOscillator();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(o.freqEnd, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain || 0.2, t + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  },

  // vol 0-1, pan -1 (left) to 1 (right). minGap stops machine-gun stacking of the same sound.
  play(name, vol = 1, pan = 0, minGap = 0) {
    if (!this.ctx || vol <= 0.01) return;
    const now = this.ctx.currentTime;
    if (minGap && this.lastPlayed[name] && now - this.lastPlayed[name] < minGap) return;
    this.lastPlayed[name] = now;
    const t = now + 0.005;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    g.connect(this.out(pan));
    const N = (d, o, at = 0) => this.noise(t + at, d, o, g);
    const T = (d, o, at = 0) => this.tone(t + at, d, o, g);
    switch (name) {
      case 'shotgun':
        N(0.4, { freq: 1400, freqEnd: 200, gain: 1.0 });
        T(0.25, { type: 'sine', freq: 95, freqEnd: 35, gain: 0.7 });
        N(0.04, { type: 'highpass', freq: 3000, gain: 0.25 }, 0.38);
        N(0.05, { type: 'bandpass', freq: 1800, gain: 0.3 }, 0.52);
        break;
      case 'sniper':
        N(0.06, { type: 'bandpass', freq: 2600, q: 0.7, gain: 1.0 });
        N(1.0, { freq: 900, freqEnd: 120, gain: 0.55 });
        T(0.35, { type: 'sine', freq: 150, freqEnd: 45, gain: 0.6 });
        N(0.04, { type: 'highpass', freq: 3500, gain: 0.3 }, 0.55);
        N(0.05, { type: 'bandpass', freq: 2000, gain: 0.3 }, 0.75);
        break;
      case 'ar':
        N(0.13, { freq: 2200, freqEnd: 500, gain: 0.6 });
        T(0.07, { freq: 170, freqEnd: 80, gain: 0.15 });
        break;
      case 'smg':
        N(0.07, { type: 'bandpass', freq: 3200, q: 0.8, gain: 0.5 });
        T(0.045, { freq: 320, freqEnd: 150, gain: 0.1 });
        break;
      case 'rocket':
        N(0.5, { freq: 900, freqEnd: 150, gain: 0.7 });
        T(0.4, { type: 'sawtooth', freq: 220, freqEnd: 60, gain: 0.25 });
        N(0.6, { type: 'bandpass', freq: 600, freqEnd: 2000, gain: 0.25 }, 0.05);
        break;
      case 'mine_place': // a heavy clack and an arming chirp
        N(0.05, { type: 'lowpass', freq: 900, gain: 0.35 });
        T(0.07, { type: 'square', freq: 1500, freqEnd: 1900, gain: 0.05 });
        break;
      case 'mine_beep':
        T(0.08, { type: 'square', freq: 2200, gain: 0.12 });
        T(0.08, { type: 'square', freq: 2950, gain: 0.05 });
        break;
      case 'heal': // a rising, friendly chime
        T(0.3, { type: 'sine', freq: 520, freqEnd: 1250, gain: 0.14 });
        T(0.3, { type: 'triangle', freq: 780, freqEnd: 1870, gain: 0.07 });
        break;
      case 'jump': // spring and whoosh
        T(0.16, { type: 'square', freq: 180, freqEnd: 520, gain: 0.08 });
        N(0.22, { type: 'bandpass', freq: 700, freqEnd: 2600, gain: 0.25 });
        break;
      case 'tesla': // a fat electric crack with a falling hum
        T(0.18, { type: 'sawtooth', freq: 220, freqEnd: 60, gain: 0.22 });
        T(0.08, { type: 'square', freq: 2400, freqEnd: 600, gain: 0.08 });
        N(0.12, { type: 'bandpass', freq: 3000, freqEnd: 900, gain: 0.35 });
        break;
      case 'plasmagun':
        T(0.12, { type: 'square', freq: 1400, freqEnd: 300, gain: 0.12 });
        T(0.1, { type: 'sine', freq: 700, freqEnd: 180, gain: 0.25 });
        N(0.05, { type: 'highpass', freq: 5000, gain: 0.15 });
        break;
      case 'flamer':
        N(0.2, { type: 'lowpass', freq: 900, freqEnd: 500, gain: 0.5 });
        N(0.15, { type: 'bandpass', freq: 2500, q: 0.6, gain: 0.15 });
        break;
      case 'weapon_drop':
        T(0.12, { type: 'square', freq: 440, gain: 0.1 }); T(0.12, { type: 'square', freq: 660, gain: 0.1 }, 0.12);
        T(0.2, { type: 'square', freq: 880, gain: 0.1 }, 0.24);
        break;
      case 'weapon_pickup':
        N(0.08, { type: 'bandpass', freq: 1500, gain: 0.5 });
        T(0.1, { type: 'square', freq: 330, gain: 0.12 }, 0.05); T(0.25, { type: 'square', freq: 660, gain: 0.12 }, 0.15);
        break;
      case 'chip':
        T(0.08, { type: 'triangle', freq: 1200, gain: 0.25 }); T(0.08, { type: 'triangle', freq: 1600, gain: 0.25 }, 0.07);
        T(0.15, { type: 'triangle', freq: 2400, gain: 0.25 }, 0.14);
        break;
      case 'throw':
        N(0.12, { type: 'bandpass', freq: 900, freqEnd: 400, gain: 0.3 });
        T(0.05, { type: 'square', freq: 500, gain: 0.05 }, 0.02);
        break;
      case 'clink':
        T(0.06, { type: 'triangle', freq: 1800, freqEnd: 1400, gain: 0.25 });
        N(0.03, { type: 'highpass', freq: 5000, gain: 0.15 });
        break;
      case 'dash':
        N(0.22, { type: 'bandpass', freq: 600, freqEnd: 2400, q: 0.6, gain: 0.45 });
        break;
      case 'ricochet': {
        // a short metal "ting", a little different every time
        const f = 1700 + Math.random() * 1200;
        T(0.14, { type: 'triangle', freq: f, freqEnd: f * 0.8, gain: 0.16 });
        T(0.05, { type: 'square', freq: f * 1.9, gain: 0.03 });
        N(0.03, { type: 'highpass', freq: 4500, gain: 0.12 });
        break;
      }
      case 'hover':
        T(0.03, { type: 'triangle', freq: 1100, gain: 0.06 });
        break;
      case 'empty':
        N(0.025, { type: 'highpass', freq: 4000, gain: 0.35 });
        break;
      case 'reload_start':
        N(0.05, { type: 'bandpass', freq: 1500, gain: 0.4 });
        T(0.04, { freq: 420, freqEnd: 300, gain: 0.08 });
        break;
      case 'reload_end':
        N(0.05, { type: 'bandpass', freq: 2600, gain: 0.45 });
        T(0.06, { freq: 260, freqEnd: 190, gain: 0.12 });
        N(0.03, { type: 'highpass', freq: 3000, gain: 0.2 }, 0.09);
        break;
      case 'switch':
        N(0.06, { type: 'bandpass', freq: 2000, gain: 0.3 });
        break;
      case 'robot_hurt':
        T(0.07, { type: 'triangle', freq: 1300, freqEnd: 700, gain: 0.2 });
        N(0.04, { type: 'highpass', freq: 3000, gain: 0.25 });
        break;
      case 'robot_die':
        N(0.8, { freq: 1600, freqEnd: 90, gain: 1.0 });
        T(0.6, { type: 'sawtooth', freq: 220, freqEnd: 30, gain: 0.3 });
        N(0.3, { type: 'highpass', freq: 2500, gain: 0.25 }, 0.05);
        break;
      case 'robot_alert':
        T(0.07, { freq: 620, gain: 0.12 });
        T(0.09, { freq: 930, gain: 0.12 }, 0.08);
        break;
      case 'robot_windup':
        T(0.2, { type: 'sawtooth', freq: 90, freqEnd: 180, gain: 0.12 });
        break;
      case 'robot_attack':
        T(0.16, { type: 'sawtooth', freq: 130, freqEnd: 55, gain: 0.3 });
        N(0.1, { type: 'bandpass', freq: 1100, gain: 0.35 });
        break;
      case 'plasma':
        T(0.22, { freq: 950, freqEnd: 180, gain: 0.18 });
        T(0.22, { type: 'sine', freq: 1900, freqEnd: 400, gain: 0.08 });
        break;
      case 'impact':
        N(0.15, { freq: 900, freqEnd: 150, gain: 0.35 });
        break;
      case 'player_hurt':
        T(0.22, { type: 'sawtooth', freq: 170, freqEnd: 70, gain: 0.35 });
        N(0.15, { freq: 700, gain: 0.3 });
        break;
      case 'pickup_health':
        T(0.1, { type: 'sine', freq: 440, freqEnd: 880, gain: 0.25 });
        T(0.14, { type: 'sine', freq: 660, freqEnd: 1320, gain: 0.25 }, 0.08);
        break;
      case 'pickup_ammo':
        T(0.06, { freq: 300, gain: 0.15 });
        T(0.06, { freq: 450, gain: 0.15 }, 0.06);
        T(0.08, { freq: 600, gain: 0.15 }, 0.12);
        break;
      case 'spawn':
        T(0.4, { type: 'sine', freq: 180, freqEnd: 1300, gain: 0.18 });
        N(0.35, { type: 'highpass', freq: 2500, gain: 0.12 });
        break;
      case 'click':
        T(0.03, { freq: 760, gain: 0.08 });
        break;
      case 'door':
        N(0.5, { freq: 500, freqEnd: 180, gain: 0.35 });
        T(0.45, { freq: 70, freqEnd: 55, gain: 0.08 });
        break;
      case 'switch_on':
        T(0.05, { freq: 300, gain: 0.2 });
        N(0.06, { type: 'bandpass', freq: 1500, gain: 0.4 });
        T(0.3, { type: 'sine', freq: 440, freqEnd: 880, gain: 0.15 }, 0.1);
        break;
      case 'zap':
        N(0.2, { type: 'highpass', freq: 2500, gain: 0.4 });
        T(0.2, { type: 'sawtooth', freq: 60, freqEnd: 120, gain: 0.18 });
        T(0.1, { freq: 1800, freqEnd: 900, gain: 0.05 }, 0.05);
        break;
      case 'glass':
        N(0.25, { type: 'highpass', freq: 4000, gain: 0.5 });
        T(0.06, { type: 'triangle', freq: 2600, freqEnd: 1800, gain: 0.12 });
        N(0.12, { type: 'bandpass', freq: 6000, gain: 0.3 }, 0.05);
        break;
      case 'barrel':
        N(1.1, { freq: 1300, freqEnd: 55, gain: 1.2 });
        T(0.8, { type: 'sine', freq: 85, freqEnd: 25, gain: 0.9 });
        N(0.4, { type: 'highpass', freq: 2000, gain: 0.3 }, 0.05);
        break;
      case 'shield_ping':
        T(0.08, { type: 'triangle', freq: 1800, freqEnd: 2600, gain: 0.15 });
        T(0.12, { type: 'sine', freq: 900, gain: 0.08 });
        break;
      case 'bomber_arm':
        for (let i = 0; i < 4; i++) T(0.05, { freq: 1300, gain: 0.15 }, i * 0.12);
        break;
      case 'teleport':
        T(0.25, { type: 'sine', freq: 1400, freqEnd: 180, gain: 0.18 });
        N(0.2, { type: 'highpass', freq: 3500, gain: 0.15 });
        break;
      case 'launch':
        T(0.22, { freq: 180, freqEnd: 650, gain: 0.15 });
        N(0.15, { type: 'bandpass', freq: 1200, gain: 0.3 });
        break;
      case 'boss_alarm':
        for (let i = 0; i < 3; i++) T(0.25, { type: 'sawtooth', freq: 440, freqEnd: 660, gain: 0.15 }, i * 0.35);
        break;
      case 'boss_roar':
        T(1.0, { type: 'sawtooth', freq: 70, freqEnd: 40, gain: 0.5 });
        T(1.0, { type: 'square', freq: 105, freqEnd: 55, gain: 0.2 });
        N(1.0, { freq: 500, freqEnd: 120, gain: 0.5 });
        break;
      case 'boss_charge':
        T(0.6, { type: 'sawtooth', freq: 80, freqEnd: 320, gain: 0.2 });
        break;
      case 'stomp':
        N(0.7, { freq: 400, freqEnd: 40, gain: 1.2 });
        T(0.5, { type: 'sine', freq: 60, freqEnd: 25, gain: 1 });
        break;
      case 'achievement':
        [784, 988, 1175, 1568].forEach((f, i) => T(0.18, { type: 'triangle', freq: f, gain: 0.18 }, i * 0.08));
        break;
      case 'combo':
        T(0.12, { freq: 660, freqEnd: 1320, gain: 0.14 });
        break;
      case 'win':
        [523, 659, 784, 1047].forEach((f, i) => T(0.25, { freq: f, gain: 0.15 }, i * 0.12));
        T(0.8, { type: 'triangle', freq: 1047, gain: 0.2 }, 0.48);
        break;
      case 'gameover':
        T(1.4, { type: 'sawtooth', freq: 320, freqEnd: 35, gain: 0.35 });
        N(1.2, { freq: 600, freqEnd: 60, gain: 0.4 });
        break;
    }
  },

  // Low factory hum while playing.
  startAmbient() {
    if (!this.ctx || this.ambient) return;
    const g = this.ctx.createGain();
    g.gain.value = 0.05;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 200;
    const a = this.ctx.createOscillator(); a.type = 'sawtooth'; a.frequency.value = 48;
    const b = this.ctx.createOscillator(); b.type = 'sawtooth'; b.frequency.value = 72.5;
    a.connect(f); b.connect(f); f.connect(g); g.connect(this.master);
    a.start(); b.start();
    this.ambient = { a, b, g };
  },

  stopAmbient() {
    if (!this.ambient) return;
    try { this.ambient.a.stop(); this.ambient.b.stop(); } catch (e) { /* already stopped */ }
    this.ambient.g.disconnect();
    this.ambient = null;
  },
};
