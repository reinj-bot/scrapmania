'use strict';
// Background music, played live from note patterns (no music files), like the sound effects.
// Three tracks: 'menu' (calm), 'fight' (driving; gets a lead riff when many robots are around)
// and 'boss' (heavy, for the Warden). A step sequencer plays 16 steps per bar.

const Music = {
  gain: null,
  volume: 0.6,
  duck: 1,          // turned down while paused
  track: null,      // what is playing now
  want: null,       // what should play (switches at the next bar)
  step: 0,
  nextTime: 0,
  intensity: 0,     // 0 calm, 1 busy fight (set by the game)

  // Chords: [root note (MIDI number), minor?]. 4 bars that loop.
  TRACKS: {
    menu: { bpm: 84, chords: [[57, 1], [53, 0], [60, 0], [55, 0]] },
    fight: { bpm: 138, chords: [[40, 1], [36, 0], [38, 0], [35, 0]] },
    boss: { bpm: 156, chords: [[38, 1], [39, 0], [38, 1], [37, 0]] },
  },

  init() {
    if (this.gain || !Sound.ctx) return;
    this.gain = Sound.ctx.createGain();
    this.gain.gain.value = this.level();
    this.gain.connect(Sound.ctx.destination);
    setInterval(() => this.schedule(), 50);
  },

  level() { return this.volume * this.duck * 0.55; },

  setVolume(v) {
    this.volume = v;
    if (this.gain) this.gain.gain.setTargetAtTime(this.level(), Sound.ctx.currentTime, 0.05);
  },

  setDuck(d) {
    this.duck = d;
    if (this.gain) this.gain.gain.setTargetAtTime(this.level(), Sound.ctx.currentTime, 0.2);
  },

  // name: 'menu' | 'fight' | 'boss' | null (silence). Takes effect at the start of the next bar.
  play(name) {
    this.want = name;
    if (!this.track && Sound.ctx) { this.track = name; this.step = 0; this.nextTime = Sound.ctx.currentTime + 0.1; }
  },

  schedule() {
    const ctx = Sound.ctx;
    if (!ctx || !this.gain) return;
    if (!this.track) {
      if (this.want) { this.track = this.want; this.step = 0; this.nextTime = ctx.currentTime + 0.1; }
      return;
    }
    if (this.nextTime < ctx.currentTime - 0.5) this.nextTime = ctx.currentTime + 0.05; // tab was asleep
    while (this.nextTime < ctx.currentTime + 0.15) {
      if (this.step % 16 === 0 && this.want !== this.track) {
        this.track = this.want;
        this.step = 0;
        if (!this.track) return;
      }
      const T = this.TRACKS[this.track];
      this.playStep(this.track, T, this.step, this.nextTime);
      this.nextTime += 60 / T.bpm / 4;
      this.step++;
    }
  },

  freq(m) { return 440 * Math.pow(2, (m - 69) / 12); },

  // ---------- instruments ----------
  note(t, m, dur, type, gain, attack) {
    Sound.tone(t, dur, { type, freq: this.freq(m), gain, attack: attack || 0.005 }, this.gain);
  },
  kick(t, g = 0.7) { Sound.tone(t, 0.18, { type: 'sine', freq: 130, freqEnd: 40, gain: g }, this.gain); },
  snare(t, g = 0.3) {
    Sound.noise(t, 0.13, { type: 'bandpass', freq: 1900, q: 0.8, gain: g }, this.gain);
    Sound.tone(t, 0.07, { type: 'triangle', freq: 200, freqEnd: 140, gain: g * 0.6 }, this.gain);
  },
  hat(t, g = 0.08) { Sound.noise(t, 0.035, { type: 'highpass', freq: 7500, gain: g }, this.gain); },
  bass(t, m, dur) {
    this.note(t, m, dur, 'triangle', 0.32);
    this.note(t, m + 12, dur * 0.8, 'square', 0.05);
  },

  playStep(name, T, step, t) {
    const s = step % 16, bar = Math.floor(step / 16) % T.chords.length;
    const [root, minor] = T.chords[bar];
    const chord = [0, minor ? 3 : 4, 7];
    const beat = 60 / T.bpm;

    if (name === 'menu') {
      // slow pad, a soft arpeggio, a heartbeat bass and a quiet tick
      if (s === 0) for (const c of chord) this.note(t, root + c, beat * 4, 'triangle', 0.05, 0.4);
      if (s % 2 === 0) {
        const order = [0, 1, 2, 1, 2, 1, 0, 1];
        this.note(t, root + 12 + chord[order[(s / 2) % 8]], beat * 0.45, 'square', 0.025);
      }
      if (s === 0 || s === 10) this.bass(t, root - 12, beat * 1.2);
      if (s === 4 || s === 12) this.hat(t, 0.04);
      return;
    }

    if (name === 'fight') {
      const busy = this.intensity > 0;
      // galloping 16th-note bass
      const bassPat = [0, 0, 12, 0, 0, 12, 0, 7, 0, 0, 12, 0, 0, 12, 10, 7];
      this.bass(t, root + bassPat[s], beat * 0.22);
      if (s % 4 === 0 || (busy && s === 10)) this.kick(t);
      if (s === 4 || s === 12) this.snare(t);
      if (s % 2 === 0 || busy) this.hat(t, s % 4 === 2 ? 0.09 : 0.05);
      if (busy) {
        // lead riff when the fight gets crowded
        const riff = [12, null, 15, null, 19, null, 17, 15, 12, null, 10, null, 12, null, null, null];
        if (riff[s] !== null) this.note(t, root + 12 + riff[s], beat * 0.4, 'square', 0.04);
      }
      if (s === 0) for (const c of chord) this.note(t, root + 24 + c, beat * 0.5, 'sawtooth', 0.02);
      return;
    }

    // boss: heavy octave bass, double kicks, a siren-like lead
    const bassPat = [0, 0, 12, 0, 1, 0, 12, 0, 0, 0, 12, 0, 1, 0, 13, 12];
    this.bass(t, root + bassPat[s], beat * 0.2);
    if ([0, 3, 6, 8, 11, 14].includes(s)) this.kick(t, 0.8);
    if (s === 4 || s === 12) this.snare(t, 0.35);
    this.hat(t, s % 2 ? 0.04 : 0.08);
    if (s === 0 || s === 8) {
      const m = root + 24 + (s === 8 ? 1 : 0);
      Sound.tone(t, beat * 1.8, { type: 'square', freq: this.freq(m), freqEnd: this.freq(m) * 1.06, gain: 0.035, attack: 0.05 }, this.gain);
    }
    if (s === 0) for (const c of chord) this.note(t, root + 12 + c, beat * 2, 'sawtooth', 0.03, 0.02);
  },
};
