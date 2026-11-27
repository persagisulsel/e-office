// Service worker: simpan aset statis agar aplikasi cepat dibuka. Data selalu diambil dari server.
const CACHE = 'portal-persagi-v2';
const ASET = ['./', 'index.html', 'style.css?v=2', 'surat.css?v=2', 'config.js?v=2', 'app.js?v=2', 'vendor/qrcode.js',
  'assets/kop.png', 'assets/footer.png', 'assets/logo.png', 'assets/icon-192.png',
  'assets/fonts/caladea-latin-400-normal.woff2', 'assets/fonts/caladea-latin-700-normal.woff2',
  'assets/fonts/arimo-latin-400-normal.woff2', 'assets/fonts/arimo-latin-700-normal.woff2'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASET)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // Jaringan dulu (agar pembaruan langsung terasa), cadangan dari cache bila offline.
  e.respondWith(fetch(e.request).then(r => { const k = r.clone(); caches.open(CACHE).then(c => c.put(e.request, k)); return r; }).catch(() => caches.match(e.request)));
});
