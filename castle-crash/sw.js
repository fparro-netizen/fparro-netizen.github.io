/* Castle Crash service worker: cache-first offline play. Bump CACHE on every release. */
var CACHE = 'castle-crash-stack-v1';
var ASSETS = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'js/game.js', 'js/core.js', 'js/levels.js',
  'js/lib/three.module.js', 'js/lib/rapier.js', 'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS.map(function (u) { return new Request(u, { cache: 'reload' }); })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    var old = keys.filter(function (k) { return k !== CACHE; });
    return Promise.all(old.map(function (k) { return caches.delete(k); })).then(function () { return old.length > 0; });
  }).then(function (upgraded) {
    return self.clients.claim().then(function () {
      if (!upgraded) return;
      // an older version was installed: reload open pages so the new game shows right away
      return self.clients.matchAll({ type: 'window' }).then(function (cs) {
        cs.forEach(function (c) { if (c.navigate) c.navigate(c.url).catch(function () {}); });
      });
    });
  }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
    return hit || fetch(e.request).then(function (res) {
      if (res && res.ok && new URL(e.request.url).origin === location.origin) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); }
      return res;
    }).catch(function () { return caches.match('index.html'); });
  }));
});
