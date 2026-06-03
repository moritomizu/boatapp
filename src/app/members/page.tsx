"use client";

import { useState } from "react";
import {
  ClipboardCheck,
  Edit3,
  Plus,
  Save,
  ShieldCheck,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge, Card, Section } from "@/components/ui";
import { getBoats } from "@/lib/boat-utils";
import { updateClientAppData, useClientAppData } from "@/lib/client-store";
import { getInitialAppData } from "@/lib/data-source";
import { deleteFirestoreDocument } from "@/lib/firebase-repository";
import { roleLabels, targetFishLabels } from "@/lib/labels";
import {
  createMemberTripRating,
  createSkillAssessment,
} from "@/lib/mock-data";
import type {
  AppUser,
  BoatSkillLevel,
  MemberBoatPermission,
  SkillAssessmentStatus,
  UserRole,
} from "@/types/domain";

const roleTone = {
  admin: "bg-blue-100 text-blue-900 ring-blue-200",
  owner: "bg-cyan-100 text-cyan-900 ring-cyan-200",
  member: "bg-slate-100 text-slate-700 ring-slate-200",
};

const blankMember = (organizationId: string): AppUser => ({
  id: `user-${crypto.randomUUID()}`,
  organizationId,
  name: "",
  email: "",
  role: "member",
  canSolo: false,
  canNightUse: false,
  notes: "",
  createdAt: new Date().toISOString(),
});

const skillStatusLabels: Record<SkillAssessmentStatus, string> = {
  training: "練習中",
  solo_ready: "単独出船可",
  needs_practice: "追加練習",
};

const scoreOptions = [1, 2, 3, 4, 5];
const skillLevelLabels: Record<BoatSkillLevel, string> = {
  trainee: "研修中",
  beginner: "初心者",
  normal: "通常",
  advanced: "上級",
  owner: "オーナー",
};
const skillLevels = Object.keys(skillLevelLabels) as BoatSkillLevel[];

function ScoreSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
      >
        {scoreOptions.map((score) => (
          <option key={score} value={score}>
            {score}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function MembersPage() {
  const initialData = getInitialAppData();
  const data = useClientAppData(initialData);
  const canEdit = data.currentUser.role === "admin";
  const canManagePermissions =
    data.currentUser.role === "admin" || data.currentUser.role === "owner";
  const boats = getBoats(data);
  const [editingMember, setEditingMember] = useState<AppUser | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">(
    "idle",
  );
  const [deleteTargetId, setDeleteTargetId] = useState("");
  const [ratingState, setRatingState] = useState<"idle" | "saving" | "error">(
    "idle",
  );
  const [skillState, setSkillState] = useState<"idle" | "saving" | "error">(
    "idle",
  );
  const [ratingForm, setRatingForm] = useState({
    reservationId: data.reservations[0]?.id ?? "",
    userId: data.users.find((user) => user.role === "member")?.id ?? data.users[0]?.id ?? "",
    evaluatorId: data.currentUser.id,
    safetyScore: 4,
    preparationScore: 4,
    communicationScore: 4,
    boatCareScore: 4,
    comment: "",
  });
  const [skillForm, setSkillForm] = useState({
    userId: data.users.find((user) => !user.canSolo)?.id ?? data.users[0]?.id ?? "",
    assessorId: data.currentUser.id,
    dockingScore: 3,
    departureScore: 3,
    navigationRulesScore: 3,
    weatherJudgmentScore: 3,
    emergencyScore: 3,
    equipmentScore: 3,
    status: "training" as SkillAssessmentStatus,
    recommendation: "",
  });

  function averageRating(userId: string) {
    const ratings = data.memberTripRatings.filter(
      (rating) => rating.userId === userId,
    );
    if (ratings.length === 0) return undefined;

    return (
      ratings.reduce((total, rating) => total + rating.overallScore, 0) /
      ratings.length
    );
  }

  function latestSkillAssessment(userId: string) {
    return [...data.skillAssessments]
      .filter((assessment) => assessment.userId === userId)
      .sort(
        (a, b) =>
          new Date(b.assessedAt).getTime() - new Date(a.assessedAt).getTime(),
      )[0];
  }

  function recentRatings(userId: string) {
    return [...data.memberTripRatings]
      .filter((rating) => rating.userId === userId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 2);
  }

  function permissionFor(userId: string, boatId: string) {
    return data.memberBoatPermissions.find(
      (permission) => permission.userId === userId && permission.boatId === boatId,
    );
  }

  async function updateBoatPermission(
    userId: string,
    boatId: string,
    patch: Partial<MemberBoatPermission>,
  ) {
    const now = new Date().toISOString();
    const existing = permissionFor(userId, boatId);
    const nextPermission: MemberBoatPermission = {
      id: existing?.id ?? `permission-${crypto.randomUUID()}`,
      organizationId: data.organization.id,
      userId,
      boatId,
      canReserve: existing?.canReserve ?? false,
      canSolo: existing?.canSolo ?? false,
      canNightUse: existing?.canNightUse ?? false,
      canUseAsGuestHost: existing?.canUseAsGuestHost ?? false,
      skillLevel: existing?.skillLevel ?? "trainee",
      notes: existing?.notes ?? "",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      ...patch,
    };

    await updateClientAppData(
      (current) => ({
        ...current,
        memberBoatPermissions: [
          nextPermission,
          ...current.memberBoatPermissions.filter(
            (permission) => permission.id !== nextPermission.id,
          ),
        ],
      }),
      data,
    );
  }

  async function saveRating(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (ratingState === "saving") return;
    setRatingState("saving");

    const overallScore =
      (ratingForm.safetyScore +
        ratingForm.preparationScore +
        ratingForm.communicationScore +
        ratingForm.boatCareScore) /
      4;
    const rating = createMemberTripRating({
      organizationId: data.organization.id,
      boatId: data.boat.id,
      reservationId: ratingForm.reservationId,
      userId: ratingForm.userId,
      evaluatorId: ratingForm.evaluatorId,
      safetyScore: ratingForm.safetyScore,
      preparationScore: ratingForm.preparationScore,
      communicationScore: ratingForm.communicationScore,
      boatCareScore: ratingForm.boatCareScore,
      overallScore,
      comment: ratingForm.comment,
    });

    try {
      await updateClientAppData(
        (current) => ({
          ...current,
          memberTripRatings: [rating, ...current.memberTripRatings],
        }),
        data,
      );
      setRatingState("idle");
      setRatingForm((current) => ({ ...current, comment: "" }));
    } catch {
      setRatingState("error");
    }
  }

  async function saveSkillAssessment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (skillState === "saving") return;
    setSkillState("saving");

    const now = new Date().toISOString();
    const assessment = createSkillAssessment({
      organizationId: data.organization.id,
      boatId: data.boat.id,
      userId: skillForm.userId,
      assessorId: skillForm.assessorId,
      dockingScore: skillForm.dockingScore,
      departureScore: skillForm.departureScore,
      navigationRulesScore: skillForm.navigationRulesScore,
      weatherJudgmentScore: skillForm.weatherJudgmentScore,
      emergencyScore: skillForm.emergencyScore,
      equipmentScore: skillForm.equipmentScore,
      status: skillForm.status,
      recommendation: skillForm.recommendation,
      assessedAt: now,
    });

    try {
      await updateClientAppData(
        (current) => ({
          ...current,
          skillAssessments: [assessment, ...current.skillAssessments],
          users: current.users.map((user) =>
            user.id === skillForm.userId
              ? {
                  ...user,
                  canSolo: skillForm.status === "solo_ready" ? true : user.canSolo,
                }
              : user,
          ),
        }),
        data,
      );
      setSkillState("idle");
      setSkillForm((current) => ({ ...current, recommendation: "" }));
    } catch {
      setSkillState("error");
    }
  }

  function updateEditingMember<T extends keyof AppUser>(
    key: T,
    value: AppUser[T],
  ) {
    setEditingMember((current) =>
      current ? { ...current, [key]: value } : current,
    );
    if (saveState === "error") setSaveState("idle");
  }

  async function saveMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingMember || saveState === "saving") return;
    setSaveState("saving");

    const exists = data.users.some((user) => user.id === editingMember.id);
    const nextUsers = exists
      ? data.users.map((user) =>
          user.id === editingMember.id ? editingMember : user,
        )
      : [...data.users, editingMember];

    try {
      await updateClientAppData(
        (current) => ({
          ...current,
          users: nextUsers,
          currentUser:
            current.currentUser.id === editingMember.id
              ? editingMember
              : current.currentUser,
        }),
        data,
      );
      setEditingMember(null);
      setSaveState("idle");
    } catch {
      setSaveState("error");
    }
  }

  async function deleteMember(userId: string) {
    if (userId === data.currentUser.id) return;

    const nextUsers = data.users.filter((user) => user.id !== userId);
    await updateClientAppData(
      (current) => ({ ...current, users: nextUsers }),
      data,
    );
    await deleteFirestoreDocument("users", userId);
    setDeleteTargetId("");
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-bold text-blue-700">メンバー管理</p>
          <h1 className="text-3xl font-black tracking-normal text-blue-950">
            権限と利用条件
          </h1>
          <p className="text-sm leading-6 text-slate-600">
            単独出船、夜間利用、備考を一覧化し、将来の利用制限に接続します。
          </p>
        </div>

        {canEdit ? (
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="rounded-lg bg-sky-50 p-3 text-sm font-semibold text-blue-900">
              管理者として表示中。メンバーの追加、編集、削除ができます。
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <a
                href="#skill-assessment"
                className="flex h-12 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-4 text-sm font-black text-blue-900"
              >
                <ClipboardCheck size={19} aria-hidden="true" />
                スキル評価へ
              </a>
              <button
                type="button"
                onClick={() =>
                  setEditingMember(blankMember(data.organization.id))
                }
                className="flex h-12 items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-black text-white"
              >
                <Plus size={19} aria-hidden="true" />
                メンバー追加
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-lg bg-sky-50 p-3 text-sm font-semibold leading-6 text-blue-900">
            <ShieldCheck
              className="mt-0.5 shrink-0"
              size={18}
              aria-hidden="true"
            />
            閲覧専用です。権限変更は管理者が行います。
          </div>
        )}

        <Section title="メンバー一覧">
          <div className="space-y-3">
            {data.users.map((user) => {
              const rating = averageRating(user.id);
              const skill = latestSkillAssessment(user.id);
              const ratings = recentRatings(user.id);

              return (
              <Card key={user.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black text-slate-950">
                      {user.name}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {user.email}
                    </p>
                  </div>
                  <Badge className={roleTone[user.role]}>
                    {roleLabels[user.role]}
                  </Badge>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-bold text-slate-500">
                      単独出船
                    </p>
                    <p className="mt-1 font-black text-slate-950">
                      {user.canSolo ? "可" : "不可"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-bold text-slate-500">
                      夜間利用
                    </p>
                    <p className="mt-1 font-black text-slate-950">
                      {user.canNightUse ? "可" : "不可"}
                    </p>
                  </div>
                </div>

                {canEdit ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg bg-amber-50 p-3">
                      <p className="flex items-center gap-1 text-xs font-bold text-amber-800">
                        <Star size={14} aria-hidden="true" />
                        平均評価
                      </p>
                      <p className="mt-1 text-xl font-black text-amber-900">
                        {rating ? rating.toFixed(1) : "-"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-blue-50 p-3">
                      <p className="flex items-center gap-1 text-xs font-bold text-blue-800">
                        <ClipboardCheck size={14} aria-hidden="true" />
                        操船スキル
                      </p>
                      <p className="mt-1 text-sm font-black text-blue-950">
                        {skill ? skillStatusLabels[skill.status] : "未評価"}
                      </p>
                    </div>
                  </div>
                ) : null}

                <details className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <summary className="cursor-pointer text-sm font-black text-slate-700">
                    船ごとの利用権限
                  </summary>
                  <div className="mt-3 space-y-3">
                    {boats.map((boat) => {
                      const permission = permissionFor(user.id, boat.id);

                      return (
                        <div key={boat.id} className="rounded-lg bg-white p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-black text-blue-950">{boat.name}</p>
                            <Badge
                              className={
                                permission?.canReserve
                                  ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
                                  : "bg-slate-100 text-slate-700 ring-slate-200"
                              }
                            >
                              {permission?.canReserve ? "予約可" : "予約不可"}
                            </Badge>
                          </div>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {[
                              ["canReserve", "予約可能"],
                              ["canSolo", "単独利用"],
                              ["canNightUse", "夜間利用"],
                              ["canUseAsGuestHost", "ゲスト主催"],
                            ].map(([key, label]) => (
                              <label
                                key={key}
                                className="flex min-h-10 items-center gap-2 rounded-lg bg-slate-50 px-3 text-sm font-bold text-slate-800"
                              >
                                <input
                                  type="checkbox"
                                  disabled={!canManagePermissions}
                                  checked={
                                    Boolean(
                                      permission?.[
                                        key as keyof Pick<
                                          MemberBoatPermission,
                                          | "canReserve"
                                          | "canSolo"
                                          | "canNightUse"
                                          | "canUseAsGuestHost"
                                        >
                                      ],
                                    )
                                  }
                                  onChange={(event) =>
                                    updateBoatPermission(user.id, boat.id, {
                                      [key]: event.target.checked,
                                    })
                                  }
                                  className="size-5 accent-blue-800"
                                />
                                {label}
                              </label>
                            ))}
                          </div>
                          <label className="mt-3 block">
                            <span className="text-xs font-bold text-slate-500">
                              スキルレベル
                            </span>
                            <select
                              disabled={!canManagePermissions}
                              value={permission?.skillLevel ?? "trainee"}
                              onChange={(event) =>
                                updateBoatPermission(user.id, boat.id, {
                                  skillLevel: event.target.value as BoatSkillLevel,
                                })
                              }
                              className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold"
                            >
                              {skillLevels.map((level) => (
                                <option key={level} value={level}>
                                  {skillLevelLabels[level]}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="mt-3 block">
                            <span className="text-xs font-bold text-slate-500">
                              備考
                            </span>
                            <input
                              disabled={!canManagePermissions}
                              value={permission?.notes ?? ""}
                              onChange={(event) =>
                                updateBoatPermission(user.id, boat.id, {
                                  notes: event.target.value,
                                })
                              }
                              className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold"
                            />
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </details>

                {canEdit && (ratings.length > 0 || skill?.recommendation) ? (
                  <details className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <summary className="cursor-pointer text-sm font-black text-slate-700">
                      評価メモ・推奨事項を開く
                    </summary>
                    <div className="mt-2 space-y-2">
                      {ratings.map((item) => {
                        const reservation = data.reservations.find(
                          (reservationItem) =>
                            reservationItem.id === item.reservationId,
                        );
                        const evaluator = data.users.find(
                          (candidate) => candidate.id === item.evaluatorId,
                        );

                        return (
                          <div
                            key={item.id}
                            className="rounded-lg bg-white px-3 py-2"
                          >
                            <p className="text-sm font-black text-slate-900">
                              {item.overallScore.toFixed(1)} /{" "}
                              {reservation
                                ? `${reservation.startAt.slice(0, 10)} ${targetFishLabels[reservation.targetFish]}`
                                : "対象釣行"}
                            </p>
                            {item.comment ? (
                              <p className="mt-1 text-sm leading-6 text-slate-600">
                                {item.comment}
                              </p>
                            ) : null}
                            <p className="mt-1 text-xs font-bold text-slate-500">
                              評価者: {evaluator?.name ?? "不明"}
                            </p>
                          </div>
                        );
                      })}
                      {skill?.recommendation ? (
                        <div className="rounded-lg bg-blue-50 px-3 py-2">
                          <p className="text-sm font-black text-blue-950">
                            スキル推奨事項
                          </p>
                          <p className="mt-1 text-sm leading-6 text-blue-900">
                            {skill.recommendation}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </details>
                ) : null}

                <p className="mt-4 text-sm leading-6 text-slate-600">
                  {user.notes || "備考なし"}
                </p>

                {canEdit ? (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setEditingMember(user)}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-sky-200 text-sm font-black text-blue-900"
                    >
                      <Edit3 size={17} aria-hidden="true" />
                      編集
                    </button>
                    {deleteTargetId === user.id ? (
                      <button
                        type="button"
                        onClick={() => deleteMember(user.id)}
                        disabled={user.id === data.currentUser.id}
                        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-rose-700 text-sm font-black text-white disabled:bg-slate-300"
                      >
                        <Trash2 size={17} aria-hidden="true" />
                        本当に削除
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteTargetId(user.id)}
                        disabled={user.id === data.currentUser.id}
                        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-rose-200 text-sm font-black text-rose-700 disabled:border-slate-200 disabled:text-slate-400"
                      >
                        <Trash2 size={17} aria-hidden="true" />
                        削除
                      </button>
                    )}
                  </div>
                ) : null}
              </Card>
              );
            })}
          </div>
        </Section>

        {canEdit ? (
          <div id="trip-rating" className="scroll-mt-24">
          <Section title="釣行ごとのメンバー評価">
            <form
              onSubmit={saveRating}
              className="space-y-4 rounded-lg border border-sky-100 bg-white p-4 shadow-sm"
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">対象釣行</span>
                  <select
                    value={ratingForm.reservationId}
                    onChange={(event) =>
                      setRatingForm((current) => ({
                        ...current,
                        reservationId: event.target.value,
                      }))
                    }
                    className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                  >
                    {data.reservations.map((reservation) => (
                      <option key={reservation.id} value={reservation.id}>
                        {reservation.startAt.slice(0, 10)} /{" "}
                        {targetFishLabels[reservation.targetFish]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">評価対象</span>
                  <select
                    value={ratingForm.userId}
                    onChange={(event) =>
                      setRatingForm((current) => ({
                        ...current,
                        userId: event.target.value,
                      }))
                    }
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
                  <span className="text-sm font-bold text-slate-700">評価者</span>
                  <select
                    value={ratingForm.evaluatorId}
                    onChange={(event) =>
                      setRatingForm((current) => ({
                        ...current,
                        evaluatorId: event.target.value,
                      }))
                    }
                    className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                  >
                    {data.users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <ScoreSelect
                  label="安全判断"
                  value={ratingForm.safetyScore}
                  onChange={(value) =>
                    setRatingForm((current) => ({ ...current, safetyScore: value }))
                  }
                />
                <ScoreSelect
                  label="準備"
                  value={ratingForm.preparationScore}
                  onChange={(value) =>
                    setRatingForm((current) => ({
                      ...current,
                      preparationScore: value,
                    }))
                  }
                />
                <ScoreSelect
                  label="連絡/共有"
                  value={ratingForm.communicationScore}
                  onChange={(value) =>
                    setRatingForm((current) => ({
                      ...current,
                      communicationScore: value,
                    }))
                  }
                />
                <ScoreSelect
                  label="船体/備品扱い"
                  value={ratingForm.boatCareScore}
                  onChange={(value) =>
                    setRatingForm((current) => ({ ...current, boatCareScore: value }))
                  }
                />
              </div>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">コメント</span>
                <textarea
                  value={ratingForm.comment}
                  onChange={(event) =>
                    setRatingForm((current) => ({
                      ...current,
                      comment: event.target.value,
                    }))
                  }
                  className="mt-2 min-h-24 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-base outline-none ring-blue-600 focus:ring-2"
                  placeholder="良かった点、次回確認したい点など"
                />
              </label>

              {ratingState === "error" ? (
                <p className="rounded-lg bg-rose-50 p-3 text-sm font-bold text-rose-800">
                  評価の保存に失敗しました。
                </p>
              ) : null}

              <button
                type="submit"
                disabled={ratingState === "saving" || !ratingForm.reservationId}
                className="flex h-13 w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 text-base font-black text-white disabled:bg-slate-300"
              >
                <Star size={20} aria-hidden="true" />
                {ratingState === "saving" ? "保存中..." : "釣行評価を保存"}
              </button>
            </form>
          </Section>
          </div>
        ) : null}

        {canEdit ? (
          <Section title="評価履歴">
            <details className="rounded-lg border border-slate-200 bg-white p-3">
              <summary className="cursor-pointer text-sm font-black text-slate-800">
                評価履歴を開く ({data.memberTripRatings.length}件)
              </summary>
              <div className="mt-3 space-y-3">
              {[...data.memberTripRatings]
                .sort(
                  (a, b) =>
                    new Date(b.createdAt).getTime() -
                    new Date(a.createdAt).getTime(),
                )
                .slice(0, 8)
                .map((rating) => {
                  const user = data.users.find((item) => item.id === rating.userId);
                  const evaluator = data.users.find(
                    (item) => item.id === rating.evaluatorId,
                  );
                  const reservation = data.reservations.find(
                    (item) => item.id === rating.reservationId,
                  );

                  return (
                    <Card key={rating.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-slate-950">
                            {user?.name ?? "対象者不明"}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {reservation
                              ? `${reservation.startAt.slice(0, 10)} / ${targetFishLabels[reservation.targetFish]}`
                              : "対象釣行なし"}{" "}
                            / 評価者: {evaluator?.name ?? "不明"}
                          </p>
                        </div>
                        <Badge className="bg-amber-100 text-amber-900 ring-amber-200">
                          {rating.overallScore.toFixed(1)}
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                        <div className="rounded-lg bg-slate-50 p-2">
                          安全 {rating.safetyScore}
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2">
                          準備 {rating.preparationScore}
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2">
                          共有 {rating.communicationScore}
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2">
                          船体 {rating.boatCareScore}
                        </div>
                      </div>
                      {rating.comment ? (
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          {rating.comment}
                        </p>
                      ) : null}
                    </Card>
                  );
                })}
              {data.memberTripRatings.length === 0 ? (
                <Card>
                  <p className="text-sm font-semibold text-slate-600">
                    評価履歴はまだありません。
                  </p>
                </Card>
              ) : null}
              </div>
            </details>
          </Section>
        ) : null}

        {canEdit ? (
          <Section title="スキル評価履歴">
            <details className="rounded-lg border border-slate-200 bg-white p-3">
              <summary className="cursor-pointer text-sm font-black text-slate-800">
                スキル評価履歴を開く ({data.skillAssessments.length}件)
              </summary>
              <div className="mt-3 space-y-3">
              {[...data.skillAssessments]
                .sort(
                  (a, b) =>
                    new Date(b.assessedAt).getTime() -
                    new Date(a.assessedAt).getTime(),
                )
                .slice(0, 8)
                .map((assessment) => {
                  const user = data.users.find(
                    (item) => item.id === assessment.userId,
                  );
                  const assessor = data.users.find(
                    (item) => item.id === assessment.assessorId,
                  );

                  return (
                    <Card key={assessment.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-slate-950">
                            {user?.name ?? "対象者不明"}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            評価者: {assessor?.name ?? "不明"} /{" "}
                            {new Intl.DateTimeFormat("ja-JP", {
                              dateStyle: "medium",
                            }).format(new Date(assessment.assessedAt))}
                          </p>
                        </div>
                        <Badge className="bg-blue-100 text-blue-900 ring-blue-200">
                          {skillStatusLabels[assessment.status]}
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                        <div className="rounded-lg bg-slate-50 p-2">
                          離岸 {assessment.departureScore}
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2">
                          着岸 {assessment.dockingScore}
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2">
                          ルール {assessment.navigationRulesScore}
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2">
                          天候 {assessment.weatherJudgmentScore}
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2">
                          緊急 {assessment.emergencyScore}
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2">
                          備品 {assessment.equipmentScore}
                        </div>
                      </div>
                      {assessment.recommendation ? (
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          {assessment.recommendation}
                        </p>
                      ) : null}
                    </Card>
                  );
                })}
              {data.skillAssessments.length === 0 ? (
                <Card>
                  <p className="text-sm font-semibold text-slate-600">
                    スキル評価履歴はまだありません。
                  </p>
                </Card>
              ) : null}
              </div>
            </details>
          </Section>
        ) : null}

        {canEdit ? (
          <div id="skill-assessment" className="scroll-mt-24">
          <Section title="単独出船前の操船スキル評価">
            <form
              onSubmit={saveSkillAssessment}
              className="space-y-4 rounded-lg border border-sky-100 bg-white p-4 shadow-sm"
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">評価対象</span>
                  <select
                    value={skillForm.userId}
                    onChange={(event) =>
                      setSkillForm((current) => ({
                        ...current,
                        userId: event.target.value,
                      }))
                    }
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
                  <span className="text-sm font-bold text-slate-700">評価者</span>
                  <select
                    value={skillForm.assessorId}
                    onChange={(event) =>
                      setSkillForm((current) => ({
                        ...current,
                        assessorId: event.target.value,
                      }))
                    }
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
                  <span className="text-sm font-bold text-slate-700">判定</span>
                  <select
                    value={skillForm.status}
                    onChange={(event) =>
                      setSkillForm((current) => ({
                        ...current,
                        status: event.target.value as SkillAssessmentStatus,
                      }))
                    }
                    className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                  >
                    {Object.entries(skillStatusLabels).map(([status, label]) => (
                      <option key={status} value={status}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["離岸", "departureScore"],
                  ["着岸", "dockingScore"],
                  ["航行ルール", "navigationRulesScore"],
                  ["天候判断", "weatherJudgmentScore"],
                  ["緊急時対応", "emergencyScore"],
                  ["備品理解", "equipmentScore"],
                ].map(([label, key]) => (
                  <ScoreSelect
                    key={key}
                    label={label}
                    value={skillForm[key as keyof typeof skillForm] as number}
                    onChange={(value) =>
                      setSkillForm((current) => ({ ...current, [key]: value }))
                    }
                  />
                ))}
              </div>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">
                  推奨事項
                </span>
                <textarea
                  value={skillForm.recommendation}
                  onChange={(event) =>
                    setSkillForm((current) => ({
                      ...current,
                      recommendation: event.target.value,
                    }))
                  }
                  className="mt-2 min-h-24 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-base outline-none ring-blue-600 focus:ring-2"
                  placeholder="単独出船前に確認したい練習項目など"
                />
              </label>

              {skillState === "error" ? (
                <p className="rounded-lg bg-rose-50 p-3 text-sm font-bold text-rose-800">
                  スキル評価の保存に失敗しました。
                </p>
              ) : null}

              <button
                type="submit"
                disabled={skillState === "saving"}
                className="flex h-13 w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 text-base font-black text-white disabled:bg-slate-300"
              >
                <ClipboardCheck size={20} aria-hidden="true" />
                {skillState === "saving" ? "保存中..." : "スキル評価を保存"}
              </button>
            </form>
          </Section>
          </div>
        ) : null}

        {editingMember ? (
          <div className="fixed inset-0 z-40 flex items-end bg-slate-950/45 p-0 sm:items-center sm:p-4">
            <form
              onSubmit={saveMember}
              className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:mx-auto sm:max-w-2xl sm:rounded-lg sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black text-blue-700">
                    メンバー編集
                  </p>
                  <h2 className="mt-1 text-xl font-black text-blue-950">
                    利用条件と権限
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="grid size-10 place-items-center rounded-full bg-slate-100 text-slate-700"
                  aria-label="編集を閉じる"
                >
                  <X size={21} aria-hidden="true" />
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">名前</span>
                  <input
                    value={editingMember.name}
                    onChange={(event) =>
                      updateEditingMember("name", event.target.value)
                    }
                    className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">
                    メールアドレス
                  </span>
                  <input
                    type="email"
                    value={editingMember.email}
                    onChange={(event) =>
                      updateEditingMember("email", event.target.value)
                    }
                    className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">権限</span>
                  <select
                    value={editingMember.role}
                    onChange={(event) =>
                      updateEditingMember(
                        "role",
                        event.target.value as UserRole,
                      )
                    }
                    className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                  >
                    {(["admin", "owner", "member"] as UserRole[]).map((role) => (
                      <option key={role} value={role}>
                        {roleLabels[role]}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex min-h-12 items-center gap-2 rounded-lg bg-slate-50 px-3 text-sm font-black text-slate-800">
                    <input
                      type="checkbox"
                      checked={editingMember.canSolo}
                      onChange={(event) =>
                        updateEditingMember("canSolo", event.target.checked)
                      }
                      className="size-5 accent-blue-800"
                    />
                    単独出船可
                  </label>
                  <label className="flex min-h-12 items-center gap-2 rounded-lg bg-slate-50 px-3 text-sm font-black text-slate-800">
                    <input
                      type="checkbox"
                      checked={editingMember.canNightUse}
                      onChange={(event) =>
                        updateEditingMember(
                          "canNightUse",
                          event.target.checked,
                        )
                      }
                      className="size-5 accent-blue-800"
                    />
                    夜間利用可
                  </label>
                </div>
              </div>

              <label className="mt-3 block">
                <span className="text-sm font-bold text-slate-700">備考</span>
                <textarea
                  value={editingMember.notes}
                  onChange={(event) =>
                    updateEditingMember("notes", event.target.value)
                  }
                  className="mt-2 min-h-24 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-base outline-none ring-blue-600 focus:ring-2"
                />
              </label>

              {saveState === "error" ? (
                <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm font-bold text-rose-800">
                  保存に失敗しました。通信状態とFirestore Rulesを確認してください。
                </p>
              ) : null}

              <button
                type="submit"
                disabled={saveState === "saving"}
                className="mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 text-base font-black text-white disabled:bg-slate-300"
              >
                <Save size={20} aria-hidden="true" />
                {saveState === "saving" ? "保存中..." : "保存する"}
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
