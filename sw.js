/* Travel Ledger Service Worker – basic offline cache */
const CACHE = 'travel-ledger-v2';
const ASSETS = [
  './',
  './index.html',
  './offline%20version.html',
  './manifest.json',
  './assets/app.js',
  './assets/offline.js',
  './assets/index.js',
  './assets/react-vendor.js',
  './assets/app.css',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  if (url.pathname.includes('/rest/v1/')) {
    return;
  }

  if (e.request.destination === 'image') {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(e.request, { ignoreVary: true });
        if (cached) return cached;
        try {
          const response = await fetch(e.request);
          if (response.status === 200 || response.type === 'opaque') {
            try {
              await cache.put(e.request, response.clone());
            } catch (cacheError) {
              console.warn('[Travel Ledger] image cache failed', cacheError);
            }
          }
          return response;
        } catch (error) {
          if (cached) return cached;
          throw error;
        }
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(e.request, { ignoreVary: true }).then((cached) => {
      const fetched = fetch(e.request).then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});
