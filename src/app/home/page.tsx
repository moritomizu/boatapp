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
import { canUseBoat, getBoats } from "@/lib/boat-utils";
import {
  updateClientAppData,
  useClientAppData,
} from "@/lib/client-store";
import { getInitialAppData } from "@/lib/data-source";
import {
  boatStatusLabels,
  boatStatusTone,
  handoverCategoryLabels,
  handoverPriorityLabels,
  handoverPriorityTone,
  handoverStatusLabels,
  roleLabels,
  supportCategoryLabels,
  supportStatusLabels,
  supportUrgencyLabels,
  supportUrgencyTone,
  targetFishLabels,
  voyageStatusLabels,
  voyageStatusTone,
} from "@/lib/labels";
import {
  findNextReservation,
  formatDate,
  formatTime,
  getReservationSessionStatus,
  isSameDay,
} from "@/lib/reservations";
import type { JoinRequestStatus } from "@/types/domain";

export default function HomePage() {
  const initialData = getInitialAppData();
  const data = useClientAppData(initialData);
  const boats = getBoats(data).sort(
    (a, b) =>
      new Date(a.createdAt ?? a.updatedAt).getTime() -
      new Date(b.createdAt ?? b.updatedAt).getTime(),
  );
  const isAdmin = data.currentUser.role === "admin";

  const todayIso = new Date().toISOString();
  const myReservations = data.reservations.filter(
    (reservation) => reservation.userId === data.currentUser.id,
  );
  const myTodaysReservations = myReservations.filter((reservation) =>
    isSameDay(reservation.startAt, todayIso),
  );
  const myNextReservation = findNextReservation(myReservations);
  const myActiveVoyage = data.voyageLogs.find(
    (voyage) =>
      voyage.userId === data.currentUser.id && voyage.status === "underway",
  );
  const myActiveReservation = myActiveVoyage
    ? data.reservations.find(
        (reservation) => reservation.id === myActiveVoyage.reservationId,
      )
    : undefined;
  const todaysReservations = data.reservations.filter((reservation) =>
    reservation.boatId === data.boat.id && isSameDay(reservation.startAt, todayIso),
  );
  const selectedBoatReservations = data.reservations.filter(
    (reservation) => reservation.boatId === data.boat.id,
  );
  const nextReservation = findNextReservation(selectedBoatReservations);
  const primaryReservation =
    myActiveReservation ?? myTodaysReservations[0] ?? myNextReservation;
  const primaryReservationId = primaryReservation?.id;
  const primaryReservationIsToday = primaryReservation
    ? isSameDay(primaryReservation.startAt, todayIso)
    : false;
  const primarySessionStatus = primaryReservation
    ? getReservationSessionStatus(primaryReservation, data)
    : undefined;
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
    (note) => note.boatId === data.boat.id && note.status !== "resolved",
  );
  const highPriorityHandovers = unresolvedHandovers.filter(
    (note) => note.priority === "high",
  );
  const latestHandovers = [...data.handoverNotes]
    .filter((note) => note.boatId === data.boat.id)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, 3);
  const unresolvedHandoverCount = unresolvedHandovers.length;
  const unresolvedSupportRequests = data.supportRequests.filter(
    (request) => request.boatId === data.boat.id && request.status === "open",
  );
  const highUrgencySupportRequests = data.supportRequests.filter(
    (request) =>
      request.status !== "resolved" &&
      request.status !== "closed" &&
      request.urgency === "high",
  );
  const myOpenSupportRequests = data.supportRequests.filter(
    (request) =>
      request.createdBy === data.currentUser.id &&
      request.status !== "resolved" &&
      request.status !== "closed",
  );
  const mySupportReplyAlerts = myOpenSupportRequests
    .map((request) => ({
      request,
      replies: data.supportMessages.filter(
        (message) => message.supportRequestId === request.id,
      ),
    }))
    .filter((item) => item.replies.length > 0);
  const joinRequestsForMe = data.joinRequests.filter((request) => {
    if (request.status !== "requested") return false;
    const reservation = data.reservations.find(
      (item) => item.id === request.reservationId,
    );
    if (!reservation) return false;
    return isAdmin || reservation.userId === data.currentUser.id;
  });
  const latestSupportRequests = [...data.supportRequests]
    .filter((request) => request.boatId === data.boat.id)
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
      label: myActiveVoyage ? "出船状況を開く" : "出船を開始",
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

  const nextTaskTitle = myActiveVoyage
    ? "出船中の操作"
    : primaryReservation
      ? primaryReservationIsToday
        ? "今日の予約を進めます"
        : "次回予約があります"
      : "まずは予約を登録します";
  const nextTaskDescription = myActiveVoyage
    ? "帰港したら出船状況画面から帰港を記録し、帰港後チェックへ進みます。"
    : primaryReservation
      ? `${boats.find((boat) => boat.id === primaryReservation.boatId)?.name ?? data.boat.name} / ${formatDate(primaryReservation.startAt)} ${formatTime(primaryReservation.startAt)} / ${primaryReservation.destinationArea}`
      : "予約からチェック、出船、帰港後チェック、申し送りまでを順番に進めます。";

  async function updateJoinRequestStatus(
    requestId: string,
    status: JoinRequestStatus,
  ) {
    const now = new Date().toISOString();
    await updateClientAppData(
      (current) => ({
        ...current,
        joinRequests: current.joinRequests.map((request) =>
          request.id === requestId ? { ...request, status, updatedAt: now } : request,
        ),
      }),
      data,
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {highUrgencySupportRequests.length > 0 ? (
          <Link
            href={`/support?supportId=${highUrgencySupportRequests[0].id}`}
            className="flex items-start gap-3 rounded-lg border border-rose-300 bg-rose-50 p-4 text-rose-900 shadow-sm ring-2 ring-rose-100"
          >
            <LifeBuoy className="mt-0.5 shrink-0" size={24} aria-hidden="true" />
            <span>
              <span className="block text-base font-black">
                緊急度高のサポート要請があります
              </span>
              <span className="mt-1 block text-sm font-semibold leading-6">
                タップして内容を確認し、必要であればコメントしてください。
              </span>
            </span>
          </Link>
        ) : null}

        {mySupportReplyAlerts.length > 0 ? (
          <Link
            href={`/support?supportId=${mySupportReplyAlerts[0].request.id}`}
            className="flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 p-4 text-blue-950 shadow-sm"
          >
            <Bell className="mt-0.5 shrink-0 text-blue-800" size={22} aria-hidden="true" />
            <span>
              <span className="block text-base font-black">
                あなたのサポート要請にコメントがあります
              </span>
              <span className="mt-1 block text-sm font-semibold leading-6">
                {mySupportReplyAlerts.reduce(
                  (total, item) => total + item.replies.length,
                  0,
                )}
                件のコメント/対応履歴があります。タップして確認できます。
              </span>
            </span>
          </Link>
        ) : null}

        <div className="space-y-2">
          <p className="text-sm font-bold text-blue-700">ホーム</p>
          <h1 className="text-2xl font-black tracking-normal text-blue-950">
            こんにちは {data.currentUser.name}さん
          </h1>
          <div className="rounded-lg bg-sky-50 p-3 text-sm font-bold leading-6 text-blue-900">
            現在の権限は{roleLabels[data.currentUser.role]}です。
            {data.currentUser.role === "admin"
              ? " 全船の管理、メンバー管理、予約補正、サポート対応ができます。"
              : data.currentUser.role === "owner"
                ? " 予約、出船記録、申し送り、サポート対応ができます。"
                : " 予約、出船前後チェック、航行ログ、申し送り、サポート要請ができます。"}
          </div>
        </div>

        <Section title="次にやること">
          <Card>
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-blue-950">
                    {nextTaskTitle}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {nextTaskDescription}
                  </p>
                </div>
                {myActiveVoyage ? (
                  <Badge className={voyageStatusTone[myActiveVoyage.status]}>
                    {voyageStatusLabels[myActiveVoyage.status]}
                  </Badge>
                ) : null}
              </div>

              {myActiveVoyage ? (
                <div className="grid gap-2">
                  <Link
                    href={`/voyages?reservationId=${myActiveVoyage.reservationId}`}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-black text-white"
                  >
                    <Navigation size={18} aria-hidden="true" />
                    出船状況を開く
                  </Link>
                </div>
              ) : primaryReservation ? (
                primaryReservationIsToday ? (
                  <div className="grid gap-2 sm:grid-cols-3">
                    {primarySessionStatus === "scheduled" ? (
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
                    ) : null}
                    {primarySessionStatus === "pre_checked" ? (
                      <Link
                        href={`/voyages?reservationId=${primaryReservation.id}`}
                        className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-black text-white"
                      >
                        <Compass size={18} aria-hidden="true" />
                        出船開始
                      </Link>
                    ) : null}
                    {primarySessionStatus === "underway" || primarySessionStatus === "returned" ? (
                      <Link
                        href={`/checks/post-return?reservationId=${primaryReservation.id}`}
                        className={`flex min-h-12 items-center justify-center gap-2 rounded-lg px-4 text-sm font-black ${
                          primaryPostCheckDone
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "bg-emerald-700 text-white"
                        }`}
                      >
                        <ClipboardCheck size={18} aria-hidden="true" />
                        {primaryPostCheckDone ? "帰港後完了" : "帰港後チェック"}
                      </Link>
                    ) : null}
                    <Link
                      href={`/reservations#reservation-${primaryReservation.id}`}
                      className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-sky-200 px-4 text-sm font-black text-blue-900"
                    >
                      <CalendarDays size={18} aria-hidden="true" />
                      予約を確認
                    </Link>
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Link
                      href={`/reservations#reservation-${primaryReservation.id}`}
                      className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-black text-white"
                    >
                      <CalendarDays size={18} aria-hidden="true" />
                      次回予約を確認
                    </Link>
                    <Link
                      href="/reservations#new"
                      className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-sky-200 px-4 text-sm font-black text-blue-900"
                    >
                      <CalendarDays size={18} aria-hidden="true" />
                      新しく予約する
                    </Link>
                  </div>
                )
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

        {myOpenSupportRequests.length > 0 ? (
          <Section title="あなたのサポート要請">
            <div className="space-y-3">
              {myOpenSupportRequests.slice(0, 3).map((request) => {
                const messageCount = data.supportMessages.filter(
                  (message) => message.supportRequestId === request.id,
                ).length;

                return (
                  <Link
                    key={request.id}
                    href={`/support?supportId=${request.id}`}
                    className="block"
                  >
                    <Card>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-blue-950">{request.title}</p>
                          <p className="mt-1 text-sm text-slate-600">
                            返信・記録 {messageCount}件 /{" "}
                            {supportStatusLabels[request.status]}
                          </p>
                        </div>
                        <Badge className={supportUrgencyTone[request.urgency]}>
                          {supportUrgencyLabels[request.urgency].split("：")[0]}
                        </Badge>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </Section>
        ) : null}

        {joinRequestsForMe.length > 0 ? (
          <Section title="便乗希望の確認">
            <div className="space-y-3">
              {joinRequestsForMe.slice(0, 3).map((request) => {
                const reservation = data.reservations.find(
                  (item) => item.id === request.reservationId,
                );
                const requester = data.users.find((user) => user.id === request.userId);

                return (
                  <Card key={request.id}>
                    <div className="space-y-3">
                      <div>
                        <p className="font-black text-blue-950">
                          {requester?.name ?? "メンバー"}さんから便乗希望
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {reservation
                            ? `${formatDate(reservation.startAt)} ${formatTime(reservation.startAt)} / ${reservation.destinationArea}`
                            : "対象予約不明"}
                        </p>
                        <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                          {request.message}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => updateJoinRequestStatus(request.id, "approved")}
                          className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-black text-white"
                        >
                          承認
                        </button>
                        <button
                          type="button"
                          onClick={() => updateJoinRequestStatus(request.id, "declined")}
                          className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm font-black text-slate-700"
                        >
                          見送り
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </Section>
        ) : null}

        <Section title="船舶の状況">
          <div className="space-y-3">
            {boats.map((boat) => {
              const available = canUseBoat(data, data.currentUser, boat);
              const boatTodaysReservations = data.reservations.filter(
                (reservation) =>
                  reservation.boatId === boat.id &&
                  isSameDay(reservation.startAt, todayIso),
              );
              const boatHandovers = data.handoverNotes.filter(
                (note) => note.boatId === boat.id && note.status !== "resolved",
              );
              const boatSupports = data.supportRequests.filter(
                (request) =>
                  request.boatId === boat.id &&
                  (request.status === "open" || request.status === "in_progress"),
              );

              const boatNextReservation = findNextReservation(
                data.reservations.filter(
                  (reservation) => reservation.boatId === boat.id,
                ),
              );
              const boatActiveVoyage = data.voyageLogs.find(
                (voyage) => voyage.boatId === boat.id && voyage.status === "underway",
              );
              const boatActiveReservation = boatActiveVoyage
                ? data.reservations.find(
                    (reservation) =>
                      reservation.id === boatActiveVoyage.reservationId,
                  )
                : undefined;
              const boatActiveUser = boatActiveVoyage
                ? data.users.find((user) => user.id === boatActiveVoyage.userId)
                : undefined;

              const cardContent = (
                <div className="flex gap-3">
                  <span className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-sky-100">
                    <Image
                      src={boat.imageUrl}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-cover"
                      unoptimized={boat.imageUrl.startsWith("data:")}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-black text-blue-950">
                        {boat.name}
                      </p>
                      <Badge className={boatStatusTone[boat.status]}>
                        {boatStatusLabels[boat.status]}
                      </Badge>
                      <Badge
                        className={
                          available
                            ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
                            : "bg-slate-100 text-slate-700 ring-slate-200"
                        }
                      >
                        {available ? "利用可" : "権限確認"}
                      </Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs font-bold text-slate-600">
                      <div className="rounded-lg bg-slate-50 p-2">
                        今日 {boatTodaysReservations.length}
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2">
                        申し送り {boatHandovers.length}
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2">
                        相談 {boatSupports.length}
                      </div>
                    </div>
                    <div className="mt-2 rounded-lg bg-white/80 p-2 text-xs font-bold leading-5 text-slate-600">
                      {boatActiveVoyage
                        ? `航行中: ${boatActiveUser?.name ?? "不明"} / ${boatActiveReservation ? `${formatTime(boatActiveReservation.startAt)} ${boatActiveReservation.destinationArea}` : "予約未確認"}`
                        : boatNextReservation
                          ? `次回: ${formatDate(boatNextReservation.startAt)} ${formatTime(boatNextReservation.startAt)}`
                          : "次回予約なし"}
                    </div>
                  </div>
                </div>
              );

              return (
                <div
                  key={boat.id}
                  className="block w-full rounded-lg border border-sky-100 bg-white p-3 text-left shadow-sm"
                >
                  {cardContent}
                </div>
              );
            })}
            {boats.length === 0 ? (
              <Card>
                <p className="text-sm font-semibold leading-6 text-slate-600">
                  利用可能な船舶がありません。管理者に船舶登録または利用権限の設定を依頼してください。
                </p>
              </Card>
            ) : null}
          </div>
        </Section>

        {isAdmin ? (
          <Section title={`${data.boat.name}の運用ダッシュボード`}>
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
          </Section>
        ) : null}

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

        {isAdmin ? (
          <>
            <Section title={`${data.boat.name}の今日の利用状況`}>
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
                    </Card>
                  );
                })}
              </div>
            </Section>

            {nextReservation ? (
              <Section title={`${data.boat.name}の次回予約`}>
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
              title={`${data.boat.name}の最新サポート要請`}
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
              title={`${data.boat.name}の最新申し送り`}
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
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
