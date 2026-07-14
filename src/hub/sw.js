'use strict';

// Bump this on every shell change (app.js / hub.css / index.html) or installed PWAs keep
// serving the cached old assets. v2: de-branded HUB + brand logo/colors + merchant logos.
const CACHE_NAME = 'hub-v2';
const SHELL_ASSETS = ['./', './index.html', './app.js', './hub.css', './manifest.json', './icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.method !== 'GET') return;

  const isShell = SHELL_ASSETS.some((asset) => {
    const path = url.pathname.endsWith('/') ? url.pathname : url.pathname.replace(/\/[^/]+$/, '/');
    return url.pathname.endsWith(asset.replace('./', '')) || url.pathname.endsWith('/hub/' + asset.replace('./', ''));
  }) || url.pathname.endsWith('/hub') || url.pathname.endsWith('/hub/');

  if (isShell) {
    event.respondWith(
      caches.match(event.request).then((cached) =>
        cached || fetch(event.request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return res;
        })
      )
    );
    return;
  }

  if (url.pathname.includes('/api/v1/hub/bootstrap')) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            res.clone().json().then((data) => {
              if (data && data.merchants) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put('hub-merchants-offline', new Response(JSON.stringify(data.merchants), {
                    headers: { 'Content-Type': 'application/json' }
                  }));
                });
              }
            }).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches.match('hub-merchants-offline').then((cached) =>
            cached || new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } })
          )
        )
    );
  }
});
