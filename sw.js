const CACHE = 'roadtap-v73';

const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/main.js',
  './js/game.js',
  './js/data.js',
  './js/core.js',
  './js/store.js',
  './js/audio.js',
  './js/ads.js',
  './js/config.js',
  './js/leaderboard.js',
  './js/cloudsave.js',
  './js/analytics.js',
  './js/tutorial.js',
  './js/auth.js',
  './js/appcheck.js',
  './manifest.webmanifest',
  './icons/favicon-32.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => Promise.allSettled(ASSETS.map((a) => c.add(a))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }
  const url = new URL(e.request.url);
  const sameOrigin = url.origin === self.location.origin;
  // v1.3.30 : version.json n'est JAMAIS intercepté ni caché -> la sonde de version
  // (main.js) voit toujours la version réelle du serveur, même avec un vieux SW
  if (url.pathname.endsWith('/version.json')) return;
  // v1.3.24 : le CODE (js/css/html/manifest) vient d'abord du réseau, cache en repli hors-ligne.
  // Évite les mélanges de versions (nouveau HTML + vieux JS = page morte, clics inactifs).
  const isCode = sameOrigin && /\.(js|css|html|webmanifest)$/.test(url.pathname);
  if (isCode) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).then((res) => {
        if (res && res.ok && sameOrigin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      });
    })
  );
});
