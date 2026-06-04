"use client";

import { firebaseApp, firebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import type {
  AppData,
  NotificationCategory,
  NotificationPriority,
  NotificationToken,
} from "@/types/domain";

const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
let foregroundUnsubscribe: (() => void) | undefined;

function tokenDocumentId(userId: string, token: string) {
  return `token-${userId}-${token.slice(-28).replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

function deviceLabel() {
  if (typeof navigator === "undefined") return "Web browser";
  const platform = navigator.platform || "Web";
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches
    ? "PWA"
    : "Browser";

  return `${platform} ${standalone}`;
}

export function canUseWebPush() {
  return (
    typeof window !== "undefined" &&
    isFirebaseConfigured &&
    Boolean(firebaseApp) &&
    Boolean(vapidKey) &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

async function registerMessagingServiceWorker() {
  return navigator.serviceWorker.register("/firebase-messaging-sw", {
    scope: "/firebase-cloud-messaging-push-scope",
  });
}

export async function registerFcmToken(data: AppData) {
  if (!canUseWebPush() || !firebaseApp || !vapidKey) {
    throw new Error("FCMのWeb Push設定が不足しています。");
  }

  const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
  const supported = await isSupported();
  if (!supported) {
    throw new Error("このブラウザはFirebase Cloud Messagingに対応していません。");
  }

  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error("ブラウザ通知が許可されていません。");
  }

  const registration = await registerMessagingServiceWorker();

  const token = await getToken(getMessaging(firebaseApp), {
    vapidKey,
    serviceWorkerRegistration: registration,
  });

  if (!token) {
    throw new Error("FCMトークンを取得できませんでした。");
  }

  const now = new Date().toISOString();
  const existing = data.notificationTokens.find((item) => item.token === token);
  const notificationToken: NotificationToken = {
    id: existing?.id ?? tokenDocumentId(data.currentUser.id, token),
    organizationId: data.organization.id,
    userId: data.currentUser.id,
    token,
    platform: "web",
    userAgent: navigator.userAgent,
    deviceLabel: deviceLabel(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    lastSeenAt: now,
  };

  return notificationToken;
}

export async function startForegroundPushListener() {
  if (!canUseWebPush() || !firebaseApp) return;
  if (foregroundUnsubscribe) return;

  const { getMessaging, isSupported, onMessage } = await import("firebase/messaging");
  const supported = await isSupported();
  if (!supported) return;

  foregroundUnsubscribe = onMessage(getMessaging(firebaseApp), (payload) => {
    const data = payload.data ?? {};
    const notification = payload.notification ?? {};
    const title = notification.title ?? data.title ?? "TaPiYoTa Grand Boat Club";
    const body = notification.body ?? data.body ?? "新しい通知があります。";
    const link = data.link ?? data.relatedPath ?? "/home";

    if (Notification.permission === "granted") {
      const browserNotification = new Notification(title, {
        body,
        icon: "/icons/tapoyota-icon-192.png",
        badge: "/icons/tapoyota-icon-192.png",
        tag: data.relatedPath,
        requireInteraction: data.priority === "urgent",
      });

      browserNotification.onclick = () => {
        window.focus();
        window.location.href = link;
        browserNotification.close();
      };
    }
  });
}

export async function sendPushNotification(input: {
  organizationId: string;
  title: string;
  body: string;
  relatedPath: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  recipientUserIds?: string[];
  excludeUserId?: string;
}) {
  if (!firebaseAuth?.currentUser) {
    return { ok: false, error: "not_signed_in" };
  }

  try {
    const idToken = await firebaseAuth.currentUser.getIdToken();
    const response = await fetch("/api/notifications/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(input),
    });
    const result = await response.json().catch(() => undefined);
    if (!response.ok || result?.ok === false || result?.sent === 0) {
      console.warn("Push notification was not delivered", {
        status: response.status,
        result,
        input,
      });
    }
    return result ?? { ok: response.ok };
  } catch (error) {
    console.warn("Failed to send push notification", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "unknown_error",
    };
  }
}
