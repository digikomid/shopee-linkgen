// Prefer the current app shell online; keep just the known static assets offline.
const CACHE = 'shopee-linkgen-v2';
const ASSETS = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(path => new Request(path, {cache: 'reload'})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('shopee-linkgen-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== location.origin) return;
  if (request.mode === 'navigate' && ['/', '/app.html', '/index.html'].includes(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request);
        if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
          await cache.put('/', response.clone()).catch(() => {});
        }
        if (response.status < 500) return response;
      } catch {}
      return await cache.match('/') || Response.error();
    })());
  } else if (ASSETS.includes(url.pathname) && url.pathname !== '/') {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(url.pathname)).then(response => response || fetch(request)));
  }
});
