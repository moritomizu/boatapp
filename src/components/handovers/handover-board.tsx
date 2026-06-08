"use client";

import Image from "next/image";
import Link from "next/link";
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
  costResponsibilities,
  costResponsibilityLabels,
  fundTransactionReasonLabels,
  getBoatFund,
  getSafetyFund,
  recalculateFunds,
  fundReasons,
} from "@/lib/funds";
import {
  handoverCategoryLabels,
  handoverPriorityLabels,
  handoverPriorityTone,
  handoverStatusLabels,
  handoverStatusTone,
} from "@/lib/labels";
import { createHandoverNote } from "@/lib/mock-data";
import { uploadHandoverAttachment } from "@/lib/storage";
import type {
  AppData,
  CostResponsibility,
  FundTransaction,
  FundTransactionReason,
  HandoverCategory,
  HandoverNote,
  HandoverPriority,
  HandoverStatus,
  SupportAttachment,
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
  const [maintenanceResponsibility, setMaintenanceResponsibility] =
    useState<CostResponsibility>("boat_maintenance_fund");
  const [maintenanceReason, setMaintenanceReason] =
    useState<FundTransactionReason>("regular_maintenance");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [attachmentMessage, setAttachmentMessage] = useState("");

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
  const canCreateAsOther = appData.currentUser.role === "admin";
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
    const createdBy = canCreateAsOther ? form.createdBy : appData.currentUser.id;
    const status = canResolve ? form.status : "unconfirmed";

    const note = createHandoverNote({
      organizationId: data.organization.id,
      boatId: appData.boat.id,
      reservationId: form.reservationId || undefined,
      title: form.title,
      body: form.body,
      category: form.category,
      priority: form.priority,
      status,
      createdBy,
      estimatedCost: form.estimatedCost > 0 ? form.estimatedCost : undefined,
      attachments: [],
      resolvedAt: status === "resolved" ? new Date().toISOString() : undefined,
    });

    try {
      let attachments: SupportAttachment[] = [];
      if (selectedFiles.length > 0) {
        const uploadResults = await Promise.allSettled(
          selectedFiles.map((file) =>
            uploadHandoverAttachment({
              file,
              handoverNoteId: note.id,
              userId: createdBy,
            }),
          ),
        );
        attachments = uploadResults
          .filter(
            (result): result is PromiseFulfilledResult<SupportAttachment> =>
              result.status === "fulfilled",
          )
          .map((result) => result.value);
        const failedCount = uploadResults.filter(
          (result) => result.status === "rejected",
        ).length;
        setAttachmentMessage(
          failedCount > 0
            ? `写真${failedCount}枚の添付に失敗しましたが、申し送り本文は保存しました。Storage Rulesを確認してください。`
            : "",
        );
      } else {
        setAttachmentMessage("");
      }

      const noteWithAttachments = { ...note, attachments };
      const nextNotes = [noteWithAttachments, ...notes];
      setSelectedId(noteWithAttachments.id);
      await updateClientAppData(
        (current) => ({ ...current, handoverNotes: nextNotes }),
        appData,
      );
      setSaveState("saved");
      setSelectedFiles([]);
      setForm((current) => ({
        ...current,
        title: "",
        body: "",
        priority: "medium",
        status: "unconfirmed",
        category: "other",
        createdBy: appData.currentUser.id,
        estimatedCost: 0,
      }));
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "申し送りの作成に失敗しました。";
      setAttachmentMessage(message);
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
      hasCost: (maintenanceCost || note.estimatedCost || 0) > 0,
      costResponsibility: maintenanceResponsibility,
      useFund:
        maintenanceResponsibility === "boat_maintenance_fund" ||
        maintenanceResponsibility === "organization_safety_fund",
      performedAt: now,
      createdBy: appData.currentUser.id,
      createdAt: now,
    };
    const shouldCreateFundTransaction =
      appData.currentUser.role === "admin" &&
      log.cost > 0 &&
      (maintenanceResponsibility === "boat_maintenance_fund" ||
        maintenanceResponsibility === "organization_safety_fund");
    if (shouldCreateFundTransaction) {
      const balance =
        maintenanceResponsibility === "boat_maintenance_fund"
          ? getBoatFund(appData, note.boatId).balance
          : getSafetyFund(appData).balance;
      if (balance - log.cost < 0) {
        const proceed = window.confirm(
          "この支出により残高がマイナスになります。登録しますか？",
        );
        if (!proceed) {
          setPromoteState("idle");
          return;
        }
      }
    }
    const fundTransaction: FundTransaction | undefined = shouldCreateFundTransaction
      ? {
          id: `fund-tx-${crypto.randomUUID()}`,
          organizationId: note.organizationId,
          fundType:
            maintenanceResponsibility === "boat_maintenance_fund"
              ? "boat_maintenance"
              : "organization_safety",
          boatId:
            maintenanceResponsibility === "boat_maintenance_fund"
              ? note.boatId
              : undefined,
          type: "expense",
          amount: log.cost,
          reason: maintenanceReason,
          costResponsibility: maintenanceResponsibility,
          description: log.title,
          relatedBoatId: note.boatId,
          relatedMaintenanceLogId: log.id,
          adminMemo: "申し送りから整備記録へ昇格時に作成",
          createdAt: now,
          createdBy: appData.currentUser.id,
        }
      : undefined;
    const logWithFund = fundTransaction
      ? { ...log, fundTransactionId: fundTransaction.id }
      : log;
    const nextNotes = notes.map((item) =>
      item.id === note.id && item.status === "unconfirmed"
        ? { ...item, status: "in_progress" as HandoverStatus, updatedAt: now }
        : item,
    );

    await updateClientAppData(
      (current) =>
        recalculateFunds({
          ...current,
          handoverNotes: nextNotes,
          maintenanceLogs: [logWithFund, ...current.maintenanceLogs],
          fundTransactions: fundTransaction
            ? [fundTransaction, ...current.fundTransactions]
            : current.fundTransactions,
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
        <h1 className="text-2xl font-black tracking-normal text-blue-950">
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
                disabled={!canResolve}
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
                disabled={!canCreateAsOther}
                className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
              >
                {(canCreateAsOther ? appData.users : [appData.currentUser]).map((user) => (
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
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) =>
                setSelectedFiles(Array.from(event.target.files ?? []))
              }
              className="mt-3 w-full text-sm font-semibold text-blue-900 file:mr-3 file:h-10 file:rounded-lg file:border-0 file:bg-blue-800 file:px-4 file:text-sm file:font-black file:text-white"
            />
            <p className="mt-2 text-sm leading-6 text-blue-800">
              状況写真を添付できます。保存時に圧縮してStorageへアップロードします。
            </p>
            {selectedFiles.length > 0 ? (
              <p className="mt-2 text-sm font-black text-blue-900">
                選択中: {selectedFiles.length}枚
              </p>
            ) : null}
            {attachmentMessage ? (
              <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm font-bold leading-6 text-amber-900">
                {attachmentMessage}
              </p>
            ) : null}
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

            {selectedNote.attachments && selectedNote.attachments.length > 0 ? (
              <div className="mt-4 rounded-lg bg-slate-50 p-3">
                <p className="text-sm font-black text-slate-900">添付写真</p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {selectedNote.attachments.map((attachment) => (
                    <Link
                      key={attachment.url}
                      href={attachment.url}
                      target="_blank"
                      className="block overflow-hidden rounded-lg border border-slate-200 bg-white"
                    >
                      <Image
                        src={attachment.url}
                        alt={attachment.name}
                        width={240}
                        height={240}
                        className="aspect-square w-full object-cover"
                        unoptimized={attachment.url.startsWith("data:")}
                      />
                    </Link>
                  ))}
                </div>
              </div>
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
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-bold text-blue-950">
                        費用負担区分
                      </span>
                      <select
                        value={maintenanceResponsibility}
                        onChange={(event) =>
                          setMaintenanceResponsibility(
                            event.target.value as CostResponsibility,
                          )
                        }
                        className="mt-2 h-12 w-full rounded-lg border border-sky-200 bg-white px-3 text-base outline-none ring-blue-600 focus:ring-2"
                      >
                        {costResponsibilities.map((responsibility) => (
                          <option key={responsibility} value={responsibility}>
                            {costResponsibilityLabels[responsibility]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-sm font-bold text-blue-950">
                        支出理由
                      </span>
                      <select
                        value={maintenanceReason}
                        onChange={(event) =>
                          setMaintenanceReason(
                            event.target.value as FundTransactionReason,
                          )
                        }
                        className="mt-2 h-12 w-full rounded-lg border border-sky-200 bg-white px-3 text-base outline-none ring-blue-600 focus:ring-2"
                      >
                        {fundReasons.map((reason) => (
                          <option key={reason} value={reason}>
                            {fundTransactionReasonLabels[reason]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {appData.currentUser.role === "admin" &&
                  maintenanceCost > 0 &&
                  (maintenanceResponsibility === "boat_maintenance_fund" ||
                    maintenanceResponsibility === "organization_safety_fund") ? (
                    <p className="rounded-lg bg-amber-50 p-3 text-sm font-bold leading-6 text-amber-900">
                      昇格時に基金台帳へ支出履歴も作成します。残高不足時は基金管理画面で確認してください。
                    </p>
                  ) : null}
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
