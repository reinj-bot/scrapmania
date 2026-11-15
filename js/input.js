'use strict';
// Keyboard + mouse state. Mouse look uses pointer lock (the cursor is captured while playing).

const Input = {
  keys: {},
  pressed: {},
  mouseDX: 0,
  avgDX: 0,          // recent typical mouse movement (to spot impossible jumps)
  skipMoves: 0,      // mouse moves to ignore right after the mouse gets captured
  mouseDown: false,
  mouseClicked: false,
  rightDown: false,
  wheel: 0,
  locked: false,
  freeMouse: false,   // backup when the browser won't capture the mouse
  mouseX: 0.5,        // cursor position across the game screen, 0..1
  mouseInside: false,
  onLockChange: null,
  onLockError: null,

  init(canvas) {
    this.canvas = canvas;
    window.addEventListener('keydown', e => {
      if (e.target && ((e.target.tagName === 'INPUT' && e.target.type === 'text') || e.target.tagName === 'TEXTAREA')) return;
      if (!e.repeat) this.pressed[e.code] = true;
      this.keys[e.code] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.mouseDown = false; this.rightDown = false; });
    document.addEventListener('mousemove', e => {
      // Browsers sometimes report one huge fake jump while the mouse is captured (a known glitch,
      // mostly right after it gets captured): ignore it instead of spinning the view around.
      let dx = e.movementX || 0;
      if (this.skipMoves > 0) { this.skipMoves--; dx = 0; }
      if (Math.abs(dx) > 250 && Math.abs(dx) > 12 * (this.avgDX + 4)) dx = 0;
      this.avgDX = this.avgDX * 0.8 + Math.abs(dx) * 0.2;
      if (this.locked || this.freeMouse) this.mouseDX += dx;
      const rect = canvas.getBoundingClientRect();
      this.mouseX = (e.clientX - rect.left) / rect.width;
      this.mouseInside = this.mouseX >= 0 && this.mouseX <= 1 && e.clientY >= rect.top && e.clientY <= rect.bottom;
    });
    document.addEventListener('mouseleave', () => { this.mouseInside = false; });
    canvas.addEventListener('mousedown', e => {
      if (e.button === 0) { this.mouseDown = true; this.mouseClicked = true; }
      if (e.button === 2) this.rightDown = true;
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 0) this.mouseDown = false;
      if (e.button === 2) this.rightDown = false;
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('wheel', e => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (this.locked) { this.everLocked = true; this.skipMoves = 2; this.avgDX = 0; }
      if (!this.locked) { this.mouseDown = false; this.rightDown = false; }
      if (this.onLockChange) this.onLockChange(this.locked);
    });
    document.addEventListener('pointerlockerror', () => { if (this.onLockError) this.onLockError(); });
  },

  lock() {
    if (!this.canvas.requestPointerLock) return false;
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => { if (this.onLockError) this.onLockError(); });
    } catch (e) {
      if (this.onLockError) this.onLockError();
    }
    return true;
  },

  unlock() {
    if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
  },

  // Call once per frame after the game has read the input.
  endFrame() {
    this.mouseDX = 0;
    this.pressed = {};
    this.mouseClicked = false;
    this.wheel = 0;
  },
};
