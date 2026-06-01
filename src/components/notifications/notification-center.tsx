"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bell, BellRing, CheckCircle2, Radio, Waves } from "lucide-react";
import { Badge, Card, Section } from "@/components/ui";
import {
  notificationCategoryLabels,
  notificationPriorityLabels,
  notificationPriorityTone,
} from "@/lib/labels";
import type { AppData, AppNotification } from "@/types/domain";

export function NotificationCenter({ data }: { data: AppData }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(
    data.notifications,
  );
  const [permission, setPermission] = useState(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported",
  );
  const preference = data.notificationPreferences.find(
    (item) => item.userId === data.currentUser.id,
  );
  const unreadNotifications = notifications.filter(
    (notification) => !notification.readBy.includes(data.currentUser.id),
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
      return;
    }

    const result = await Notification.requestPermission();
    setPermission(result);

    if (result === "granted") {
      new Notification("TaPiYoTa Grand Boat Club", {
        body: "通知が有効になりました。海況、チェック、申し送りを見逃しにくくします。",
      });
    }
  }

  function markAsRead(notificationId: string) {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? {
              ...notification,
              readBy: Array.from(
                new Set([...notification.readBy, data.currentUser.id]),
              ),
            }
          : notification,
      ),
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-bold text-blue-700">通知センター</p>
        <h1 className="text-3xl font-black tracking-normal text-blue-950">
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
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-black text-blue-900"
        >
          <BellRing size={20} aria-hidden="true" />
          ブラウザ通知を許可する
        </button>
      </section>

      <Section title="通知設定">
        <Card>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["天候/海況アラート", preference?.weatherAlerts],
              ["予約リマインド", preference?.reservationReminders],
              ["出船前/帰港後チェック", preference?.checkReminders],
              ["重要申し送り", preference?.handoverAlerts],
              ["サポート要請", preference?.supportAlerts],
            ].map(([label, enabled]) => (
              <div
                key={label as string}
                className="flex min-h-13 items-center justify-between rounded-lg bg-slate-50 px-3 py-3"
              >
                <span className="text-sm font-black text-slate-800">
                  {label as string}
                </span>
                <Badge
                  className={
                    enabled
                      ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
                      : "bg-slate-100 text-slate-700 ring-slate-200"
                  }
                >
                  {enabled ? "ON" : "OFF"}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      <Section title="通知一覧">
        <div className="space-y-3">
          {sortedNotifications.map((notification) => {
            const isRead = notification.readBy.includes(data.currentUser.id);

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
