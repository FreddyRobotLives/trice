/* Trice offline shell — after one online visit, the app loads with no signal.
   Navigation strategy: race the network against a 3.5s timer. Fresh signal wins
   and the user always gets the newest deploy on refresh. Dead or crawling signal
   loses the race and the cached shell paints instead — and the network fetch is
   NOT aborted: when it eventually lands, the new build is cached and the in-page
   build watchdog (the single reload authority) swaps it in at a safe moment. */
const CACHE = 'trice-shell-v87';
const CORE = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/vendor/leaflet.min.js', '/vendor/leaflet.min.css', '/vendor/xlsx.full.min.js', '/vendor/exceljs.min.js', '/vendor/InterVariable.woff2'];
const NAV_TIMEOUT = 3500;

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

  // App shell
  if (req.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    const net = fetch(new Request(req, { cache: 'no-cache' }))
      .then((r) => {
        // Cache only a real page — never a 4xx/5xx or an opaque error body.
        if (r && r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put('/index.html', copy)); }
        return r;
      });
    const timer = new Promise((res) => setTimeout(() => res('timeout'), NAV_TIMEOUT));
    e.respondWith(
      Promise.race([net.catch(() => 'down'), timer]).then((winner) => {
        if (winner && winner !== 'timeout' && winner !== 'down' && winner.ok) return winner;
        // Slow or down: paint the cached shell now. The un-aborted network fetch
        // above still completes in the background and refreshes the cache.
        return caches.match('/index.html').then((hit) => hit || (winner && winner !== 'timeout' && winner !== 'down' ? winner : net));
      })
    );
    return;
  }
  // Vendored engines (map, spreadsheets): cache-first so Map and exports work offline
  if (url.pathname.startsWith('/vendor/') || CORE.includes(url.pathname)) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((r) => { if (r && r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return r; }))
    );
  }
  // Map tiles and everything else: network as usual
});
