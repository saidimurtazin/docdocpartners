// DocDocPartner Service Worker v2
// Lightweight — only cache static assets, don't interfere with navigation/API

const CACHE_NAME = 'docdocpartner-v2';

// Install — skip waiting immediately, no precaching
self.addEventListener('install', () => {
  self.skipWaiting();
});

// Activate — clean old caches, claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — only cache static assets (JS/CSS/fonts/images with hash in filename)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Only cache hashed static assets (Vite adds hash to filenames: /assets/index-abc123.js)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Everything else — let the browser handle normally (no SW interference)
});
