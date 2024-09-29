const CACHE_NAME = 'clash-scan-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/scannerWorker.js',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return Promise.all(
          urlsToCache.map(url => {
            return cache.add(url).catch(error => {
              console.error(`Failed to cache ${url}:`, error);
            });
          })
        );
      })
      .catch(error => {
        console.error('Failed to open cache:', error);
      })
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 检查是否为 127.0.0.1 且端口不是 80 或 443
  if (url.hostname === '127.0.0.1' && url.port !== '80' && url.port !== '443') {
    return; // 不缓存这些请求
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});