/* CashFlow Service Worker v3.0 */
'use strict';

const CACHE_VER  = 'cf-v3.0.0';
const CACHE_FONT = 'cf-fonts-v1';
const BASE       = '/CashFlow';

const SHELL = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/manifest.json',
  BASE + '/assets/css/tokens.css',
  BASE + '/assets/css/base.css',
  BASE + '/assets/css/nav.css',
  BASE + '/assets/css/components.css',
  BASE + '/assets/js/store.js',
  BASE + '/assets/js/ui.js',
  BASE + '/assets/js/app.js',
  BASE + '/assets/icons/icon.svg',
  BASE + '/assets/icons/icon-192.png',
  BASE + '/assets/icons/icon-512.png',
];

/* ── Install ── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VER)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] precache partial fail', err))
  );
});

/* ── Activate ── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VER && k !== CACHE_FONT).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── Fetch ── */
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // Fonts → stale-while-revalidate
  if (url.hostname.includes('fonts.g')) {
    e.respondWith(staleWhileRevalidate(req, CACHE_FONT));
    return;
  }

  // App shell → cache-first, fallback network, fallback offline page
  e.respondWith(cacheFirst(req));
});

async function cacheFirst(req) {
  const cached = await caches.match(req, { ignoreSearch: false });
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok && res.type !== 'opaque') {
      const cache = await caches.open(CACHE_VER);
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    if (req.mode === 'navigate') {
      const fallback = await caches.match(BASE + '/') || await caches.match(BASE + '/index.html');
      if (fallback) return fallback;
    }
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req).then(res => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  return cached || fetchPromise;
}

/* ── Messages ── */
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data?.type === 'GET_VERSION') {
    e.ports[0]?.postMessage({ version: CACHE_VER });
  }
});
