export const dynamic = "force-dynamic";

function firebaseConfigScript() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  return JSON.stringify(config);
}

export function GET() {
  const body = `
importScripts("https://www.gstatic.com/firebasejs/12.14.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.14.0/firebase-messaging-compat.js");

firebase.initializeApp(${firebaseConfigScript()});

const messaging = firebase.messaging();

function notificationPayload(payload) {
  const data = payload.data || {};
  const notification = payload.notification || {};
  const title = notification.title || data.title || "TaPiYoTa Grand Boat Club";
  const body = notification.body || data.body || "新しい通知があります。";
  const relatedPath = data.relatedPath || "/home";
  const link = data.link || new URL(relatedPath, self.location.origin).toString();

  return { title, body, relatedPath, link, priority: data.priority || "normal" };
}

messaging.onBackgroundMessage((payload) => {
  const item = notificationPayload(payload);
  self.registration.showNotification(item.title, {
    body: item.body,
    icon: "/icons/tapoyota-icon-192.png",
    badge: "/icons/tapoyota-icon-192.png",
    tag: item.relatedPath,
    renotify: item.priority === "urgent",
    requireInteraction: item.priority === "urgent",
    data: { url: item.link },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || new URL("/home", self.location.origin).toString();

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
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
    })
  );
});
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
