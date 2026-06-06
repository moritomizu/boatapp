"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ClipboardCheck,
  Clock,
  LifeBuoy,
  MessageSquareWarning,
  Moon,
  Ship,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge, Card, Section } from "@/components/ui";
import { reservationSessionStatusLabels, reservationSessionStatusTone } from "@/lib/labels";
import { formatDate, formatTime } from "@/lib/reservations";
import {
  getUserUsageEntries,
  getUserUsageSummary,
} from "@/lib/usage-history";
import { getInitialAppData } from "@/lib/data-source";
import { useClientAppData } from "@/lib/client-store";

export default function UsageHistoryPage() {
  const data = useClientAppData(getInitialAppData());
  const searchParams = useSearchParams();
  const canViewOthers =
    data.currentUser.role === "admin" || data.currentUser.role === "owner";
  const requestedUserId = searchParams.get("userId") ?? data.currentUser.id;
  const userId = canViewOthers ? requestedUserId : data.currentUser.id;
  const user = data.users.find((item) => item.id === userId) ?? data.currentUser;
  const entries = getUserUsageEntries(data, user.id);
  const summary = getUserUsageSummary(data, user.id);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-bold text-blue-700">利用実績</p>
          <h1 className="text-2xl font-black tracking-normal text-blue-950">
            {user.id === data.currentUser.id ? "マイ利用履歴" : `${user.name}さんの利用履歴`}
          </h1>
          <p className="text-sm leading-6 text-slate-600">
            予約、出船前チェック、帰港後チェック、航海ログから利用実績を集計します。評価点数は扱いません。
          </p>
        </div>

        {canViewOthers ? (
          <Section title="対象メンバー">
            <div className="grid gap-2 sm:grid-cols-3">
              {data.users.map((candidate) => (
                <Link
                  key={candidate.id}
                  href={`/usage-history?userId=${candidate.id}`}
                  className={`rounded-lg px-3 py-3 text-sm font-black ring-1 ${
                    candidate.id === user.id
                      ? "bg-blue-800 text-white ring-blue-800"
                      : "bg-white text-blue-900 ring-sky-100"
                  }`}
                >
                  {candidate.name}
                </Link>
              ))}
            </div>
          </Section>
        ) : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <p className="text-xs font-bold text-slate-500">今月</p>
            <p className="mt-2 text-2xl font-black text-blue-950">
              {summary.thisMonthCount}回
            </p>
          </Card>
          <Card>
            <p className="text-xs font-bold text-slate-500">累計</p>
            <p className="mt-2 text-2xl font-black text-blue-950">
              {summary.totalCount}回
            </p>
          </Card>
          <Card>
            <p className="text-xs font-bold text-slate-500">累計時間</p>
            <p className="mt-2 text-2xl font-black text-blue-950">
              {summary.totalHours.toFixed(1)}h
            </p>
          </Card>
          <Card>
            <p className="text-xs font-bold text-slate-500">利用船舶</p>
            <p className="mt-2 text-2xl font-black text-blue-950">
              {summary.boatCount}艇
            </p>
          </Card>
        </div>

        <Section title="安全運用の実績">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <div className="flex items-center gap-2 text-sm font-black text-blue-900">
                <ClipboardCheck size={18} aria-hidden="true" />
                出船前チェック
              </div>
              <p className="mt-2 text-2xl font-black text-blue-950">
                {summary.preCheckRate.toFixed(0)}%
              </p>
            </Card>
            <Card>
              <div className="flex items-center gap-2 text-sm font-black text-emerald-900">
                <ClipboardCheck size={18} aria-hidden="true" />
                帰港後チェック
              </div>
              <p className="mt-2 text-2xl font-black text-emerald-900">
                {summary.postCheckRate.toFixed(0)}%
              </p>
            </Card>
            <Card>
              <div className="flex items-center gap-2 text-sm font-black text-slate-800">
                <Moon size={18} aria-hidden="true" />
                夜間利用
              </div>
              <p className="mt-2 text-2xl font-black text-slate-950">
                {summary.nightUseCount}回
              </p>
            </Card>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Card>
              <div className="flex items-center gap-2 text-sm font-black text-rose-800">
                <LifeBuoy size={18} aria-hidden="true" />
                相談作成
              </div>
              <p className="mt-2 text-xl font-black text-rose-800">
                {summary.supportCreatedCount}件
              </p>
            </Card>
            <Card>
              <div className="flex items-center gap-2 text-sm font-black text-blue-900">
                <LifeBuoy size={18} aria-hidden="true" />
                サポート回答
              </div>
              <p className="mt-2 text-xl font-black text-blue-950">
                {summary.supportAnsweredCount}件
              </p>
            </Card>
            <Card>
              <div className="flex items-center gap-2 text-sm font-black text-amber-900">
                <MessageSquareWarning size={18} aria-hidden="true" />
                申し送り作成
              </div>
              <p className="mt-2 text-xl font-black text-amber-900">
                {summary.handoverCreatedCount}件
              </p>
            </Card>
          </div>
        </Section>

        <Section title="利用履歴">
          <div className="space-y-3">
            {entries.map((entry) => (
              <Card key={entry.reservation.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-black text-blue-700">
                      <Ship size={16} aria-hidden="true" />
                      {entry.boatName}
                    </p>
                    <p className="mt-1 text-lg font-black text-blue-950">
                      {formatDate(entry.reservation.startAt)}
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-600">
                      {formatTime(entry.reservation.startAt)} -{" "}
                      {formatTime(entry.reservation.endAt)}
                    </p>
                  </div>
                  <Badge className={reservationSessionStatusTone[entry.sessionStatus as keyof typeof reservationSessionStatusTone]}>
                    {reservationSessionStatusLabels[entry.sessionStatus as keyof typeof reservationSessionStatusLabels]}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <div className="rounded-lg bg-slate-50 p-2 font-bold text-slate-700">
                    <Clock size={15} className="mr-1 inline" aria-hidden="true" />
                    {(entry.durationMinutes / 60).toFixed(1)}h
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2 font-bold text-slate-700">
                    出船前 {entry.preCheckDone ? "済" : "未"}
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2 font-bold text-slate-700">
                    帰港後 {entry.postCheckDone ? "済" : "未"}
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2 font-bold text-slate-700">
                    航跡 {entry.hasVoyageLog ? "あり" : "なし"}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge className="bg-rose-50 text-rose-800 ring-rose-100">
                    相談{entry.supportCount}件
                  </Badge>
                  <Badge className="bg-amber-50 text-amber-900 ring-amber-100">
                    申し送り{entry.handoverCount}件
                  </Badge>
                </div>
                {entry.memo ? (
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {entry.memo}
                  </p>
                ) : null}
                {entry.voyageId ? (
                  <Link
                    href={`/voyage-logs/${entry.voyageId}`}
                    className="mt-3 flex min-h-11 items-center justify-center rounded-lg bg-blue-800 px-4 text-sm font-black text-white"
                  >
                    航路を見る
                  </Link>
                ) : null}
              </Card>
            ))}
            {entries.length === 0 ? (
              <Card>
                <p className="text-sm font-semibold text-slate-600">
                  利用履歴はまだありません。
                </p>
              </Card>
            ) : null}
          </div>
        </Section>
      </div>
    </AppShell>
  );
}
