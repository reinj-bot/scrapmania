'use strict';
// Player actions (move, reload, use...) and which key does each one. Keys can be changed in the
// CONTROLS screen; the choice is saved in settings.keys. Also reads a game controller.

const ACTIONS = [
  { id: 'forward', label: 'MOVE FORWARD', key: 'KeyW', extra: ['ArrowUp'] },
  { id: 'back', label: 'MOVE BACK', key: 'KeyS', extra: ['ArrowDown'] },
  { id: 'left', label: 'STEP LEFT', key: 'KeyA' },
  { id: 'right', label: 'STEP RIGHT', key: 'KeyD' },
  { id: 'turnLeft', label: 'TURN LEFT', key: 'ArrowLeft' },
  { id: 'turnRight', label: 'TURN RIGHT', key: 'ArrowRight' },
  { id: 'reload', label: 'RELOAD', key: 'KeyR' },
  { id: 'grenade', label: 'GRENADE', key: 'KeyG' },
  { id: 'dash', label: 'DASH', key: 'ShiftLeft' },
  { id: 'use', label: 'USE SWITCH', key: 'KeyE' },
  { id: 'gun1', label: 'SHOTGUN', key: 'Digit1', extra: ['Numpad1'] },
  { id: 'gun2', label: 'SNIPER', key: 'Digit2', extra: ['Numpad2'] },
  { id: 'gun3', label: 'RIFLE', key: 'Digit3', extra: ['Numpad3'] },
  { id: 'gun4', label: 'SMG', key: 'Digit4', extra: ['Numpad4'] },
  { id: 'gun5', label: 'ROCKETS', key: 'Digit5', extra: ['Numpad5'] },
  { id: 'gun6', label: 'PLASMA', key: 'Digit6', extra: ['Numpad6'] },
  { id: 'gun7', label: 'FLAMER', key: 'Digit7', extra: ['Numpad7'] },
  { id: 'gun8', label: 'TESLA', key: 'Digit8', extra: ['Numpad8'] },
];

// Standard controller layout (Xbox names; PlayStation works the same way).
const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

const Controls = {
  keys: {},        // action id -> key code (from settings)
  pad: { active: false, moveX: 0, moveY: 0, lookX: 0, buttons: [], prev: [] },

  defaults() {
    const k = {};
    for (const a of ACTIONS) k[a.id] = a.key;
    return k;
  },

  // Saved keys, cleaned up: unknown actions dropped, missing ones get the default.
  valid(saved) {
    const k = this.defaults();
    if (saved && typeof saved === 'object') {
      for (const a of ACTIONS) {
        if (typeof saved[a.id] === 'string' && saved[a.id] && saved[a.id] !== 'Escape') k[a.id] = saved[a.id];
      }
    }
    return k;
  },

  use(keys) { this.keys = keys; },

  codes(id) {
    const a = ACTIONS.find(x => x.id === id);
    return [this.keys[id] || a.key].concat(a.extra || []);
  },

  held(id) { return this.codes(id).some(c => Input.keys[c]); },
  pressed(id) { return this.codes(id).some(c => Input.pressed[c]); },

  // Give an action a new key. If another action had that key, they swap.
  bind(id, code) {
    const old = this.keys[id];
    for (const a of ACTIONS) if (a.id !== id && this.keys[a.id] === code) this.keys[a.id] = old;
    this.keys[id] = code;
  },

  keyName(code) {
    if (!code) return '?';
    const named = {
      ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', Space: 'SPACE',
      ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL',
      AltLeft: 'L-ALT', AltRight: 'R-ALT', Enter: 'ENTER', Tab: 'TAB', Backspace: 'BACKSPACE',
      CapsLock: 'CAPS', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/',
      Backslash: '\\', BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Backquote: '`',
    };
    if (named[code]) return named[code];
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    if (code.startsWith('Numpad')) return 'NUM ' + code.slice(6).toUpperCase();
    return code.toUpperCase();
  },

  name(id) { return this.keyName(this.keys[id]); },

  // ---------- controller ----------
  // Read the first connected controller once per frame.
  pollPad() {
    const p = this.pad;
    p.prev = p.buttons;
    p.buttons = [];
    p.moveX = p.moveY = p.lookX = 0;
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = list && Array.from(list).find(g => g && g.connected);
    if (!gp) return;
    const dz = v => (Math.abs(v) < 0.2 ? 0 : (v - Math.sign(v) * 0.2) / 0.8);
    p.moveX = dz(gp.axes[0] || 0);
    p.moveY = dz(gp.axes[1] || 0);
    p.lookX = dz(gp.axes[2] || 0);
    p.buttons = gp.buttons.map(b => b.pressed || b.value > 0.4);
    // the controller counts as "in use" once a button is pressed or a stick moved
    if (p.buttons.some(Boolean) || p.moveX || p.moveY || p.lookX) p.active = true;
  },

  padHeld(b) { return !!this.pad.buttons[b]; },
  padPressed(b) { return !!this.pad.buttons[b] && !this.pad.prev[b]; },

  // Mouse or keyboard used again: show keyboard hints instead of controller ones.
  keyboardUsed() { this.pad.active = false; },
};
