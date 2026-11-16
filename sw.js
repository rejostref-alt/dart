// Service worker: wszystkie pliki w pamięci telefonu, aplikacja działa bez internetu.
const CACHE = 'dart-v12';
const FILES = ['./', 'index.html', 'styles.css', 'i18n.js', 'caller.js', 'board.js', 'vision.js', 'games.js', 'qr.js', 'pair.js', 'app.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
// cache: 'reload' – zawsze świeże pliki z serwera, nie z pamięci przeglądarki (inaczej aktualizacja mogła zapisać stary app.js)
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
    const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res;
  }).catch(() => caches.match('index.html'))));
});
