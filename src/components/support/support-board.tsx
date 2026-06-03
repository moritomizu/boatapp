"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import {
  Camera,
  ClipboardCheck,
  LifeBuoy,
  MapPin,
  MessageSquarePlus,
  Send,
  ShieldAlert,
} from "lucide-react";
import { Badge, Card, Section } from "@/components/ui";
import { postReturnCheckItems, preDepartureCheckItems } from "@/lib/check-items";
import { updateClientAppData, useClientAppData } from "@/lib/client-store";
import {
  supportCategoryLabels,
  supportStatusLabels,
  supportStatusTone,
  supportUrgencyLabels,
  supportUrgencyTone,
  targetFishLabels,
} from "@/lib/labels";
import { createSupportMessage, createSupportRequest } from "@/lib/mock-data";
import { formatDate, formatTime } from "@/lib/reservations";
import { uploadSupportAttachment } from "@/lib/storage";
import type {
  AppData,
  SupportAttachment,
  SupportCategory,
  SupportLocation,
  SupportRequest,
  SupportStatus,
  SupportUrgency,
} from "@/types/domain";

const categories = Object.keys(supportCategoryLabels) as SupportCategory[];
const statuses: ("all" | SupportStatus)[] = [
  "all",
  "open",
  "in_progress",
  "resolved",
  "closed",
];

type InitialDraft = {
  reservationId?: string;
};

export function SupportBoard({
  data,
  initialDraft,
}: {
  data: AppData;
  initialDraft: InitialDraft;
}) {
  const appData = useClientAppData(data);
  const requests = appData.supportRequests;
  const messages = appData.supportMessages;
  const [selectedId, setSelectedId] = useState(data.supportRequests[0]?.id ?? "");
  const [categoryFilter, setCategoryFilter] = useState<"all" | SupportCategory>(
    "all",
  );
  const [statusFilter, setStatusFilter] = useState<"all" | SupportStatus>("all");
  const [locationMessage, setLocationMessage] = useState("");
  const [comment, setComment] = useState("");
  const [resolveComment, setResolveComment] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [createState, setCreateState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [commentState, setCommentState] = useState<"idle" | "saving">("idle");
  const [statusState, setStatusState] = useState<SupportStatus | "">("");
  const [form, setForm] = useState({
    title: "",
    category: "other" as SupportCategory,
    urgency: "medium" as SupportUrgency,
    body: "",
    reservationId: initialDraft.reservationId ?? "",
    createdBy: data.currentUser.id,
    location: undefined as SupportLocation | undefined,
  });

  const selectedRequest = requests.find((request) => request.id === selectedId);
  const canChangeAllStatuses =
    appData.currentUser.role === "admin" || appData.currentUser.role === "owner";
  const canResolveSelected =
    canChangeAllStatuses || selectedRequest?.createdBy === appData.currentUser.id;
  const selectedMessages = messages
    .filter((message) => message.supportRequestId === selectedId)
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  const openCount = requests.filter((request) => request.status === "open").length;
  const highOpenCount = requests.filter(
    (request) => request.status !== "resolved" && request.urgency === "high",
  ).length;

  const visibleRequests = useMemo(() => {
    return [...requests]
      .filter((request) =>
        categoryFilter === "all" ? true : request.category === categoryFilter,
      )
      .filter((request) =>
        statusFilter === "all" ? true : request.status === statusFilter,
      )
      .sort((a, b) => {
        const statusRank = { open: 0, in_progress: 1, resolved: 2, closed: 3 };
        const urgencyRank = { high: 0, medium: 1, low: 2 };
        const statusDiff = statusRank[a.status] - statusRank[b.status];
        if (statusDiff !== 0) return statusDiff;
        const urgencyDiff = urgencyRank[a.urgency] - urgencyRank[b.urgency];
        if (urgencyDiff !== 0) return urgencyDiff;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [categoryFilter, requests, statusFilter]);

  function updateForm<T extends keyof typeof form>(
    key: T,
    value: (typeof form)[T],
  ) {
    if (createState === "saved" || createState === "error") {
      setCreateState("idle");
    }
    setForm((current) => ({ ...current, [key]: value }));
  }

  function captureLocation() {
    setLocationMessage("現在地を取得しています...");

    if (!navigator.geolocation) {
      setLocationMessage("位置情報を取得できませんでした");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateForm("location", {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: new Date().toISOString(),
        });
        setLocationMessage("現在地を取得しました");
      },
      () => {
        setLocationMessage("位置情報を取得できませんでした");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createState === "saving") return;
    setCreateState("saving");

    const request = createSupportRequest({
      organizationId: data.organization.id,
      boatId: appData.boat.id,
      reservationId: form.reservationId || undefined,
      title: form.title,
      category: form.category,
      urgency: form.urgency,
      body: form.body,
      status: "open",
      createdBy: form.createdBy,
      location: form.location,
      attachments: [],
    });

    try {
      let attachments: SupportAttachment[] = [];
      if (selectedFiles.length > 0) {
        attachments = await Promise.all(
          selectedFiles.map((file) =>
            uploadSupportAttachment({
              file,
              supportRequestId: request.id,
              userId: form.createdBy,
            }),
          ),
        );
      }

      const requestWithAttachments = { ...request, attachments };
      const nextRequests = [requestWithAttachments, ...requests];

      setSelectedId(requestWithAttachments.id);
      await updateClientAppData(
        (current) => ({ ...current, supportRequests: nextRequests }),
        appData,
      );
      setCreateState("saved");
      setForm((current) => ({
        ...current,
        title: "",
        body: "",
        category: "other",
        urgency: "medium",
        location: undefined,
      }));
      setSelectedFiles([]);
      setLocationMessage("");
    } catch {
      setCreateState("error");
    }
  }

  async function addMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRequest || !comment.trim() || commentState === "saving") return;
    setCommentState("saving");

    const message = createSupportMessage({
      organizationId: data.organization.id,
      supportRequestId: selectedRequest.id,
      body: comment,
      createdBy: appData.currentUser.id,
    });
    const nextMessages = [...messages, message];
    const nextRequests = requests.map((request) =>
      request.id === selectedRequest.id
        ? { ...request, updatedAt: message.createdAt }
        : request,
    );

    try {
      await updateClientAppData(
        (current) => ({
          ...current,
          supportMessages: nextMessages,
          supportRequests: nextRequests,
        }),
        appData,
      );
      setComment("");
    } finally {
      setCommentState("idle");
    }
  }

  async function updateStatus(status: SupportStatus, resolution?: string) {
    if (!selectedRequest) return;
    if (statusState) return;
    setStatusState(status);
    const now = new Date().toISOString();

    const nextRequests = requests.map((request) =>
        request.id === selectedRequest.id
          ? {
              ...request,
              status,
              assignedTo:
                status === "in_progress"
                  ? appData.currentUser.id
                  : request.assignedTo,
              updatedAt: now,
              resolvedAt: status === "resolved" ? now : request.resolvedAt,
              closedAt: status === "closed" ? now : request.closedAt,
            }
          : request,
      );
    let nextMessages = messages;

    if (resolution?.trim()) {
      nextMessages = [
        ...messages,
        createSupportMessage({
          organizationId: data.organization.id,
          supportRequestId: selectedRequest.id,
          body: `解決コメント: ${resolution}`,
          createdBy: appData.currentUser.id,
        }),
      ];
      setResolveComment("");
    }

    try {
      await updateClientAppData(
        (current) => ({
          ...current,
          supportRequests: nextRequests,
          supportMessages: nextMessages,
        }),
        appData,
      );
    } finally {
      setStatusState("");
    }
  }

  function requestMeta(request: SupportRequest) {
    const author = appData.users.find((user) => user.id === request.createdBy);
    const reservation = appData.reservations.find(
      (item) => item.id === request.reservationId,
    );

    return { author, reservation };
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-bold text-blue-700">サポート要請</p>
        <h1 className="text-3xl font-black tracking-normal text-blue-950">
          仲間に相談する
        </h1>
        <p className="text-sm leading-6 text-slate-600">
          出船中の困りごとを、共同オーナー/メンバーに残せるサポートログです。
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-900">
        <ShieldAlert className="mt-0.5 shrink-0" size={22} aria-hidden="true" />
        <p className="text-sm font-bold leading-7">
          この機能は、共同オーナー/メンバー間の状況共有・相談用です。緊急時や人命に関わる場合は、海上保安庁118番、マリーナ、救助機関へ直接連絡してください。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-bold text-slate-500">未対応</p>
          <p className="mt-2 text-3xl font-black text-orange-700">{openCount}</p>
        </Card>
        <Card>
          <p className="text-xs font-bold text-slate-500">緊急度高</p>
          <p className="mt-2 text-3xl font-black text-rose-700">
            {highOpenCount}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-bold text-slate-500">全要請</p>
          <p className="mt-2 text-3xl font-black text-blue-950">
            {requests.length}
          </p>
        </Card>
      </div>

      <Section title="サポート要請を作成">
        <form
          id="new"
          onSubmit={handleCreate}
          className="space-y-4 rounded-lg border border-sky-100 bg-white p-4 shadow-sm"
        >
          <label className="block">
            <span className="text-sm font-bold text-slate-700">タイトル</span>
            <input
              value={form.title}
              onChange={(event) => updateForm("title", event.target.value)}
              className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
              placeholder="例: 燃料残量が不安"
              required
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-bold text-slate-700">カテゴリ</span>
              <select
                value={form.category}
                onChange={(event) =>
                  updateForm("category", event.target.value as SupportCategory)
                }
                className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {supportCategoryLabels[category]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-700">緊急度</span>
              <select
                value={form.urgency}
                onChange={(event) =>
                  updateForm("urgency", event.target.value as SupportUrgency)
                }
                className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
              >
                <option value="low">低：確認・相談</option>
                <option value="medium">中：早めに回答希望</option>
                <option value="high">高：すぐ確認してほしい</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-bold text-slate-700">本文</span>
            <textarea
              value={form.body}
              onChange={(event) => updateForm("body", event.target.value)}
              className="mt-2 min-h-28 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-base outline-none ring-blue-600 focus:ring-2"
              placeholder="状況、試したこと、今いる場所の目印など"
              required
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-bold text-slate-700">関連予約</span>
              <select
                value={form.reservationId}
                onChange={(event) =>
                  updateForm("reservationId", event.target.value)
                }
                className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
              >
                <option value="">予約に紐付けない</option>
                {appData.reservations.map((reservation) => (
                  <option key={reservation.id} value={reservation.id}>
                    {formatDate(reservation.startAt)}{" "}
                    {formatTime(reservation.startAt)} /{" "}
                    {targetFishLabels[reservation.targetFish]}
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

          <div className="rounded-lg border border-sky-100 bg-sky-50 p-3">
            <button
              type="button"
              onClick={captureLocation}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-black text-white"
            >
              <MapPin size={19} aria-hidden="true" />
              現在地を取得
            </button>
            {locationMessage ? (
              <p className="mt-2 text-sm font-bold text-blue-900">
                {locationMessage}
              </p>
            ) : null}
            {form.location ? (
              <p className="mt-2 text-xs font-semibold leading-5 text-blue-900">
                緯度 {form.location.latitude.toFixed(5)} / 経度{" "}
                {form.location.longitude.toFixed(5)}
              </p>
            ) : null}
          </div>

          <label className="block rounded-lg border border-dashed border-sky-200 bg-sky-50 p-4">
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
              状況写真を添付できます。電波が弱い場合は送信に時間がかかることがあります。
            </p>
            {selectedFiles.length > 0 ? (
              <p className="mt-2 text-sm font-black text-blue-900">
                選択中: {selectedFiles.length}枚
              </p>
            ) : null}
          </label>

          <button
            type="submit"
            disabled={createState === "saving"}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-5 text-base font-black text-white disabled:bg-slate-300"
          >
            <Send size={21} aria-hidden="true" />
            {createState === "saving"
              ? "送信中..."
              : createState === "saved"
                ? "送信しました"
                : createState === "error"
                  ? "送信に失敗しました"
                : "サポート要請を送信"}
          </button>
        </form>
      </Section>

      <Section title="サポート要請一覧">
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            value={categoryFilter}
            onChange={(event) =>
              setCategoryFilter(event.target.value as "all" | SupportCategory)
            }
            className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"
          >
            <option value="all">すべてのカテゴリ</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {supportCategoryLabels[category]}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as "all" | SupportStatus)
            }
            className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status === "all" ? "すべてのステータス" : supportStatusLabels[status]}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 space-y-3">
          {visibleRequests.map((request) => {
            const { author, reservation } = requestMeta(request);

            return (
              <button
                key={request.id}
                type="button"
                onClick={() => setSelectedId(request.id)}
                className={`w-full rounded-lg border p-4 text-left shadow-sm ${
                  selectedId === request.id
                    ? "border-blue-400 bg-sky-50 ring-2 ring-blue-100"
                    : request.urgency === "high" && request.status !== "resolved"
                      ? "border-rose-200 bg-rose-50"
                      : "border-sky-100 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">{request.title}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {author?.name} /{" "}
                      {new Intl.DateTimeFormat("ja-JP", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(request.updatedAt))}
                    </p>
                  </div>
                  <Badge className={supportUrgencyTone[request.urgency]}>
                    {supportUrgencyLabels[request.urgency].split("：")[0]}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge className="bg-sky-100 text-blue-800 ring-sky-200">
                    {supportCategoryLabels[request.category]}
                  </Badge>
                  <Badge className={supportStatusTone[request.status]}>
                    {supportStatusLabels[request.status]}
                  </Badge>
                  <Badge className="bg-white text-slate-700 ring-slate-200">
                    {request.location ? "位置情報あり" : "位置情報なし"}
                  </Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {reservation
                    ? `${formatDate(reservation.startAt)} ${targetFishLabels[reservation.targetFish]}`
                    : "予約紐付けなし"}
                </p>
              </button>
            );
          })}
        </div>
      </Section>

      {selectedRequest ? (
        <Section title="サポート要請詳細">
          <Card>
            {(() => {
              const { author, reservation } = requestMeta(selectedRequest);
              const assigned = appData.users.find(
                (user) => user.id === selectedRequest.assignedTo,
              );
              const mapUrl = selectedRequest.location
                ? `https://www.google.com/maps?q=${selectedRequest.location.latitude},${selectedRequest.location.longitude}`
                : "";
              const relatedPreCheck = appData.preDepartureChecks.find(
                (check) => check.reservationId === selectedRequest.reservationId,
              );
              const relatedPostCheck = appData.postReturnChecks.find(
                (check) => check.reservationId === selectedRequest.reservationId,
              );
              const preCheckUser = appData.users.find(
                (user) => user.id === relatedPreCheck?.userId,
              );
              const preCheckedCount = relatedPreCheck
                ? Object.values(relatedPreCheck.items).filter(Boolean).length
                : 0;
              const postCheckedCount = relatedPostCheck
                ? Object.values(relatedPostCheck.items).filter(Boolean).length
                : 0;

              return (
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <LifeBuoy
                      className="mt-1 shrink-0 text-blue-800"
                      size={24}
                      aria-hidden="true"
                    />
                    <div>
                      <h2 className="text-xl font-black text-blue-950">
                        {selectedRequest.title}
                      </h2>
                      <p className="mt-2 text-sm leading-7 text-slate-700">
                        {selectedRequest.body}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-sky-100 text-blue-800 ring-sky-200">
                      {supportCategoryLabels[selectedRequest.category]}
                    </Badge>
                    <Badge className={supportUrgencyTone[selectedRequest.urgency]}>
                      {supportUrgencyLabels[selectedRequest.urgency]}
                    </Badge>
                    <Badge className={supportStatusTone[selectedRequest.status]}>
                      {supportStatusLabels[selectedRequest.status]}
                    </Badge>
                  </div>

                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <dt className="font-bold text-slate-500">作成者</dt>
                      <dd className="mt-1 font-black text-slate-900">
                        {author?.name}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <dt className="font-bold text-slate-500">対応者</dt>
                      <dd className="mt-1 font-black text-slate-900">
                        {assigned?.name ?? "未割り当て"}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <dt className="font-bold text-slate-500">対象船舶</dt>
                      <dd className="mt-1 font-black text-slate-900">
                        {appData.boat.name}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <dt className="font-bold text-slate-500">関連予約</dt>
                      <dd className="mt-1 font-black text-slate-900">
                        {reservation
                          ? `${formatDate(reservation.startAt)} ${formatTime(reservation.startAt)}`
                          : "なし"}
                      </dd>
                    </div>
                  </dl>

                  <div className="rounded-lg border border-sky-100 bg-sky-50 p-3">
                    <div className="flex items-start gap-2">
                      <ClipboardCheck
                        className="mt-0.5 shrink-0 text-blue-800"
                        size={21}
                        aria-hidden="true"
                      />
                      <div>
                        <p className="text-sm font-black text-blue-950">
                          チェック結果との連携
                        </p>
                        <p className="mt-1 text-sm leading-6 text-blue-900">
                          サポート要請に紐づく予約のチェック状況を確認できます。
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-lg bg-white p-3">
                        <p className="text-xs font-bold text-slate-500">
                          出船前チェック
                        </p>
                        {relatedPreCheck ? (
                          <>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Badge
                                className={
                                  relatedPreCheck.hasIssue
                                    ? "bg-rose-100 text-rose-800 ring-rose-200"
                                    : "bg-emerald-100 text-emerald-800 ring-emerald-200"
                                }
                              >
                                {relatedPreCheck.hasIssue ? "問題あり" : "問題なし"}
                              </Badge>
                              <Badge className="bg-slate-100 text-slate-700 ring-slate-200">
                                {preCheckedCount}/{preDepartureCheckItems.length}項目
                              </Badge>
                            </div>
                            <p className="mt-2 text-sm font-bold text-slate-900">
                              {preCheckUser?.name ?? "実施者不明"} /{" "}
                              {new Intl.DateTimeFormat("ja-JP", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              }).format(new Date(relatedPreCheck.checkedAt))}
                            </p>
                            {relatedPreCheck.comment ? (
                              <p className="mt-2 text-sm leading-6 text-slate-600">
                                {relatedPreCheck.comment}
                              </p>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <p className="mt-2 text-sm font-bold text-amber-800">
                              この予約の出船前チェックは未確認です。
                            </p>
                            {selectedRequest.reservationId ? (
                              <Link
                                href={`/checks/pre-departure?reservationId=${selectedRequest.reservationId}`}
                                className="mt-2 inline-flex text-sm font-black text-blue-800 underline underline-offset-4"
                              >
                                出船前チェックを開く
                              </Link>
                            ) : null}
                          </>
                        )}
                      </div>
                      <div className="rounded-lg bg-white p-3">
                        <p className="text-xs font-bold text-slate-500">
                          帰港後チェック
                        </p>
                        {relatedPostCheck ? (
                          <>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Badge
                                className={
                                  relatedPostCheck.hasIssue
                                    ? "bg-rose-100 text-rose-800 ring-rose-200"
                                    : "bg-emerald-100 text-emerald-800 ring-emerald-200"
                                }
                              >
                                {relatedPostCheck.hasIssue ? "問題あり" : "問題なし"}
                              </Badge>
                              <Badge className="bg-slate-100 text-slate-700 ring-slate-200">
                                {postCheckedCount}/{postReturnCheckItems.length}項目
                              </Badge>
                            </div>
                            <p className="mt-2 text-sm font-bold text-slate-900">
                              {new Intl.DateTimeFormat("ja-JP", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              }).format(new Date(relatedPostCheck.checkedAt))}
                            </p>
                            {relatedPostCheck.comment ? (
                              <p className="mt-2 text-sm leading-6 text-slate-600">
                                {relatedPostCheck.comment}
                              </p>
                            ) : null}
                          </>
                        ) : (
                          <p className="mt-2 text-sm font-bold text-slate-600">
                            まだ帰港後チェックは登録されていません。
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {selectedRequest.location ? (
                    <div className="rounded-lg bg-sky-50 p-3 text-sm leading-6 text-blue-900">
                      <p className="font-black">位置情報</p>
                      <p>
                        緯度 {selectedRequest.location.latitude.toFixed(5)} / 経度{" "}
                        {selectedRequest.location.longitude.toFixed(5)}
                      </p>
                      <Link
                        href={mapUrl}
                        target="_blank"
                        className="mt-2 inline-flex font-black underline underline-offset-4"
                      >
                        Google Mapsで開く
                      </Link>
                    </div>
                  ) : null}

                  {selectedRequest.attachments &&
                  selectedRequest.attachments.length > 0 ? (
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-sm font-black text-slate-900">
                        添付写真
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {selectedRequest.attachments.map((attachment) => (
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
                            />
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="grid gap-2 sm:grid-cols-2">
                    {canChangeAllStatuses &&
                    selectedRequest.status === "open" ? (
                      <button
                        type="button"
                        onClick={() => updateStatus("in_progress")}
                        disabled={Boolean(statusState)}
                        className="flex h-12 items-center justify-center rounded-lg bg-blue-800 px-4 text-sm font-black text-white disabled:bg-slate-300"
                      >
                        {statusState === "in_progress" ? "変更中..." : "対応します"}
                      </button>
                    ) : null}
                    {canResolveSelected &&
                    selectedRequest.status !== "resolved" &&
                    selectedRequest.status !== "closed" ? (
                      <button
                        type="button"
                        onClick={() => updateStatus("resolved", resolveComment)}
                        disabled={Boolean(statusState)}
                        className="flex h-12 items-center justify-center rounded-lg bg-emerald-700 px-4 text-sm font-black text-white disabled:bg-slate-300"
                      >
                        {statusState === "resolved"
                          ? "変更中..."
                          : "解決済みにする"}
                      </button>
                    ) : null}
                    {canChangeAllStatuses ? (
                      <button
                        type="button"
                        onClick={() => updateStatus("closed")}
                        disabled={Boolean(statusState)}
                        className="flex h-12 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-black text-slate-700 disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        {statusState === "closed" ? "変更中..." : "クローズ"}
                      </button>
                    ) : null}
                  </div>

                  <label className="block">
                    <span className="text-sm font-bold text-slate-700">
                      解決コメント
                    </span>
                    <textarea
                      value={resolveComment}
                      onChange={(event) => setResolveComment(event.target.value)}
                      className="mt-2 min-h-20 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-base outline-none ring-blue-600 focus:ring-2"
                      placeholder="解決済みにする時のメモ。任意です。"
                    />
                  </label>
                </div>
              );
            })()}
          </Card>
        </Section>
      ) : null}

      {selectedRequest ? (
        <Section title="サポートスレッド">
          <div className="space-y-3">
            {selectedMessages.map((message) => {
              const author = appData.users.find(
                (user) => user.id === message.createdBy,
              );
              return (
                <Card key={message.id}>
                  <p className="text-sm leading-7 text-slate-700">{message.body}</p>
                  <p className="mt-3 text-xs font-bold text-slate-500">
                    {author?.name} /{" "}
                    {new Intl.DateTimeFormat("ja-JP", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(message.createdAt))}
                  </p>
                </Card>
              );
            })}
          </div>

          <form
            onSubmit={addMessage}
            className="mt-3 space-y-3 rounded-lg border border-sky-100 bg-white p-4 shadow-sm"
          >
            <label className="block">
              <span className="text-sm font-bold text-slate-700">コメント</span>
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                className="mt-2 min-h-24 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-base outline-none ring-blue-600 focus:ring-2"
                placeholder="回答や対応履歴を残します"
              />
            </label>
            <button
              type="submit"
              disabled={commentState === "saving" || !comment.trim()}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-black text-white disabled:bg-slate-300"
            >
              <MessageSquarePlus size={19} aria-hidden="true" />
              {commentState === "saving" ? "追加中..." : "コメントを追加"}
            </button>
          </form>
        </Section>
      ) : null}
    </div>
  );
}
