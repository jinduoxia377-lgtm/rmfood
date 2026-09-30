/* RMFOOD minimal Service Worker (plain JS, valid syntax) */
const CACHE_VERSION = 'v5';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((k) => k.indexOf('rmfood') === 0)
      .map((k) => caches.delete(k)));
    return self.clients.claim();
  })());
});

/* No fetch handler: every request goes to the network. This guarantees the browser
   always fetches the latest chunks from nginx and never serves stale SW-cache bytes
   (nginx sets immutable cache on hashed asset URLs, so re-download only happens on new URL). */
