// Service worker Пиксель-Фермы.
// Файлы приложения: «сначала сеть, потом кэш» — обновление приходит сразу, офлайн тоже работает.
// Шрифты Google: «сначала кэш». Прогресс (localStorage) service worker не видит и не трогает.
const BUILD = '__BUILD__';
const CACHE = 'pixelfarm-app-' + BUILD;
const FONTS = 'pixelfarm-fonts';
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => (k.startsWith('pixelfarm-app-') && k !== CACHE) || k === 'pixelfarm-audio').map(k => caches.delete(k)))) // pixelfarm-audio: кэш бывших записей озвучки
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    // no-cache: браузер всё равно сверится с сервером, а не возьмёт старую копию из HTTP-кэша
    e.respondWith(fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })
        .then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }))));
  }
});
