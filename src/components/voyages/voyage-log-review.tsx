"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ClipboardCheck,
  FileText,
  Map,
  MessageSquareWarning,
  Save,
} from "lucide-react";
import { Badge, Card, Section } from "@/components/ui";
import { VoyageMap } from "@/components/voyages/voyage-map";
import { findBoat } from "@/lib/boat-utils";
import { updateClientAppData, useClientAppData } from "@/lib/client-store";
import {
  calculateNavigationSummary,
  detectStopCandidates,
  formatDuration,
} from "@/lib/voyages";
import { formatDate, formatTime } from "@/lib/reservations";
import {
  targetFishLabels,
  voyageReviewStatusLabels,
  voyageStatusLabels,
  voyageStatusTone,
} from "@/lib/labels";
import type { AppData, VoyageReviewStatus } from "@/types/domain";

type VoyageLogReviewProps = {
  data: AppData;
  logId: string;
};

export function VoyageLogReview({ data, logId }: VoyageLogReviewProps) {
  const appData = useClientAppData(data);
  const voyage = appData.voyageLogs.find((item) => item.id === logId);
  const [reviewStatus, setReviewStatus] = useState<VoyageReviewStatus>(
    voyage?.reviewStatus ?? "unreviewed",
  );
  const [reviewMemo, setReviewMemo] = useState(voyage?.reviewMemo ?? "");
  const [reviewState, setReviewState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  if (!voyage) {
    return (
      <div className="space-y-4">
        <Link
          href="/my-log"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-sky-200 bg-white px-4 text-sm font-black text-blue-900"
        >
          <ArrowLeft size={17} aria-hidden="true" />
          航海履歴へ戻る
        </Link>
        <Card>
          <p className="text-sm font-bold leading-6 text-slate-600">
            指定された航海ログが見つかりません。
          </p>
        </Card>
      </div>
    );
  }

  const currentVoyage = voyage;
  const reservation = appData.reservations.find(
    (item) => item.id === currentVoyage.reservationId,
  );
  const boat = findBoat(appData, currentVoyage.boatId);
  const user = appData.users.find((item) => item.id === currentVoyage.userId);
  const summary =
    currentVoyage.navigationSummary ??
    calculateNavigationSummary(
      currentVoyage.trackPoints,
      currentVoyage.departedAt,
      currentVoyage.returnedAt,
    );
  const stopCandidates =
    currentVoyage.stopCandidates ?? detectStopCandidates(currentVoyage.trackPoints);
  const preCheck = appData.preDepartureChecks.find(
    (item) => item.reservationId === currentVoyage.reservationId,
  );
  const postCheck = appData.postReturnChecks.find(
    (item) => item.reservationId === currentVoyage.reservationId,
  );
  const handovers = appData.handoverNotes.filter(
    (item) => item.reservationId === currentVoyage.reservationId,
  );
  const canReview =
    appData.currentUser.role === "admin" || appData.currentUser.role === "owner";

  async function saveReview() {
    if (!canReview || reviewState === "saving") return;
    setReviewState("saving");

    const now = new Date().toISOString();
    try {
      await updateClientAppData(
        (current) => ({
          ...current,
          voyageLogs: current.voyageLogs.map((item) =>
            item.id === currentVoyage.id
              ? {
                  ...item,
                  reviewStatus,
                  reviewMemo,
                  reviewedBy: appData.currentUser.id,
                  reviewedAt: now,
                  updatedAt: now,
                }
              : item,
          ),
        }),
        appData,
      );
      setReviewState("saved");
    } catch {
      setReviewState("error");
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Link
          href="/my-log"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-sky-200 bg-white px-4 text-sm font-black text-blue-900"
        >
          <ArrowLeft size={17} aria-hidden="true" />
          航海履歴へ戻る
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-blue-700">航路レビュー</p>
            <h1 className="mt-1 text-2xl font-black tracking-normal text-blue-950">
              {reservation
                ? `${formatDate(reservation.startAt)} ${reservation.destinationArea}`
                : "航海ログ詳細"}
            </h1>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
              {boat.name} / {user?.name ?? "利用者不明"} /{" "}
              {currentVoyage.departedAt ? formatTime(currentVoyage.departedAt) : "-"} -{" "}
              {currentVoyage.returnedAt ? formatTime(currentVoyage.returnedAt) : "-"}
            </p>
          </div>
          <Badge className={voyageStatusTone[currentVoyage.status]}>
            {voyageStatusLabels[currentVoyage.status]}
          </Badge>
        </div>
      </div>

      <VoyageMap
        points={currentVoyage.trackPoints}
        stopCandidates={stopCandidates}
        heightClassName="h-[50vh] min-h-80 max-h-[560px]"
      />

      <Section title="航行サマリー">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Card>
            <p className="text-xs font-bold text-slate-500">距離</p>
            <p className="mt-1 text-xl font-black text-blue-950">
              {summary.totalDistanceKm.toFixed(1)}km
            </p>
          </Card>
          <Card>
            <p className="text-xs font-bold text-slate-500">時間</p>
            <p className="mt-1 text-xl font-black text-blue-950">
              {formatDuration(summary.durationMinutes)}
            </p>
          </Card>
          <Card>
            <p className="text-xs font-bold text-slate-500">平均</p>
            <p className="mt-1 text-xl font-black text-blue-950">
              {summary.averageSpeedKmh.toFixed(1)}km/h
            </p>
          </Card>
          <Card>
            <p className="text-xs font-bold text-slate-500">最高</p>
            <p className="mt-1 text-xl font-black text-blue-950">
              {summary.maxSpeedKmh.toFixed(1)}km/h
            </p>
          </Card>
          <Card>
            <p className="text-xs font-bold text-slate-500">停船時間</p>
            <p className="mt-1 text-xl font-black text-blue-950">
              {formatDuration(summary.stoppedTimeMinutes)}
            </p>
          </Card>
          <Card>
            <p className="text-xs font-bold text-slate-500">記録点</p>
            <p className="mt-1 text-xl font-black text-blue-950">
              {summary.trackPointCount}点
            </p>
          </Card>
        </div>
      </Section>

      <Section title="停船候補">
        <div className="space-y-2">
          {stopCandidates.map((candidate, index) => (
            <Card key={candidate.id}>
              <p className="font-black text-amber-950">#{index + 1}</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
                {formatTime(candidate.startedAt)} - {formatTime(candidate.endedAt)} /{" "}
                {formatDuration(candidate.durationMinutes)} / 記録点
                {candidate.pointCount}件
              </p>
            </Card>
          ))}
          {stopCandidates.length === 0 ? (
            <Card>
              <p className="text-sm font-semibold leading-6 text-slate-600">
                停船候補は検出されていません。
              </p>
            </Card>
          ) : null}
        </div>
      </Section>

      <Section title="関連情報">
        <div className="grid gap-2 sm:grid-cols-2">
          {reservation ? (
            <Link
              href={`/reservations#reservation-${reservation.id}`}
              className="flex min-h-12 items-center gap-2 rounded-lg bg-white px-4 text-sm font-black text-blue-900 ring-1 ring-sky-100"
            >
              <FileText size={17} aria-hidden="true" />
              予約詳細を見る
            </Link>
          ) : null}
          <Link
            href={`/checks/pre-departure?reservationId=${currentVoyage.reservationId}`}
            className="flex min-h-12 items-center gap-2 rounded-lg bg-white px-4 text-sm font-black text-blue-900 ring-1 ring-sky-100"
          >
            <ClipboardCheck size={17} aria-hidden="true" />
            出船前チェック {preCheck ? "済" : "未"}
          </Link>
          <Link
            href={`/checks/post-return?reservationId=${currentVoyage.reservationId}`}
            className="flex min-h-12 items-center gap-2 rounded-lg bg-white px-4 text-sm font-black text-blue-900 ring-1 ring-sky-100"
          >
            <ClipboardCheck size={17} aria-hidden="true" />
            帰港後チェック {postCheck ? "済" : "未"}
          </Link>
          <Link
            href={`/handovers?reservationId=${currentVoyage.reservationId}#new`}
            className="flex min-h-12 items-center gap-2 rounded-lg bg-amber-50 px-4 text-sm font-black text-amber-900 ring-1 ring-amber-100"
          >
            <MessageSquareWarning size={17} aria-hidden="true" />
            申し送りを追加
          </Link>
        </div>
        {reservation ? (
          <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-700">
            {targetFishLabels[reservation.targetFish]} / {reservation.destinationArea} / 同乗
            {reservation.passengerCount}名
          </p>
        ) : null}
        {handovers.length > 0 ? (
          <div className="mt-3 space-y-2">
            {handovers.map((handover) => (
              <div
                key={handover.id}
                className="rounded-lg bg-white p-3 text-sm font-semibold leading-6 text-slate-700 ring-1 ring-slate-100"
              >
                {handover.title}
              </div>
            ))}
          </div>
        ) : null}
      </Section>

      {currentVoyage.memo ? (
        <Section title="メモ">
          <Card>
            <p className="text-sm leading-6 text-slate-700">{currentVoyage.memo}</p>
          </Card>
        </Section>
      ) : null}

      {canReview ? (
        <Section title="管理者レビュー">
          <Card>
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-bold text-slate-700">
                  評価ステータス
                </span>
                <select
                  value={reviewStatus}
                  onChange={(event) =>
                    setReviewStatus(event.target.value as VoyageReviewStatus)
                  }
                  className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                >
                  {(["unreviewed", "safe", "needs_review"] as VoyageReviewStatus[]).map(
                    (status) => (
                      <option key={status} value={status}>
                        {voyageReviewStatusLabels[status]}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-bold text-slate-700">評価メモ</span>
                <textarea
                  value={reviewMemo}
                  onChange={(event) => setReviewMemo(event.target.value)}
                  className="mt-2 min-h-24 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-base outline-none ring-blue-600 focus:ring-2"
                  placeholder="航行エリア、時間、帰港判断などを踏まえた確認メモ"
                />
              </label>
              {reviewState === "error" ? (
                <p className="rounded-lg bg-rose-50 p-3 text-sm font-bold text-rose-800">
                  評価の保存に失敗しました。
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => void saveReview()}
                disabled={reviewState === "saving"}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-black text-white disabled:bg-slate-300"
              >
                <Save size={18} aria-hidden="true" />
                {reviewState === "saving"
                  ? "保存中..."
                  : reviewState === "saved"
                    ? "保存しました"
                    : "レビューを保存"}
              </button>
            </div>
          </Card>
        </Section>
      ) : null}

      <Link
        href="/my-log"
        className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-sky-200 bg-white px-4 text-sm font-black text-blue-900"
      >
        <Map size={17} aria-hidden="true" />
        航海履歴一覧へ
      </Link>
    </div>
  );
}
