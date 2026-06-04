"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  Navigation,
  Save,
  ShipWheel,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge, Card, Section } from "@/components/ui";
import { findBoat, getBoatName, getBoats, reservationWarnings } from "@/lib/boat-utils";
import { updateClientAppData, useClientAppData } from "@/lib/client-store";
import { getInitialAppData } from "@/lib/data-source";
import { deleteFirestoreDocument } from "@/lib/firebase-repository";
import {
  reservationSessionStatusLabels,
  reservationSessionStatusTone,
  targetFishLabels,
} from "@/lib/labels";
import { createJoinRequest, createReservation } from "@/lib/mock-data";
import {
  formatDate,
  formatTime,
  getReservationSessionStatus,
  hasTimeOverlap,
  withReservationSessionStatus,
} from "@/lib/reservations";
import type { Reservation, TargetFish } from "@/types/domain";

const targetFishOptions: TargetFish[] = [
  "seabass",
  "chinning",
  "tairubber",
  "yellowtail",
  "other",
];

const reservationTimeOptions = Array.from({ length: 48 }, (_, index) => {
  const hour = String(Math.floor(index / 2)).padStart(2, "0");
  const minute = index % 2 === 0 ? "00" : "30";
  return `${hour}:${minute}`;
});

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
  const boats = getBoats(data);
  const [viewMode, setViewMode] = useState<"all" | "boat" | "mine">("boat");
  const [selectedBoatId, setSelectedBoatId] = useState(data.boat.id);
  const [calendarOffset, setCalendarOffset] = useState(0);
  const visibleReservations = data.reservations.filter((reservation) => {
    if (viewMode === "mine") return reservation.userId === data.currentUser.id;
    if (viewMode === "boat") return reservation.boatId === selectedBoatId;
    return true;
  });
  const reservations = visibleReservations;
  const [form, setForm] = useState({
    boatId: data.boat.id,
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
  const [deleteMessage, setDeleteMessage] = useState("");
  const [closeMessage, setCloseMessage] = useState("");
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [joinRequestState, setJoinRequestState] = useState("");
  const [joinRequestMessage, setJoinRequestMessage] = useState("");
  const [joinRequestResult, setJoinRequestResult] = useState("");
  const canAssignReservationUser = data.currentUser.role === "admin";

  function canOperateReservation(reservation: Reservation) {
    return (
      data.currentUser.role === "admin" ||
      reservation.userId === data.currentUser.id
    );
  }

  const draftReservation = useMemo(
    () => ({
      id: "draft",
      boatId: form.boatId,
      startAt: `${form.date}T${form.startTime}:00.000+09:00`,
      endAt: `${form.date}T${form.endTime}:00.000+09:00`,
    }),
    [form.boatId, form.date, form.endTime, form.startTime],
  );
  const hasOverlap = hasTimeOverlap(
    draftReservation,
    data.reservations.filter(
      (reservation) =>
        reservation.id !== editingId && reservation.boatId === form.boatId,
    ),
  );
  const warnings = reservationWarnings(data, form.userId, form.boatId);
  const calendarMonth = useMemo(() => {
    const base = new Date();
    base.setMonth(base.getMonth() + calendarOffset);
    const firstDay = new Date(base.getFullYear(), base.getMonth(), 1);
    const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    const leadingBlankCount = firstDay.getDay();
    const days = Array.from({ length: lastDay.getDate() }, (_, index) => {
      const date = new Date(base.getFullYear(), base.getMonth(), index + 1);
      const dateKey = toDateKey(date);
      const dayReservations = visibleReservations.filter(
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
  }, [calendarOffset, visibleReservations]);

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
    const existingReservation = data.reservations.find((item) => item.id === editingId);
    if (existingReservation && !canOperateReservation(existingReservation)) return;
    setSaveState("saving");
    const targetUserId = canAssignReservationUser
      ? form.userId
      : data.currentUser.id;

    const reservationInput = {
      organizationId: data.organization.id,
      boatId: form.boatId,
      userId: targetUserId,
      startAt: `${form.date}T${form.startTime}:00.000+09:00`,
      endAt: `${form.date}T${form.endTime}:00.000+09:00`,
      targetFish: form.targetFish,
      destinationArea: form.destinationArea,
      passengerCount: form.passengerCount,
      availableSeats: form.availableSeats,
      joinAllowed: form.joinAllowed,
      comment: form.comment,
    };

    const reservation: Reservation = editingId && existingReservation
      ? {
          ...existingReservation,
          ...reservationInput,
          updatedAt: new Date().toISOString(),
        }
      : createReservation(reservationInput);

    const nextReservations = [
      ...data.reservations.filter((item) => item.id !== editingId),
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
    const sessionStatus = getReservationSessionStatus(reservation, data);
    if (sessionStatus === "closed" && data.currentUser.role !== "admin") return;
    if (!canOperateReservation(reservation)) return;
    setEditingId(reservationId);
    setSaveState("idle");
    setForm({
      date: reservation.startAt.slice(0, 10),
      boatId: reservation.boatId,
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
      boatId: selectedBoatId,
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

  function startReservationForDate(dateKey: string) {
    setEditingId("");
    setSaveState("idle");
    setForm((current) => ({
      ...current,
      boatId: selectedBoatId,
      date: dateKey,
      userId: data.currentUser.id,
      startTime: "07:00",
      endTime: "11:00",
      passengerCount: 1,
      availableSeats: 0,
      joinAllowed: false,
      comment: "",
    }));
    document.getElementById("new")?.scrollIntoView({ behavior: "smooth" });
  }

  async function requestJoin(reservation: Reservation) {
    if (joinRequestState) return;

    const existingRequest = data.joinRequests.find(
      (request) =>
        request.reservationId === reservation.id &&
        request.userId === data.currentUser.id,
    );
    if (existingRequest) {
      setJoinRequestResult("この予約にはすでに便乗希望を送信しています。");
      return;
    }

    setJoinRequestState(reservation.id);
    setJoinRequestResult("");
    try {
      const request = createJoinRequest({
        organizationId: data.organization.id,
        boatId: reservation.boatId,
        reservationId: reservation.id,
        userId: data.currentUser.id,
        message:
          joinRequestMessage.trim() ||
          "便乗を希望します。よろしくお願いします。",
        status: "requested",
      });

      await updateClientAppData(
        (current) => ({
          ...current,
          joinRequests: [request, ...(current.joinRequests ?? [])],
        }),
        data,
      );
      setJoinRequestMessage("");
      setJoinRequestResult("便乗希望を送信しました。");
    } catch {
      setJoinRequestResult("便乗希望の送信に失敗しました。通信状態を確認してください。");
    } finally {
      setJoinRequestState("");
    }
  }

  async function deleteReservation(reservationId: string) {
    const reservation = data.reservations.find((item) => item.id === reservationId);
    if (!reservation || !canOperateReservation(reservation)) return;

    if (!window.confirm("この予約を削除しますか？関連するチェックや航行ログは残ります。")) {
      return;
    }

    setDeleteState(reservationId);
    setDeleteMessage("");
    try {
      await deleteFirestoreDocument("reservations", reservationId);
      await updateClientAppData(
        (current) => ({
          ...current,
          reservations: current.reservations.filter(
            (reservation) => reservation.id !== reservationId,
          ),
        }),
        data,
      );
      if (editingId === reservationId) cancelEdit();
      setDeleteMessage("予約を削除しました。");
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "予約の削除に失敗しました。";
      setDeleteMessage(
        `予約を削除できませんでした: ${message} Firestore Rulesでreservationsのdelete権限を確認してください。`,
      );
    } finally {
      setDeleteState("");
    }
  }

  async function closeReservation(reservation: Reservation) {
    if (!canOperateReservation(reservation)) return;

    setSaveState("saving");
    setCloseMessage("");
    try {
      await updateClientAppData(
        (current) => ({
          ...current,
          reservations: current.reservations.map((item) =>
            item.id === reservation.id
              ? withReservationSessionStatus(item, "closed")
              : item,
          ),
        }),
        data,
      );
      setSaveState("saved");
      setCloseMessage(
        "出船についてやることは完了です。お疲れ様でした。気をつけて帰ってください。",
      );
    } catch {
      setSaveState("error");
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-bold text-blue-700">予約カレンダー</p>
          <h1 className="text-2xl font-black tracking-normal text-blue-950">
            釣行予定と空き席
          </h1>
          <p className="text-sm leading-6 text-slate-600">
            メンバー以上が先着順で予約できます。重複は警告表示のみです。
          </p>
        </div>

        <Section title={`${calendarMonth.label}の予約`}>
          <div className="mb-3 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setCalendarOffset((current) => current - 1)}
              className="flex min-h-11 items-center justify-center gap-1 rounded-lg border border-sky-200 bg-white px-3 text-sm font-black text-blue-900"
            >
              <ChevronLeft size={17} aria-hidden="true" />
              前月
            </button>
            <button
              type="button"
              onClick={() => setCalendarOffset(0)}
              className="min-h-11 rounded-lg bg-blue-800 px-3 text-sm font-black text-white"
            >
              当月
            </button>
            <button
              type="button"
              onClick={() => setCalendarOffset((current) => current + 1)}
              className="flex min-h-11 items-center justify-center gap-1 rounded-lg border border-sky-200 bg-white px-3 text-sm font-black text-blue-900"
            >
              翌月
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          </div>
          <div className="mb-3 grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setViewMode("all")}
              className={`h-11 rounded-lg text-sm font-black ${
                viewMode === "all" ? "bg-blue-800 text-white" : "bg-white text-slate-700"
              }`}
            >
              全艇表示
            </button>
            <button
              type="button"
              onClick={() => setViewMode("boat")}
              className={`h-11 rounded-lg text-sm font-black ${
                viewMode === "boat" ? "bg-blue-800 text-white" : "bg-white text-slate-700"
              }`}
            >
              船ごと表示
            </button>
            <button
              type="button"
              onClick={() => setViewMode("mine")}
              className={`h-11 rounded-lg text-sm font-black ${
                viewMode === "mine" ? "bg-blue-800 text-white" : "bg-white text-slate-700"
              }`}
            >
              自分の予約
            </button>
          </div>
          {viewMode === "boat" ? (
            <label className="mb-3 block">
              <span className="text-sm font-bold text-slate-700">表示船舶</span>
              <select
                value={selectedBoatId}
                onChange={(event) => setSelectedBoatId(event.target.value)}
                className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-base outline-none ring-blue-600 focus:ring-2"
              >
                {boats.map((boat) => (
                  <option key={boat.id} value={boat.id}>
                    {boat.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
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
                          {formatTime(reservation.startAt)}{" "}
                          {viewMode === "all" ? `${getBoatName(data, reservation.boatId)} ` : ""}
                          {user?.name}
                        </Link>
                      );
                    })}
                    {day.reservations.length > 2 ? (
                      <p className="text-[10px] font-bold text-blue-800">
                        +{day.reservations.length - 2}件
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => startReservationForDate(day.dateKey)}
                      className="mt-1 flex min-h-8 w-full items-center justify-center rounded-md border border-sky-200 bg-white px-1 text-[10px] font-black text-blue-800"
                    >
                      + 予約
                    </button>
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
              <label className="block sm:col-span-3">
                <span className="text-sm font-bold text-slate-700">
                  対象船舶
                </span>
                <select
                  value={form.boatId}
                  onChange={(event) => updateForm("boatId", event.target.value)}
                  className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                >
                  {boats.map((boat) => (
                    <option key={boat.id} value={boat.id}>
                      {boat.name}
                    </option>
                  ))}
                </select>
                <p className="mt-2 rounded-lg bg-sky-50 p-3 text-sm font-black text-blue-900">
                  対象船舶: {findBoat(data, form.boatId).name}
                </p>
              </label>
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
                <select
                  value={form.startTime}
                  onChange={(event) =>
                    updateForm("startTime", event.target.value)
                  }
                  className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                  required
                >
                  {reservationTimeOptions.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-bold text-slate-700">終了</span>
                <select
                  value={form.endTime}
                  onChange={(event) =>
                    updateForm("endTime", event.target.value)
                  }
                  className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                  required
                >
                  {reservationTimeOptions.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
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

            {warnings.length > 0 ? (
              <div className="space-y-2 rounded-lg bg-amber-50 p-3 text-sm font-bold leading-6 text-amber-900">
                {warnings.map((warning) => (
                  <p key={warning} className="flex gap-2">
                    <AlertTriangle className="mt-0.5 shrink-0" size={16} aria-hidden="true" />
                    {warning}
                  </p>
                ))}
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
                  disabled={!canAssignReservationUser}
                  className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                >
                  {(canAssignReservationUser ? data.users : [data.currentUser]).map((user) => (
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
          {deleteMessage ? (
            <div
              className={`mb-3 rounded-lg border p-3 text-sm font-bold leading-6 ${
                deleteMessage.startsWith("予約を削除しました")
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-rose-200 bg-rose-50 text-rose-800"
              }`}
            >
              {deleteMessage}
            </div>
          ) : null}
          {closeMessage ? (
            <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold leading-6 text-emerald-800">
              {closeMessage}
            </div>
          ) : null}
          <div className="space-y-3">
            {visibleReservations.map((reservation) => {
              const user = data.users.find((item) => item.id === reservation.userId);
              const overlap = hasTimeOverlap(
                reservation,
                data.reservations.filter((item) => item.boatId === reservation.boatId),
              );
              const boat = findBoat(data, reservation.boatId);
              const phase = reservationPhase(reservation.startAt);
              const sessionStatus = getReservationSessionStatus(reservation, data);
              const isClosed = sessionStatus === "closed";
              const canOperate = canOperateReservation(reservation);
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
              const joinRequests = data.joinRequests.filter(
                (request) => request.reservationId === reservation.id,
              );
              const currentUserJoinRequest = joinRequests.find(
                (request) => request.userId === data.currentUser.id,
              );
              const canRequestJoin =
                phase !== "past" &&
                reservation.joinAllowed &&
                reservation.availableSeats > 0 &&
                reservation.userId !== data.currentUser.id &&
                !currentUserJoinRequest;

              return (
                <div id={`reservation-${reservation.id}`} key={reservation.id}>
                  <Card>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-blue-700">
                          {boat.name}
                        </p>
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
                      <Badge className={reservationSessionStatusTone[sessionStatus]}>
                        {reservationSessionStatusLabels[sessionStatus]}
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

                    {joinRequests.length > 0 ? (
                      <div className="mt-4 rounded-lg border border-sky-100 bg-sky-50 p-3">
                        <p className="text-sm font-black text-blue-950">
                          便乗希望 {joinRequests.length}件
                        </p>
                        <div className="mt-2 space-y-2">
                          {joinRequests.map((request) => {
                            const requester = data.users.find(
                              (item) => item.id === request.userId,
                            );

                            return (
                              <div
                                key={request.id}
                                className="rounded-lg bg-white p-3 text-sm leading-6 text-slate-700"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-black text-slate-900">
                                    {requester?.name ?? "メンバー"}
                                  </span>
                                  <Badge
                                    className={
                                      request.status === "approved"
                                        ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
                                        : request.status === "declined"
                                          ? "bg-slate-100 text-slate-700 ring-slate-200"
                                          : "bg-amber-100 text-amber-900 ring-amber-200"
                                    }
                                  >
                                    {request.status === "approved"
                                      ? "承認済み"
                                      : request.status === "declined"
                                        ? "見送り"
                                        : "希望中"}
                                  </Badge>
                                </div>
                                <p className="mt-1">{request.message}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {canRequestJoin ? (
                      <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                        <p className="text-sm font-black text-emerald-900">
                          この釣行に便乗希望を送る
                        </p>
                        <textarea
                          value={joinRequestMessage}
                          onChange={(event) =>
                            setJoinRequestMessage(event.target.value)
                          }
                          placeholder="例: 同乗希望です。準備と片付けも手伝います。"
                          className="mt-2 min-h-20 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm outline-none ring-emerald-600 focus:ring-2"
                        />
                        <button
                          type="button"
                          onClick={() => requestJoin(reservation)}
                          disabled={joinRequestState === reservation.id}
                          className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-black text-white disabled:bg-slate-300"
                        >
                          <UserPlus size={17} aria-hidden="true" />
                          {joinRequestState === reservation.id
                            ? "送信中..."
                            : "便乗希望を送る"}
                        </button>
                      </div>
                    ) : currentUserJoinRequest ? (
                      <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-900">
                        この予約には便乗希望を送信済みです。
                      </div>
                    ) : null}

                    {joinRequestResult ? (
                      <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-700">
                        {joinRequestResult}
                      </p>
                    ) : null}

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
                          {!isClosed && canOperate ? (
                            <Link
                              href={`/checks/post-return?reservationId=${reservation.id}`}
                              className="flex min-h-11 items-center justify-center rounded-lg border border-sky-200 px-4 text-sm font-black text-blue-900"
                            >
                              帰港後チェック
                            </Link>
                          ) : null}
                        </>
                      ) : phase === "today" ? (
                        <>
                          {sessionStatus === "scheduled" && canOperate ? (
                            <Link
                              href={`/checks/pre-departure?reservationId=${reservation.id}`}
                              className="flex min-h-11 items-center justify-center rounded-lg bg-blue-800 px-4 text-sm font-black text-white"
                            >
                              出船前チェック
                            </Link>
                          ) : null}
                          {sessionStatus === "pre_checked" && canOperate ? (
                            <Link
                              href={`/voyages?reservationId=${reservation.id}`}
                              className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-black text-white"
                            >
                              <Navigation size={16} aria-hidden="true" />
                              出船開始
                            </Link>
                          ) : null}
                          {sessionStatus === "underway" ? (
                            <>
                              <Link
                                href={`/support?reservationId=${reservation.id}#new`}
                                className="flex min-h-11 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-4 text-sm font-black text-rose-800"
                              >
                                サポート要請
                              </Link>
                              {canOperate ? (
                                <Link
                                  href={`/checks/post-return?reservationId=${reservation.id}`}
                                  className="flex min-h-11 items-center justify-center rounded-lg bg-emerald-700 px-4 text-sm font-black text-white"
                                >
                                  帰港後チェック
                                </Link>
                              ) : null}
                            </>
                          ) : null}
                          {sessionStatus === "returned" && canOperate ? (
                            <button
                              type="button"
                              onClick={() => closeReservation(reservation)}
                              className="flex min-h-11 items-center justify-center rounded-lg bg-slate-800 px-4 text-sm font-black text-white"
                            >
                              予約クローズ
                            </button>
                          ) : null}
                          {sessionStatus === "closed" ? (
                            <div className="flex min-h-11 items-center justify-center rounded-lg bg-slate-100 px-4 text-sm font-black text-slate-500">
                              利用終了
                            </div>
                          ) : null}
                          {!canOperate ? (
                            <div className="flex min-h-11 items-center justify-center rounded-lg bg-slate-100 px-4 text-sm font-black text-slate-500">
                              他メンバーの予約
                            </div>
                          ) : null}
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
                      {(isClosed && data.currentUser.role !== "admin") || !canOperate ? null : (
                        <button
                          type="button"
                          onClick={() => startEdit(reservation.id)}
                          className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-black text-slate-700"
                        >
                          <Edit3 size={16} aria-hidden="true" />
                          編集
                        </button>
                      )}
                      {canOperate ? (
                        <button
                          type="button"
                          onClick={() => deleteReservation(reservation.id)}
                          disabled={deleteState === reservation.id}
                          className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-rose-200 px-4 text-sm font-black text-rose-700 disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                          {deleteState === reservation.id ? "削除中" : "削除"}
                        </button>
                      ) : null}
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
