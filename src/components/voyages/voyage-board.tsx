"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Anchor,
  CheckCircle2,
  LifeBuoy,
  MapPin,
  Navigation,
  Route,
  ShipWheel,
} from "lucide-react";
import { Badge, Card, Section } from "@/components/ui";
import { updateClientAppData, useClientAppData } from "@/lib/client-store";
import { targetFishLabels, voyageStatusLabels, voyageStatusTone } from "@/lib/labels";
import { formatDate, formatTime } from "@/lib/reservations";
import {
  calculateDistanceKm,
  calculateDurationMinutes,
  createVoyageLog,
  formatDuration,
} from "@/lib/voyages";
import type { AppData, TrackPoint, VoyageLog } from "@/types/domain";

type VoyageBoardProps = {
  data: AppData;
  initialReservationId?: string;
};

const nowIso = () => new Date().toISOString();

function getPosition() {
  return new Promise<TrackPoint>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not available."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: nowIso(),
        });
      },
      reject,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 },
    );
  });
}

export function VoyageBoard({ data, initialReservationId }: VoyageBoardProps) {
  const appData = useClientAppData(data);
  const [selectedReservationId, setSelectedReservationId] = useState(
    initialReservationId ?? appData.reservations[0]?.id ?? "",
  );
  const [memo, setMemo] = useState("");
  const [locationMessage, setLocationMessage] = useState("");
  const [actionState, setActionState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  const selectedReservation = appData.reservations.find(
    (reservation) => reservation.id === selectedReservationId,
  );
  const activeVoyage = appData.voyageLogs.find(
    (voyage) => voyage.status === "underway",
  );
  const selectedVoyage = appData.voyageLogs.find(
    (voyage) => voyage.reservationId === selectedReservationId,
  );
  const sortedVoyages = [...appData.voyageLogs].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  const skillSummary = useMemo(() => {
    const completed = appData.voyageLogs.filter(
      (voyage) => voyage.status === "completed",
    );
    const totalMinutes = completed.reduce(
      (sum, voyage) => sum + (voyage.durationMinutes ?? 0),
      0,
    );
    const totalDistance = completed.reduce(
      (sum, voyage) => sum + (voyage.distanceKm ?? 0),
      0,
    );

    return {
      count: completed.length,
      totalMinutes,
      totalDistance,
    };
  }, [appData.voyageLogs]);

  async function startVoyage() {
    if (!selectedReservation || actionState === "saving") return;
    setActionState("saving");
    setLocationMessage("現在地を取得しています...");

    try {
      const point = await getPosition();
      const voyage = createVoyageLog({
        organizationId: appData.organization.id,
        boatId: appData.boat.id,
        reservationId: selectedReservation.id,
        userId: appData.currentUser.id,
        status: "underway",
        departedAt: point.capturedAt,
        trackPoints: [point],
        passengerCount: selectedReservation.passengerCount,
        memo,
      });

      await updateClientAppData(
        (current) => ({
          ...current,
          voyageLogs: [voyage, ...current.voyageLogs],
        }),
        appData,
      );
      setLocationMessage("出船を開始しました。航行ログを記録中です。");
      setActionState("saved");
    } catch {
      setLocationMessage("現在地を取得できませんでした。通信状態と位置情報許可を確認してください。");
      setActionState("error");
    }
  }

  async function recordPoint() {
    if (!activeVoyage || actionState === "saving") return;
    setActionState("saving");
    setLocationMessage("現在地を記録しています...");

    try {
      const point = await getPosition();
      const nextVoyages = appData.voyageLogs.map((voyage) =>
        voyage.id === activeVoyage.id
          ? {
              ...voyage,
              trackPoints: [...voyage.trackPoints, point],
              updatedAt: point.capturedAt,
            }
          : voyage,
      );

      await updateClientAppData(
        (current) => ({ ...current, voyageLogs: nextVoyages }),
        appData,
      );
      setLocationMessage("現在地を記録しました。");
      setActionState("saved");
    } catch {
      setLocationMessage("現在地を取得できませんでした。後でもう一度記録できます。");
      setActionState("error");
    }
  }

  async function completeVoyage() {
    if (!activeVoyage || actionState === "saving") return;
    setActionState("saving");
    setLocationMessage("帰港位置を記録しています...");

    try {
      const point = await getPosition();
      const returnedAt = point.capturedAt;
      const trackPoints = [...activeVoyage.trackPoints, point];
      const durationMinutes = calculateDurationMinutes(
        activeVoyage.departedAt,
        returnedAt,
      );
      const distanceKm = Number(calculateDistanceKm(trackPoints).toFixed(1));
      const nextVoyages = appData.voyageLogs.map((voyage) =>
        voyage.id === activeVoyage.id
          ? {
              ...voyage,
              status: "completed" as const,
              returnedAt,
              durationMinutes,
              distanceKm,
              trackPoints,
              memo: memo || voyage.memo,
              updatedAt: returnedAt,
            }
          : voyage,
      );

      await updateClientAppData(
        (current) => ({ ...current, voyageLogs: nextVoyages }),
        appData,
      );
      setLocationMessage("帰港を記録しました。帰港後チェックへ進めます。");
      setActionState("saved");
    } catch {
      setLocationMessage("帰港位置を取得できませんでした。位置情報許可を確認してください。");
      setActionState("error");
    }
  }

  function voyageReservation(voyage: VoyageLog) {
    return appData.reservations.find(
      (reservation) => reservation.id === voyage.reservationId,
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-bold text-blue-700">航行ログ</p>
        <h1 className="text-3xl font-black tracking-normal text-blue-950">
          出船セッション
        </h1>
        <p className="text-sm leading-6 text-slate-600">
          出船開始から帰港までを記録し、利用時間・航行距離・経験値を残します。
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <p className="text-xs font-bold text-slate-500">完了回数</p>
          <p className="mt-2 text-2xl font-black text-blue-950">
            {skillSummary.count}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-bold text-slate-500">累計時間</p>
          <p className="mt-2 text-2xl font-black text-blue-950">
            {formatDuration(skillSummary.totalMinutes)}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-bold text-slate-500">累計距離</p>
          <p className="mt-2 text-2xl font-black text-blue-950">
            {skillSummary.totalDistance.toFixed(1)}km
          </p>
        </Card>
      </div>

      {activeVoyage ? (
        <Section
          title="航行中"
          action={
            <Badge className={voyageStatusTone.underway}>
              {voyageStatusLabels.underway}
            </Badge>
          }
        >
          <Card>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-800">
                  <Navigation size={24} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-lg font-black text-blue-950">
                    {voyageReservation(activeVoyage)?.destinationArea ??
                      "航行中"}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    出船 {activeVoyage.departedAt ? formatTime(activeVoyage.departedAt) : "-"} / 記録点
                    {activeVoyage.trackPoints.length}件
                  </p>
                </div>
              </div>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">
                  航行メモ
                </span>
                <textarea
                  value={memo}
                  onChange={(event) => setMemo(event.target.value)}
                  className="mt-2 min-h-24 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-base outline-none ring-blue-600 focus:ring-2"
                  placeholder="海況、操船で気になったこと、帰港後に残すメモ"
                />
              </label>

              {locationMessage ? (
                <p className="rounded-lg bg-sky-50 p-3 text-sm font-bold leading-6 text-blue-900">
                  {locationMessage}
                </p>
              ) : null}

              <div className="grid gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={recordPoint}
                  disabled={actionState === "saving"}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-sky-200 px-4 text-sm font-black text-blue-900 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <MapPin size={18} aria-hidden="true" />
                  現在地を記録
                </button>
                <Link
                  href={`/support?reservationId=${activeVoyage.reservationId}#new`}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 text-sm font-black text-rose-800"
                >
                  <LifeBuoy size={18} aria-hidden="true" />
                  サポート要請
                </Link>
                <button
                  type="button"
                  onClick={completeVoyage}
                  disabled={actionState === "saving"}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-black text-white disabled:bg-slate-300"
                >
                  <Anchor size={18} aria-hidden="true" />
                  帰港を記録
                </button>
              </div>
            </div>
          </Card>
        </Section>
      ) : (
        <Section title="出船開始">
          <Card>
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-bold text-slate-700">
                  対象予約
                </span>
                <select
                  value={selectedReservationId}
                  onChange={(event) => setSelectedReservationId(event.target.value)}
                  className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                >
                  {appData.reservations.map((reservation) => (
                    <option key={reservation.id} value={reservation.id}>
                      {formatDate(reservation.startAt)}{" "}
                      {formatTime(reservation.startAt)} /{" "}
                      {targetFishLabels[reservation.targetFish]} /{" "}
                      {reservation.destinationArea}
                    </option>
                  ))}
                </select>
              </label>

              {selectedReservation ? (
                <div className="rounded-lg bg-sky-50 p-3 text-sm font-semibold leading-6 text-blue-900">
                  {selectedReservation.destinationArea} / 同乗
                  {selectedReservation.passengerCount}名 / 空き席
                  {selectedReservation.availableSeats}席
                </div>
              ) : null}

              {selectedVoyage ? (
                <p className="rounded-lg bg-emerald-50 p-3 text-sm font-bold leading-6 text-emerald-800">
                  この予約には航行ログがあります。履歴から確認できます。
                </p>
              ) : null}

              {locationMessage ? (
                <p className="rounded-lg bg-sky-50 p-3 text-sm font-bold leading-6 text-blue-900">
                  {locationMessage}
                </p>
              ) : null}

              <button
                type="button"
                onClick={startVoyage}
                disabled={!selectedReservation || actionState === "saving"}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-5 text-base font-black text-white shadow-lg shadow-blue-900/20 disabled:bg-slate-300 disabled:shadow-none"
              >
                <ShipWheel size={22} aria-hidden="true" />
                {actionState === "saving" ? "開始中..." : "出船を開始"}
              </button>
            </div>
          </Card>
        </Section>
      )}

      {activeVoyage?.status === "underway" ? null : (
        <Section title="次の流れ">
          <div className="grid gap-2 sm:grid-cols-3">
            <Link
              href={
                selectedReservationId
                  ? `/checks/pre-departure?reservationId=${selectedReservationId}`
                  : "/checks/pre-departure"
              }
              className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-black text-white"
            >
              <CheckCircle2 size={18} aria-hidden="true" />
              出船前チェック
            </Link>
            <Link
              href={
                selectedReservationId
                  ? `/checks/post-return?reservationId=${selectedReservationId}`
                  : "/checks/post-return"
              }
              className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-sky-200 px-4 text-sm font-black text-blue-900"
            >
              <Anchor size={18} aria-hidden="true" />
              帰港後チェック
            </Link>
            <Link
              href={
                selectedReservationId
                  ? `/handovers?reservationId=${selectedReservationId}#new`
                  : "/handovers#new"
              }
              className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 text-sm font-black text-amber-900"
            >
              <Route size={18} aria-hidden="true" />
              申し送り
            </Link>
          </div>
        </Section>
      )}

      <Section title="航行ログ履歴">
        <div className="space-y-3">
          {sortedVoyages.map((voyage) => {
            const reservation = voyageReservation(voyage);

            return (
              <Card key={voyage.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-blue-950">
                      {reservation
                        ? `${formatDate(reservation.startAt)} ${reservation.destinationArea}`
                        : "予約未紐付け"}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {voyage.departedAt ? formatTime(voyage.departedAt) : "-"} -{" "}
                      {voyage.returnedAt ? formatTime(voyage.returnedAt) : "-"}
                    </p>
                  </div>
                  <Badge className={voyageStatusTone[voyage.status]}>
                    {voyageStatusLabels[voyage.status]}
                  </Badge>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-bold text-slate-500">時間</p>
                    <p className="mt-1 font-black text-slate-950">
                      {formatDuration(voyage.durationMinutes)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-bold text-slate-500">距離</p>
                    <p className="mt-1 font-black text-slate-950">
                      {voyage.distanceKm !== undefined
                        ? `${voyage.distanceKm.toFixed(1)}km`
                        : "-"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-bold text-slate-500">記録点</p>
                    <p className="mt-1 font-black text-slate-950">
                      {voyage.trackPoints.length}
                    </p>
                  </div>
                </div>
                {voyage.memo ? (
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {voyage.memo}
                  </p>
                ) : null}
              </Card>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
