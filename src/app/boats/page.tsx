"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  Camera,
  ClipboardCheck,
  Edit3,
  Map,
  MessageSquareWarning,
  PlusCircle,
  Star,
  Save,
  ShieldCheck,
  Ship,
  UploadCloud,
  Wrench,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge, Card, Field, Section } from "@/components/ui";
import { updateClientAppData, useClientAppData } from "@/lib/client-store";
import { getInitialAppData } from "@/lib/data-source";
import {
  boatStatusLabels,
  boatStatusTone,
  handoverCategoryLabels,
  handoverPriorityLabels,
  handoverPriorityTone,
  handoverStatusLabels,
  handoverStatusTone,
  roleLabels,
  targetFishLabels,
} from "@/lib/labels";
import { formatDate, formatTime } from "@/lib/reservations";
import {
  clearQueuedBoatImage,
  getQueuedBoatImage,
  queueBoatImageUpload,
  uploadBoatImage,
  uploadQueuedBoatImage,
} from "@/lib/storage";
import type { Boat, BoatStatus } from "@/types/domain";

export default function BoatsPage() {
  const initialData = getInitialAppData();
  const appData = useClientAppData(initialData);
  const canEdit = appData.currentUser.role === "admin";
  const managedBoats = appData.boats?.length ? appData.boats : [appData.boat];
  const [isEditing, setIsEditing] = useState(false);
  const [isAddingBoat, setIsAddingBoat] = useState(false);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "queued" | "error"
  >("idle");
  const [imageState, setImageState] = useState<
    "idle" | "uploading" | "uploaded" | "queued" | "error"
  >("idle");
  const [imageFile, setImageFile] = useState<File | undefined>();
  const [imageMessage, setImageMessage] = useState("");
  const [hasQueuedImage, setHasQueuedImage] = useState(
    () => Boolean(getQueuedBoatImage()),
  );
  const [form, setForm] = useState({
    name: appData.boat.name,
    status: appData.boat.status,
    mooringLocation: appData.boat.mooringLocation,
    capacity: String(appData.boat.capacity),
    fuelType: appData.boat.fuelType,
    engineInfo: appData.boat.engineInfo,
    notes: appData.boat.notes,
  });
  const [newBoatForm, setNewBoatForm] = useState({
    name: "",
    mooringLocation: "",
    capacity: "6",
    fuelType: "ガソリン",
    engineInfo: "",
    notes: "",
  });
  const unresolvedHandovers = appData.handoverNotes
    .filter((note) => note.status !== "resolved")
    .sort((a, b) => {
      if (a.priority === "high" && b.priority !== "high") return -1;
      if (a.priority !== "high" && b.priority === "high") return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    })
    .slice(0, 5);
  const latestResolvedHandovers = appData.handoverNotes
    .filter((note) => note.status === "resolved")
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, 3);
  const boatReservations = appData.reservations
    .filter((reservation) => reservation.boatId === appData.boat.id)
    .sort(
      (a, b) =>
        new Date(b.startAt).getTime() - new Date(a.startAt).getTime(),
    );
  const latestBoatReservations = boatReservations.slice(0, 6);
  const completedVoyageCount = appData.voyageLogs.filter(
    (voyage) => voyage.boatId === appData.boat.id && voyage.status === "completed",
  ).length;
  const totalDistanceKm = appData.voyageLogs
    .filter((voyage) => voyage.boatId === appData.boat.id)
    .reduce((total, voyage) => total + (voyage.distanceKm ?? 0), 0);
  const boatRatings = appData.memberTripRatings.filter(
    (rating) => rating.boatId === appData.boat.id,
  );
  const averageBoatRating =
    boatRatings.length > 0
      ? boatRatings.reduce((total, rating) => total + rating.overallScore, 0) /
        boatRatings.length
      : undefined;

  function openEditor() {
    setForm({
      name: appData.boat.name,
      status: appData.boat.status,
      mooringLocation: appData.boat.mooringLocation,
      capacity: String(appData.boat.capacity),
      fuelType: appData.boat.fuelType,
      engineInfo: appData.boat.engineInfo,
      notes: appData.boat.notes,
    });
    setSaveState("idle");
    setIsEditing(true);
  }

  function updateForm<T extends keyof typeof form>(
    key: T,
    value: (typeof form)[T],
  ) {
    if (saveState !== "idle") setSaveState("idle");
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateNewBoatForm<T extends keyof typeof newBoatForm>(
    key: T,
    value: (typeof newBoatForm)[T],
  ) {
    setNewBoatForm((current) => ({ ...current, [key]: value }));
  }

  function upsertBoatList(current: typeof appData, boat: Boat) {
    const currentBoats = current.boats?.length ? current.boats : [current.boat];
    const exists = currentBoats.some((item) => item.id === boat.id);
    const boats = exists
      ? currentBoats.map((item) => (item.id === boat.id ? boat : item))
      : [...currentBoats, boat];

    return {
      ...current,
      boat: current.boat.id === boat.id ? boat : current.boat,
      boats,
    };
  }

  async function saveBoat(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveState === "saving") return;
    setSaveState("saving");

    setImageMessage("");
    setImageState("idle");

    try {
      const updatedAt = new Date().toISOString();
      const nextBoat = {
        ...appData.boat,
        name: form.name,
        status: form.status as BoatStatus,
        mooringLocation: form.mooringLocation,
        capacity: Number(form.capacity) || appData.boat.capacity,
        fuelType: form.fuelType,
        engineInfo: form.engineInfo,
        notes: form.notes,
        updatedAt,
      };

      const savePromise = updateClientAppData(
        (current) => upsertBoatList(current, nextBoat),
        appData,
      );
      setSaveState("saved");
      setIsEditing(false);
      await savePromise;

      if (imageFile) {
        await saveBoatImage(imageFile);
      }
    } catch {
      setSaveState("error");
    }
  }

  async function saveBoatImage(file: File) {
    setImageState("uploading");
    setImageMessage("写真を圧縮してアップロードしています。");

    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await queueBoatImageUpload({
          file,
          boatId: appData.boat.id,
          userId: appData.currentUser.id,
        });
        setHasQueuedImage(true);
        setImageState("queued");
        setImageMessage(
          "写真は圧縮してオフライン保留しました。オンラインになったら同期できます。",
        );
        setImageFile(undefined);
        return;
      }

      const imageUrl = await uploadBoatImage({
        file,
        boatId: appData.boat.id,
        userId: appData.currentUser.id,
      });

      await updateClientAppData(
        (current) =>
          upsertBoatList(current, {
            ...current.boat,
            imageUrl,
            updatedAt: new Date().toISOString(),
          }),
        appData,
      );
      setImageFile(undefined);
      setHasQueuedImage(Boolean(getQueuedBoatImage()));
      setImageState("uploaded");
      setImageMessage("船舶写真を更新しました。");
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "写真アップロードに失敗しました。";
      setImageState("error");
      setImageMessage(
        `船舶情報は保存済みです。写真だけ更新できませんでした: ${message}`,
      );
    }
  }

  async function syncQueuedImage() {
    if (saveState === "saving") return;
    setSaveState("saving");

    try {
      const imageUrl = await uploadQueuedBoatImage();
      if (!imageUrl) {
        setHasQueuedImage(false);
        setSaveState("idle");
        return;
      }

      await updateClientAppData(
        (current) =>
          upsertBoatList(current, {
            ...current.boat,
            imageUrl,
            updatedAt: new Date().toISOString(),
          }),
        appData,
      );
      setHasQueuedImage(false);
      setImageState("uploaded");
      setImageMessage("保留写真を同期しました。");
      setSaveState("saved");
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "保留写真の同期に失敗しました。";
      setImageState("error");
      setImageMessage(message);
      setSaveState("error");
    }
  }

  function discardQueuedImage() {
    clearQueuedBoatImage();
    setHasQueuedImage(false);
    setSaveState("idle");
  }

  async function selectBoat(boat: Boat) {
    await updateClientAppData(
      (current) => ({
        ...current,
        boat,
        boats: current.boats?.length ? current.boats : managedBoats,
      }),
      appData,
    );
  }

  async function addBoat(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveState === "saving") return;
    setSaveState("saving");

    const now = new Date().toISOString();
    const boat: Boat = {
      id: `boat-${crypto.randomUUID()}`,
      organizationId: appData.organization.id,
      name: newBoatForm.name,
      status: "available",
      mooringLocation: newBoatForm.mooringLocation,
      capacity: Number(newBoatForm.capacity) || 1,
      fuelType: newBoatForm.fuelType,
      engineInfo: newBoatForm.engineInfo,
      imageUrl: appData.boat.imageUrl,
      notes: newBoatForm.notes,
      updatedAt: now,
    };

    try {
      await updateClientAppData(
        (current) => ({
          ...current,
          boat,
          boats: [...(current.boats?.length ? current.boats : [current.boat]), boat],
        }),
        appData,
      );
      setNewBoatForm({
        name: "",
        mooringLocation: "",
        capacity: "6",
        fuelType: "ガソリン",
        engineInfo: "",
        notes: "",
      });
      setIsAddingBoat(false);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-bold text-blue-700">船舶情報</p>
          <h1 className="text-3xl font-black tracking-normal text-blue-950">
            {appData.boat.name}
          </h1>
          <p className="text-sm leading-6 text-slate-600">
            管理者は編集可能。共同オーナーとメンバーは閲覧専用です。
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border border-sky-100 bg-white shadow-sm">
          <div className="relative aspect-[4/3] w-full sm:aspect-[16/9]">
            <Image
              src={appData.boat.imageUrl}
              alt={`${appData.boat.name}のイメージ`}
              fill
              sizes="(min-width: 768px) 960px, 100vw"
              className="object-cover"
              unoptimized={appData.boat.imageUrl.startsWith("data:")}
              priority
            />
          </div>
          <div className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={boatStatusTone[appData.boat.status]}>
                {boatStatusLabels[appData.boat.status]}
              </Badge>
              <Badge className="bg-slate-100 text-slate-700 ring-slate-200">
                {roleLabels[appData.currentUser.role]}として表示
              </Badge>
              {hasQueuedImage ? (
                <Badge className="bg-amber-100 text-amber-900 ring-amber-200">
                  写真同期待ち
                </Badge>
              ) : null}
            </div>
            {canEdit ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={openEditor}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-black text-white"
                >
                  <Edit3 size={18} aria-hidden="true" />
                  船舶情報を編集
                </button>
                {hasQueuedImage ? (
                  <button
                    type="button"
                    onClick={syncQueuedImage}
                    disabled={saveState === "saving"}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 text-sm font-black text-amber-900 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <UploadCloud size={18} aria-hidden="true" />
                    {saveState === "saving" ? "同期中..." : "保留写真を同期"}
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-lg bg-sky-50 p-3 text-sm font-semibold leading-6 text-blue-900">
                <ShieldCheck className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
                閲覧専用です。変更が必要な場合は管理者へ連絡してください。
              </div>
            )}
          </div>
        </div>

        {saveState === "error" ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800">
            保存に失敗しました。通信状態とFirebase Storageの設定を確認してください。
          </div>
        ) : saveState === "queued" ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
            写真は圧縮してオフライン保留しました。オンラインになったら同期できます。
          </div>
        ) : saveState === "saved" ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
            船舶情報を保存しました。
          </div>
        ) : null}

        {imageMessage ? (
          <div
            className={`rounded-lg border p-3 text-sm font-bold ${
              imageState === "error"
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : imageState === "uploaded"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            {imageMessage}
            {imageState === "error" && imageFile ? (
              <button
                type="button"
                onClick={() => saveBoatImage(imageFile)}
                className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-black text-white"
              >
                <UploadCloud size={18} aria-hidden="true" />
                写真アップロードを再試行
              </button>
            ) : null}
          </div>
        ) : null}

        <Section
          title="管理船舶"
          action={
            canEdit ? (
              <button
                type="button"
                onClick={() => setIsAddingBoat(true)}
                className="inline-flex items-center gap-1 text-sm font-bold text-blue-800"
              >
                <PlusCircle size={16} aria-hidden="true" />
                船を追加
              </button>
            ) : null
          }
        >
          <div className="space-y-3">
            {managedBoats.map((boat) => (
              <Card key={boat.id}>
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-sky-100 text-blue-800">
                    {boat.imageUrl ? (
                      <Image
                        src={boat.imageUrl}
                        alt=""
                        width={44}
                        height={44}
                        className="h-full w-full object-cover"
                        unoptimized={boat.imageUrl.startsWith("data:")}
                      />
                    ) : (
                      <Ship size={22} aria-hidden="true" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-black text-slate-950">
                        {boat.name}
                      </p>
                      {boat.id === appData.boat.id ? (
                        <Badge className="bg-blue-100 text-blue-900 ring-blue-200">
                          表示中
                        </Badge>
                      ) : null}
                      <Badge className={boatStatusTone[boat.status]}>
                        {boatStatusLabels[boat.status]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {boat.mooringLocation} / 定員{boat.capacity}名
                    </p>
                  </div>
                </div>
                {canEdit && boat.id !== appData.boat.id ? (
                  <button
                    type="button"
                    onClick={() => selectBoat(boat)}
                    className="mt-3 flex min-h-11 w-full items-center justify-center rounded-lg border border-sky-200 bg-sky-50 px-4 text-sm font-black text-blue-900"
                  >
                    この船を表示
                  </button>
                ) : null}
              </Card>
            ))}
          </div>
        </Section>

        <Section title="利用履歴">
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-sky-50 p-3">
                <p className="text-xs font-bold text-blue-800">予約</p>
                <p className="mt-1 text-xl font-black text-blue-950">
                  {boatReservations.length}
                </p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3">
                <p className="text-xs font-bold text-emerald-800">航行完了</p>
                <p className="mt-1 text-xl font-black text-emerald-900">
                  {completedVoyageCount}
                </p>
              </div>
              <div className="rounded-lg bg-amber-50 p-3">
                <p className="text-xs font-bold text-amber-800">平均評価</p>
                <p className="mt-1 text-xl font-black text-amber-900">
                  {averageBoatRating ? averageBoatRating.toFixed(1) : "-"}
                </p>
              </div>
            </div>
            <div className="rounded-lg bg-white p-3 text-sm font-bold text-slate-600">
              累計航行距離: {totalDistanceKm.toFixed(1)}km
            </div>

            {latestBoatReservations.map((reservation) => {
              const user = appData.users.find(
                (item) => item.id === reservation.userId,
              );
              const voyage = appData.voyageLogs.find(
                (item) => item.reservationId === reservation.id,
              );
              const ratings = appData.memberTripRatings.filter(
                (item) => item.reservationId === reservation.id,
              );
              const handovers = appData.handoverNotes.filter(
                (item) => item.reservationId === reservation.id,
              );

              return (
                <Card key={reservation.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-black text-slate-950">
                        {formatDate(reservation.startAt)}
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-600">
                        {formatTime(reservation.startAt)} -{" "}
                        {formatTime(reservation.endAt)} / {user?.name ?? "不明"}
                      </p>
                    </div>
                    <Badge className="bg-sky-100 text-blue-800 ring-sky-200">
                      {targetFishLabels[reservation.targetFish]}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge
                      className={
                        voyage
                          ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
                          : "bg-slate-100 text-slate-700 ring-slate-200"
                      }
                    >
                      航行ログ{voyage ? "あり" : "なし"}
                    </Badge>
                    <Badge className="bg-amber-100 text-amber-900 ring-amber-200">
                      評価{ratings.length}件
                    </Badge>
                    <Badge className="bg-white text-slate-700 ring-slate-200">
                      申し送り{handovers.length}件
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {reservation.destinationArea} / 同乗予定{" "}
                    {reservation.passengerCount}名
                    {voyage?.distanceKm
                      ? ` / 航行距離 ${voyage.distanceKm.toFixed(1)}km`
                      : ""}
                  </p>
                  {canEdit ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <Link
                        href={`/voyages?reservationId=${reservation.id}`}
                        className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-black text-white"
                      >
                        <Map size={16} aria-hidden="true" />
                        航路を見る
                      </Link>
                      <Link
                        href={`/members#trip-rating`}
                        className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 text-sm font-black text-amber-900"
                      >
                        <Star size={16} aria-hidden="true" />
                        評価へ
                      </Link>
                      <Link
                        href={`/reservations#reservation-${reservation.id}`}
                        className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 text-sm font-black text-blue-900"
                      >
                        <ClipboardCheck size={16} aria-hidden="true" />
                        予約詳細
                      </Link>
                    </div>
                  ) : null}
                </Card>
              );
            })}
            {latestBoatReservations.length === 0 ? (
              <Card>
                <p className="text-sm font-semibold text-slate-600">
                  この船の利用履歴はまだありません。
                </p>
              </Card>
            ) : null}
          </div>
        </Section>

        <Section
          title="申し送り"
          action={
            <Link href="/handovers" className="text-sm font-bold text-blue-800">
              作成・一覧
            </Link>
          }
        >
          <div className="space-y-3">
            {unresolvedHandovers.map((note) => {
              const author = appData.users.find((user) => user.id === note.createdBy);

              return (
                <Card key={note.id}>
                  <div className="flex items-start gap-3">
                    <span
                      className={`grid size-10 shrink-0 place-items-center rounded-lg ${
                        note.priority === "high"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      <MessageSquareWarning size={20} aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-base font-black text-slate-950">
                        {note.title}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {note.body}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge className={handoverPriorityTone[note.priority]}>
                      重要度{handoverPriorityLabels[note.priority]}
                    </Badge>
                    <Badge className={handoverStatusTone[note.status]}>
                      {handoverStatusLabels[note.status]}
                    </Badge>
                    <Badge className="bg-sky-100 text-blue-800 ring-sky-200">
                      {handoverCategoryLabels[note.category]}
                    </Badge>
                  </div>
                  <p className="mt-3 text-xs font-bold text-slate-500">
                    {author?.name ?? "作成者不明"} /{" "}
                    {new Intl.DateTimeFormat("ja-JP", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(note.updatedAt))}
                  </p>
                </Card>
              );
            })}
            {unresolvedHandovers.length === 0 ? (
              <Card>
                <p className="text-sm font-semibold text-slate-600">
                  未解決の申し送りはありません。
                </p>
              </Card>
            ) : null}
            {latestResolvedHandovers.length > 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs font-black text-slate-500">最近解決した申し送り</p>
                <div className="mt-2 space-y-2">
                  {latestResolvedHandovers.map((note) => (
                    <div
                      key={note.id}
                      className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"
                    >
                      <span className="truncate text-sm font-bold text-slate-800">
                        {note.title}
                      </span>
                      <Badge className={handoverStatusTone[note.status]}>
                        {handoverStatusLabels[note.status]}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </Section>

        <Section title="メンテナンス台帳">
          <div className="space-y-3">
            {[...appData.maintenanceLogs]
              .sort(
                (a, b) =>
                  new Date(b.performedAt).getTime() -
                  new Date(a.performedAt).getTime(),
              )
              .slice(0, 5)
              .map((log) => {
                const author = appData.users.find(
                  (user) => user.id === log.createdBy,
                );
                const handover = appData.handoverNotes.find(
                  (note) => note.id === log.handoverNoteId,
                );

                return (
                  <Card key={log.id}>
                    <div className="flex items-start gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-sky-100 text-blue-800">
                        <Wrench size={20} aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-base font-black text-slate-950">
                          {log.title}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {log.body}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge className="bg-sky-100 text-blue-800 ring-sky-200">
                        {log.category}
                      </Badge>
                      {handover ? (
                        <Badge className="bg-amber-100 text-amber-900 ring-amber-200">
                          申し送り連携
                        </Badge>
                      ) : null}
                      <Badge className="bg-slate-100 text-slate-700 ring-slate-200">
                        {new Intl.DateTimeFormat("ja-JP", {
                          dateStyle: "medium",
                        }).format(new Date(log.performedAt))}
                      </Badge>
                    </div>
                    <p className="mt-3 text-xs font-bold text-slate-500">
                      記録者: {author?.name ?? "不明"} / 費用:{" "}
                      {new Intl.NumberFormat("ja-JP", {
                        style: "currency",
                        currency: "JPY",
                        maximumFractionDigits: 0,
                      }).format(log.cost)}
                    </p>
                  </Card>
                );
              })}
            {appData.maintenanceLogs.length === 0 ? (
              <Card>
                <p className="text-sm font-semibold text-slate-600">
                  メンテナンス台帳はまだありません。申し送り詳細から整備記録へ昇格できます。
                </p>
              </Card>
            ) : null}
          </div>
        </Section>

        <Section title="基本情報">
          <Card>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Field label="船名" value={appData.boat.name} />
              <Field label="係留場所" value={appData.boat.mooringLocation} />
              <Field label="定員" value={`${appData.boat.capacity}名`} />
              <Field label="燃料種別" value={appData.boat.fuelType} />
              <Field label="エンジン情報" value={appData.boat.engineInfo} />
              <Field
                label="最終更新日"
                value={new Intl.DateTimeFormat("ja-JP", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(appData.boat.updatedAt))}
              />
            </dl>
          </Card>
        </Section>

        <Section title="備考">
          <Card>
            <p className="text-sm leading-7 text-slate-700">{appData.boat.notes}</p>
          </Card>
        </Section>

        {isAddingBoat ? (
          <div className="fixed inset-0 z-40 flex items-end bg-slate-950/45 p-0 sm:items-center sm:p-4">
            <form
              onSubmit={addBoat}
              className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:mx-auto sm:max-w-2xl sm:rounded-lg sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black text-blue-700">管理者編集</p>
                  <h2 className="mt-1 text-xl font-black text-blue-950">
                    船を追加
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddingBoat(false)}
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-700"
                  aria-label="追加を閉じる"
                >
                  <X size={21} aria-hidden="true" />
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">船名</span>
                  <input
                    value={newBoatForm.name}
                    onChange={(event) =>
                      updateNewBoatForm("name", event.target.value)
                    }
                    className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">係留場所</span>
                  <input
                    value={newBoatForm.mooringLocation}
                    onChange={(event) =>
                      updateNewBoatForm("mooringLocation", event.target.value)
                    }
                    className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">定員</span>
                  <input
                    value={newBoatForm.capacity}
                    type="number"
                    min="1"
                    onChange={(event) =>
                      updateNewBoatForm("capacity", event.target.value)
                    }
                    className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">燃料種別</span>
                  <input
                    value={newBoatForm.fuelType}
                    onChange={(event) =>
                      updateNewBoatForm("fuelType", event.target.value)
                    }
                    className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                  />
                </label>
              </div>

              <label className="mt-3 block">
                <span className="text-sm font-bold text-slate-700">エンジン情報</span>
                <input
                  value={newBoatForm.engineInfo}
                  onChange={(event) =>
                    updateNewBoatForm("engineInfo", event.target.value)
                  }
                  className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                />
              </label>

              <label className="mt-3 block">
                <span className="text-sm font-bold text-slate-700">備考</span>
                <textarea
                  value={newBoatForm.notes}
                  onChange={(event) =>
                    updateNewBoatForm("notes", event.target.value)
                  }
                  className="mt-2 min-h-28 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-base outline-none ring-blue-600 focus:ring-2"
                />
              </label>

              <button
                type="submit"
                disabled={saveState === "saving"}
                className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-5 text-base font-black text-white disabled:bg-slate-300"
              >
                <PlusCircle size={21} aria-hidden="true" />
                {saveState === "saving" ? "追加中..." : "船を追加する"}
              </button>
            </form>
          </div>
        ) : null}

        {isEditing ? (
          <div className="fixed inset-0 z-40 flex items-end bg-slate-950/45 p-0 sm:items-center sm:p-4">
            <form
              onSubmit={saveBoat}
              className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:mx-auto sm:max-w-2xl sm:rounded-lg sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black text-blue-700">管理者編集</p>
                  <h2 className="mt-1 text-xl font-black text-blue-950">
                    船舶情報を編集
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-700"
                  aria-label="編集を閉じる"
                >
                  <X size={21} aria-hidden="true" />
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">船名</span>
                  <input
                    value={form.name}
                    onChange={(event) => updateForm("name", event.target.value)}
                    className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">状態</span>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      updateForm("status", event.target.value as BoatStatus)
                    }
                    className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                  >
                    {Object.entries(boatStatusLabels).map(([status, label]) => (
                      <option key={status} value={status}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">係留場所</span>
                  <input
                    value={form.mooringLocation}
                    onChange={(event) =>
                      updateForm("mooringLocation", event.target.value)
                    }
                    className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">定員</span>
                  <input
                    value={form.capacity}
                    type="number"
                    min="1"
                    onChange={(event) => updateForm("capacity", event.target.value)}
                    className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">燃料種別</span>
                  <input
                    value={form.fuelType}
                    onChange={(event) => updateForm("fuelType", event.target.value)}
                    className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">エンジン情報</span>
                  <input
                    value={form.engineInfo}
                    onChange={(event) => updateForm("engineInfo", event.target.value)}
                    className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                  />
                </label>
              </div>

              <label className="mt-3 block">
                <span className="text-sm font-bold text-slate-700">備考</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => updateForm("notes", event.target.value)}
                  className="mt-2 min-h-28 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-base outline-none ring-blue-600 focus:ring-2"
                />
              </label>

              <label className="mt-3 block rounded-lg border border-dashed border-sky-200 bg-sky-50 p-4">
                <div className="flex items-center gap-2 text-sm font-black text-blue-900">
                  <Camera size={20} aria-hidden="true" />
                  船舶写真
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) =>
                    setImageFile(event.target.files?.[0] ?? undefined)
                  }
                  className="mt-3 w-full text-sm font-semibold text-blue-900 file:mr-3 file:h-10 file:rounded-lg file:border-0 file:bg-blue-800 file:px-4 file:text-sm file:font-black file:text-white"
                />
                <p className="mt-2 text-sm leading-6 text-blue-800">
                  JPEG/PNG/WebPに対応しています。選択した写真は最大幅1280px程度へ圧縮して保存します。圏外時は圧縮済み写真を端末内に保留できます。
                </p>
                {imageFile ? (
                  <p className="mt-2 text-sm font-black text-blue-900">
                    選択中: {imageFile.name}
                  </p>
                ) : null}
                {hasQueuedImage ? (
                  <button
                    type="button"
                    onClick={discardQueuedImage}
                    className="mt-3 h-10 rounded-lg border border-amber-200 bg-white px-3 text-sm font-black text-amber-900"
                  >
                    保留写真を破棄
                  </button>
                ) : null}
                {imageMessage ? (
                  <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm font-bold leading-6 text-amber-900">
                    {imageMessage}
                  </p>
                ) : null}
              </label>

              <button
                type="submit"
                disabled={saveState === "saving"}
                className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-5 text-base font-black text-white disabled:bg-slate-300"
              >
                <Save size={21} aria-hidden="true" />
                {saveState === "saving" ? "保存中..." : "保存する"}
              </button>
              {imageFile ? (
                <p className="mt-3 text-center text-xs font-bold leading-5 text-slate-500">
                  基本情報を先に保存し、その後に写真をアップロードします。
                </p>
              ) : null}
            </form>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
