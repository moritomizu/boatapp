"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Navigation,
  RotateCcw,
  Save,
} from "lucide-react";
import { Badge, Card, Section } from "@/components/ui";
import { findBoat } from "@/lib/boat-utils";
import { updateClientAppData, useClientAppData } from "@/lib/client-store";
import { targetFishLabels } from "@/lib/labels";
import {
  createPostReturnCheck,
  createPreDepartureCheck,
} from "@/lib/mock-data";
import {
  formatDate,
  formatTime,
  withReservationSessionStatus,
} from "@/lib/reservations";
import { uploadCheckImage } from "@/lib/storage";
import type {
  AppData,
  PostReturnCheck,
  PreDepartureCheck,
} from "@/types/domain";

type CheckRecord = PreDepartureCheck | PostReturnCheck;

type CheckItem<Key extends string> = {
  key: Key;
  label: string;
};

type CheckWorkflowProps<Key extends string, RecordType extends CheckRecord> = {
  title: string;
  description: string;
  mode: "pre-departure" | "post-return";
  data: AppData;
  initialReservationId?: string;
  items: CheckItem<Key>[];
  initialHistory: RecordType[];
};

const nowForInput = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

export function CheckWorkflow<Key extends string, RecordType extends CheckRecord>({
  title,
  description,
  mode,
  data,
  initialReservationId,
  items,
}: CheckWorkflowProps<Key, RecordType>) {
  const router = useRouter();
  const appData = useClientAppData(data);
  const history = (
    mode === "pre-departure"
      ? appData.preDepartureChecks
      : appData.postReturnChecks
  ) as RecordType[];
  const [reservationId, setReservationId] = useState(
    initialReservationId ?? data.reservations[0]?.id ?? "",
  );
  const [userId, setUserId] = useState(data.currentUser.id);
  const [checkedAt, setCheckedAt] = useState(nowForInput());
  const [checks, setChecks] = useState<Record<Key, boolean>>(
    Object.fromEntries(items.map((item) => [item.key, false])) as Record<
      Key,
      boolean
    >,
  );
  const [hasIssue, setHasIssue] = useState(false);
  const [comment, setComment] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imageMessage, setImageMessage] = useState("");
  const [savedRecord, setSavedRecord] = useState<RecordType | null>(null);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  const checkedCount = items.filter((item) => checks[item.key]).length;
  const uncheckedCount = items.length - checkedCount;
  const selectedReservation = appData.reservations.find(
    (reservation) => reservation.id === reservationId,
  );
  const selectedBoat = findBoat(appData, selectedReservation?.boatId ?? appData.boat.id);
  const canOperateSelectedReservation = selectedReservation
    ? selectedReservation.userId === appData.currentUser.id ||
      appData.currentUser.role === "admin"
    : false;
  const existingRecord = useMemo(
    () =>
      history
        .filter((record) => record.reservationId === reservationId)
        .sort(
          (a, b) =>
            new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime(),
        )[0],
    [history, reservationId],
  );
  const selectedHistory = existingRecord ? [existingRecord] : [];

  const issueLink = useMemo(() => {
    const params = new URLSearchParams({
      reservationId,
      source: mode,
      title:
        mode === "pre-departure"
          ? "出船前チェックで問題あり"
          : "帰港後チェックで問題あり",
      body: comment || "チェック結果から作成された申し送りです。",
    });

    return `/handovers?${params.toString()}#new`;
  }, [comment, mode, reservationId]);

  function toggle(key: Key) {
    if (saveState === "saved" || saveState === "error") setSaveState("idle");
    setChecks((current) => ({ ...current, [key]: !current[key] }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canOperateSelectedReservation || saveState === "saving") return;
    setSaveState("saving");

    const baseInput = {
      organizationId: data.organization.id,
      boatId: selectedReservation?.boatId ?? appData.boat.id,
      reservationId,
      userId,
      checkedAt: new Date(checkedAt).toISOString(),
      hasIssue,
      comment,
    };
    const draftRecord =
      mode === "pre-departure"
        ? createPreDepartureCheck({
            ...baseInput,
            items: checks as PreDepartureCheck["items"],
          })
        : createPostReturnCheck({
            ...baseInput,
            items: checks as PostReturnCheck["items"],
          });
    let imageUrls: string[] = [];

    if (selectedFiles.length > 0) {
      setImageMessage("写真を圧縮してアップロードしています。");
      const uploadResults = await Promise.allSettled(
        selectedFiles.map((file) =>
          uploadCheckImage({
            file,
            mode,
            checkId: draftRecord.id,
            userId,
          }),
        ),
      );
      imageUrls = uploadResults
        .filter(
          (result): result is PromiseFulfilledResult<string> =>
            result.status === "fulfilled",
        )
        .map((result) => result.value);
      const failedCount = uploadResults.filter(
        (result) => result.status === "rejected",
      ).length;
      setImageMessage(
        failedCount > 0
          ? `写真${failedCount}枚の添付に失敗しましたが、チェック結果は保存します。`
          : "写真を添付しました。",
      );
    }

    const record = {
      ...draftRecord,
      imageUrls,
    };

    const nextHistory = [
      record as RecordType,
      ...history.filter((item) => item.reservationId !== reservationId),
    ];

    setSavedRecord(record as RecordType);
    const nextReservations = appData.reservations.map((reservation) =>
      reservation.id === reservationId
        ? withReservationSessionStatus(
            reservation,
            mode === "pre-departure" ? "pre_checked" : "returned",
          )
        : reservation,
    );
    const nextData =
      mode === "pre-departure"
        ? {
            ...appData,
            reservations: nextReservations,
            preDepartureChecks: nextHistory as PreDepartureCheck[],
          }
        : {
            ...appData,
            reservations: nextReservations,
            postReturnChecks: nextHistory as PostReturnCheck[],
          };
    try {
      await updateClientAppData(() => nextData, appData);
      setSaveState("saved");
      setSelectedFiles([]);
      if (mode === "pre-departure" && !hasIssue) {
        router.push(`/voyages?reservationId=${reservationId}`);
      }
    } catch {
      setSaveState("error");
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-bold text-blue-700">運用チェック</p>
        <h1 className="text-3xl font-black tracking-normal text-blue-950">
          {title}
        </h1>
        <p className="text-sm leading-6 text-slate-600">{description}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block sm:col-span-3">
              <span className="text-sm font-bold text-slate-700">
                利用予約との紐付け
              </span>
              <select
                value={reservationId}
                onChange={(event) => setReservationId(event.target.value)}
                className="mt-2 h-13 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
              >
                {appData.reservations.map((reservation) => {
                  const user = appData.users.find(
                    (item) => item.id === reservation.userId,
                  );

                  return (
                    <option key={reservation.id} value={reservation.id}>
                      {formatDate(reservation.startAt)}{" "}
                      {formatTime(reservation.startAt)} - {user?.name} /{" "}
                      {targetFishLabels[reservation.targetFish]}
                    </option>
                  );
                })}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">
                チェック実施者
              </span>
              <select
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                disabled={appData.currentUser.role !== "admin"}
                className="mt-2 h-13 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
              >
                {(appData.currentUser.role === "admin"
                  ? appData.users
                  : [appData.currentUser]
                ).map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block sm:col-span-2">
              <span className="text-sm font-bold text-slate-700">実施日時</span>
              <input
                type="datetime-local"
                value={checkedAt}
                onChange={(event) => setCheckedAt(event.target.value)}
                className="mt-2 h-13 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
              />
            </label>
          </div>

          {selectedReservation ? (
            <div className="mt-4 rounded-lg bg-sky-50 p-3 text-sm font-semibold leading-6 text-blue-900">
              対象船舶: {selectedBoat.name} / 予約:{" "}
              {formatDate(selectedReservation.startAt)}{" "}
              {formatTime(selectedReservation.startAt)} -{" "}
              {formatTime(selectedReservation.endAt)} /{" "}
              {selectedReservation.destinationArea} /{" "}
              {targetFishLabels[selectedReservation.targetFish]} /{" "}
            </div>
          ) : null}

          {selectedReservation && !canOperateSelectedReservation ? (
            <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm font-bold leading-6 text-amber-900">
              この予約は他メンバーの利用です。チェック記録の保存は予約者本人または管理者のみ行えます。
            </div>
          ) : null}
        </Card>

        {existingRecord ? (
          <Card>
            <div className="flex items-start gap-3">
              <span
                className={`grid size-11 shrink-0 place-items-center rounded-lg ${
                  existingRecord.hasIssue
                    ? "bg-rose-100 text-rose-800"
                    : "bg-emerald-100 text-emerald-800"
                }`}
              >
                <ClipboardCheck size={22} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-black text-slate-950">
                    この予約はチェック実施済みです
                  </p>
                  <Badge
                    className={
                      existingRecord.hasIssue
                        ? "bg-rose-100 text-rose-800 ring-rose-200"
                        : "bg-emerald-100 text-emerald-800 ring-emerald-200"
                    }
                  >
                    {existingRecord.hasIssue ? "問題あり" : "問題なし"}
                  </Badge>
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {new Intl.DateTimeFormat("ja-JP", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(existingRecord.checkedAt))}
                  に保存されています。再保存するとこの記録を置き換えます。
                </p>
                {mode === "pre-departure" && !existingRecord.hasIssue ? (
                  <Link
                    href={`/voyages?reservationId=${reservationId}`}
                    className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-black text-white"
                  >
                    <Navigation size={18} aria-hidden="true" />
                    出船へ進む
                  </Link>
                ) : null}
              </div>
            </div>
          </Card>
        ) : null}

        <Section
          title="チェック項目"
          action={
            <Badge
              className={
                uncheckedCount === 0
                  ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
                  : "bg-amber-100 text-amber-900 ring-amber-200"
              }
            >
              {checkedCount}/{items.length}
            </Badge>
          }
        >
          <div className="space-y-3">
            {items.map((item) => (
              <button
                type="button"
                key={item.key}
                onClick={() => toggle(item.key)}
                className={`flex min-h-16 w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-base font-black shadow-sm ${
                  checks[item.key]
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-slate-200 bg-white text-slate-800"
                }`}
              >
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-full border-2 ${
                    checks[item.key]
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-slate-300 bg-white text-transparent"
                  }`}
                >
                  <CheckCircle2 size={22} aria-hidden="true" />
                </span>
                {item.label}
              </button>
            ))}
          </div>
        </Section>

        {uncheckedCount > 0 ? (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm font-bold leading-6 text-amber-900">
            <AlertTriangle className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
            未チェック項目が{uncheckedCount}件あります。保存はできますが、出航・離船前に再確認してください。
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm font-bold leading-6 text-emerald-900">
            <CheckCircle2 className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
            全項目チェック済みです。
          </div>
        )}

        <Card>
          <div className="space-y-4">
            <label className="flex min-h-14 items-center gap-3 rounded-lg bg-slate-50 px-3 text-base font-black text-slate-900">
              <input
                type="checkbox"
                checked={hasIssue}
                onChange={(event) => setHasIssue(event.target.checked)}
                className="size-6 accent-rose-700"
              />
              問題あり
            </label>

            {hasIssue ? (
              <div className="rounded-lg bg-rose-50 p-3 text-sm font-bold leading-6 text-rose-800">
                問題ありで保存すると、申し送り作成へ進めます。
              </div>
            ) : (
              <div className="rounded-lg bg-emerald-50 p-3 text-sm font-bold leading-6 text-emerald-900">
                問題なしとして保存します。
              </div>
            )}

            <label className="block">
              <span className="text-sm font-bold text-slate-700">コメント</span>
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                className="mt-2 min-h-28 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-base outline-none ring-blue-600 focus:ring-2"
                placeholder="気になったこと、次回確認してほしいことなど"
              />
            </label>

            <div className="rounded-lg border border-dashed border-sky-200 bg-sky-50 p-4">
              <div className="flex items-center gap-2 text-sm font-black text-blue-900">
                <Camera size={20} aria-hidden="true" />
                写真添付
              </div>
              <p className="mt-2 text-sm leading-6 text-blue-800">
                チェック時の船体・備品・気になる箇所を複数枚添付できます。
              </p>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) =>
                  setSelectedFiles(Array.from(event.target.files ?? []))
                }
                className="mt-3 block w-full text-sm font-bold text-blue-900 file:mr-3 file:min-h-10 file:rounded-lg file:border-0 file:bg-blue-800 file:px-4 file:text-sm file:font-black file:text-white"
              />
              {selectedFiles.length > 0 ? (
                <p className="mt-2 text-sm font-bold text-blue-900">
                  {selectedFiles.length}枚を添付予定
                </p>
              ) : null}
              {imageMessage ? (
                <p className="mt-2 rounded-lg bg-white p-3 text-sm font-bold leading-6 text-blue-900">
                  {imageMessage}
                </p>
              ) : null}
            </div>
          </div>
        </Card>

        <div className="sticky bottom-20 z-10 rounded-lg border border-sky-100 bg-white/95 p-3 shadow-xl shadow-slate-950/10 backdrop-blur md:bottom-4">
          <button
            type="submit"
            disabled={!canOperateSelectedReservation || saveState === "saving"}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-5 text-base font-black text-white disabled:bg-slate-300"
          >
            {existingRecord ? (
              <RotateCcw size={22} aria-hidden="true" />
            ) : mode === "pre-departure" && !hasIssue ? (
              <Navigation size={22} aria-hidden="true" />
            ) : (
              <Save size={22} aria-hidden="true" />
            )}
            {saveState === "saving"
              ? "保存中..."
              : saveState === "saved"
                ? "保存しました"
                : saveState === "error"
                  ? "保存に失敗しました"
                  : existingRecord
                    ? "チェック結果を更新"
                    : mode === "pre-departure" && !hasIssue
                      ? "保存して出船へ進む"
                      : "チェック結果を保存"}
          </button>
        </div>
      </form>

      {savedRecord ? (
        <Card>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ClipboardCheck size={22} className="text-blue-800" aria-hidden="true" />
              <p className="text-lg font-black text-blue-950">
                チェックを保存しました
              </p>
            </div>
            {savedRecord.hasIssue ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Link
                  href={issueLink}
                  className="flex min-h-12 items-center justify-center rounded-lg bg-rose-700 px-4 text-sm font-black text-white"
                >
                  申し送りを作成する
                </Link>
                <button
                  type="button"
                  onClick={() => setSavedRecord(null)}
                  className="min-h-12 rounded-lg border border-slate-200 px-4 text-sm font-black text-slate-700"
                >
                  後で作成する
                </button>
              </div>
            ) : mode === "pre-departure" ? (
              <p className="text-sm font-semibold leading-6 text-emerald-800">
                問題なしとして保存しました。出船画面へ進みます。
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-semibold leading-6 text-emerald-800">
                  帰港後チェックを保存しました。最後に予約をクローズすると、この出船の記録が完了します。
                </p>
                <Link
                  href={`/reservations#reservation-${reservationId}`}
                  className="flex min-h-12 items-center justify-center rounded-lg bg-slate-800 px-4 text-sm font-black text-white"
                >
                  予約をクローズへ進む
                </Link>
              </div>
            )}
          </div>
        </Card>
      ) : null}

      <Section title="この予約のチェック記録">
        <div className="space-y-3">
          {selectedHistory.map((record) => {
            const reservation = appData.reservations.find(
              (item) => item.id === record.reservationId,
            );
            const user = appData.users.find((item) => item.id === record.userId);

            return (
              <Card key={record.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">
                      {new Intl.DateTimeFormat("ja-JP", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(record.checkedAt))}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {user?.name} / {reservation?.destinationArea ?? "予約未選択"}
                    </p>
                  </div>
                  <Badge
                    className={
                      record.hasIssue
                        ? "bg-rose-100 text-rose-800 ring-rose-200"
                        : "bg-emerald-100 text-emerald-800 ring-emerald-200"
                    }
                  >
                    {record.hasIssue ? "問題あり" : "問題なし"}
                  </Badge>
                </div>
                {record.comment ? (
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {record.comment}
                  </p>
                ) : null}
                {record.imageUrls?.length ? (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {record.imageUrls.map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="relative aspect-square overflow-hidden rounded-lg bg-slate-100"
                      >
                        <Image
                          src={url}
                          alt="チェック添付写真"
                          fill
                          sizes="33vw"
                          unoptimized={url.startsWith("data:")}
                          className="object-cover"
                        />
                      </a>
                    ))}
                  </div>
                ) : null}
              </Card>
            );
          })}
          {selectedHistory.length === 0 ? (
            <Card>
              <p className="text-sm font-semibold leading-6 text-slate-600">
                この予約のチェック記録はまだありません。
              </p>
            </Card>
          ) : null}
        </div>
      </Section>
    </div>
  );
}
