"use client";

import { useMemo, useState } from "react";
import {
  Camera,
  CheckCircle2,
  FilePlus2,
  MessageSquareWarning,
  Wrench,
  X,
} from "lucide-react";
import { Badge, Card, Section } from "@/components/ui";
import { getBoatName } from "@/lib/boat-utils";
import { updateClientAppData, useClientAppData } from "@/lib/client-store";
import {
  handoverCategoryLabels,
  handoverPriorityLabels,
  handoverPriorityTone,
  handoverStatusLabels,
  handoverStatusTone,
} from "@/lib/labels";
import { createHandoverNote } from "@/lib/mock-data";
import type {
  AppData,
  HandoverCategory,
  HandoverNote,
  HandoverPriority,
  HandoverStatus,
} from "@/types/domain";

const categories = Object.keys(handoverCategoryLabels) as HandoverCategory[];
const priorities = Object.keys(handoverPriorityLabels) as HandoverPriority[];
const statuses = Object.keys(handoverStatusLabels) as HandoverStatus[];

type InitialDraft = {
  reservationId?: string;
  title?: string;
  body?: string;
};

export function HandoverBoard({
  data,
  initialDraft,
}: {
  data: AppData;
  initialDraft: InitialDraft;
}) {
  const appData = useClientAppData(data);
  const notes = appData.handoverNotes;
  const [scope, setScope] = useState<"current" | "all">("current");
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState({
    title: initialDraft.title ?? "",
    body: initialDraft.body ?? "",
    category: "other" as HandoverCategory,
    priority: "medium" as HandoverPriority,
    status: "unconfirmed" as HandoverStatus,
    reservationId: initialDraft.reservationId ?? "",
    createdBy: data.currentUser.id,
    estimatedCost: 0,
  });
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [resolvingId, setResolvingId] = useState("");
  const [promoteState, setPromoteState] = useState<"idle" | "saving" | "done">(
    "idle",
  );
  const [maintenanceCost, setMaintenanceCost] = useState(0);

  const unresolvedNotes = useMemo(
    () =>
      notes
        .filter((note) => (scope === "current" ? note.boatId === appData.boat.id : true))
        .filter((note) => note.status !== "resolved")
        .sort((a, b) => {
          if (a.priority === "high" && b.priority !== "high") return -1;
          if (a.priority !== "high" && b.priority === "high") return 1;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        }),
    [appData.boat.id, notes, scope],
  );
  const resolvedNotes = notes
    .filter((note) => (scope === "current" ? note.boatId === appData.boat.id : true))
    .filter((note) => note.status === "resolved");
  const selectedNote = notes.find((note) => note.id === selectedId);
  const canResolve =
    appData.currentUser.role === "admin" ||
    appData.currentUser.role === "owner";
  const canPromote = canResolve;
  const selectedMaintenanceLog = selectedNote
    ? appData.maintenanceLogs.find(
        (log) => log.handoverNoteId === selectedNote.id,
      )
    : undefined;

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

    const note = createHandoverNote({
      organizationId: data.organization.id,
      boatId: appData.boat.id,
      reservationId: form.reservationId || undefined,
      title: form.title,
      body: form.body,
      category: form.category,
      priority: form.priority,
      status: form.status,
      createdBy: form.createdBy,
      estimatedCost: form.estimatedCost > 0 ? form.estimatedCost : undefined,
      resolvedAt: form.status === "resolved" ? new Date().toISOString() : undefined,
    });

    const nextNotes = [note, ...notes];

    setSelectedId(note.id);
    try {
      await updateClientAppData(
        (current) => ({ ...current, handoverNotes: nextNotes }),
        appData,
      );
      setSaveState("saved");
      setForm((current) => ({
        ...current,
        title: "",
        body: "",
        priority: "medium",
        status: "unconfirmed",
        category: "other",
        estimatedCost: 0,
      }));
    } catch {
      setSaveState("error");
    }
  }

  async function resolveNote(noteId: string) {
    const now = new Date().toISOString();
    setResolvingId(noteId);

    const nextNotes = notes.map((note) =>
        note.id === noteId
          ? {
              ...note,
              status: "resolved" as HandoverStatus,
              updatedAt: now,
              resolvedAt: now,
            }
          : note,
      );

    try {
      await updateClientAppData(
        (current) => ({ ...current, handoverNotes: nextNotes }),
        appData,
      );
    } finally {
      setResolvingId("");
    }
  }

  async function promoteToMaintenanceLog(note: HandoverNote) {
    if (promoteState === "saving" || selectedMaintenanceLog) return;
    setPromoteState("saving");
    const now = new Date().toISOString();
    const log = {
      id: `maintenance-${crypto.randomUUID()}`,
      organizationId: note.organizationId,
      boatId: note.boatId,
      handoverNoteId: note.id,
      category: handoverCategoryLabels[note.category],
      title: note.title,
      body: `申し送りからメンテナンス台帳へ昇格\n\n${note.body}`,
      cost: maintenanceCost || note.estimatedCost || 0,
      performedAt: now,
      createdBy: appData.currentUser.id,
      createdAt: now,
    };
    const nextNotes = notes.map((item) =>
      item.id === note.id && item.status === "unconfirmed"
        ? { ...item, status: "in_progress" as HandoverStatus, updatedAt: now }
        : item,
    );

    await updateClientAppData(
      (current) => ({
        ...current,
        handoverNotes: nextNotes,
        maintenanceLogs: [log, ...current.maintenanceLogs],
      }),
      appData,
    );
    setPromoteState("done");
  }

  function renderNote(note: HandoverNote) {
    const author = appData.users.find((user) => user.id === note.createdBy);

    return (
      <button
        type="button"
        key={note.id}
        onClick={() => {
          setPromoteState("idle");
          setMaintenanceCost(note.estimatedCost ?? 0);
          setSelectedId(note.id);
        }}
        className={`w-full rounded-lg border bg-white p-4 text-left shadow-sm ${
          selectedId === note.id ? "border-blue-400 ring-2 ring-blue-100" : "border-sky-100"
        } ${note.priority === "high" && note.status !== "resolved" ? "bg-rose-50" : ""}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-black text-slate-950">{note.title}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {getBoatName(appData, note.boatId)} /{" "}
              {author?.name} /{" "}
              {new Intl.DateTimeFormat("ja-JP", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(note.updatedAt))}
            </p>
          </div>
          <Badge className={handoverPriorityTone[note.priority]}>
            重要度{handoverPriorityLabels[note.priority]}
          </Badge>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge className="bg-sky-100 text-blue-800 ring-sky-200">
            {handoverCategoryLabels[note.category]}
          </Badge>
          <Badge className={handoverStatusTone[note.status]}>
            {handoverStatusLabels[note.status]}
          </Badge>
        </div>
        <p className="mt-3 max-h-12 overflow-hidden text-sm leading-6 text-slate-600">
          {note.body}
        </p>
        <p className="mt-3 text-sm font-black text-blue-800">詳細を確認</p>
      </button>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-bold text-blue-700">申し送りノート</p>
        <h1 className="text-3xl font-black tracking-normal text-blue-950">
          船の状態と注意点
        </h1>
        <p className="text-sm leading-6 text-slate-600">
          LINEで流れがちな軽微な不具合、注意点、工事予定を運用ログとして残します。
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setScope("current")}
          className={`h-11 rounded-lg text-sm font-black ${
            scope === "current" ? "bg-blue-800 text-white" : "bg-white text-slate-700"
          }`}
        >
          選択中の船
        </button>
        <button
          type="button"
          onClick={() => setScope("all")}
          className={`h-11 rounded-lg text-sm font-black ${
            scope === "all" ? "bg-blue-800 text-white" : "bg-white text-slate-700"
          }`}
        >
          全艇の申し送り
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-bold text-slate-500">未解決</p>
          <p className="mt-2 text-3xl font-black text-amber-700">
            {unresolvedNotes.length}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-bold text-slate-500">重要度高</p>
          <p className="mt-2 text-3xl font-black text-rose-700">
            {
              unresolvedNotes.filter((note) => note.priority === "high")
                .length
            }
          </p>
        </Card>
        <Card>
          <p className="text-xs font-bold text-slate-500">解決済み</p>
          <p className="mt-2 text-3xl font-black text-emerald-700">
            {resolvedNotes.length}
          </p>
        </Card>
      </div>

      <Section title="申し送り作成">
        <form
          id="new"
          onSubmit={handleSubmit}
          className="space-y-4 rounded-lg border border-sky-100 bg-white p-4 shadow-sm"
        >
          <p className="rounded-lg bg-sky-50 p-3 text-sm font-black text-blue-900">
            対象船舶: {appData.boat.name}
          </p>
          <label className="block">
            <span className="text-sm font-bold text-slate-700">タイトル</span>
            <input
              value={form.title}
              onChange={(event) => updateForm("title", event.target.value)}
              className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-bold text-slate-700">本文</span>
            <textarea
              value={form.body}
              onChange={(event) => updateForm("body", event.target.value)}
              className="mt-2 min-h-32 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-base outline-none ring-blue-600 focus:ring-2"
              required
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-sm font-bold text-slate-700">カテゴリ</span>
              <select
                value={form.category}
                onChange={(event) =>
                  updateForm("category", event.target.value as HandoverCategory)
                }
                className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {handoverCategoryLabels[category]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">重要度</span>
              <select
                value={form.priority}
                onChange={(event) =>
                  updateForm("priority", event.target.value as HandoverPriority)
                }
                className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
              >
                {priorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {handoverPriorityLabels[priority]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">ステータス</span>
              <select
                value={form.status}
                onChange={(event) =>
                  updateForm("status", event.target.value as HandoverStatus)
                }
                className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {handoverStatusLabels[status]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-bold text-slate-700">対象予約</span>
              <select
                value={form.reservationId}
                onChange={(event) => updateForm("reservationId", event.target.value)}
                className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
              >
                <option value="">予約に紐付けない</option>
                {appData.reservations
                  .filter((reservation) => reservation.boatId === appData.boat.id)
                  .map((reservation) => (
                  <option key={reservation.id} value={reservation.id}>
                    {new Intl.DateTimeFormat("ja-JP", {
                      month: "numeric",
                      day: "numeric",
                      weekday: "short",
                    }).format(new Date(reservation.startAt))}{" "}
                    {reservation.destinationArea}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">作成者</span>
              <select
                value={form.createdBy}
                onChange={(event) => updateForm("createdBy", event.target.value)}
                className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
              >
                {appData.users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-bold text-slate-700">
              想定費用・対応費用
            </span>
            <input
              type="number"
              min={0}
              value={form.estimatedCost}
              onChange={(event) =>
                updateForm("estimatedCost", Number(event.target.value))
              }
              className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
            />
            <p className="mt-1 text-xs font-semibold text-slate-500">
              未定の場合は0のままで構いません。整備記録へ昇格する際にも調整できます。
            </p>
          </label>

          <div className="rounded-lg border border-dashed border-sky-200 bg-sky-50 p-4">
            <div className="flex items-center gap-2 text-sm font-black text-blue-900">
              <Camera size={20} aria-hidden="true" />
              写真添付
            </div>
            <p className="mt-2 text-sm leading-6 text-blue-800">
              Firebase Storage接続後に利用予定です。
            </p>
          </div>

          <button
            type="submit"
            disabled={saveState === "saving"}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-5 text-base font-black text-white disabled:bg-slate-300"
          >
            <FilePlus2 size={22} aria-hidden="true" />
            {saveState === "saving"
              ? "作成中..."
              : saveState === "saved"
                ? "作成しました"
                : saveState === "error"
                  ? "作成に失敗しました"
                : "申し送りを作成"}
          </button>
        </form>
      </Section>

      <div className="grid gap-6">
        <Section title="未解決の申し送り">
          <div className="space-y-3">
            {unresolvedNotes.map(renderNote)}
            {unresolvedNotes.length === 0 ? (
              <Card>
                <p className="text-sm font-semibold text-slate-600">
                  未解決の申し送りはありません。
                </p>
              </Card>
            ) : null}
          </div>
        </Section>
      </div>

      <Section title="解決済み">
        <div className="space-y-3">{resolvedNotes.map(renderNote)}</div>
      </Section>

      {selectedNote ? (
        <div className="fixed inset-0 z-40 flex items-end bg-slate-950/45 p-0 sm:items-center sm:p-4">
          <div className="max-h-[88vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:mx-auto sm:max-w-2xl sm:rounded-lg sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <MessageSquareWarning
                  className="mt-1 shrink-0 text-blue-800"
                  size={24}
                  aria-hidden="true"
                />
                <div>
                  <p className="text-xs font-black text-blue-700">申し送り詳細</p>
                  <h2 className="mt-1 text-xl font-black text-blue-950">
                    {selectedNote.title}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId("")}
                className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-700"
                aria-label="詳細を閉じる"
              >
                <X size={21} aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge className="bg-sky-100 text-blue-800 ring-sky-200">
                {getBoatName(appData, selectedNote.boatId)}
              </Badge>
              <Badge className="bg-sky-100 text-blue-800 ring-sky-200">
                {handoverCategoryLabels[selectedNote.category]}
              </Badge>
              <Badge className={handoverPriorityTone[selectedNote.priority]}>
                重要度{handoverPriorityLabels[selectedNote.priority]}
              </Badge>
              <Badge className={handoverStatusTone[selectedNote.status]}>
                {handoverStatusLabels[selectedNote.status]}
              </Badge>
            </div>

            <p className="mt-4 whitespace-pre-wrap text-base leading-8 text-slate-700">
              {selectedNote.body}
            </p>

            {selectedNote.estimatedCost ? (
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-black text-amber-900">
                想定費用:{" "}
                {new Intl.NumberFormat("ja-JP", {
                  style: "currency",
                  currency: "JPY",
                  maximumFractionDigits: 0,
                }).format(selectedNote.estimatedCost)}
              </p>
            ) : null}

            <div className="mt-5 rounded-lg border border-sky-100 bg-sky-50 p-3">
              <div className="flex items-start gap-2">
                <Wrench
                  className="mt-0.5 shrink-0 text-blue-800"
                  size={20}
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-black text-blue-950">
                    メンテナンス台帳への昇格
                  </p>
                  <p className="mt-1 text-sm leading-6 text-blue-900">
                    重要な申し送りや対応内容は、船舶の整備記録として残せます。
                  </p>
                </div>
              </div>
              {selectedMaintenanceLog ? (
                <p className="mt-3 rounded-lg bg-white p-3 text-sm font-bold text-emerald-800">
                  すでに整備記録へ紐づいています: {selectedMaintenanceLog.title}
                </p>
              ) : canPromote ? (
                <div className="mt-3 space-y-3">
                  <label className="block">
                    <span className="text-sm font-bold text-blue-950">
                      整備費用
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={maintenanceCost}
                      onChange={(event) =>
                        setMaintenanceCost(Number(event.target.value))
                      }
                      className="mt-2 h-12 w-full rounded-lg border border-sky-200 bg-white px-3 text-base outline-none ring-blue-600 focus:ring-2"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => promoteToMaintenanceLog(selectedNote)}
                    disabled={promoteState === "saving"}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-black text-white disabled:bg-slate-300"
                  >
                    <Wrench size={19} aria-hidden="true" />
                    {promoteState === "saving"
                      ? "作成中..."
                      : promoteState === "done"
                        ? "整備記録を作成しました"
                        : "メンテナンス台帳へ昇格"}
                  </button>
                </div>
              ) : (
                <p className="mt-3 rounded-lg bg-white p-3 text-sm font-bold text-slate-600">
                  整備記録への昇格は管理者/共同オーナーが行えます。
                </p>
              )}
            </div>

            {selectedNote.status !== "resolved" ? (
              <button
                type="button"
                onClick={() => resolveNote(selectedNote.id)}
                disabled={!canResolve || resolvingId === selectedNote.id}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-black text-white disabled:bg-slate-300"
              >
                <CheckCircle2 size={20} aria-hidden="true" />
                {resolvingId === selectedNote.id
                  ? "変更中..."
                  : "解決済みに変更"}
              </button>
            ) : null}

            {!canResolve ? (
              <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-600">
                メンバーは他人の申し送りを解決済みに変更できません。
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
