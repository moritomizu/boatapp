"use client";

import Link from "next/link";
import { BookOpen, Map, ShipWheel } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge, Card, Section } from "@/components/ui";
import { findBoat } from "@/lib/boat-utils";
import { useClientAppData } from "@/lib/client-store";
import { getInitialAppData } from "@/lib/data-source";
import { targetFishLabels, voyageStatusLabels, voyageStatusTone } from "@/lib/labels";
import { formatDate, formatTime } from "@/lib/reservations";
import {
  calculateNavigationSummary,
  formatDuration,
} from "@/lib/voyages";

export default function MyLogPage() {
  const initialData = getInitialAppData();
  const data = useClientAppData(initialData);
  const myVoyages = data.voyageLogs
    .filter((voyage) => voyage.userId === data.currentUser.id)
    .filter((voyage) =>
      data.reservations.some((reservation) => reservation.id === voyage.reservationId),
    )
    .sort(
      (a, b) =>
        new Date(b.departedAt ?? b.createdAt).getTime() -
        new Date(a.departedAt ?? a.createdAt).getTime(),
    );

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-bold text-blue-700">航海履歴</p>
          <h1 className="text-2xl font-black tracking-normal text-blue-950">
            航海履歴
          </h1>
          <p className="text-sm leading-6 text-slate-600">
            出船時間、帰港時間、航路、メモを後から振り返れます。
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Card>
            <p className="text-xs font-bold text-slate-500">利用回数</p>
            <p className="mt-2 text-2xl font-black text-blue-950">
              {myVoyages.length}
            </p>
          </Card>
          <Card>
            <p className="text-xs font-bold text-slate-500">合計時間</p>
            <p className="mt-2 text-2xl font-black text-blue-950">
              {formatDuration(
                myVoyages.reduce((total, voyage) => total + (voyage.durationMinutes ?? 0), 0),
              )}
            </p>
          </Card>
          <Card>
            <p className="text-xs font-bold text-slate-500">合計距離</p>
            <p className="mt-2 text-2xl font-black text-blue-950">
              {myVoyages
                .reduce((total, voyage) => total + (voyage.distanceKm ?? 0), 0)
                .toFixed(1)}
              km
            </p>
          </Card>
        </div>

        <Section title="航海ログ">
          <div className="space-y-3">
            {myVoyages.map((voyage) => {
              const reservation = data.reservations.find(
                (item) => item.id === voyage.reservationId,
              );
              const boat = findBoat(data, voyage.boatId);
              const summary =
                voyage.navigationSummary ??
                calculateNavigationSummary(
                  voyage.trackPoints,
                  voyage.departedAt,
                  voyage.returnedAt,
                );

              return (
                <Card key={voyage.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-black text-blue-950">
                        {reservation ? formatDate(reservation.startAt) : "日付未設定"}
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-600">
                        {boat.name}
                      </p>
                    </div>
                    <Badge className={voyageStatusTone[voyage.status]}>
                      {voyageStatusLabels[voyage.status]}
                    </Badge>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-bold text-slate-500">出港</p>
                      <p className="mt-1 font-black text-slate-950">
                        {voyage.departedAt ? formatTime(voyage.departedAt) : "-"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-bold text-slate-500">帰港</p>
                      <p className="mt-1 font-black text-slate-950">
                        {voyage.returnedAt ? formatTime(voyage.returnedAt) : "-"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-bold text-slate-500">利用時間</p>
                      <p className="mt-1 font-black text-slate-950">
                        {formatDuration(voyage.durationMinutes)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-bold text-slate-500">距離</p>
                      <p className="mt-1 font-black text-slate-950">
                        {summary.totalDistanceKm.toFixed(1)}km
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-bold text-slate-500">平均速度</p>
                      <p className="mt-1 font-black text-slate-950">
                        {summary.averageSpeedKmh.toFixed(1)}km/h
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-bold text-slate-500">最高速度</p>
                      <p className="mt-1 font-black text-slate-950">
                        {summary.maxSpeedKmh.toFixed(1)}km/h
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-bold text-slate-500">航跡</p>
                      <p className="mt-1 font-black text-slate-950">
                        {summary.trackPointCount > 1
                          ? `${summary.trackPointCount}点`
                          : "なし"}
                      </p>
                    </div>
                  </div>

                  {reservation ? (
                    <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
                      {targetFishLabels[reservation.targetFish]} /{" "}
                      {reservation.destinationArea} / 同乗者{" "}
                      {Math.max(0, reservation.passengerCount - 1)}名
                    </p>
                  ) : null}
                  {voyage.memo ? (
                    <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                      {voyage.memo}
                    </p>
                  ) : null}

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Link
                      href={`/voyage-logs/${voyage.id}`}
                      className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-black text-white"
                    >
                      <Map size={17} aria-hidden="true" />
                      航路を見る
                    </Link>
                    <Link
                      href={`/reservations#reservation-${voyage.reservationId}`}
                      className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-sky-200 px-4 text-sm font-black text-blue-900"
                    >
                      <BookOpen size={17} aria-hidden="true" />
                      予約を確認
                    </Link>
                  </div>
                </Card>
              );
            })}
            {myVoyages.length === 0 ? (
              <Card>
                <div className="flex items-start gap-3">
                  <ShipWheel className="mt-0.5 text-blue-800" size={22} />
                  <p className="text-sm font-semibold leading-6 text-slate-600">
                    まだ自分の航海ログはありません。出船開始から記録するとここに表示されます。
                  </p>
                </div>
              </Card>
            ) : null}
          </div>
        </Section>
      </div>
    </AppShell>
  );
}
