// sw.js — RITMOL service worker
// Strategy: network-first for navigation + same-origin assets.
// Cache is only used as an offline fallback, never as the primary response.
//
// CACHE_VERSION must be bumped on every deploy that changes JS/HTML/CSS.
// The build pipeline (vite.config.js or deploy.yml) should inject the
// value automatically; the fallback string here is overwritten at build time.
const CACHE_VERSION = self.__RITMOL_CACHE_VERSION__ || "v__BUILD_HASH__";
const CACHE_NAME = `ritmol-shell-${CACHE_VERSION}`;

// Assets that should be pre-cached on install for offline use.
// Keep this list small — only the minimal shell needed to show the app.
const PRECACHE_URLS = [
  "./",
  "./index.html",
];

// ── Install: pre-cache the minimal shell ─────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  // Take control immediately — don't wait for old SW clients to close.
  self.skipWaiting();
});

// ── Activate: delete all caches whose name doesn't match CACHE_NAME ──────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  // Claim all existing clients so they immediately use this SW version.
  self.clients.claim();
});

// ── Fetch: network-first, cache fallback ─────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests for same-origin URLs.
  // Pass through everything else (POST, external origins, chrome-extension://, etc.)
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // Successful network response — update the cache entry and return it.
        if (networkResponse.ok || networkResponse.type === "opaque") {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return networkResponse;
      })
      .catch(() =>
        // Network failed (offline) — try the cache.
        caches.match(request).then(
          (cached) =>
            cached ||
            // Nothing in cache either — return a minimal offline response
            // rather than a browser error page.
            new Response("Offline — open RITMOL when you have a connection.", {
              status: 503,
              headers: { "Content-Type": "text/plain" },
            })
        )
      )
  );
});
