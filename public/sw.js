/*
 * Finora service worker.
 *
 * Privacy rule: this worker never stores HTML pages, API responses, server
 * action results or anything from Supabase. Pages are rendered per user and
 * contain financial data, so they always come from the network. Only
 * fingerprinted build assets, icons and the static offline page are cached.
 *
 * Bump CACHE_VERSION when the precache list or caching rules change.
 */
const CACHE_VERSION = 'v1';
const STATIC_CACHE = `finora-static-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

const PRECACHE_URLS = [
  OFFLINE_URL,
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('finora-') && key !== STATIC_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isCacheableAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/brand/')
  );
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok && response.type === 'basic') {
    cache.put(request, response.clone());
  }
  return response;
}

async function networkWithOfflineFallback(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(STATIC_CACHE);
    const offline = await cache.match(OFFLINE_URL);
    return offline || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Mutations (server actions, form posts) and other methods are never touched.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Supabase, FX providers and any other origin go straight to the network.
  if (url.origin !== self.location.origin) return;

  // Page navigations: always network, static offline page only when it fails.
  if (request.mode === 'navigate') {
    event.respondWith(networkWithOfflineFallback(request));
    return;
  }

  // Fingerprinted build output and brand images are safe to cache.
  if (isCacheableAsset(url)) {
    event.respondWith(cacheFirst(request));
  }

  // Everything else (API routes, RSC payloads, auth callbacks) is left to the browser.
});
