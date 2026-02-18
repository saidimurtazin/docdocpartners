// DocDocPartner Service Worker
// Стратегия: Network-first для API, Cache-first для статики

const CACHE_NAME = 'docdocpartner-v1';

// Статические ресурсы для предварительного кэширования
const PRECACHE_URLS = [
  '/',
  '/dashboard',
  '/login',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Установка — предварительное кэширование
self.addEventListener('install', (event) => {
  console.log('[SW] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Pre-caching app shell');
        // Не блокируем установку если какие-то URL не загрузились
        return cache.addAll(PRECACHE_URLS).catch((err) => {
          console.warn('[SW] Pre-cache partial failure:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Активация — очистка старых кэшей
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch — стратегия маршрутизации
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Пропускаем не-GET запросы
  if (request.method !== 'GET') return;

  // Пропускаем chrome-extension и другие протоколы
  if (!url.protocol.startsWith('http')) return;

  // API запросы (tRPC) — Network-first
  if (url.pathname.startsWith('/trpc') || url.pathname.startsWith('/api')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Внешние ресурсы (Google Fonts, CDN) — Stale-while-revalidate
  if (url.origin !== self.location.origin) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Статические ресурсы (JS, CSS, изображения) — Cache-first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // HTML-навигация — Network-first (чтобы SPA роутинг работал)
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Всё остальное — Network-first
  event.respondWith(networkFirst(request));
});

// Проверка — является ли URL статическим ресурсом
function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)(\?.*)?$/.test(pathname)
    || pathname.startsWith('/assets/');
}

// Стратегия: Cache-first (для статики)
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return new Response('Offline', { status: 503 });
  }
}

// Стратегия: Network-first (для API и навигации)
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;

    // Для навигации — вернуть кэшированный index.html
    if (request.mode === 'navigate') {
      const fallback = await caches.match('/');
      if (fallback) return fallback;
    }

    return new Response('Offline', { status: 503 });
  }
}

// Стратегия: Stale-while-revalidate (для внешних ресурсов)
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      const cache = caches.open(CACHE_NAME).then((c) => c.put(request, response.clone()));
    }
    return response;
  }).catch(() => cached);

  return cached || fetchPromise;
}
