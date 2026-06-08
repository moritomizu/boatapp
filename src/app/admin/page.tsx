"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Coins,
  FileText,
  LifeBuoy,
  MessageSquareWarning,
  Navigation,
  Ship,
  UserPlus,
  Users,
  Wrench,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge, Card, Section } from "@/components/ui";
import { getBoats } from "@/lib/boat-utils";
import { useClientAppData } from "@/lib/client-store";
import { getInitialAppData } from "@/lib/data-source";
import { getBoatFund, getSafetyFund, safetyTransactions } from "@/lib/funds";
import {
  boatStatusLabels,
  boatStatusTone,
  handoverPriorityLabels,
  handoverPriorityTone,
  reservationSessionStatusLabels,
  reservationSessionStatusTone,
  supportStatusLabels,
  supportUrgencyLabels,
  supportUrgencyTone,
} from "@/lib/labels";
import {
  formatDate,
  formatTime,
  getReservationSessionStatus,
} from "@/lib/reservations";
import {
  currentYearMonth,
  formatCurrency,
  generateMonthlyRevenueReport,
  reportStatusLabels,
} from "@/lib/revenue";
import type { Boat, Reservation } from "@/types/domain";

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isSameDate(value: string, date: Date) {
  return dayKey(new Date(value)) === dayKey(date);
}

function isWithinDays(value: string, start: Date, days: number) {
  const target = new Date(value).getTime();
  const startAt = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const endAt = startAt + days * 24 * 60 * 60 * 1000;

  return target >= startAt && target < endAt;
}

function hoursSince(iso?: string) {
  if (!iso) return "-";
  const hours = Math.max(0, (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60));
  if (hours < 1) return `${Math.round(hours * 60)}分`;
  return `${hours.toFixed(1)}時間`;
}

function reservationUserName(users: { id: string; name: string }[], reservation: Reservation) {
  return users.find((user) => user.id === reservation.userId)?.name ?? "不明";
}

export default function AdminPage() {
  const data = useClientAppData(getInitialAppData());
  const isAdmin = data.currentUser.role === "admin";
  const isOwner = data.currentUser.role === "owner" || isAdmin;
  const now = new Date();
  const currentMonth = currentYearMonth(now);
  const boats = getBoats(data);
  const ownedBoatIds = new Set(
    data.boatOwnerships
      .filter(
        (ownership) =>
          ownership.organizationId === data.organization.id &&
          ownership.ownerUserId === data.currentUser.id,
      )
      .map((ownership) => ownership.boatId),
  );
  const visibleBoats = isAdmin
    ? boats
    : boats.filter((boat) => ownedBoatIds.has(boat.id));
  const visibleBoatIds = new Set(visibleBoats.map((boat) => boat.id));
  const visibleReservations = data.reservations.filter(
    (reservation) =>
      visibleBoatIds.has(reservation.boatId) &&
      !reservation.deletedAt,
  );
  const todaysReservations = visibleReservations.filter((reservation) =>
    isSameDate(reservation.startAt, now),
  );
  const upcomingReservations = visibleReservations
    .filter((reservation) => isWithinDays(reservation.startAt, now, 7))
    .sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    );
  const activeVoyages = data.voyageLogs.filter(
    (voyage) => visibleBoatIds.has(voyage.boatId) && voyage.status === "underway",
  );
  const nonClosedReservations = visibleReservations.filter((reservation) => {
    if (reservation.canceledAt) return false;
    const status = getReservationSessionStatus(reservation, data);
    return status !== "closed" && new Date(reservation.endAt).getTime() < now.getTime();
  });
  const postReturnMissing = nonClosedReservations.filter(
    (reservation) =>
      !data.postReturnChecks.some((check) => check.reservationId === reservation.id),
  );
  const pendingApplications = data.membershipApplications.filter(
    (application) =>
      application.status === "pending" || application.status === "reviewing",
  );
  const activeSupportRequests = data.supportRequests
    .filter(
      (request) =>
        visibleBoatIds.has(request.boatId) &&
        request.status !== "resolved" &&
        request.status !== "closed",
    )
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const importantHandovers = data.handoverNotes
    .filter(
      (note) =>
        visibleBoatIds.has(note.boatId) &&
        note.status !== "resolved" &&
        (note.priority === "high" || note.status === "unconfirmed"),
    )
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const maintenanceIssues = data.maintenanceLogs.filter(
    (log) =>
      visibleBoatIds.has(log.boatId) &&
      (log.costResponsibility === "undecided" || (log.hasCost && !log.costResponsibility)),
  );
  const report =
    data.monthlyRevenueReports.find(
      (item) => item.organizationId === data.organization.id && item.yearMonth === currentMonth,
    ) ?? generateMonthlyRevenueReport(data, currentMonth);
  const safetyFund = getSafetyFund(data);
  const safetyMonthTransactions = safetyTransactions(data).filter((transaction) =>
    transaction.createdAt.startsWith(currentMonth),
  );
  const lowBoatFunds = visibleBoats
    .map((boat) => ({ boat, fund: getBoatFund(data, boat.id) }))
    .filter((item) => item.fund.balance < 0 || item.fund.balance < 30000);
  const summaryItems = [
    { label: "今日の予約", value: `${todaysReservations.length}件`, href: "/reservations", icon: CalendarDays },
    { label: "出船中", value: `${activeVoyages.length}件`, href: "/voyages", icon: Navigation },
    { label: "未クローズ", value: `${nonClosedReservations.length}件`, href: "/reservations", icon: ClipboardCheck },
    { label: "申請待ち", value: `${pendingApplications.length}件`, href: "/organization#membership-applications", icon: UserPlus },
    { label: "サポート", value: `${activeSupportRequests.length}件`, href: "/support", icon: LifeBuoy },
    { label: "申し送り", value: `${importantHandovers.length}件`, href: "/handovers", icon: MessageSquareWarning },
    { label: "メンテ要確認", value: `${maintenanceIssues.length}件`, href: "/boats", icon: Wrench },
    { label: "月次配分", value: report.status === "confirmed" ? "確定済" : "未確定", href: "/revenue", icon: Coins },
  ];
  const quickActions = [
    { href: "/reservations#new", label: "新規予約を作成", icon: CalendarDays },
    { href: "/reservations", label: "予約カレンダー", icon: ClipboardCheck },
    { href: "/organization#membership-applications", label: "会員申請を見る", icon: UserPlus },
    { href: "/members", label: "メンバー管理", icon: Users },
    { href: "/boats", label: "船舶管理", icon: Ship },
    { href: "/funds", label: "基金管理", icon: Coins },
    { href: "/revenue", label: "月次配分レポート", icon: FileText },
    { href: "/support", label: "サポート要請", icon: LifeBuoy },
    { href: "/handovers", label: "申し送り", icon: MessageSquareWarning },
    { href: "/my-log", label: "航海履歴", icon: Navigation },
    { href: "/boats", label: "Googleカレンダー連携設定", icon: CalendarDays },
    { href: "/notifications", label: "通知設定", icon: AlertTriangle },
  ];
  const todoItems = [
    ...postReturnMissing.slice(0, 3).map((reservation) => ({
      key: `post-${reservation.id}`,
      title: "帰港後チェック未完了",
      detail: `${boats.find((boat) => boat.id === reservation.boatId)?.name ?? "船舶"} / ${formatDate(reservation.startAt)} ${formatTime(reservation.endAt)}終了`,
      priority: "高",
      href: `/checks/post-return?reservationId=${reservation.id}`,
      action: "帰港後チェックへ",
    })),
    ...nonClosedReservations.slice(0, 3).map((reservation) => ({
      key: `close-${reservation.id}`,
      title: "予約クローズ未完了",
      detail: `${boats.find((boat) => boat.id === reservation.boatId)?.name ?? "船舶"} / ${reservationUserName(data.users, reservation)}`,
      priority: "中",
      href: `/reservations#reservation-${reservation.id}`,
      action: "予約を確認",
    })),
    ...(pendingApplications.length > 0
      ? [
          {
            key: "applications",
            title: "参加申請の確認",
            detail: `${pendingApplications.length}件の申請が未処理です`,
            priority: "高",
            href: "/organization#membership-applications",
            action: "申請を見る",
          },
        ]
      : []),
    ...activeSupportRequests.slice(0, 2).map((request) => ({
      key: `support-${request.id}`,
      title: "未対応サポート要請",
      detail: `${boats.find((boat) => boat.id === request.boatId)?.name ?? "船舶"} / ${request.title}`,
      priority: request.urgency === "high" ? "高" : "中",
      href: `/support?supportId=${request.id}#support-detail`,
      action: "対応する",
    })),
    ...(report.status !== "confirmed"
      ? [
          {
            key: "revenue",
            title: "月次配分レポート未確定",
            detail: `${currentMonth} / ${reportStatusLabels[report.status]}`,
            priority: "中",
            href: "/revenue",
            action: "確認する",
          },
        ]
      : []),
    ...lowBoatFunds.slice(0, 2).map(({ boat, fund }) => ({
      key: `fund-${boat.id}`,
      title: "メンテ積立残高の確認",
      detail: `${boat.name} / ${formatCurrency(fund.balance)}`,
      priority: fund.balance < 0 ? "高" : "中",
      href: "/funds",
      action: "基金を見る",
    })),
  ];

  if (!isOwner) {
    return (
      <AppShell>
        <Card>
          <p className="font-black text-blue-950">
            運営TOPは管理者/オーナー向け画面です。
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
            通常の利用操作はホーム、予約、船舶情報から確認してください。
          </p>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-bold text-blue-700">運営TOP</p>
          <h1 className="text-2xl font-black tracking-normal text-blue-950">
            Admin Command Center
          </h1>
          <p className="text-sm leading-6 text-slate-600">
            今日の予約、出船状況、会員申請、メンテナンス、月次配分をまとめて確認できます。
          </p>
        </div>

        <Section title="今日の運営状況">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {summaryItems.map((item) => {
              const SummaryIcon = item.icon;
              return (
                <Link key={item.label} href={item.href} className="block">
                  <Card>
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-lg bg-sky-100 text-blue-800">
                        <SummaryIcon size={20} aria-hidden="true" />
                      </span>
                      <span>
                        <span className="block text-xs font-bold text-slate-500">{item.label}</span>
                        <span className="mt-1 block text-xl font-black text-blue-950">{item.value}</span>
                      </span>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </Section>

        <Section title="要対応">
          <div className="space-y-3">
            {todoItems.slice(0, 8).map((item) => (
              <Card key={item.key}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-blue-950">{item.title}</p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
                      {item.detail}
                    </p>
                  </div>
                  <Badge
                    className={
                      item.priority === "高"
                        ? "bg-rose-100 text-rose-800 ring-rose-200"
                        : "bg-amber-100 text-amber-900 ring-amber-200"
                    }
                  >
                    {item.priority}
                  </Badge>
                </div>
                <Link
                  href={item.href}
                  className="mt-3 flex min-h-11 items-center justify-center rounded-lg bg-blue-800 px-4 text-sm font-black text-white"
                >
                  {item.action}
                </Link>
              </Card>
            ))}
            {todoItems.length === 0 ? (
              <Card>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 text-emerald-700" size={22} aria-hidden="true" />
                  <div>
                    <p className="font-black text-blue-950">大きな要対応はありません</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      予約、サポート、申請、基金残高に大きな未対応はありません。
                    </p>
                  </div>
                </div>
              </Card>
            ) : null}
          </div>
        </Section>

        <Section title="今日・近日の予約">
          <div className="space-y-3">
            {upcomingReservations.slice(0, 6).map((reservation) => {
              const boat = boats.find((item) => item.id === reservation.boatId);
              const status = getReservationSessionStatus(reservation, data);
              const preDone = data.preDepartureChecks.some((check) => check.reservationId === reservation.id);
              const postDone = data.postReturnChecks.some((check) => check.reservationId === reservation.id);

              return (
                <Card key={reservation.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-blue-950">
                        {formatDate(reservation.startAt)} {formatTime(reservation.startAt)}
                      </p>
                      <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
                        {boat?.name ?? "船舶"} / {reservationUserName(data.users, reservation)} / {reservation.destinationArea}
                      </p>
                    </div>
                    <Badge className={reservationSessionStatusTone[status]}>
                      {reservationSessionStatusLabels[status]}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-bold text-slate-600">
                    <span className="rounded-lg bg-slate-50 p-2">
                      前: {preDone ? "済" : "未"}
                    </span>
                    <span className="rounded-lg bg-slate-50 p-2">
                      後: {postDone ? "済" : "未"}
                    </span>
                    <span className="rounded-lg bg-slate-50 p-2">
                      ゲスト {reservation.passengerCount > 1 ? "あり" : "なし"}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <Link href={`/reservations#reservation-${reservation.id}`} className="flex min-h-10 items-center justify-center rounded-lg bg-sky-50 px-3 text-sm font-black text-blue-900">
                      予約詳細
                    </Link>
                    <Link href={`/voyages?reservationId=${reservation.id}`} className="flex min-h-10 items-center justify-center rounded-lg bg-sky-50 px-3 text-sm font-black text-blue-900">
                      出船状況
                    </Link>
                    <Link href={`/checks/post-return?reservationId=${reservation.id}`} className="flex min-h-10 items-center justify-center rounded-lg bg-sky-50 px-3 text-sm font-black text-blue-900">
                      帰港後
                    </Link>
                  </div>
                </Card>
              );
            })}
            {upcomingReservations.length === 0 ? (
              <Card>
                <p className="text-sm font-semibold text-slate-600">
                  今後7日間の予約はありません。
                </p>
              </Card>
            ) : null}
          </div>
        </Section>

        <Section title="出船中・クローズ未完了">
          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <p className="flex items-center gap-2 font-black text-blue-950">
                <Navigation size={18} aria-hidden="true" />
                現在出船中
              </p>
              <div className="mt-3 space-y-3">
                {activeVoyages.slice(0, 4).map((voyage) => {
                  const boat = boats.find((item) => item.id === voyage.boatId);
                  const reservation = data.reservations.find((item) => item.id === voyage.reservationId);
                  const supports = data.supportRequests.filter(
                    (request) =>
                      request.reservationId === voyage.reservationId &&
                      request.status !== "resolved" &&
                      request.status !== "closed",
                  );
                  return (
                    <Link key={voyage.id} href={`/voyages?reservationId=${voyage.reservationId}`} className="block rounded-lg bg-slate-50 p-3">
                      <p className="font-black text-slate-950">{boat?.name ?? "船舶"}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-600">
                        {reservation ? reservationUserName(data.users, reservation) : "予約未確認"} / 経過 {hoursSince(voyage.departedAt)}
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        サポート {supports.length}件 / 航行ログ {voyage.trackPoints.length > 0 ? "あり" : "未記録"}
                      </p>
                    </Link>
                  );
                })}
                {activeVoyages.length === 0 ? (
                  <p className="text-sm font-semibold text-slate-600">現在出船中の船はありません。</p>
                ) : null}
              </div>
            </Card>

            <Card>
              <p className="flex items-center gap-2 font-black text-blue-950">
                <ClipboardCheck size={18} aria-hidden="true" />
                クローズ未完了
              </p>
              <div className="mt-3 space-y-3">
                {nonClosedReservations.slice(0, 4).map((reservation) => {
                  const boat = boats.find((item) => item.id === reservation.boatId);
                  const postDone = data.postReturnChecks.some((check) => check.reservationId === reservation.id);
                  return (
                    <Link key={reservation.id} href={`/reservations#reservation-${reservation.id}`} className="block rounded-lg bg-slate-50 p-3">
                      <p className="font-black text-slate-950">{boat?.name ?? "船舶"}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-600">
                        終了予定 {formatDate(reservation.endAt)} {formatTime(reservation.endAt)}
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        帰港後チェック: {postDone ? "済" : "未完了"}
                      </p>
                    </Link>
                  );
                })}
                {nonClosedReservations.length === 0 ? (
                  <p className="text-sm font-semibold text-slate-600">クローズ未完了の予約はありません。</p>
                ) : null}
              </div>
            </Card>
          </div>
        </Section>

        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="参加申請">
            <div className="space-y-3">
              {pendingApplications.slice(0, 4).map((application) => (
                <Link key={application.id} href="/organization#membership-applications" className="block">
                  <Card>
                    <p className="font-black text-blue-950">{application.profile.name}</p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
                      {application.profile.email} / 免許 {application.licenseInfo?.hasLicense ? "あり" : "なし"} / {formatDate(application.createdAt)}
                    </p>
                  </Card>
                </Link>
              ))}
              {pendingApplications.length === 0 ? (
                <Card>
                  <p className="text-sm font-semibold text-slate-600">承認待ちの参加申請はありません。</p>
                </Card>
              ) : null}
            </div>
          </Section>

          <Section title="サポート・申し送り">
            <div className="space-y-3">
              {activeSupportRequests.slice(0, 3).map((request) => (
                <Link key={request.id} href={`/support?supportId=${request.id}#support-detail`} className="block">
                  <Card>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-blue-950">{request.title}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-600">
                          {boats.find((boat) => boat.id === request.boatId)?.name ?? "船舶"} / {supportStatusLabels[request.status]}
                        </p>
                      </div>
                      <Badge className={supportUrgencyTone[request.urgency]}>
                        {supportUrgencyLabels[request.urgency].split("：")[0]}
                      </Badge>
                    </div>
                  </Card>
                </Link>
              ))}
              {importantHandovers.slice(0, 3).map((note) => (
                <Link key={note.id} href="/handovers" className="block">
                  <Card>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-blue-950">{note.title}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-600">
                          {boats.find((boat) => boat.id === note.boatId)?.name ?? "船舶"} / {formatDate(note.updatedAt)}
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

        <Section title="船舶ステータス">
          <div className="grid gap-3 sm:grid-cols-2">
            {visibleBoats.map((boat: Boat) => {
              const boatToday = todaysReservations.filter((reservation) => reservation.boatId === boat.id);
              const boatVoyage = activeVoyages.find((voyage) => voyage.boatId === boat.id);
              const boatHandovers = importantHandovers.filter((note) => note.boatId === boat.id);
              const boatMaintenance = maintenanceIssues.filter((log) => log.boatId === boat.id);
              const fund = getBoatFund(data, boat.id);
              const currentState = boatVoyage
                ? "出船中"
                : boat.status === "in_repair"
                  ? "メンテ中"
                  : boatToday.length > 0
                    ? "予約あり"
                    : boatStatusLabels[boat.status];
              return (
                <Card key={boat.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-blue-950">{boat.name}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-600">{currentState}</p>
                    </div>
                    <Badge className={boatStatusTone[boat.status]}>
                      {boatStatusLabels[boat.status]}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-bold text-slate-600">
                    <span className="rounded-lg bg-slate-50 p-2">今日 {boatToday.length}件</span>
                    <span className="rounded-lg bg-slate-50 p-2">申し送り {boatHandovers.length}件</span>
                    <span className="rounded-lg bg-slate-50 p-2">メンテ {boatMaintenance.length}件</span>
                    <span className="rounded-lg bg-slate-50 p-2">{formatCurrency(fund.balance)}</span>
                  </div>
                  <Link href="/boats" className="mt-3 flex min-h-10 items-center justify-center rounded-lg bg-sky-50 px-3 text-sm font-black text-blue-900">
                    船舶詳細
                  </Link>
                </Card>
              );
            })}
          </div>
        </Section>

        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="メンテ積立・安全基金">
            <Card>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-blue-950">共通安全基金</p>
                  <p className="mt-1 text-2xl font-black text-blue-950">
                    {formatCurrency(safetyFund.balance)}
                  </p>
                </div>
                <Badge
                  className={
                    safetyFund.balance < 30000
                      ? "bg-rose-100 text-rose-800 ring-rose-200"
                      : "bg-emerald-100 text-emerald-800 ring-emerald-200"
                  }
                >
                  {safetyFund.balance < 30000 ? "要確認" : "良好"}
                </Badge>
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-600">
                当月入出金 {safetyMonthTransactions.length}件 / 船別低残高 {lowBoatFunds.length}件
              </p>
              <Link href="/funds" className="mt-3 flex min-h-11 items-center justify-center rounded-lg bg-blue-800 px-4 text-sm font-black text-white">
                基金管理へ
              </Link>
            </Card>
          </Section>

          <Section title="月次配分レポート">
            <Card>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-blue-950">{currentMonth}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    会費総額 {formatCurrency(report.totalMembershipRevenue)}
                  </p>
                </div>
                <Badge
                  className={
                    report.status === "confirmed"
                      ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
                      : "bg-amber-100 text-amber-900 ring-amber-200"
                  }
                >
                  {reportStatusLabels[report.status]}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-bold text-slate-600">
                <span className="rounded-lg bg-slate-50 p-2">
                  船主還元 {formatCurrency(report.boatSummaries.reduce((total, summary) => total + summary.ownerReturnAmount, 0))}
                </span>
                <span className="rounded-lg bg-slate-50 p-2">
                  メンテ積立 {formatCurrency(report.boatSummaries.reduce((total, summary) => total + summary.maintenanceReserveAmount, 0))}
                </span>
                <span className="rounded-lg bg-slate-50 p-2">
                  運営費 {formatCurrency(report.boatSummaries.reduce((total, summary) => total + summary.operationFeeAmount, 0))}
                </span>
                <span className="rounded-lg bg-slate-50 p-2">
                  未確定 {report.status === "confirmed" ? 0 : report.boatSummaries.length}艇
                </span>
              </div>
              <Link href="/revenue" className="mt-3 flex min-h-11 items-center justify-center rounded-lg bg-blue-800 px-4 text-sm font-black text-white">
                月次配分へ
              </Link>
            </Card>
          </Section>
        </div>

        <Section title="クイック操作">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {quickActions.map((action) => {
              const QuickIcon = action.icon;
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  className="flex min-h-14 items-center gap-3 rounded-lg border border-sky-100 bg-white px-4 text-sm font-black text-blue-950 shadow-sm"
                >
                  <span className="grid size-9 place-items-center rounded-lg bg-sky-100 text-blue-800">
                    <QuickIcon size={20} aria-hidden="true" />
                  </span>
                  {action.label}
                </Link>
              );
            })}
          </div>
        </Section>
      </div>
    </AppShell>
  );
}
