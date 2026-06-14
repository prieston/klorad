/* eslint-disable no-restricted-globals */
/**
 * Klorad Mobility — per-world service worker.
 *
 * One file backs every world; each `/w/<slug>/` registers it with its
 * own scope, so each world ends up with a distinct registration record
 * + a distinct push subscription (PR3). The cache namespace is keyed
 * off `self.registration.scope` so two worlds installed on the same
 * device don't collide.
 *
 * Responsibilities:
 *
 * 1. **PWA caching** — installs an offline shell on first visit, then
 *    services fetches:
 *      - `/_next/static/...`           — cache-first, immutable
 *      - `/api/public/worlds/<slug>`   — stale-while-revalidate
 *      - `/w/<slug>` navigations       — network-first → cache → shell
 *      - everything else               — passthrough
 *
 * 2. **Push notifications** — PR3 will plug in `push` + `notificationclick`
 *    handlers against a per-world subscription pool.
 *
 * Cache key versioning: bump `CACHE_VERSION` on any breaking change to
 * the strategies below. `activate` sweeps caches that don't start with
 * the current version prefix.
 */

const CACHE_VERSION = "v1";

/** `/w/foo/` → "foo". Bare scope (`/`) falls back to "default". */
function slugFromScope() {
  try {
    const url = new URL(self.registration.scope);
    const match = url.pathname.match(/^\/w\/([^/]+)\/?$/);
    return match ? match[1] : "default";
  } catch {
    return "default";
  }
}

const WORLD_SLUG = slugFromScope();
const CACHE_STATIC = `klorad-world-${WORLD_SLUG}-${CACHE_VERSION}-static`;
const CACHE_PAGES = `klorad-world-${WORLD_SLUG}-${CACHE_VERSION}-pages`;
const CACHE_DATA = `klorad-world-${WORLD_SLUG}-${CACHE_VERSION}-data`;

/** Routes worth precaching so the first offline visit isn't blank. */
const PRECACHE = [`/w/${WORLD_SLUG}`];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_PAGES);
      // Pre-warm the world's start URL. If the network is down at
      // install (unlikely — the SW only installs after a successful
      // page load) we'll just no-op.
      try {
        await cache.addAll(PRECACHE);
      } catch {
        /* network blip — runtime cache picks this up */
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const prefix = `klorad-world-${WORLD_SLUG}-${CACHE_VERSION}-`;
      await Promise.all(
        keys
          .filter((k) => k.startsWith(`klorad-world-${WORLD_SLUG}-`) && !k.startsWith(prefix))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

/** Cache-first: serve cached if present, otherwise fetch + cache. */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

/** Stale-while-revalidate: serve cache immediately if present and
 *  refresh in the background; otherwise fall back to the network. */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await networkPromise) || new Response(null, { status: 504 });
}

/** Network-first: try network, fall back to cache, then to the world's
 *  shell so offline visits still see a Klorad surface. */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const shell = await cache.match(`/w/${WORLD_SLUG}`);
    if (shell) return shell;
    return new Response("Offline", { status: 503 });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, CACHE_STATIC));
    return;
  }
  if (url.pathname === `/api/public/worlds/${WORLD_SLUG}`) {
    event.respondWith(staleWhileRevalidate(request, CACHE_DATA));
    return;
  }
  // Only intercept navigations inside the world's scope — anything
  // else (e.g. the manifest) goes through the regular network path so
  // we don't accidentally cache stale auth/world metadata.
  if (
    request.mode === "navigate" &&
    url.pathname.startsWith(`/w/${WORLD_SLUG}`)
  ) {
    event.respondWith(networkFirst(request, CACHE_PAGES));
  }
});

/* ───────────────────── Push notifications ─────────────────────── */

/**
 * Per-world push handler. Server posts a JSON payload
 *   { title, body, url?, icon?, tag? }
 * The SW renders it as a single notification. `tag` collapses repeats
 * (e.g. recurring "still offline" alerts won't stack).
 */
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Klorad Mobility", body: event.data.text() };
  }
  const title = payload.title || "Klorad Mobility";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/klorad-favicon.png",
    badge: "/klorad-favicon.png",
    tag: payload.tag || `world-${WORLD_SLUG}`,
    data: {
      url: payload.url || `/w/${WORLD_SLUG}`,
    },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

/**
 * Click handler — focus an already-open tab on the world if one
 * exists; otherwise open a new one at the payload's URL. Per
 * notification-click spec the URL must be same-origin for the focus
 * branch to work, so we resolve to an absolute origin URL first.
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || `/w/${WORLD_SLUG}`;
  const absolute = new URL(target, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of all) {
        try {
          const u = new URL(client.url);
          if (u.pathname.startsWith(`/w/${WORLD_SLUG}`)) {
            await client.focus();
            if ("navigate" in client) {
              try {
                await client.navigate(absolute);
              } catch {
                /* cross-origin / restricted; focus is enough */
              }
            }
            return;
          }
        } catch {
          /* malformed client url; skip */
        }
      }
      await self.clients.openWindow(absolute);
    })(),
  );
});
