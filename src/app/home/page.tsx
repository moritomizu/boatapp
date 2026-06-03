"use client";

import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  ClipboardCheck,
  Compass,
  LifeBuoy,
  MessageSquareWarning,
  Navigation,
  Ship,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge, Card, Section } from "@/components/ui";
import { useClientAppData } from "@/lib/client-store";
import { getInitialAppData, useMockData } from "@/lib/data-source";
import {
  boatStatusLabels,
  boatStatusTone,
  handoverCategoryLabels,
  handoverPriorityLabels,
  handoverPriorityTone,
  handoverStatusLabels,
  supportCategoryLabels,
  supportStatusLabels,
  supportUrgencyLabels,
  supportUrgencyTone,
  targetFishLabels,
  voyageStatusLabels,
  voyageStatusTone,
} from "@/lib/labels";
import { findNextReservation, formatDate, formatTime, isSameDay } from "@/lib/reservations";

export default function HomePage() {
  const initialData = getInitialAppData();
  const data = useClientAppData(initialData);

  const todayIso = new Date().toISOString();
  const todaysReservations = data.reservations.filter((reservation) =>
    isSameDay(reservation.startAt, todayIso),
  );
  const nextReservation = findNextReservation(data.reservations);
  const activeVoyage = data.voyageLogs.find(
    (voyage) => voyage.status === "underway",
  );
  const primaryReservation =
    (activeVoyage
      ? data.reservations.find(
          (reservation) => reservation.id === activeVoyage.reservationId,
        )
      : undefined) ??
    todaysReservations[0] ??
    nextReservation;
  const primaryReservationId = primaryReservation?.id;
  const primaryPreCheckDone = primaryReservationId
    ? data.preDepartureChecks.some(
        (check) => check.reservationId === primaryReservationId,
      )
    : false;
  const primaryPostCheckDone = primaryReservationId
    ? data.postReturnChecks.some(
        (check) => check.reservationId === primaryReservationId,
      )
    : false;
  const unresolvedHandovers = data.handoverNotes.filter(
    (note) => note.status !== "resolved",
  );
  const highPriorityHandovers = unresolvedHandovers.filter(
    (note) => note.priority === "high",
  );
  const latestHandovers = [...data.handoverNotes]
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, 3);
  const unresolvedHandoverCount = unresolvedHandovers.length;
  const unresolvedSupportRequests = data.supportRequests.filter(
    (request) => request.status === "open",
  );
  const highUrgencySupportRequests = data.supportRequests.filter(
    (request) => request.status !== "resolved" && request.urgency === "high",
  );
  const latestSupportRequests = [...data.supportRequests]
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, 3);
  const unresolvedSupportCount = unresolvedSupportRequests.length;
  const unreadNotifications = data.notifications.filter(
    (notification) => !notification.readBy.includes(data.currentUser.id),
  );
  const urgentNotifications = unreadNotifications.filter(
    (notification) => notification.priority === "urgent",
  );
  const actions = [
    { href: "/reservations#new", label: "予約する", icon: CalendarDays },
    { href: "/reservations", label: "予約カレンダーを見る", icon: ClipboardCheck },
    {
      href: primaryReservationId
        ? `/checks/pre-departure?reservationId=${primaryReservationId}`
        : "/checks/pre-departure",
      label: "出船前チェック",
      icon: ClipboardCheck,
    },
    {
      href: primaryReservationId
        ? `/voyages?reservationId=${primaryReservationId}`
        : "/voyages",
      label: activeVoyage ? "航行中画面を開く" : "出船を開始",
      icon: Navigation,
    },
    {
      href: primaryReservationId
        ? `/checks/post-return?reservationId=${primaryReservationId}`
        : "/checks/post-return",
      label: "帰港後チェック",
      icon: ClipboardCheck,
    },
    { href: "/handovers", label: "申し送りを見る", icon: MessageSquareWarning },
    { href: "/support#new", label: "サポート要請", icon: LifeBuoy },
    { href: "/notifications", label: "通知を見る", icon: Bell },
    { href: "/boats", label: "船舶情報を見る", icon: Ship },
    { href: "/members", label: "メンバーを見る", icon: Users },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="rounded-lg bg-blue-900 p-5 text-white shadow-lg shadow-blue-950/20">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-sky-200">
                大阪 共同保有艇
              </p>
              <div className="mt-1 flex items-center gap-3">
                <span className="relative size-11 shrink-0 overflow-hidden rounded-lg border border-white/20 bg-white/10">
                  <Image
                    src={data.boat.imageUrl}
                    alt=""
                    fill
                    sizes="44px"
                    className="object-cover"
                    unoptimized={data.boat.imageUrl.startsWith("data:")}
                    aria-hidden="true"
                  />
                </span>
                <h1 className="text-3xl font-black tracking-normal">
                  {data.boat.name}
                </h1>
              </div>
            </div>
            <Badge className={boatStatusTone[data.boat.status]}>
              {boatStatusLabels[data.boat.status]}
            </Badge>
          </div>
          <p className="mt-4 text-sm leading-6 text-sky-100">
            {useMockData
              ? "モックデータで表示中。Firebase接続後も同じ画面構造で運用できます。"
              : "Firebaseデータで表示中。"}
          </p>
        </section>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card>
            <p className="text-xs font-bold text-slate-500">今日の予約</p>
            <p className="mt-2 text-3xl font-black text-blue-950">
              {todaysReservations.length}
            </p>
          </Card>
          <Card>
            <p className="text-xs font-bold text-slate-500">申し送り</p>
            <p className="mt-2 text-3xl font-black text-amber-700">
              {unresolvedHandoverCount}
            </p>
          </Card>
          <Card>
            <p className="text-xs font-bold text-slate-500">サポート要請</p>
            <p className="mt-2 text-3xl font-black text-rose-700">
              {unresolvedSupportCount}
            </p>
          </Card>
          <Card>
            <p className="text-xs font-bold text-slate-500">船の状態</p>
            <p className="mt-2 text-lg font-black text-blue-950">
              {boatStatusLabels[data.boat.status]}
            </p>
          </Card>
        </div>

        <Link href="/notifications" className="block">
          <section className="rounded-lg border border-sky-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-sky-100 text-blue-800">
                  <Bell size={22} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-base font-black text-blue-950">
                    通知センター
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    未読{unreadNotifications.length}件 / 緊急
                    {urgentNotifications.length}件
                  </p>
                </div>
              </div>
              <Badge
                className={
                  urgentNotifications.length > 0
                    ? "bg-rose-100 text-rose-800 ring-rose-200"
                    : "bg-sky-100 text-blue-800 ring-sky-200"
                }
              >
                {urgentNotifications.length > 0 ? "要確認" : "確認"}
              </Badge>
            </div>
          </section>
        </Link>

        <Section title="次にやること">
          <Card>
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-blue-950">
                    {activeVoyage
                      ? "航行中です"
                      : primaryReservation
                        ? "本日の流れを進めます"
                        : "まずは予約を登録します"}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {activeVoyage
                      ? `${activeVoyage.trackPoints.length}件の位置を記録中。帰港したら航行ログを完了してください。`
                      : primaryReservation
                        ? `${formatDate(primaryReservation.startAt)} ${formatTime(primaryReservation.startAt)} / ${primaryReservation.destinationArea}`
                        : "予約からチェック、出船、帰港後チェック、申し送りまでを順番に進めます。"}
                  </p>
                </div>
                {activeVoyage ? (
                  <Badge className={voyageStatusTone[activeVoyage.status]}>
                    {voyageStatusLabels[activeVoyage.status]}
                  </Badge>
                ) : null}
              </div>

              {activeVoyage ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  <Link
                    href={`/voyages?reservationId=${activeVoyage.reservationId}`}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 text-sm font-black text-white"
                  >
                    <Navigation size={18} aria-hidden="true" />
                    航行ログを開く
                  </Link>
                  <Link
                    href={`/support?reservationId=${activeVoyage.reservationId}#new`}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 text-sm font-black text-rose-800"
                  >
                    <LifeBuoy size={18} aria-hidden="true" />
                    サポート要請
                  </Link>
                  <Link
                    href={`/checks/post-return?reservationId=${activeVoyage.reservationId}`}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-sky-200 px-4 text-sm font-black text-blue-900"
                  >
                    <ClipboardCheck size={18} aria-hidden="true" />
                    帰港後チェック
                  </Link>
                </div>
              ) : primaryReservation ? (
                <div className="grid gap-2 sm:grid-cols-4">
                  <Link
                    href={`/checks/pre-departure?reservationId=${primaryReservation.id}`}
                    className={`flex min-h-12 items-center justify-center gap-2 rounded-lg px-4 text-sm font-black ${
                      primaryPreCheckDone
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "bg-blue-800 text-white"
                    }`}
                  >
                    <ClipboardCheck size={18} aria-hidden="true" />
                    {primaryPreCheckDone ? "出船前完了" : "出船前チェック"}
                  </Link>
                  <Link
                    href={`/voyages?reservationId=${primaryReservation.id}`}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-black text-white"
                  >
                    <Compass size={18} aria-hidden="true" />
                    出船開始
                  </Link>
                  <Link
                    href={`/checks/post-return?reservationId=${primaryReservation.id}`}
                    className={`flex min-h-12 items-center justify-center gap-2 rounded-lg px-4 text-sm font-black ${
                      primaryPostCheckDone
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border border-sky-200 text-blue-900"
                    }`}
                  >
                    <ClipboardCheck size={18} aria-hidden="true" />
                    {primaryPostCheckDone ? "帰港後完了" : "帰港後チェック"}
                  </Link>
                  <Link
                    href={`/handovers?reservationId=${primaryReservation.id}#new`}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 text-sm font-black text-amber-900"
                  >
                    <MessageSquareWarning size={18} aria-hidden="true" />
                    申し送り
                  </Link>
                </div>
              ) : (
                <Link
                  href="/reservations#new"
                  className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-black text-white"
                >
                  <CalendarDays size={18} aria-hidden="true" />
                  予約を登録
                </Link>
              )}
            </div>
          </Card>
        </Section>

        <Section title="主要操作">
          <div className="grid gap-3 sm:grid-cols-2">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex min-h-16 items-center gap-3 rounded-lg border border-sky-100 bg-white px-4 py-3 text-base font-black text-blue-950 shadow-sm"
                >
                  <span className="grid size-10 place-items-center rounded-lg bg-sky-100 text-blue-800">
                    <Icon size={23} aria-hidden="true" />
                  </span>
                  {action.label}
                </Link>
              );
            })}
          </div>
        </Section>

        {highPriorityHandovers.length > 0 ? (
          <Link
            href="/handovers"
            className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-900 shadow-sm"
          >
            <AlertTriangle className="mt-0.5 shrink-0" size={22} aria-hidden="true" />
            <span>
              <span className="block text-base font-black">
                重要度高の申し送りがあります
              </span>
              <span className="mt-1 block text-sm font-semibold leading-6">
                出船前に内容を確認してください。
              </span>
            </span>
          </Link>
        ) : null}

        {highUrgencySupportRequests.length > 0 ? (
          <Link
            href="/support"
            className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-900 shadow-sm"
          >
            <LifeBuoy className="mt-0.5 shrink-0" size={22} aria-hidden="true" />
            <span>
              <span className="block text-base font-black">
                緊急度高のサポート要請があります
              </span>
              <span className="mt-1 block text-sm font-semibold leading-6">
                共同メンバー間の相談です。人命に関わる場合は118番等へ直接連絡してください。
              </span>
            </span>
          </Link>
        ) : null}

        <Section title="今日の利用状況">
          <div className="space-y-3">
            {todaysReservations.map((reservation) => {
              const user = data.users.find((item) => item.id === reservation.userId);
              return (
                <Card key={reservation.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">
                        {formatTime(reservation.startAt)} -{" "}
                        {formatTime(reservation.endAt)}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {user?.name} / {targetFishLabels[reservation.targetFish]} /{" "}
                        {reservation.destinationArea}
                      </p>
                    </div>
                    <Badge className="bg-sky-100 text-blue-800 ring-sky-200">
                      {reservation.joinAllowed ? "便乗歓迎" : "貸切"}
                    </Badge>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <Link
                      href={`/checks/pre-departure?reservationId=${reservation.id}`}
                      className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-black text-white"
                    >
                      <ClipboardCheck size={18} aria-hidden="true" />
                      出船前チェックを開始
                    </Link>
                    <Link
                      href={`/checks/post-return?reservationId=${reservation.id}`}
                      className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-sky-200 bg-white px-4 text-sm font-black text-blue-900"
                    >
                      <ClipboardCheck size={18} aria-hidden="true" />
                      帰港後チェックを開始
                    </Link>
                    <Link
                      href={`/voyages?reservationId=${reservation.id}`}
                      className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-black text-white"
                    >
                      <Navigation size={18} aria-hidden="true" />
                      出船開始
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        </Section>

        {nextReservation ? (
          <Section title="次回予約">
            <Card>
              <p className="text-lg font-black text-blue-950">
                {formatDate(nextReservation.startAt)} {formatTime(nextReservation.startAt)} -{" "}
                {formatTime(nextReservation.endAt)}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {targetFishLabels[nextReservation.targetFish]} /{" "}
                {nextReservation.destinationArea} / 空き席
                {nextReservation.availableSeats}席
              </p>
            </Card>
          </Section>
        ) : null}

        <Section
          title="最新のサポート要請"
          action={
            <Link href="/support" className="text-sm font-bold text-blue-800">
              すべて見る
            </Link>
          }
        >
          <div className="space-y-3">
            {latestSupportRequests.map((request) => (
              <Link key={request.id} href="/support" className="block">
                <Card>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">{request.title}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {supportCategoryLabels[request.category]} /{" "}
                        {supportStatusLabels[request.status]}
                      </p>
                    </div>
                    <Badge className={supportUrgencyTone[request.urgency]}>
                      {supportUrgencyLabels[request.urgency].split("：")[0]}
                    </Badge>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </Section>

        <Section
          title="最新の申し送り"
          action={
            <Link href="/boats" className="text-sm font-bold text-blue-800">
              すべて見る
            </Link>
          }
        >
          <div className="space-y-3">
            {latestHandovers.map((note) => (
              <Link key={note.id} href="/boats" className="block">
                <Card>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">{note.title}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {handoverCategoryLabels[note.category]} /{" "}
                        {handoverStatusLabels[note.status]}
                      </p>
                    </div>
                    <Badge className={handoverPriorityTone[note.priority]}>
                      重要度{handoverPriorityLabels[note.priority]}
                    </Badge>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </Section>
      </div>
    </AppShell>
  );
}
