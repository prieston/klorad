/* eslint-disable no-restricted-globals */
/**
 * Campus service worker — web-push delivery + PWA offline shell.
 *
 * Two responsibilities:
 *
 * 1. **Push notifications** (original responsibility): receives push
 *    events, surfaces them, focuses or opens the right tab on click.
 *
 * 2. **PWA caching** (added with the PWA shell arc): caches the
 *    offline fallback at install, then services fetches with
 *    strategies tuned per route family:
 *
 *      - `/_next/static/...`            — cache-first, immutable
 *      - `/api/campus/.../{news,...}`   — stale-while-revalidate
 *      - `/campus/*` navigations        — network-first, fall back
 *                                          to cache, then to the
 *                                          `/offline` shell
 *      - everything else                — passthrough
 *
 * Registered once from `ServiceWorkerRegistrar` mounted in the
 * campus public layout, so it's installed on the visitor's first
 * page view (no `Get notifications` tap required).
 *
 * Cache key versioning: bump `CACHE_VERSION` on any breaking change
 * to the strategies below. `activate` sweeps caches whose names
 * don't start with the current version prefix.
 */

// v2: notificationclick now reports back to /api/broadcasts/click,
// which requires fresh `broadcastId` + `clickToken` data on each
// shown notification. Older SW instances would silently drop the
// open-count beacon; bumping the version forces a re-activation.
const CACHE_VERSION = "v2";
const CACHE_STATIC = `klorad-campus-${CACHE_VERSION}-static`;
const CACHE_PAGES = `klorad-campus-${CACHE_VERSION}-pages`;
const CACHE_DATA = `klorad-campus-${CACHE_VERSION}-data`;
const OFFLINE_URL = "/offline";

// Pages worth precaching so the very first offline visit has
// *something* to show. The offline shell is mandatory; everything
// else is best-effort (a single failed fetch must not abort install).
const PRECACHE_URLS = [OFFLINE_URL];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_PAGES);
      await Promise.all(
        PRECACHE_URLS.map((url) =>
          cache
            .add(new Request(url, { cache: "reload" }))
            .catch(() => undefined),
        ),
      );
      // Take control immediately so the first notification doesn't
      // wait for a reload (kept from the original push-only SW).
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const prefix = `klorad-campus-${CACHE_VERSION}-`;
      await Promise.all(
        keys
          .filter((k) => k.startsWith("klorad-campus-") && !k.startsWith(prefix))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

/**
 * Cache-first: serve from cache when present, otherwise fetch, cache
 * the response, and return it. Used for immutable hashed assets.
 */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

/**
 * Stale-while-revalidate: return the cached copy immediately (if
 * any), kick off a background fetch to refresh the cache. Used for
 * the SWR API JSON endpoints — the browser's own SWR keeps the UI
 * fresh; we just shave another round-trip off cold visits.
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

/**
 * Network-first for navigations: try the network, cache the success,
 * fall back to a cached copy, fall back to the offline shell. The
 * shell renders something useful (campus branding + "you're offline"
 * copy) instead of the browser's default offline page.
 */
async function networkFirstPage(request) {
  const cache = await caches.open(CACHE_PAGES);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;
    return Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Same-origin only — we never want to intercept third-party
  // requests (DO Spaces uploads, MappedIn tiles, fonts CDN, …).
  if (url.origin !== self.location.origin) return;

  // Hashed Next assets — content-addressed, safe to cache forever.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, CACHE_STATIC));
    return;
  }

  // Public consumer API: news / events / clubs / dining JSON.
  if (/^\/api\/campus\/[^/]+\/(news|events|clubs|dining)/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, CACHE_DATA));
    return;
  }

  // Navigation requests (full document loads) inside the consumer
  // surface. Anything else is left to the network — we don't want
  // to silently cache admin API calls, auth round-trips, etc.
  if (
    request.mode === "navigate" &&
    (url.pathname === "/offline" || url.pathname.startsWith("/campus/"))
  ) {
    event.respondWith(networkFirstPage(request));
    return;
  }
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch (err) {
    payload = { title: "Campus update", body: event.data.text() };
  }
  const title = payload.title || "Campus update";
  // `broadcastId` + `clickToken` ride through to the notificationclick
  // handler so we can post the open back to the counter endpoint
  // without re-querying the server.
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/favicon.ico",
    badge: payload.icon || "/favicon.ico",
    data: {
      url: payload.url || "/",
      broadcastId: payload.broadcastId,
      clickToken: payload.clickToken,
    },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

/**
 * Fire-and-forget POST to the open-count endpoint. `sendBeacon` is
 * the right tool — the SW thread may terminate before a `fetch`
 * promise resolves, but the browser keeps a beacon's body in flight
 * across that termination.
 *
 * Falls back to `fetch` with `keepalive: true` when sendBeacon
 * doesn't exist (rare in 2026; cheap to keep).
 */
function reportOpen(data) {
  if (!data || !data.broadcastId || !data.clickToken) return;
  const body = JSON.stringify({
    id: data.broadcastId,
    token: data.clickToken,
  });
  try {
    if (self.navigator && self.navigator.sendBeacon) {
      self.navigator.sendBeacon(
        "/api/broadcasts/click",
        new Blob([body], { type: "application/json" }),
      );
      return;
    }
  } catch {
    // sendBeacon can throw on some browsers when offline — fall
    // through to the fetch path.
  }
  try {
    fetch("/api/broadcasts/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    // Best-effort.
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  reportOpen(event.notification.data);
  const target =
    (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientsArr) => {
        // Focus an open tab on the target if one exists.
        for (const client of clientsArr) {
          if (client.url.includes(target) && "focus" in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      }),
  );
});
