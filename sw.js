/* Trice offline shell — after one online visit, the app loads with no signal. */
const CACHE = 'trice-shell-v4';
const CORE = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                      // never touch sync/analyze POSTs
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/')) return;          // live API only

  // App shell: newest when online, cached when offline
  if (req.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    e.respondWith(
      fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put('/index.html', copy)); return r; })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }
  // CDN libraries (map engine, spreadsheet engine): cache after first use so Map works offline
  if (url.hostname === 'cdnjs.cloudflare.com' || CORE.includes(url.pathname)) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return r; }))
    );
  }
  // Map tiles and everything else: network as usual
});
