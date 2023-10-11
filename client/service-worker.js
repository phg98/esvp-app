// service-worker.js
self.addEventListener('install', (event) => {
  event.waitUntil(
      caches.open('esvp-cache-v1').then((cache) => {
          return cache.addAll([
              '/',
              '/index.html'
              // 기타 캐싱하고 싶은 리소스를 여기에 추가
          ]);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
      fetch(event.request).then((response) => {
          // 네트워크 요청이 성공하면 캐시를 업데이트하고 응답을 반환
          const responseClone = response.clone();
          caches.open('esvp-cache-v1').then((cache) => {
              cache.put(event.request, responseClone);
          });
          return response;
      }).catch(() => {
          // 네트워크 요청이 실패하면 캐시에서 응답을 반환
          return caches.match(event.request);
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = ['esvp-cache-v1'];
  event.waitUntil(
      caches.keys().then((cacheNames) => {
          return Promise.all(
              cacheNames.map((cacheName) => {
                  if (cacheWhitelist.indexOf(cacheName) === -1) {
                      return caches.delete(cacheName);
                  }
              })
          );
      })
  );
});
