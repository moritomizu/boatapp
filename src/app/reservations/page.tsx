"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarPlus,
  Edit3,
  Eye,
  Navigation,
  Save,
  ShipWheel,
  Trash2,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge, Card, Section } from "@/components/ui";
import { updateClientAppData, useClientAppData } from "@/lib/client-store";
import { getInitialAppData } from "@/lib/data-source";
import { deleteFirestoreDocument } from "@/lib/firebase-repository";
import { targetFishLabels } from "@/lib/labels";
import { createReservation } from "@/lib/mock-data";
import {
  formatDate,
  formatTime,
  hasTimeOverlap,
} from "@/lib/reservations";
import type { Reservation, TargetFish } from "@/types/domain";

const targetFishOptions: TargetFish[] = [
  "seabass",
  "chinning",
  "tairubber",
  "yellowtail",
  "other",
];

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const todayKey = () => toDateKey(new Date());

const reservationPhase = (startAt: string) => {
  const key = startAt.slice(0, 10);
  const today = todayKey();
  if (key < today) return "past";
  if (key > today) return "future";
  return "today";
};

export default function ReservationsPage() {
  const initialData = getInitialAppData();
  const data = useClientAppData(initialData);
  const reservations = data.reservations;
  const [form, setForm] = useState({
    date: "2026-06-08",
    startTime: "07:00",
    endTime: "11:00",
    userId: initialData.currentUser.id,
    targetFish: "seabass" as TargetFish,
    destinationArea: "大阪湾",
    passengerCount: 2,
    availableSeats: 1,
    joinAllowed: true,
    comment: "",
  });
  const [editingId, setEditingId] = useState("");
  const [deleteState, setDeleteState] = useState("");
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  const draftReservation = useMemo(
    () => ({
      id: "draft",
      startAt: `${form.date}T${form.startTime}:00.000+09:00`,
      endAt: `${form.date}T${form.endTime}:00.000+09:00`,
    }),
    [form.date, form.endTime, form.startTime],
  );
  const hasOverlap = hasTimeOverlap(
    draftReservation,
    reservations.filter((reservation) => reservation.id !== editingId),
  );
  const calendarMonth = useMemo(() => {
    const base = new Date(reservations[0]?.startAt ?? "2026-06-01T00:00:00.000+09:00");
    const firstDay = new Date(base.getFullYear(), base.getMonth(), 1);
    const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    const leadingBlankCount = firstDay.getDay();
    const days = Array.from({ length: lastDay.getDate() }, (_, index) => {
      const date = new Date(base.getFullYear(), base.getMonth(), index + 1);
      const dateKey = toDateKey(date);
      const dayReservations = reservations.filter(
        (reservation) => reservation.startAt.slice(0, 10) === dateKey,
      );

      return {
        date,
        dateKey,
        reservations: dayReservations,
      };
    });

    return {
      label: new Intl.DateTimeFormat("ja-JP", {
        year: "numeric",
        month: "long",
      }).format(firstDay),
      leadingBlankCount,
      days,
    };
  }, [reservations]);

  function updateForm<T extends keyof typeof form>(
    key: T,
    value: (typeof form)[T],
  ) {
    if (saveState === "saved" || saveState === "error") setSaveState("idle");
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveState === "saving") return;
    setSaveState("saving");

    const reservationInput = {
      organizationId: data.organization.id,
      boatId: data.boat.id,
      userId: form.userId,
      startAt: `${form.date}T${form.startTime}:00.000+09:00`,
      endAt: `${form.date}T${form.endTime}:00.000+09:00`,
      targetFish: form.targetFish,
      destinationArea: form.destinationArea,
      passengerCount: form.passengerCount,
      availableSeats: form.availableSeats,
      joinAllowed: form.joinAllowed,
      comment: form.comment,
    };

    const existingReservation = reservations.find((item) => item.id === editingId);
    const reservation: Reservation = editingId && existingReservation
      ? {
          ...existingReservation,
          ...reservationInput,
          updatedAt: new Date().toISOString(),
        }
      : createReservation(reservationInput);

    const nextReservations = [
      ...reservations.filter((item) => item.id !== editingId),
      reservation,
    ].sort(
      (a, b) =>
        new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    );

    try {
      await updateClientAppData(
        (current) => ({ ...current, reservations: nextReservations }),
        data,
      );
      setSaveState("saved");
      setEditingId("");
    } catch {
      setSaveState("error");
    }
  }

  function startEdit(reservationId: string) {
    const reservation = reservations.find((item) => item.id === reservationId);
    if (!reservation) return;
    setEditingId(reservationId);
    setSaveState("idle");
    setForm({
      date: reservation.startAt.slice(0, 10),
      startTime: reservation.startAt.slice(11, 16),
      endTime: reservation.endAt.slice(11, 16),
      userId: reservation.userId,
      targetFish: reservation.targetFish,
      destinationArea: reservation.destinationArea,
      passengerCount: reservation.passengerCount,
      availableSeats: reservation.availableSeats,
      joinAllowed: reservation.joinAllowed,
      comment: reservation.comment,
    });
    document.getElementById("new")?.scrollIntoView({ behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId("");
    setSaveState("idle");
    setForm((current) => ({
      ...current,
      date: "2026-06-08",
      startTime: "07:00",
      endTime: "11:00",
      userId: data.currentUser.id,
      targetFish: "seabass",
      destinationArea: "大阪湾",
      passengerCount: 2,
      availableSeats: 1,
      joinAllowed: true,
      comment: "",
    }));
  }

  async function deleteReservation(reservationId: string) {
    if (!window.confirm("この予約を削除しますか？関連するチェックや航行ログは残ります。")) {
      return;
    }

    setDeleteState(reservationId);
    try {
      await updateClientAppData(
        (current) => ({
          ...current,
          reservations: current.reservations.filter(
            (reservation) => reservation.id !== reservationId,
          ),
        }),
        data,
      );
      await deleteFirestoreDocument("reservations", reservationId);
      if (editingId === reservationId) cancelEdit();
    } finally {
      setDeleteState("");
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-bold text-blue-700">予約カレンダー</p>
          <h1 className="text-3xl font-black tracking-normal text-blue-950">
            釣行予定と空き席
          </h1>
          <p className="text-sm leading-6 text-slate-600">
            メンバー以上が先着順で予約できます。重複は警告表示のみです。
          </p>
        </div>

        <Section title={`${calendarMonth.label}の予約`}>
          <div className="rounded-lg border border-sky-100 bg-white p-3 shadow-sm">
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-black text-slate-500">
              {["日", "月", "火", "水", "木", "金", "土"].map((day) => (
                <div key={day} className="py-2">
                  {day}
                </div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {Array.from({ length: calendarMonth.leadingBlankCount }).map(
                (_, index) => (
                  <div
                    key={`blank-${index}`}
                    className="min-h-24 rounded-lg bg-slate-50"
                  />
                ),
              )}
              {calendarMonth.days.map((day) => (
                <div
                  key={day.dateKey}
                  className={`min-h-24 rounded-lg border p-2 ${
                    day.reservations.length > 0
                      ? "border-blue-200 bg-sky-50"
                      : "border-slate-100 bg-white"
                  }`}
                >
                  <p className="text-sm font-black text-slate-800">
                    {day.date.getDate()}
                  </p>
                  <div className="mt-1 space-y-1">
                    {day.reservations.slice(0, 2).map((reservation) => {
                      const user = data.users.find(
                        (item) => item.id === reservation.userId,
                      );

                      return (
                        <Link
                          key={reservation.id}
                          href={`#reservation-${reservation.id}`}
                          className="block rounded-md bg-blue-800 px-1.5 py-1 text-[10px] font-black leading-4 text-white"
                        >
                          {formatTime(reservation.startAt)} {user?.name}
                        </Link>
                      );
                    })}
                    {day.reservations.length > 2 ? (
                      <p className="text-[10px] font-bold text-blue-800">
                        +{day.reservations.length - 2}件
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section title={editingId ? "予約編集" : "予約登録"}>
          <form
            id="new"
            onSubmit={handleSubmit}
            className="space-y-4 rounded-lg border border-sky-100 bg-white p-4 shadow-sm"
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="text-sm font-bold text-slate-700">利用日</span>
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => updateForm("date", event.target.value)}
                  className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                  required
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-slate-700">開始</span>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(event) =>
                    updateForm("startTime", event.target.value)
                  }
                  className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                  required
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-slate-700">終了</span>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(event) =>
                    updateForm("endTime", event.target.value)
                  }
                  className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                  required
                />
              </label>
            </div>

            {hasOverlap ? (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm font-bold leading-6 text-amber-900">
                <AlertTriangle
                  className="mt-0.5 shrink-0"
                  size={18}
                  aria-hidden="true"
                />
                同日同時間帯に重複する予約があります。今回は登録はブロックしません。
              </div>
            ) : null}

            {editingId ? (
              <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-sm font-bold leading-6 text-blue-900">
                <Edit3 className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
                予約を編集中です。保存すると既存予約が更新されます。
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-bold text-slate-700">予約者</span>
                <select
                  value={form.userId}
                  onChange={(event) => updateForm("userId", event.target.value)}
                  className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                >
                  {data.users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-bold text-slate-700">釣りもの</span>
                <select
                  value={form.targetFish}
                  onChange={(event) =>
                    updateForm("targetFish", event.target.value as TargetFish)
                  }
                  className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                >
                  {targetFishOptions.map((option) => (
                    <option key={option} value={option}>
                      {targetFishLabels[option]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">
                行き先エリア
              </span>
              <input
                value={form.destinationArea}
                onChange={(event) =>
                  updateForm("destinationArea", event.target.value)
                }
                className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-bold text-slate-700">
                  同乗予定人数
                </span>
                <input
                  type="number"
                  min={0}
                  value={form.passengerCount}
                  onChange={(event) =>
                    updateForm("passengerCount", Number(event.target.value))
                  }
                  className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-slate-700">空き席数</span>
                <input
                  type="number"
                  min={0}
                  value={form.availableSeats}
                  onChange={(event) =>
                    updateForm("availableSeats", Number(event.target.value))
                  }
                  className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                />
              </label>
            </div>

            <label className="flex min-h-12 items-center gap-3 rounded-lg bg-sky-50 px-3 text-sm font-bold text-blue-950">
              <input
                type="checkbox"
                checked={form.joinAllowed}
                onChange={(event) =>
                  updateForm("joinAllowed", event.target.checked)
                }
                className="size-5 accent-blue-800"
              />
              便乗歓迎
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">コメント</span>
              <textarea
                value={form.comment}
                onChange={(event) => updateForm("comment", event.target.value)}
                className="mt-2 min-h-24 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-base outline-none ring-blue-600 focus:ring-2"
              />
            </label>

            <button
              type="submit"
              disabled={saveState === "saving"}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-5 text-base font-black text-white shadow-lg shadow-blue-900/20 disabled:bg-slate-300 disabled:shadow-none"
            >
              {editingId ? (
                <Save size={22} aria-hidden="true" />
              ) : (
                <CalendarPlus size={22} aria-hidden="true" />
              )}
              {saveState === "saving"
                ? editingId
                  ? "更新中..."
                  : "登録中..."
                : saveState === "saved"
                  ? editingId
                    ? "更新しました"
                    : "登録しました"
                  : saveState === "error"
                    ? editingId
                      ? "更新に失敗しました"
                      : "登録に失敗しました"
                    : editingId
                      ? "予約を更新"
                      : "予約を登録"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={cancelEdit}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-black text-slate-700"
              >
                <X size={18} aria-hidden="true" />
                編集をキャンセル
              </button>
            ) : null}
          </form>
        </Section>

        <Section title="予約一覧">
          <div className="space-y-3">
            {reservations.map((reservation) => {
              const user = data.users.find((item) => item.id === reservation.userId);
              const overlap = hasTimeOverlap(reservation, reservations);
              const phase = reservationPhase(reservation.startAt);
              const voyage = data.voyageLogs.find(
                (item) => item.reservationId === reservation.id,
              );
              const relatedHandovers = data.handoverNotes.filter(
                (note) => note.reservationId === reservation.id,
              );
              const preCheckDone = data.preDepartureChecks.some(
                (check) => check.reservationId === reservation.id,
              );
              const postCheckDone = data.postReturnChecks.some(
                (check) => check.reservationId === reservation.id,
              );

              return (
                <div id={`reservation-${reservation.id}`} key={reservation.id}>
                  <Card>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-black text-blue-950">
                          {formatDate(reservation.startAt)}
                        </p>
                        <p className="mt-1 text-base font-black text-slate-950">
                          {formatTime(reservation.startAt)} -{" "}
                          {formatTime(reservation.endAt)}
                        </p>
                      </div>
                      <Badge
                        className={
                          reservation.availableSeats > 0
                            ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
                            : "bg-slate-100 text-slate-700 ring-slate-200"
                        }
                      >
                        {reservation.availableSeats > 0 ? "空き席あり" : "満席"}
                      </Badge>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge className="bg-sky-100 text-blue-800 ring-sky-200">
                        {targetFishLabels[reservation.targetFish]}
                      </Badge>
                      <Badge className="bg-white text-slate-700 ring-slate-200">
                        {reservation.joinAllowed ? "便乗歓迎" : "便乗なし"}
                      </Badge>
                      {overlap ? (
                        <Badge className="bg-amber-100 text-amber-900 ring-amber-200">
                          時間重複あり
                        </Badge>
                      ) : null}
                      <Badge
                        className={
                          phase === "past"
                            ? "bg-slate-100 text-slate-700 ring-slate-200"
                            : phase === "today"
                              ? "bg-blue-100 text-blue-900 ring-blue-200"
                              : "bg-violet-100 text-violet-900 ring-violet-200"
                        }
                      >
                        {phase === "past"
                          ? "過去の利用"
                          : phase === "today"
                            ? "本日"
                            : "未来の予定"}
                      </Badge>
                    </div>

                    <div className="mt-4 grid gap-2 text-sm text-slate-600">
                      <p className="flex items-center gap-2">
                        <ShipWheel size={17} aria-hidden="true" />
                        予約者: {user?.name}
                      </p>
                      <p>行き先: {reservation.destinationArea}</p>
                      <p>
                        同乗予定: {reservation.passengerCount}名 / 空き席:{" "}
                        {reservation.availableSeats}席
                      </p>
                      {reservation.comment ? <p>{reservation.comment}</p> : null}
                    </div>

                    {phase === "past" ? (
                      <div className="mt-4 rounded-lg bg-slate-50 p-3">
                        <p className="text-sm font-black text-slate-800">
                          利用後の確認
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge
                            className={
                              voyage
                                ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
                                : "bg-slate-100 text-slate-700 ring-slate-200"
                            }
                          >
                            航行ログ{voyage ? "あり" : "なし"}
                          </Badge>
                          <Badge
                            className={
                              relatedHandovers.length > 0
                                ? "bg-amber-100 text-amber-900 ring-amber-200"
                                : "bg-slate-100 text-slate-700 ring-slate-200"
                            }
                          >
                            申し送り{relatedHandovers.length}件
                          </Badge>
                          <Badge className="bg-sky-100 text-blue-800 ring-sky-200">
                            出船前{preCheckDone ? "完了" : "未確認"}
                          </Badge>
                          <Badge className="bg-sky-100 text-blue-800 ring-sky-200">
                            帰港後{postCheckDone ? "完了" : "未確認"}
                          </Badge>
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-4 grid gap-2 sm:grid-cols-4">
                      {phase === "past" ? (
                        <>
                          <Link
                            href={`/voyages?reservationId=${reservation.id}`}
                            className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-black text-white"
                          >
                            <Eye size={16} aria-hidden="true" />
                            航行情報
                          </Link>
                          <Link
                            href={`/boats`}
                            className="flex min-h-11 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-4 text-sm font-black text-amber-900"
                          >
                            申し送り確認
                          </Link>
                          <Link
                            href={`/checks/post-return?reservationId=${reservation.id}`}
                            className="flex min-h-11 items-center justify-center rounded-lg border border-sky-200 px-4 text-sm font-black text-blue-900"
                          >
                            帰港後チェック
                          </Link>
                        </>
                      ) : phase === "today" ? (
                        <>
                          <Link
                            href={`/checks/pre-departure?reservationId=${reservation.id}`}
                            className="flex min-h-11 items-center justify-center rounded-lg bg-blue-800 px-4 text-sm font-black text-white"
                          >
                            出船前チェック
                          </Link>
                          <Link
                            href={`/voyages?reservationId=${reservation.id}`}
                            className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-black text-white"
                          >
                            <Navigation size={16} aria-hidden="true" />
                            出船開始
                          </Link>
                          <Link
                            href={`/checks/post-return?reservationId=${reservation.id}`}
                            className="flex min-h-11 items-center justify-center rounded-lg border border-sky-200 px-4 text-sm font-black text-blue-900"
                          >
                            帰港後チェック
                          </Link>
                          <Link
                            href={`/support?reservationId=${reservation.id}#new`}
                            className="flex min-h-11 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-4 text-sm font-black text-rose-800"
                          >
                            サポート要請
                          </Link>
                        </>
                      ) : (
                        <>
                          <div className="flex min-h-11 items-center justify-center rounded-lg bg-slate-100 px-4 text-sm font-black text-slate-500">
                            未来予約
                          </div>
                          <div className="flex min-h-11 items-center justify-center rounded-lg bg-slate-100 px-4 text-sm font-black text-slate-500">
                            出船開始不可
                          </div>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => startEdit(reservation.id)}
                        className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-black text-slate-700"
                      >
                        <Edit3 size={16} aria-hidden="true" />
                        編集
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteReservation(reservation.id)}
                        disabled={deleteState === reservation.id}
                        className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-rose-200 px-4 text-sm font-black text-rose-700 disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                        {deleteState === reservation.id ? "削除中" : "削除"}
                      </button>
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        </Section>
      </div>
    </AppShell>
  );
}
