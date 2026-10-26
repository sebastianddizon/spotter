/* Spotter service worker: app opens instantly and offline; food data is cached as it is used. */
const VER = 'spotter-v21';
const SHELL = ['./', './index.html', './config.js', './manifest.json', './icons/icon-192.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VER).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VER && k !== 'spotter-food').map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;   // API calls and fonts go straight to the network
  if (u.pathname.includes('/food/') && !/\/food\/(menus\/|r(meta|i|t|u)[\/.])/.test(u.pathname)) {
    // food database files never change within a release: cache first
    e.respondWith(caches.open('spotter-food').then(async c => (await c.match(e.request)) || fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; })));
    return;
  }
  // app shell: network first so updates land, cache when offline
  e.respondWith(fetch(e.request).then(r => { if (r.ok) caches.open(VER).then(c => c.put(e.request, r.clone())); return r; }).catch(() => caches.match(e.request).then(m => m || caches.match('./index.html'))));
});
