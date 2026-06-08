const CACHE_NAME = "tapiyota-grand-boat-club-v5";
const CORE_ASSETS = [
  "/login",
  "/manifest.webmanifest",
  "/tapiyota_icon.jpg",
  "/icons/tapoyota-icon-192.png",
  "/icons/tapoyota-icon-512.png",
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

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (event.request.url.includes("/_next/")) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .catch(() =>
          new Response(
            `<!doctype html>
            <html lang="ja">
              <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>TaPiYoTa Grand Boat Club</title>
                <style>
                  body { margin: 0; font-family: system-ui, sans-serif; background: #f8fafc; color: #172554; }
                  main { min-height: 100vh; display: grid; place-items: center; padding: 24px; text-align: center; }
                  img { width: 72px; height: 72px; border-radius: 18px; }
                  p { color: #475569; line-height: 1.7; }
                </style>
              </head>
              <body>
                <main>
                  <div>
                    <img src="/tapiyota_icon.jpg" alt="" />
                    <h1>オフラインです</h1>
                    <p>通信が戻ったら再読み込みしてください。保存済みの操作はオンライン復帰後に同期します。</p>
                  </div>
                </main>
              </body>
            </html>`,
            { headers: { "Content-Type": "text/html; charset=utf-8" } },
          ),
        ),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request)),
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
