/* Talhacade service worker — hand-rolled, dependency-free.
 *
 * The whole site is static, so offline support is straightforward:
 *  - navigations  → network first, cache fallback (fresh when online,
 *                   playable when not; "/" is precached as the offline shell)
 *  - /_next/static (content-hashed, immutable) → cache first
 *  - everything else (manifest, icon, images) → cache then revalidate
 *
 * All cache URLs are relative, so the worker works both at the domain root
 * and under the GitHub Pages /talhacade/ subpath.
 */
const VERSION = "talhacade-v1";
const PRECACHE = ["./", "./games/", "./scorecard/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("talhacade-") && key !== VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // App-shell pages: always prefer the network so deploys show up instantly.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches
            .open(VERSION)
            .then((cache) => cache.put(request, copy))
            .catch(() => undefined);
          return response;
        })
        .catch(() =>
          caches
            .match(request, { ignoreSearch: true })
            .then((hit) => hit || caches.match("./"))
        )
    );
    return;
  }

  // Hashed build assets are immutable: serve from cache when possible.
  if (url.pathname.includes("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((hit) => {
        if (hit) return hit;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches
              .open(VERSION)
              .then((cache) => cache.put(request, copy))
              .catch(() => undefined);
          }
          return response;
        });
      })
    );
    return;
  }

  // Small static files: answer from cache, refresh in the background.
  event.respondWith(
    caches.match(request).then((hit) => {
      const refresh = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches
              .open(VERSION)
              .then((cache) => cache.put(request, copy))
              .catch(() => undefined);
          }
          return response;
        })
        .catch(() => hit);
      return hit || refresh;
    })
  );
});
