'use strict';
// Moving progress between copies of the game (Brave, the installed web app, the desktop program,
// another PC): all of it - settings, pilot, XP, rank, achievements, best scores, unlocks - packed
// into one text code that can be copied or saved as a file, and read back on the other side.
// The screen for it is in menu.js (OPTIONS > EXPORT / IMPORT PROGRESS).

const Transfer = {
  PREFIX: 'SCRAPMANIA-PROGRESS-1:',
  KEYS: { save: 'scrapProtocol.save.v1', records: 'scrapProtocol.records.v1' },

  // Everything saved on this device, as one code.
  exportCode() {
    const data = { v: 1 };
    for (const [k, key] of Object.entries(this.KEYS)) data[k] = Store.get(key);
    const bytes = new TextEncoder().encode(JSON.stringify(data));
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return this.PREFIX + btoa(bin);
  },

  // Reads a code back. Returns the saves, or null if it isn't a Scrapmania progress code.
  parse(code) {
    try {
      code = String(code).replace(/\s+/g, '');
      if (!code.startsWith(this.PREFIX)) return null;
      const bin = atob(code.slice(this.PREFIX.length));
      const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
      if (!data || data.v !== 1) return null;
      // both parts must be real saves (or empty), never something that would break the game
      for (const k of Object.keys(this.KEYS)) {
        if (data[k] !== null && data[k] !== undefined && typeof JSON.parse(data[k]) !== 'object') return null;
      }
      if (!data.save && !data.records) return null;
      return data;
    } catch (e) {
      return null;
    }
  },

  // A short description for the "are you sure" line: whose progress is this?
  describe(data) {
    let name = 'RECRUIT', xp = 0;
    try { name = JSON.parse(data.save).username || name; } catch (e) { /* no settings in the code */ }
    try { xp = JSON.parse(data.records).totals.xp || 0; } catch (e) { /* no records in the code */ }
    return name + ' - ' + xp.toLocaleString('en-US') + ' XP';
  },

  // Replaces this device's progress with the code's, then restarts the game so it loads it.
  apply(data) {
    for (const [k, key] of Object.entries(this.KEYS)) if (data[k]) Store.set(key, data[k]);
    location.reload();
  },
};
