// Service worker d'Ali : réseau d'abord, cache en secours (jamais pour /api).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).pathname.startsWith('/api/')) return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open('ali').then(k => k.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
