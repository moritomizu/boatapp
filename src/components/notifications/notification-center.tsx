"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bell, BellRing, CheckCircle2, HelpCircle, Radio, Waves, X } from "lucide-react";
import { Badge, Card, Section } from "@/components/ui";
import { updateClientAppData, useClientAppData } from "@/lib/client-store";
import {
  canUseWebPush,
  registerFcmToken,
  sendPushNotification,
} from "@/lib/push-notifications";
import {
  notificationCategoryLabels,
  notificationPriorityLabels,
  notificationPriorityTone,
} from "@/lib/labels";
import type { AppData, NotificationChannel, NotificationPreference } from "@/types/domain";

const defaultPreference = (userId: string): NotificationPreference => ({
  userId,
  channels: ["in_app"],
  weatherAlerts: true,
  reservationReminders: true,
  checkReminders: true,
  handoverAlerts: true,
  supportAlerts: true,
});

const notificationSettingItems: {
  label: string;
  key: keyof Pick<
    NotificationPreference,
    | "weatherAlerts"
    | "reservationReminders"
    | "checkReminders"
    | "handoverAlerts"
    | "supportAlerts"
  >;
}[] = [
  { label: "天候/海況アラート", key: "weatherAlerts" },
  { label: "予約リマインド", key: "reservationReminders" },
  { label: "出船前/帰港後チェック", key: "checkReminders" },
  { label: "重要申し送り", key: "handoverAlerts" },
  { label: "サポート要請", key: "supportAlerts" },
];

export function NotificationCenter({ data }: { data: AppData }) {
  const appData = useClientAppData(data);
  const [permission, setPermission] = useState(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported",
  );
  const [settingsState, setSettingsState] = useState<"idle" | "saving" | "error">(
    "idle",
  );
  const [pushState, setPushState] = useState<
    "idle" | "saving" | "saved" | "error" | "unsupported"
  >("idle");
  const [pushMessage, setPushMessage] = useState("");
  const [testState, setTestState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [testMessage, setTestMessage] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const preference =
    appData.notificationPreferences.find(
      (item) => item.userId === appData.currentUser.id,
    ) ?? defaultPreference(appData.currentUser.id);
  const pushEnabled =
    permission === "granted" && preference.channels.includes("push");
  const notifications = appData.notifications.filter(
    (notification) =>
      !notification.recipientUserIds ||
      notification.recipientUserIds.includes(appData.currentUser.id),
  );
  const unreadNotifications = notifications.filter(
    (notification) => !notification.readBy.includes(appData.currentUser.id),
  );
  const urgentNotifications = unreadNotifications.filter(
    (notification) => notification.priority === "urgent",
  );
  const sortedNotifications = useMemo(
    () =>
      [...notifications].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [notifications],
  );

  async function requestNotificationPermission() {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      setPushState("unsupported");
      return;
    }

    if (!canUseWebPush()) {
      setPushState("unsupported");
      setPushMessage(
        "FCMのWeb Push設定が不足しています。VAPIDキーとFirebase設定を確認してください。",
      );
      return;
    }

    setPushState("saving");

    try {
      const token = await registerFcmToken(appData);
      await updateClientAppData(
        (current) => {
          const exists = current.notificationTokens.some(
            (item) => item.id === token.id,
          );
          const currentPreference =
            current.notificationPreferences.find(
              (item) => item.userId === appData.currentUser.id,
            ) ?? defaultPreference(appData.currentUser.id);
          const nextPreference = {
            ...currentPreference,
            channels: Array.from(
              new Set<NotificationChannel>([
                ...currentPreference.channels,
                "push",
              ]),
            ),
          };
          const preferenceExists = current.notificationPreferences.some(
            (item) => item.userId === nextPreference.userId,
          );

          return {
            ...current,
            notificationTokens: exists
              ? current.notificationTokens.map((item) =>
                  item.id === token.id ? token : item,
                )
              : [token, ...current.notificationTokens],
            notificationPreferences: preferenceExists
              ? current.notificationPreferences.map((item) =>
                  item.userId === nextPreference.userId ? nextPreference : item,
                )
              : [...current.notificationPreferences, nextPreference],
          };
        },
        appData,
      );
      setPermission(Notification.permission);
      setPushState("saved");
      setPushMessage("この端末へのプッシュ通知を有効化しました。");
    } catch (error) {
      setPermission(Notification.permission);
      setPushState("error");
      setPushMessage(
        error instanceof Error
          ? error.message
          : "プッシュ通知の登録に失敗しました。",
      );
    }
  }

  async function savePreference(nextPreference: NotificationPreference) {
    setSettingsState("saving");
    try {
      await updateClientAppData(
        (current) => {
          const exists = current.notificationPreferences.some(
            (item) => item.userId === nextPreference.userId,
          );

          return {
            ...current,
            notificationPreferences: exists
              ? current.notificationPreferences.map((item) =>
                  item.userId === nextPreference.userId ? nextPreference : item,
                )
              : [...current.notificationPreferences, nextPreference],
          };
        },
        appData,
      );
      setSettingsState("idle");
    } catch {
      setSettingsState("error");
    }
  }

  function updatePreference<T extends keyof NotificationPreference>(
    key: T,
    value: NotificationPreference[T],
  ) {
    void savePreference({ ...preference, [key]: value });
  }

  async function markAsRead(notificationId: string) {
    await updateClientAppData(
      (current) => ({
        ...current,
        notifications: current.notifications.map((notification) =>
          notification.id === notificationId
            ? {
                ...notification,
                readBy: Array.from(
                  new Set([...notification.readBy, appData.currentUser.id]),
                ),
              }
            : notification,
        ),
      }),
      appData,
    );
  }

  function toggleChannel(channel: NotificationChannel) {
    const channels = preference.channels.includes(channel)
      ? preference.channels.filter((item) => item !== channel)
      : [...preference.channels, channel];
    updatePreference("channels", channels);
  }

  async function sendTestNotification() {
    setTestState("sending");
    setTestMessage("");

    const result = await sendPushNotification({
      organizationId: appData.organization.id,
      title: "テスト通知",
      body: `${appData.currentUser.name}さんの端末へテスト通知を送信しました。`,
      relatedPath: "/notifications",
      category: "support",
      priority: "important",
      recipientUserIds: [appData.currentUser.id],
    });

    if (result?.ok && result.sent > 0) {
      setTestState("sent");
      setTestMessage(
        `テスト通知を送信しました。送信数: ${result.sent}件。端末側に通知が出るか確認してください。`,
      );
      return;
    }

    setTestState("error");
    if (result?.reason === "firebase_admin_not_configured") {
      setTestMessage(
        "送信APIは動いていますが、Firebase Admin SDKの環境変数が未設定です。VercelのFIREBASE_SERVICE_ACCOUNT_BASE64などを確認してください。",
      );
    } else if (result?.error === "firebase_admin_init_failed") {
      setTestMessage(
        `Firebase Admin SDKの初期化に失敗しました。サービスアカウントの秘密鍵形式を確認してください。詳細: ${result.message ?? "不明"}`,
      );
    } else if (result?.error === "push_send_failed") {
      setTestMessage(
        `FCM送信処理に失敗しました。Vercelの環境変数とFirebase Cloud Messaging設定を確認してください。詳細: ${result.message ?? "不明"}`,
      );
    } else if (result?.sent === 0) {
      setTestMessage(
        `送信対象の端末トークンが見つかりませんでした。この端末で再度「プッシュ通知を有効化する」を押してください。保存済みトークン: ${result.tokenCount ?? 0}件 / 一致: ${result.matchedTokenCount ?? 0}件`,
      );
    } else if (result?.error === "unauthorized") {
      setTestMessage("送信APIの認証に失敗しました。ログインし直して再度試してください。");
    } else {
      setTestMessage(
        `テスト通知の送信に失敗しました。結果: ${JSON.stringify(result ?? {})}`,
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-bold text-blue-700">通知センター</p>
        <h1 className="text-2xl font-black tracking-normal text-blue-950">
          海上でも見逃さない通知
        </h1>
        <p className="text-sm leading-6 text-slate-600">
          波で揺れる状況でも、重要な確認だけすぐ拾えるように通知を整理します。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-bold text-slate-500">未読</p>
          <p className="mt-2 text-3xl font-black text-blue-950">
            {unreadNotifications.length}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-bold text-slate-500">緊急</p>
          <p className="mt-2 text-3xl font-black text-rose-700">
            {urgentNotifications.length}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-bold text-slate-500">ブラウザ通知</p>
          <p className="mt-2 text-lg font-black text-slate-950">
            {permission === "granted"
              ? "許可済み"
              : permission === "denied"
                ? "拒否"
                : permission === "unsupported"
                  ? "非対応"
                  : "未設定"}
          </p>
        </Card>
      </div>

      <section className="rounded-lg border border-blue-100 bg-blue-900 p-4 text-white shadow-lg shadow-blue-950/15">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-white/15">
            <Waves size={24} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-black">海上利用向けの通知設計</h2>
            <p className="mt-2 text-sm leading-6 text-sky-100">
              緊急度が高い通知、出船前/帰港後チェック、重要申し送りを優先して表示します。Firebase Cloud Messaging接続後はプッシュ通知へ拡張します。
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={requestNotificationPermission}
          disabled={pushState === "saving" || pushEnabled}
          className={`mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-black disabled:bg-slate-200 disabled:text-slate-500 ${
            pushEnabled
              ? "bg-emerald-100 text-emerald-900"
              : "bg-white text-blue-900"
          }`}
        >
          {pushEnabled ? (
            <CheckCircle2 size={20} aria-hidden="true" />
          ) : (
            <BellRing size={20} aria-hidden="true" />
          )}
          {pushState === "saving"
            ? "通知を登録中..."
            : pushEnabled
              ? "プッシュ通知は有効です"
              : "プッシュ通知を有効化する"}
        </button>
        {pushMessage ? (
          <p
            className={`mt-3 rounded-lg p-3 text-sm font-bold leading-6 ${
              pushState === "saved"
                ? "bg-emerald-50 text-emerald-900"
                : "bg-rose-50 text-rose-900"
            }`}
          >
            {pushMessage}
          </p>
        ) : null}
        <div className="mt-4 rounded-lg border border-white/20 bg-white/10 p-3">
          <p className="text-sm font-black">通知テスト</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-sky-100">
            この端末にだけテスト通知を送信します。サポート要請とは切り離してFCMの接続状態を確認できます。
          </p>
          <button
            type="button"
            onClick={sendTestNotification}
            disabled={testState === "sending"}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-sky-100 px-4 text-sm font-black text-blue-950 disabled:bg-slate-200 disabled:text-slate-500"
          >
            <Bell size={18} aria-hidden="true" />
            {testState === "sending" ? "テスト送信中..." : "テスト通知を送る"}
          </button>
          {testMessage ? (
            <p
              className={`mt-3 rounded-lg p-3 text-sm font-bold leading-6 ${
                testState === "sent"
                  ? "bg-emerald-50 text-emerald-900"
                  : "bg-rose-50 text-rose-900"
              }`}
            >
              {testMessage}
            </p>
          ) : null}
        </div>
      </section>

      <Section
        title="通知設定"
        action={
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            className="grid size-8 place-items-center rounded-full bg-sky-100 text-blue-800"
            aria-label="通知設定の説明を開く"
          >
            <HelpCircle size={17} aria-hidden="true" />
          </button>
        }
      >
        <Card>
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-bold leading-6 text-rose-900">
            緊急度「高」のサポート要請は、安全確認を優先するため、サポート要請通知がOFFでも全通知チャンネルへ送信対象になります。
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {notificationSettingItems.map(({ label, key }) => {
              const enabled = preference[key];

              return (
              <button
                type="button"
                key={key}
                onClick={() => updatePreference(key, !enabled)}
                disabled={settingsState === "saving"}
                className="flex min-h-13 items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-3 text-left disabled:opacity-60"
              >
                <span className="text-sm font-black text-slate-800">
                  {label as string}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${
                    enabled
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {enabled ? "ON" : "OFF"}
                </span>
              </button>
              );
            })}
          </div>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-sm font-black text-slate-800">通知チャンネル</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {[
                ["in_app", "アプリ内"],
                ["push", "プッシュ通知"],
                ["email", "メール"],
              ].map(([channel, label]) => {
                const enabled = preference.channels.includes(
                  channel as NotificationChannel,
                );

                return (
                  <button
                    type="button"
                    key={channel}
                    onClick={() => toggleChannel(channel as NotificationChannel)}
                    disabled={settingsState === "saving"}
                    className={`h-11 rounded-lg border px-3 text-sm font-black disabled:opacity-60 ${
                      enabled
                        ? "border-blue-200 bg-blue-800 text-white"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {label} {enabled ? "ON" : "OFF"}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
              プッシュ通知はFirebase Cloud Messaging接続後に本配信へ拡張します。現時点では設定保存とブラウザ通知許可の確認ができます。
            </p>
            {settingsState === "error" ? (
              <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm font-bold text-rose-800">
                通知設定の保存に失敗しました。
              </p>
            ) : null}
          </div>
        </Card>
      </Section>

      {showHelp ? (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-950/45 p-3 sm:items-center sm:justify-center">
          <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black text-blue-700">通知設定の説明</p>
                <h2 className="mt-1 text-lg font-black text-blue-950">
                  アプリ内通知とプッシュ通知の違い
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                className="grid size-10 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-600"
                aria-label="閉じる"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="font-black text-slate-950">アプリ内通知</p>
                <p className="mt-1">
                  アプリのホーム画面や通知センターに残る通知です。あとから履歴として確認できます。
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="font-black text-slate-950">プッシュ通知</p>
                <p className="mt-1">
                  ブラウザやPWAが閉じていても端末に表示される通知です。端末ごとに「プッシュ通知を有効化する」が必要です。
                </p>
              </div>
              <div className="rounded-lg bg-rose-50 p-3 text-rose-900">
                <p className="font-black">緊急度高のサポート要請</p>
                <p className="mt-1">
                  安全確認を優先するため、サポート要請通知がOFFでも送信対象になります。
                </p>
              </div>
              <p className="text-xs font-semibold leading-5 text-slate-500">
                同じ通知が2通出る場合は、アプリ内通知とプッシュ通知の重複ではなく、FCM受信処理の重複が原因です。現在は1通だけ表示されるよう送信方式を調整しています。
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <Section title="通知一覧">
        <div className="space-y-3">
          {sortedNotifications.map((notification) => {
            const isRead = notification.readBy.includes(appData.currentUser.id);

            return (
              <Card key={notification.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-1 grid size-10 shrink-0 place-items-center rounded-lg ${
                        isRead ? "bg-slate-100 text-slate-500" : "bg-sky-100 text-blue-800"
                      }`}
                    >
                      {notification.category === "weather" ? (
                        <Waves size={21} aria-hidden="true" />
                      ) : notification.priority === "urgent" ? (
                        <Radio size={21} aria-hidden="true" />
                      ) : (
                        <Bell size={21} aria-hidden="true" />
                      )}
                    </span>
                    <div>
                      <p className="font-black text-slate-950">
                        {notification.title}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {notification.body}
                      </p>
                    </div>
                  </div>
                  {!isRead ? (
                    <span className="mt-1 size-2.5 shrink-0 rounded-full bg-blue-700" />
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge className="bg-sky-100 text-blue-800 ring-sky-200">
                    {notificationCategoryLabels[notification.category]}
                  </Badge>
                  <Badge className={notificationPriorityTone[notification.priority]}>
                    {notificationPriorityLabels[notification.priority]}
                  </Badge>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <Link
                    href={notification.relatedPath}
                    className="flex min-h-11 items-center justify-center rounded-lg bg-blue-800 px-4 text-sm font-black text-white"
                  >
                    関連画面を開く
                  </Link>
                  <button
                    type="button"
                    onClick={() => markAsRead(notification.id)}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-black text-slate-700"
                  >
                    <CheckCircle2 size={18} aria-hidden="true" />
                    既読にする
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
