// Pasmala Service Worker v4 - optimized for performance
const CACHE_NAME = "pasmala-v4";

// App shell - the core files that make the app work offline
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon.png"
];

// External CDN assets to cache after first load
const CDN_CACHE_NAME = "pasmala-cdn-v1";
const CDN_ORIGINS = [
  "unpkg.com",
  "cdn.sheetjs.com",
  "cdn.jsdelivr.net",
  "fonts.googleapis.com",
  "fonts.gstatic.com"
];

// ── Install: cache app shell immediately ──
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL).catch(err => console.warn("Cache addAll failed:", err)))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ──
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== CDN_CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: smart caching strategy ──
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  const isCDN = CDN_ORIGINS.some(o => url.hostname.includes(o));
  const isNavigate = event.request.mode === "navigate";
  const isAppShell = url.pathname === "/" || url.pathname === "/index.html" ||
                     url.pathname === "/manifest.json" || url.pathname === "/icon.png";

  // Strategy 1: Navigation requests → Network first, fallback to cache
  if (isNavigate) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return res;
        })
        .catch(() => 
          caches.match("/index.html").then(cached => cached || caches.match("/"))
        )
    );
    return;
  }

  // Strategy 2: App shell → Cache first (instant loading)
  if (isAppShell) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) {
          // Update cache in background
          fetch(event.request).then(res => {
            if (res.ok) caches.open(CACHE_NAME).then(c => c.put(event.request, res));
          }).catch(() => {});
          return cached;
        }
        return fetch(event.request);
      })
    );
    return;
  }

  // Strategy 3: CDN scripts → Cache first, then network (these never change for same URL)
  if (isCDN) {
    event.respondWith(
      caches.match(event.request, { cacheName: CDN_CACHE_NAME }).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CDN_CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return res;
        }).catch(() => new Response("", { status: 503 }));
      })
    );
    return;
  }

  // Strategy 4: Everything else → Network, fallback to cache
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});
