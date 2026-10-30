/* Gilded Ace service worker: cache-first offline play. Bump CACHE (and CACHE_NAME in js/app.js) on every release. */
var PREFIX = 'gilded-ace-';
var CACHE = PREFIX + 'v2';
var ASSETS = ['./', 'index.html', 'style.css', 'manifest.webmanifest',
  'js/core.js', 'js/guides.js', 'js/app.js', 'js/blackjack.js', 'js/holdem.js', 'js/roulette.js', 'js/slots.js', 'js/videopoker.js', 'js/baccarat.js', 'js/craps.js',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS.map(function (u) { return new Request(u, { cache: 'reload' }); })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    // only remove this game's older caches; other games on this origin keep theirs
    var old = keys.filter(function (k) { return k.indexOf(PREFIX) === 0 && k !== CACHE; });
    return Promise.all(old.map(function (k) { return caches.delete(k); })).then(function () { return old.length > 0; });
  }).then(function (upgraded) {
    return self.clients.claim().then(function () {
      if (!upgraded) return;
      return self.clients.matchAll({ type: 'window' }).then(function (cs) {
        cs.forEach(function (c) { if (c.navigate) c.navigate(c.url).catch(function () {}); });
      });
    });
  }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.open(CACHE).then(function (c) { return c.match(e.request, { ignoreSearch: true }); }).then(function (hit) {
    return hit || fetch(e.request).then(function (res) {
      if (res && res.ok && new URL(e.request.url).origin === location.origin && new URL(e.request.url).pathname.indexOf('/casino/') >= 0) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); }
      return res;
    }).catch(function () { return caches.open(CACHE).then(function (c) { return c.match('index.html'); }); });
  }));
});
