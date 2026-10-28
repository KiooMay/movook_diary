// Service worker: app shell offline + dados com "rede primeiro" + capas em cache.
// __BUILD__ é substituído em cada build, por isso cada deploy renova o cache da shell.
const VERSION = '__BUILD__';
const SHELL = `shell-${VERSION}`;
const COVERS = 'covers-v1';
const PRECACHE = ['./', './index.html', './manifest.webmanifest', './data.json',
  './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== COVERS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()));
});

async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req, { ignoreSearch: true });
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) (await caches.open(cacheName)).put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  try {
    const res = await fetch(req, { cache: 'no-cache', signal: AbortSignal.timeout(5000) });
    if (res.ok) (await caches.open(SHELL)).put(req, res.clone());
    return res;
  } catch {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    if (req.mode === 'navigate') return caches.match('./index.html');
    throw new Error('offline');
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // recursos externos: o browser trata
  if (url.pathname.includes('/covers/')) return e.respondWith(cacheFirst(req, COVERS));
  if (req.mode === 'navigate' || url.pathname.endsWith('/data.json')) return e.respondWith(networkFirst(req));
  e.respondWith(cacheFirst(req, SHELL));
});
