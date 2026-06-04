const CACHE_NAME = "tapiyota-grand-boat-club-v3";
const CORE_ASSETS = [
  "/",
  "/login",
  "/home",
  "/boats",
  "/members",
  "/reservations",
  "/checks/pre-departure",
  "/checks/post-return",
  "/handovers",
  "/support",
  "/voyages",
  "/notifications",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.all(
          CORE_ASSETS.map((asset) =>
            fetch(asset)
              .then((response) => {
                if (response.ok) return cache.put(asset, response);
                return undefined;
              })
              .catch(() => undefined),
          ),
        ),
      ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  if (event.request.url.includes("/_next/")) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/home"))),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached ||
      fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      }),
    ),
  );
});

self.addEventListener("push", (event) => {
  const fallback = {
    title: "TaPiYoTa Grand Boat Club",
    body: "新しい通知があります。",
    relatedPath: "/home",
  };
  let payload = fallback;

  try {
    payload = event.data ? event.data.json() : fallback;
  } catch {
    payload = fallback;
  }

  const notification = payload.notification || {};
  const data = payload.data || payload;
  const title = notification.title || data.title || fallback.title;
  const body = notification.body || data.body || fallback.body;
  const relatedPath = data.relatedPath || data.link || fallback.relatedPath;
  const url = data.link || new URL(relatedPath, self.location.origin).toString();

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/tapoyota-icon-192.png",
      badge: "/icons/tapoyota-icon-192.png",
      tag: relatedPath,
      renotify: data.priority === "urgent",
      requireInteraction: data.priority === "urgent",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || new URL("/home", self.location.origin).toString();

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const target = new URL(url);
        const existing = clients.find((client) => {
          const current = new URL(client.url);
          return current.origin === target.origin;
        });

        if (existing) {
          existing.navigate(url);
          return existing.focus();
        }

        return self.clients.openWindow(url);
      }),
  );
});
