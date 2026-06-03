"use client";

import Image from "next/image";
import { useState } from "react";
import {
  Camera,
  Edit3,
  Save,
  ShieldCheck,
  UploadCloud,
  Wrench,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge, Card, Field, Section } from "@/components/ui";
import { updateClientAppData, useClientAppData } from "@/lib/client-store";
import { getInitialAppData } from "@/lib/data-source";
import { boatStatusLabels, boatStatusTone, roleLabels } from "@/lib/labels";
import {
  clearQueuedBoatImage,
  getQueuedBoatImage,
  queueBoatImageUpload,
  uploadBoatImage,
  uploadQueuedBoatImage,
} from "@/lib/storage";
import type { BoatStatus } from "@/types/domain";

export default function BoatsPage() {
  const initialData = getInitialAppData();
  const appData = useClientAppData(initialData);
  const canEdit = appData.currentUser.role === "admin";
  const [isEditing, setIsEditing] = useState(false);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "queued" | "error"
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

  async function saveBoat(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveState === "saving") return;
    setSaveState("saving");

    let imageUrl = appData.boat.imageUrl;
    let queuedImage = false;
    setImageMessage("");

    try {
      if (imageFile) {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          await queueBoatImageUpload({
            file: imageFile,
            boatId: appData.boat.id,
            userId: appData.currentUser.id,
          });
          setHasQueuedImage(true);
          queuedImage = true;
          setSaveState("queued");
        } else {
          try {
            imageUrl = await uploadBoatImage({
              file: imageFile,
              boatId: appData.boat.id,
              userId: appData.currentUser.id,
            });
            setHasQueuedImage(Boolean(getQueuedBoatImage()));
          } catch {
            setImageMessage(
              "写真アップロードに失敗したため、写真は変更せず船舶情報のみ保存します。",
            );
          }
        }
      }

      const updatedAt = new Date().toISOString();
      const nextBoat = {
        ...appData.boat,
        name: form.name,
        status: form.status as BoatStatus,
        mooringLocation: form.mooringLocation,
        capacity: Number(form.capacity) || appData.boat.capacity,
        fuelType: form.fuelType,
        engineInfo: form.engineInfo,
        imageUrl,
        notes: form.notes,
        updatedAt,
      };

      await updateClientAppData(
        (current) => ({ ...current, boat: nextBoat }),
        appData,
      );
      setImageFile(undefined);
      setSaveState(queuedImage ? "queued" : "saved");
      if (!queuedImage) setIsEditing(false);
    } catch {
      setSaveState("error");
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
        (current) => ({
          ...current,
          boat: {
            ...current.boat,
            imageUrl,
            updatedAt: new Date().toISOString(),
          },
        }),
        appData,
      );
      setHasQueuedImage(false);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  function discardQueuedImage() {
    clearQueuedBoatImage();
    setHasQueuedImage(false);
    setSaveState("idle");
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
            {imageMessage ? (
              <span className="mt-2 block text-amber-900">{imageMessage}</span>
            ) : null}
          </div>
        ) : null}

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
                  accept="image/*"
                  onChange={(event) =>
                    setImageFile(event.target.files?.[0] ?? undefined)
                  }
                  className="mt-3 w-full text-sm font-semibold text-blue-900 file:mr-3 file:h-10 file:rounded-lg file:border-0 file:bg-blue-800 file:px-4 file:text-sm file:font-black file:text-white"
                />
                <p className="mt-2 text-sm leading-6 text-blue-800">
                  選択した写真は最大幅1600px程度へ圧縮して保存します。圏外時は圧縮済み写真を端末内に保留できます。
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
            </form>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
