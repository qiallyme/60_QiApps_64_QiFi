const CACHE_NAME = 'qifi-shell-v6';
const SHELL_ASSETS = [
  '/manifest.webmanifest',
  '/qifi-icon-192.png',
  '/qifi-icon-512.png',
  '/qifi-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.pathname.startsWith('/api/') || url.hostname === 'api.qially.com' || url.hostname.endsWith('workers.dev')) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/offline-shell', copy));
          }
          return response;
        })
        .catch(() => caches.match('/offline-shell') || Response.error())
    );
    return;
  }

  // Hashed JavaScript and CSS must always come from the active deployment.
  // Caching those files can combine an old application shell with new chunks.
});
