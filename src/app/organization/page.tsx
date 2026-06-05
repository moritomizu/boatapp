"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Clipboard,
  LinkIcon,
  MailPlus,
  Save,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge, Card, Field, Section } from "@/components/ui";
import { getBoats } from "@/lib/boat-utils";
import { updateClientAppData, useClientAppData } from "@/lib/client-store";
import { getInitialAppData } from "@/lib/data-source";
import { roleLabels } from "@/lib/labels";
import { getOrganizationRule } from "@/lib/usage-history";
import type { OrganizationInvite, OrganizationRule, UserRole } from "@/types/domain";

const inviteStatuses = {
  pending: "未参加",
  accepted: "参加済み",
  expired: "期限切れ",
  revoked: "無効",
};

function createInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export default function OrganizationPage() {
  const initialData = getInitialAppData();
  const data = useClientAppData(initialData);
  const canEditOrganization = data.currentUser.role === "admin";
  const canCreateInvite =
    data.currentUser.role === "admin" || data.currentUser.role === "owner";
  const organizationRule = getOrganizationRule(data);
  const boats = getBoats(data);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [copyMessage, setCopyMessage] = useState("");
  const [organizationForm, setOrganizationForm] = useState({
    name: data.organization.name,
    description: data.organization.description ?? "",
    contact: data.organization.contact ?? "",
    activityArea: data.organization.activityArea ?? "",
    ruleSummary: data.organization.ruleSummary ?? "",
  });
  const [ruleForm, setRuleForm] = useState({
    monthlyReservationLimit: organizationRule.monthlyReservationLimit,
    standardUsageHours: organizationRule.standardUsageHours,
    bookingWindowDays: organizationRule.bookingWindowDays,
    allowNightUse: organizationRule.allowNightUse,
    allowSoloUse: organizationRule.allowSoloUse,
    allowJoinRequests: organizationRule.allowJoinRequests,
    allowGuestOnBoard: organizationRule.allowGuestOnBoard,
    requirePreDepartureCheck: organizationRule.requirePreDepartureCheck,
    requirePostReturnCheck: organizationRule.requirePostReturnCheck,
    requireFullFuelReturn: organizationRule.requireFullFuelReturn,
    strictLimit: Boolean(organizationRule.strictLimit),
    ruleText: organizationRule.ruleText,
    notes: organizationRule.notes,
    emergencyContact: organizationRule.emergencyContact,
  });
  const [inviteForm, setInviteForm] = useState(() => ({
    email: "",
    role: "member" as Exclude<UserRole, "admin">,
    memo: "",
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14)
      .toISOString()
      .slice(0, 10),
  }));

  const activeMembers = data.organizationMembers.filter(
    (member) => member.organizationId === data.organization.id && member.isActive,
  );
  const owner = data.users.find((user) => user.id === data.organization.ownerUserId);
  const inviteUrlBase = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/join?code=`;
  }, []);

  async function saveOrganization(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEditOrganization || saveState === "saving") return;
    setSaveState("saving");

    try {
      await updateClientAppData(
        (current) => ({
          ...current,
          organization: {
            ...current.organization,
            ...organizationForm,
            updatedAt: new Date().toISOString(),
          },
        }),
        data,
      );
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  async function saveRule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (data.currentUser.role !== "admin" || saveState === "saving") return;
    setSaveState("saving");

    const now = new Date().toISOString();
    const nextRule: OrganizationRule = {
      ...organizationRule,
      ...ruleForm,
      id: organizationRule.id,
      organizationId: data.organization.id,
      monthlyReservationLimit: Number(ruleForm.monthlyReservationLimit) || 0,
      standardUsageHours: Number(ruleForm.standardUsageHours) || 0,
      bookingWindowDays: Number(ruleForm.bookingWindowDays) || 0,
      createdAt: organizationRule.createdAt ?? now,
      updatedAt: now,
    };

    try {
      await updateClientAppData(
        (current) => {
          const exists = current.organizationRules.some(
            (rule) => rule.id === nextRule.id,
          );

          return {
            ...current,
            organizationRules: exists
              ? current.organizationRules.map((rule) =>
                  rule.id === nextRule.id ? nextRule : rule,
                )
              : [nextRule, ...current.organizationRules],
          };
        },
        data,
      );
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  async function createInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreateInvite || saveState === "saving") return;
    setSaveState("saving");
    const now = new Date().toISOString();
    const invite: OrganizationInvite = {
      id: `invite-${crypto.randomUUID()}`,
      organizationId: data.organization.id,
      email: inviteForm.email,
      role: inviteForm.role,
      inviteCode: createInviteCode(),
      status: "pending",
      memo: inviteForm.memo,
      invitedBy: data.currentUser.id,
      expiresAt: `${inviteForm.expiresAt}T23:59:59.000+09:00`,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await updateClientAppData(
        (current) => ({
          ...current,
          organizationInvites: [invite, ...current.organizationInvites],
        }),
        data,
      );
      setInviteForm((current) => ({ ...current, email: "", memo: "" }));
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  async function copyInvite(code: string) {
    const url = `${inviteUrlBase}${code}`;
    await navigator.clipboard?.writeText(url);
    setCopyMessage("招待URLをコピーしました。");
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-bold text-blue-700">組織設定</p>
          <h1 className="text-2xl font-black tracking-normal text-blue-950">
            {data.organization.name}
          </h1>
          <p className="text-sm leading-6 text-slate-600">
            船舶、メンバー、利用ルールを組織単位で管理します。
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <p className="text-xs font-bold text-slate-500">所属メンバー</p>
            <p className="mt-2 text-3xl font-black text-blue-950">
              {activeMembers.length}
            </p>
          </Card>
          <Card>
            <p className="text-xs font-bold text-slate-500">管理船舶</p>
            <p className="mt-2 text-3xl font-black text-blue-950">
              {boats.length}
            </p>
          </Card>
          <Card>
            <p className="text-xs font-bold text-slate-500">月間上限</p>
            <p className="mt-2 text-3xl font-black text-blue-950">
              {organizationRule.monthlyReservationLimit}
            </p>
          </Card>
        </div>

        <Section title="組織情報">
          <form onSubmit={saveOrganization} className="space-y-3 rounded-lg border border-sky-100 bg-white p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-bold text-slate-700">組織名</span>
                <input
                  value={organizationForm.name}
                  disabled={!canEditOrganization}
                  onChange={(event) =>
                    setOrganizationForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2 disabled:text-slate-500"
                />
              </label>
              <Field label="代表者/管理者" value={owner?.name ?? "未設定"} />
              <label className="block">
                <span className="text-sm font-bold text-slate-700">連絡先</span>
                <input
                  value={organizationForm.contact}
                  disabled={!canEditOrganization}
                  onChange={(event) =>
                    setOrganizationForm((current) => ({
                      ...current,
                      contact: event.target.value,
                    }))
                  }
                  className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2 disabled:text-slate-500"
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-slate-700">活動エリア</span>
                <input
                  value={organizationForm.activityArea}
                  disabled={!canEditOrganization}
                  onChange={(event) =>
                    setOrganizationForm((current) => ({
                      ...current,
                      activityArea: event.target.value,
                    }))
                  }
                  className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2 disabled:text-slate-500"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-sm font-bold text-slate-700">説明</span>
              <textarea
                value={organizationForm.description}
                disabled={!canEditOrganization}
                onChange={(event) =>
                  setOrganizationForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                className="mt-2 min-h-20 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-base outline-none ring-blue-600 focus:ring-2 disabled:text-slate-500"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-700">利用ルール概要</span>
              <textarea
                value={organizationForm.ruleSummary}
                disabled={!canEditOrganization}
                onChange={(event) =>
                  setOrganizationForm((current) => ({
                    ...current,
                    ruleSummary: event.target.value,
                  }))
                }
                className="mt-2 min-h-20 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-base outline-none ring-blue-600 focus:ring-2 disabled:text-slate-500"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="作成日"
                value={new Intl.DateTimeFormat("ja-JP", {
                  dateStyle: "medium",
                }).format(new Date(data.organization.createdAt))}
              />
              <Field
                label="更新日"
                value={
                  data.organization.updatedAt
                    ? new Intl.DateTimeFormat("ja-JP", {
                        dateStyle: "medium",
                      }).format(new Date(data.organization.updatedAt))
                    : "未更新"
                }
              />
            </div>
            {canEditOrganization ? (
              <button
                type="submit"
                disabled={saveState === "saving"}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-black text-white disabled:bg-slate-300"
              >
                <Save size={18} aria-hidden="true" />
                組織情報を保存
              </button>
            ) : (
              <div className="flex items-start gap-2 rounded-lg bg-sky-50 p-3 text-sm font-semibold leading-6 text-blue-900">
                <ShieldCheck className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
                閲覧専用です。変更は管理者が行います。
              </div>
            )}
          </form>
        </Section>

        <Section title="利用ルール設定">
          <form onSubmit={saveRule} className="space-y-4 rounded-lg border border-sky-100 bg-white p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["monthlyReservationLimit", "月間予約上限回数"],
                ["standardUsageHours", "標準利用時間"],
                ["bookingWindowDays", "予約可能な先の日数"],
              ].map(([key, label]) => (
                <label key={key} className="block">
                  <span className="text-sm font-bold text-slate-700">{label}</span>
                  <input
                    type="number"
                    min={0}
                    value={ruleForm[key as keyof typeof ruleForm] as number}
                    disabled={data.currentUser.role !== "admin"}
                    onChange={(event) =>
                      setRuleForm((current) => ({
                        ...current,
                        [key]: Number(event.target.value),
                      }))
                    }
                    className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2 disabled:text-slate-500"
                  />
                </label>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                ["allowNightUse", "夜間利用を許可"],
                ["allowSoloUse", "単独利用を許可"],
                ["allowJoinRequests", "便乗募集を許可"],
                ["allowGuestOnBoard", "ゲスト同乗を許可"],
                ["requirePreDepartureCheck", "出船前チェック必須"],
                ["requirePostReturnCheck", "帰港後チェック必須"],
                ["requireFullFuelReturn", "給油満タン返し必須"],
                ["strictLimit", "上限超過を将来ブロック"],
              ].map(([key, label]) => (
                <label key={key} className="flex min-h-12 items-center gap-2 rounded-lg bg-slate-50 px-3 text-sm font-black text-slate-800">
                  <input
                    type="checkbox"
                    disabled={data.currentUser.role !== "admin"}
                    checked={Boolean(ruleForm[key as keyof typeof ruleForm])}
                    onChange={(event) =>
                      setRuleForm((current) => ({
                        ...current,
                        [key]: event.target.checked,
                      }))
                    }
                    className="size-5 accent-blue-800"
                  />
                  {label}
                </label>
              ))}
            </div>
            <label className="block">
              <span className="text-sm font-bold text-slate-700">利用ルール本文</span>
              <textarea
                value={ruleForm.ruleText}
                disabled={data.currentUser.role !== "admin"}
                onChange={(event) =>
                  setRuleForm((current) => ({ ...current, ruleText: event.target.value }))
                }
                className="mt-2 min-h-28 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-base outline-none ring-blue-600 focus:ring-2 disabled:text-slate-500"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-700">注意事項</span>
              <textarea
                value={ruleForm.notes}
                disabled={data.currentUser.role !== "admin"}
                onChange={(event) =>
                  setRuleForm((current) => ({ ...current, notes: event.target.value }))
                }
                className="mt-2 min-h-20 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-base outline-none ring-blue-600 focus:ring-2 disabled:text-slate-500"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-700">緊急時の連絡先</span>
              <textarea
                value={ruleForm.emergencyContact}
                disabled={data.currentUser.role !== "admin"}
                onChange={(event) =>
                  setRuleForm((current) => ({ ...current, emergencyContact: event.target.value }))
                }
                className="mt-2 min-h-20 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-base outline-none ring-blue-600 focus:ring-2 disabled:text-slate-500"
              />
            </label>
            {data.currentUser.role === "admin" ? (
              <button
                type="submit"
                disabled={saveState === "saving"}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-black text-white disabled:bg-slate-300"
              >
                <Settings size={18} aria-hidden="true" />
                利用ルールを保存
              </button>
            ) : null}
          </form>
        </Section>

        <Section title="メンバー招待">
          {canCreateInvite ? (
            <form onSubmit={createInvite} className="space-y-3 rounded-lg border border-sky-100 bg-white p-4 shadow-sm">
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block sm:col-span-2">
                  <span className="text-sm font-bold text-slate-700">招待先メール</span>
                  <input
                    type="email"
                    required
                    value={inviteForm.email}
                    onChange={(event) =>
                      setInviteForm((current) => ({ ...current, email: event.target.value }))
                    }
                    className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">予定ロール</span>
                  <select
                    value={inviteForm.role}
                    onChange={(event) =>
                      setInviteForm((current) => ({
                        ...current,
                        role: event.target.value as Exclude<UserRole, "admin">,
                      }))
                    }
                    className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                  >
                    <option value="member">{roleLabels.member}</option>
                    <option value="owner">{roleLabels.owner}</option>
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="text-sm font-bold text-slate-700">有効期限</span>
                <input
                  type="date"
                  value={inviteForm.expiresAt}
                  onChange={(event) =>
                    setInviteForm((current) => ({ ...current, expiresAt: event.target.value }))
                  }
                  className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-slate-700">招待メモ</span>
                <textarea
                  value={inviteForm.memo}
                  onChange={(event) =>
                    setInviteForm((current) => ({ ...current, memo: event.target.value }))
                  }
                  className="mt-2 min-h-20 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-base outline-none ring-blue-600 focus:ring-2"
                />
              </label>
              <button
                type="submit"
                disabled={saveState === "saving"}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-black text-white disabled:bg-slate-300"
              >
                <MailPlus size={18} aria-hidden="true" />
                招待コードを発行
              </button>
            </form>
          ) : null}

          <div className="mt-3 space-y-3">
            {data.organizationInvites.map((invite) => (
              <Card key={invite.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">{invite.email}</p>
                    <p className="mt-1 text-sm font-bold text-slate-500">
                      {roleLabels[invite.role]} / {invite.inviteCode}
                    </p>
                  </div>
                  <Badge className="bg-sky-100 text-blue-800 ring-sky-200">
                    {inviteStatuses[invite.status]}
                  </Badge>
                </div>
                <p className="mt-3 break-all rounded-lg bg-slate-50 p-3 text-xs font-bold text-slate-600">
                  {inviteUrlBase}
                  {invite.inviteCode}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => void copyInvite(invite.inviteCode)}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-sky-200 bg-white px-3 text-sm font-black text-blue-900"
                  >
                    <Clipboard size={17} aria-hidden="true" />
                    URLをコピー
                  </button>
                  <Link
                    href={`/join?code=${invite.inviteCode}`}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-sky-50 px-3 text-sm font-black text-blue-900"
                  >
                    <LinkIcon size={17} aria-hidden="true" />
                    参加画面を開く
                  </Link>
                </div>
                {invite.memo ? (
                  <p className="mt-3 text-sm leading-6 text-slate-600">{invite.memo}</p>
                ) : null}
              </Card>
            ))}
            {copyMessage ? (
              <p className="rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
                {copyMessage}
              </p>
            ) : null}
            {data.organizationInvites.length === 0 ? (
              <Card>
                <p className="text-sm font-semibold text-slate-600">
                  招待はまだありません。
                </p>
              </Card>
            ) : null}
          </div>
        </Section>

        <Section title="メンバーと船舶">
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/members"
              className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-black text-blue-900 ring-1 ring-sky-100"
            >
              <Users size={18} aria-hidden="true" />
              メンバー管理へ
            </Link>
            <Link
              href="/usage-history"
              className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-black text-blue-900 ring-1 ring-sky-100"
            >
              <Clipboard size={18} aria-hidden="true" />
              利用履歴へ
            </Link>
          </div>
        </Section>

        {saveState === "saved" ? (
          <p className="rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
            保存しました。
          </p>
        ) : saveState === "error" ? (
          <p className="rounded-lg bg-rose-50 p-3 text-sm font-bold text-rose-800">
            保存に失敗しました。通信状態とFirestore Rulesを確認してください。
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
