/* Trice offline shell — after one online visit, the app loads with no signal.
   Navigation strategy: race the network against a 3.5s timer. Fresh signal wins
   and the user always gets the newest deploy on refresh. Dead or crawling signal
   loses the race and the cached shell paints instead — and the network fetch is
   NOT aborted: when it eventually lands, the new build is cached and the in-page
   build watchdog (the single reload authority) swaps it in at a safe moment. */
const CACHE = 'trice-shell-v116';
const CORE = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/vendor/leaflet.min.js', '/vendor/leaflet.min.css', '/vendor/xlsx.full.min.js', '/vendor/exceljs.min.js', '/vendor/InterVariable.woff2'];
const NAV_TIMEOUT = 3500;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => {
        const upgrade = ks.some((k) => k !== CACHE && /^trice-shell-/.test(k));
        return Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))).then(() => upgrade);
      })
      .then((upgrade) => self.clients.claim().then(() => upgrade))
      .then((upgrade) => {
        if (!upgrade) return;   // first registration on this device: nothing to displace
        /* One-shot per deploy: this activate runs exactly once per new worker.
           Every window this worker now controls is running whatever build it
           loaded with — possibly months old. Reload each once through this
           worker's network-race so the live build takes over everywhere,
           including home-screen PWAs that never see a refresh button. The 3.5s
           delay lets the navigation that triggered the update finish painting;
           pages already on the rescue path are left alone. */
        /* Handshake first: pages new enough to listen reply with an ack and
           reload themselves at a polite moment (never mid-password). Pages too
           old to know the protocol stay silent — they are exactly the ones that
           need force, so after 1.5s the worker navigates the non-responders. */
        /* Share-link windows are never taken over. A client reading the map, or a
           sub working an order, is a public page that already pulls live data on
           its own — and it deliberately boots early, so it never registers the
           handshake listener. Without this it looks "silent", gets force
           navigated, and reloads under the person a few seconds in. */
        const SKIP = /[?&](fresh|mv|wo)=/;
        setTimeout(() => {
          self.clients.matchAll({ type: 'window' }).then((cs) => {
            cs.forEach((c) => { try { if (!SKIP.test(c.url)) c.postMessage({ t: 'trice-takeover' }); } catch (e2) {} });
            setTimeout(() => {
              self.clients.matchAll({ type: 'window' }).then((cs2) => {
                cs2.forEach((c) => {
                  try { if (!ACKED.has(c.id) && !SKIP.test(c.url) && c.navigate) c.navigate(c.url); } catch (e2) {}
                });
              });
            }, 1500);
          });
        }, 3500);
      })
  );
});
const ACKED = new Set();
self.addEventListener('message', (e) => {
  if (e.data && e.data.t === 'trice-ack' && e.source) ACKED.add(e.source.id);
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                      // never touch sync/analyze POSTs
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/')) return;          // live API only
  if (url.pathname === '/fresh' || url.pathname === '/fresh.html') return; // rescue page: always straight from the network
  if (url.pathname === '/version.txt') return;           // build beacon: always live

  // App shell
  if (req.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    const net = fetch(new Request(req, { cache: 'no-cache' }))
      .then((r) => {
        /* Cache only a real page — never a 4xx/5xx or an opaque error body, and
           never a share link. Map and work-order links are served with their own
           preview tags and titles; storing one under the shared shell key would
           hand those tags to the whole app on the next offline load. */
        const shareLink = url.searchParams.has('mv') || url.searchParams.has('wo');
        if (r && r.ok && !shareLink) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put('/index.html', copy)); }
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
