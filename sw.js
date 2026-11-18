'use strict';
// Offline helper for the installed Scrapmania app (made by tools/web/make-web.js - don't edit).
const CACHE = 'scrapmania-379d500a04';
const FILES = ['./', "./css/style.css", "./icon.ico", "./icons/icon-192.png", "./icons/icon-512.png", "./index.html", "./js/art.js", "./js/audio.js", "./js/barrels.js", "./js/blast.js", "./js/bossfight.js", "./js/breakables.js", "./js/campaign.js", "./js/combo.js", "./js/config.js", "./js/controls.js", "./js/cosmetics.js", "./js/cutscene.js", "./js/difficulty.js", "./js/doors.js", "./js/drill.js", "./js/effects.js", "./js/elites.js", "./js/enemies.js", "./js/font.js", "./js/gadgets.js", "./js/game.js", "./js/hud.js", "./js/input.js", "./js/levels.js", "./js/lexicon.js", "./js/map.js", "./js/mapfx.js", "./js/menu.js", "./js/mines.js", "./js/modifiers.js", "./js/music.js", "./js/player.js", "./js/playershots.js", "./js/records.js", "./js/renderer.js", "./js/screenfit.js", "./js/spawner.js", "./js/storage.js", "./js/switches.js", "./js/tips.js", "./js/transfer.js", "./js/traps.js", "./js/tutorial.js", "./js/wardenmoves.js", "./js/weapons.js", "./logo.png", "./manifest.webmanifest"];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

// a new version: throw away the old copies
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('scrapmania-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// online: always the newest file from the website (and keep a copy); offline: the saved copy
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(hit => hit ||
    (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
