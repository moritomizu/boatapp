"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Calculator,
  CheckCircle2,
  ClipboardList,
  Coins,
  RefreshCw,
  Save,
  Ship,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge, Card, Section } from "@/components/ui";
import { getBoats } from "@/lib/boat-utils";
import { updateClientAppData, useClientAppData } from "@/lib/client-store";
import { getInitialAppData } from "@/lib/data-source";
import {
  allocationMethodLabels,
  currentYearMonth,
  formatCurrency,
  generateMonthlyRevenueReport,
  ownershipTypeLabels,
  reportStatusLabels,
  subscriptionStatusLabels,
} from "@/lib/revenue";
import type {
  BoatOwnership,
  BoatOwnershipType,
  BoatRevenuePolicy,
  MemberSubscription,
  MemberSubscriptionStatus,
  MembershipPlan,
  MonthlyBoatRevenueSummary,
  MonthlyRevenueReport,
  MonthlyRevenueReportStatus,
  RevenueAllocationMethod,
} from "@/types/domain";

const statusTone: Record<MonthlyRevenueReportStatus, string> = {
  draft: "bg-slate-100 text-slate-700 ring-slate-200",
  reviewing: "bg-amber-100 text-amber-900 ring-amber-200",
  confirmed: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  reopened: "bg-blue-100 text-blue-900 ring-blue-200",
};

const subscriptionStatusTone: Record<MemberSubscriptionStatus, string> = {
  active: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  paused: "bg-amber-100 text-amber-900 ring-amber-200",
  cancelled: "bg-slate-100 text-slate-700 ring-slate-200",
  trial: "bg-sky-100 text-blue-800 ring-sky-200",
};

const allocationMethods = Object.keys(
  allocationMethodLabels,
) as RevenueAllocationMethod[];
const ownershipTypes = Object.keys(ownershipTypeLabels) as BoatOwnershipType[];

function numberValue(value: FormDataEntryValue | null) {
  return Number(value || 0);
}

function monthLabel(yearMonth: string) {
  const [year, month] = yearMonth.split("-");
  return `${year}年${Number(month)}月`;
}

function summaryTotal(
  summaries: MonthlyBoatRevenueSummary[],
  key: keyof Pick<
    MonthlyBoatRevenueSummary,
    | "finalAllocatedRevenue"
    | "ownerReturnAmount"
    | "operationFeeAmount"
    | "maintenanceReserveAmount"
    | "localManagementAmount"
  >,
) {
  return summaries.reduce((total, summary) => total + summary[key], 0);
}

export default function RevenuePage() {
  const initialData = useMemo(() => getInitialAppData(), []);
  const data = useClientAppData(initialData);
  const boats = getBoats(data);
  const isAdmin = data.currentUser.role === "admin";
  const isOwner = data.currentUser.role === "owner" || isAdmin;
  const [yearMonth, setYearMonth] = useState(currentYearMonth());
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const report =
    data.monthlyRevenueReports.find(
      (item) => item.organizationId === data.organization.id && item.yearMonth === yearMonth,
    ) ?? generateMonthlyRevenueReport(data, yearMonth);
  const ownedBoatIds = new Set(
    data.boatOwnerships
      .filter(
        (ownership) =>
          ownership.organizationId === data.organization.id &&
          ownership.ownerUserId === data.currentUser.id,
      )
      .map((ownership) => ownership.boatId),
  );
  const visibleSummaries = isAdmin
    ? report.boatSummaries
    : report.boatSummaries.filter((summary) => ownedBoatIds.has(summary.boatId));

  async function saveReport(nextReport: MonthlyRevenueReport) {
    setSaveState("saving");
    try {
      await updateClientAppData(
        (current) => {
          const exists = current.monthlyRevenueReports.some(
            (item) => item.id === nextReport.id,
          );

          return {
            ...current,
            monthlyRevenueReports: exists
              ? current.monthlyRevenueReports.map((item) =>
                  item.id === nextReport.id ? nextReport : item,
                )
              : [nextReport, ...current.monthlyRevenueReports],
          };
        },
        data,
      );
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  async function generateReport() {
    await saveReport(generateMonthlyRevenueReport(data, yearMonth, report));
  }

  async function updateSummary(
    boatId: string,
    updater: (summary: MonthlyBoatRevenueSummary) => MonthlyBoatRevenueSummary,
  ) {
    if (!isAdmin || report.status === "confirmed") return;
    await saveReport({
      ...report,
      status: report.status === "draft" ? "reviewing" : report.status,
      boatSummaries: report.boatSummaries.map((summary) =>
        summary.boatId === boatId ? updater(summary) : summary,
      ),
      updatedAt: new Date().toISOString(),
    });
  }

  async function confirmReport() {
    if (!isAdmin) return;
    const now = new Date().toISOString();
    await saveReport({
      ...report,
      status: "confirmed",
      confirmedAt: now,
      confirmedBy: data.currentUser.id,
      updatedAt: now,
    });
  }

  async function reopenReport() {
    if (!isAdmin) return;
    await saveReport({
      ...report,
      status: "reopened",
      updatedAt: new Date().toISOString(),
    });
  }

  async function savePlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) return;
    const form = new FormData(event.currentTarget);
    const now = new Date().toISOString();
    const plan: MembershipPlan = {
      id: `plan-${crypto.randomUUID()}`,
      organizationId: data.organization.id,
      name: String(form.get("name") ?? ""),
      description: String(form.get("description") ?? ""),
      monthlyFee: numberValue(form.get("monthlyFee")),
      monthlyReservationLimit: numberValue(form.get("monthlyReservationLimit")),
      weekendReservationLimit: numberValue(form.get("weekendReservationLimit")),
      accessibleBoatIds: form.getAll("accessibleBoatIds").map(String),
      canGuestUse: form.get("canGuestUse") === "on",
      canNightUse: form.get("canNightUse") === "on",
      canEventUse: form.get("canEventUse") === "on",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await updateClientAppData(
      (current) => ({
        ...current,
        membershipPlans: [plan, ...current.membershipPlans],
      }),
      data,
    );
    event.currentTarget.reset();
    setSaveState("saved");
  }

  async function saveSubscription(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) return;
    const form = new FormData(event.currentTarget);
    const plan = data.membershipPlans.find(
      (item) => item.id === String(form.get("membershipPlanId")),
    );
    const user = data.users.find((item) => item.id === String(form.get("userId")));
    if (!plan || !user) return;
    const now = new Date().toISOString();
    const subscription: MemberSubscription = {
      id: `subscription-${crypto.randomUUID()}`,
      organizationId: data.organization.id,
      userId: user.id,
      membershipPlanId: plan.id,
      status: "active",
      startedAt: `${String(form.get("startedAt") || currentYearMonth())}-01T00:00:00.000+09:00`,
      monthlyFeeSnapshot: plan.monthlyFee,
      planNameSnapshot: plan.name,
      createdAt: now,
      updatedAt: now,
    };

    await updateClientAppData(
      (current) => ({
        ...current,
        memberSubscriptions: [
          subscription,
          ...current.memberSubscriptions.filter((item) => item.userId !== user.id),
        ],
      }),
      data,
    );
    event.currentTarget.reset();
    setSaveState("saved");
  }

  async function saveBoatSettings(
    event: React.FormEvent<HTMLFormElement>,
    boatId: string,
  ) {
    event.preventDefault();
    if (!isAdmin) return;
    const form = new FormData(event.currentTarget);
    const now = new Date().toISOString();
    const ownership: BoatOwnership = {
      id: String(form.get("ownershipId") || `ownership-${crypto.randomUUID()}`),
      organizationId: data.organization.id,
      boatId,
      ownerUserId: String(form.get("ownerUserId") || "") || undefined,
      ownerName: String(form.get("ownerName") || ""),
      ownershipType: String(form.get("ownershipType")) as BoatOwnershipType,
      ownershipSharePercent: numberValue(form.get("ownershipSharePercent")),
      isPayoutRecipient: form.get("isPayoutRecipient") === "on",
      payoutSharePercent: numberValue(form.get("payoutSharePercent")),
      payoutMemo: String(form.get("payoutMemo") || ""),
      adminMemo: String(form.get("adminMemo") || ""),
      createdAt: String(form.get("createdAt") || now),
      updatedAt: now,
    };
    const policy: BoatRevenuePolicy = {
      id: String(form.get("policyId") || `revenue-policy-${boatId}`),
      organizationId: data.organization.id,
      boatId,
      ownerReturnRate: numberValue(form.get("ownerReturnRate")),
      operationFeeRate: numberValue(form.get("operationFeeRate")),
      maintenanceReserveRate: numberValue(form.get("maintenanceReserveRate")),
      localManagementRate: numberValue(form.get("localManagementRate")),
      allocationMethod: String(form.get("allocationMethod")) as RevenueAllocationMethod,
      allowManualAdjustment: form.get("allowManualAdjustment") === "on",
      memo: String(form.get("policyMemo") || ""),
      createdAt: String(form.get("policyCreatedAt") || now),
      updatedAt: now,
    };

    await updateClientAppData(
      (current) => ({
        ...current,
        boatOwnerships: [
          ownership,
          ...current.boatOwnerships.filter((item) => item.id !== ownership.id),
        ],
        boatRevenuePolicies: [
          policy,
          ...current.boatRevenuePolicies.filter((item) => item.id !== policy.id),
        ],
      }),
      data,
    );
    setSaveState("saved");
  }

  if (!isOwner) {
    return (
      <AppShell>
        <Card>
          <p className="font-black text-blue-950">会費配分は管理者/オーナー向け機能です。</p>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-bold text-blue-700">会費配分</p>
          <h1 className="text-2xl font-black tracking-normal text-blue-950">
            月次配分レポート
          </h1>
          <p className="text-sm leading-6 text-slate-600">
            会員月額費を組織共通収入として集計し、船ごとの利用実績を見ながら月次で配分を確定します。決済・自動送金はまだ行いません。
          </p>
        </div>

        <Section title="対象月">
          <Card>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <label className="block">
                <span className="text-sm font-bold text-slate-700">レポート月</span>
                <input
                  type="month"
                  value={yearMonth}
                  onChange={(event) => setYearMonth(event.target.value)}
                  className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base"
                />
              </label>
              {isAdmin ? (
                <>
                  <button
                    type="button"
                    onClick={() => void generateReport()}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-black text-white"
                  >
                    <Calculator size={18} aria-hidden="true" />
                    集計する
                  </button>
                  {report.status === "confirmed" ? (
                    <button
                      type="button"
                      onClick={() => void reopenReport()}
                      className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-4 text-sm font-black text-blue-900"
                    >
                      <RefreshCw size={18} aria-hidden="true" />
                      再オープン
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void confirmReport()}
                      className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-black text-white"
                    >
                      <CheckCircle2 size={18} aria-hidden="true" />
                      確定
                    </button>
                  )}
                </>
              ) : null}
            </div>
            {saveState === "saved" ? (
              <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
                保存しました。
              </p>
            ) : saveState === "error" ? (
              <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm font-bold text-rose-800">
                保存に失敗しました。Firestore Rulesを確認してください。
              </p>
            ) : null}
          </Card>
        </Section>

        <Section title={`${monthLabel(yearMonth)} サマリー`}>
          <div className="grid gap-3 sm:grid-cols-4">
            <Card>
              <p className="text-xs font-bold text-slate-500">ステータス</p>
              <Badge className={`mt-2 ${statusTone[report.status]}`}>
                {reportStatusLabels[report.status]}
              </Badge>
            </Card>
            <Card>
              <p className="text-xs font-bold text-slate-500">有効会員</p>
              <p className="mt-2 text-2xl font-black text-blue-950">
                {report.activeMembers}名
              </p>
            </Card>
            <Card>
              <p className="text-xs font-bold text-slate-500">月会費総額</p>
              <p className="mt-2 text-2xl font-black text-blue-950">
                {formatCurrency(report.totalMembershipRevenue)}
              </p>
            </Card>
            <Card>
              <p className="text-xs font-bold text-slate-500">実利用</p>
              <p className="mt-2 text-2xl font-black text-blue-950">
                {report.completedReservations ?? 0}件
              </p>
            </Card>
          </div>
          <Card>
            <div className="grid gap-3 text-sm font-bold text-slate-700 sm:grid-cols-4">
              <p>予約件数: {report.totalReservations ?? 0}件</p>
              <p>キャンセル: {report.cancelledReservations ?? 0}件</p>
              <p>利用時間: {report.totalUsageHours ?? 0}h</p>
              <p>航行距離: {report.totalNavigationDistanceKm ?? 0}km</p>
            </div>
          </Card>
        </Section>

        <Section title="船別配分">
          <div className="space-y-3">
            {visibleSummaries.map((summary) => (
              <Card key={summary.boatId}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-lg font-black text-blue-950">
                      <Ship size={19} aria-hidden="true" />
                      {summary.boatNameSnapshot}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      利用{summary.usageCount}件 / {summary.usageHours}h / 航行
                      {summary.navigationDistanceKm ?? 0}km
                    </p>
                  </div>
                  <Badge className={statusTone[report.status]}>
                    {reportStatusLabels[report.status]}
                  </Badge>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-bold text-slate-500">最多利用艇帰属</p>
                    <p className="mt-1 font-black text-slate-950">
                      {formatCurrency(summary.suggestedRevenueByMostUsedBoat ?? 0)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-bold text-slate-500">利用回数按分</p>
                    <p className="mt-1 font-black text-slate-950">
                      {formatCurrency(summary.suggestedRevenueByUsageCount ?? 0)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-bold text-slate-500">利用時間按分</p>
                    <p className="mt-1 font-black text-slate-950">
                      {formatCurrency(summary.suggestedRevenueByUsageTime ?? 0)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-5">
                  {[
                    ["配分対象額", summary.finalAllocatedRevenue],
                    ["船主還元", summary.ownerReturnAmount],
                    ["運営費", summary.operationFeeAmount],
                    ["メンテ積立", summary.maintenanceReserveAmount],
                    ["現地管理費", summary.localManagementAmount],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-sky-50 p-3">
                      <p className="text-xs font-bold text-blue-800">{label}</p>
                      <p className="mt-1 font-black text-blue-950">
                        {formatCurrency(Number(value))}
                      </p>
                    </div>
                  ))}
                </div>

                {isAdmin && report.status !== "confirmed" ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-bold text-slate-700">最終配分対象額</span>
                      <input
                        type="number"
                        value={summary.finalAllocatedRevenue}
                        onChange={(event) =>
                          void updateSummary(summary.boatId, (current) => ({
                            ...current,
                            finalAllocatedRevenue: Number(event.target.value),
                          }))
                        }
                        className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-bold text-slate-700">船主還元額</span>
                      <input
                        type="number"
                        value={summary.ownerReturnAmount}
                        onChange={(event) =>
                          void updateSummary(summary.boatId, (current) => ({
                            ...current,
                            ownerReturnAmount: Number(event.target.value),
                          }))
                        }
                        className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-bold text-slate-700">調整理由</span>
                      <textarea
                        value={summary.adjustmentReason ?? ""}
                        onChange={(event) =>
                          void updateSummary(summary.boatId, (current) => ({
                            ...current,
                            adjustmentReason: event.target.value,
                          }))
                        }
                        className="mt-2 min-h-20 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-base"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-bold text-slate-700">管理者メモ</span>
                      <textarea
                        value={summary.adminMemo ?? ""}
                        onChange={(event) =>
                          void updateSummary(summary.boatId, (current) => ({
                            ...current,
                            adminMemo: event.target.value,
                          }))
                        }
                        className="mt-2 min-h-20 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-base"
                      />
                    </label>
                  </div>
                ) : (
                  <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-600">
                    {summary.adjustmentReason || summary.adminMemo
                      ? `${summary.adjustmentReason || ""} ${summary.adminMemo || ""}`
                      : "調整理由・管理者メモはありません。"}
                  </div>
                )}
              </Card>
            ))}
            {!isAdmin && visibleSummaries.length === 0 ? (
              <Card>
                <p className="text-sm font-semibold text-slate-600">
                  あなたが還元対象者として設定されている船の配分レポートはまだありません。
                </p>
              </Card>
            ) : null}
          </div>
        </Section>

        {isAdmin ? (
          <>
            <Section title="確定額合計">
              <div className="grid gap-3 sm:grid-cols-5">
                {[
                  ["配分対象", summaryTotal(report.boatSummaries, "finalAllocatedRevenue")],
                  ["船主還元", summaryTotal(report.boatSummaries, "ownerReturnAmount")],
                  ["運営費", summaryTotal(report.boatSummaries, "operationFeeAmount")],
                  ["メンテ積立", summaryTotal(report.boatSummaries, "maintenanceReserveAmount")],
                  ["現地管理費", summaryTotal(report.boatSummaries, "localManagementAmount")],
                ].map(([label, value]) => (
                  <Card key={label}>
                    <p className="text-xs font-bold text-slate-500">{label}</p>
                    <p className="mt-2 text-xl font-black text-blue-950">
                      {formatCurrency(Number(value))}
                    </p>
                  </Card>
                ))}
              </div>
            </Section>

            <Section title="会員プラン">
              <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
                <Card>
                  <form onSubmit={savePlan} className="space-y-3">
                    <p className="font-black text-blue-950">プラン追加</p>
                    <input name="name" placeholder="プラン名" required className="h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3" />
                    <input name="monthlyFee" type="number" placeholder="月額費" required className="h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3" />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input name="monthlyReservationLimit" type="number" placeholder="月間利用回数" className="h-12 rounded-lg border border-slate-200 bg-slate-50 px-3" />
                      <input name="weekendReservationLimit" type="number" placeholder="土日祝利用回数" className="h-12 rounded-lg border border-slate-200 bg-slate-50 px-3" />
                    </div>
                    <textarea name="description" placeholder="説明" className="min-h-20 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3" />
                    <div className="grid gap-2 sm:grid-cols-2">
                      {boats.map((boat) => (
                        <label key={boat.id} className="flex min-h-10 items-center gap-2 rounded-lg bg-slate-50 px-3 text-sm font-bold">
                          <input type="checkbox" name="accessibleBoatIds" value={boat.id} className="size-5 accent-blue-800" />
                          {boat.name}
                        </label>
                      ))}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {[
                        ["canGuestUse", "ゲスト同伴"],
                        ["canNightUse", "夜間利用"],
                        ["canEventUse", "イベント利用"],
                      ].map(([name, label]) => (
                        <label key={name} className="flex min-h-10 items-center gap-2 rounded-lg bg-slate-50 px-3 text-sm font-bold">
                          <input type="checkbox" name={name} className="size-5 accent-blue-800" />
                          {label}
                        </label>
                      ))}
                    </div>
                    <button className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-black text-white">
                      <Save size={18} aria-hidden="true" />
                      プランを保存
                    </button>
                  </form>
                </Card>
                <div className="space-y-3">
                  {data.membershipPlans.map((plan) => (
                    <Card key={plan.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-blue-950">{plan.name}</p>
                          <p className="mt-1 text-sm font-bold text-slate-500">
                            {formatCurrency(plan.monthlyFee)} / 月{plan.monthlyReservationLimit ?? "-"}回
                          </p>
                        </div>
                        <Badge className={plan.isActive ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-slate-100 text-slate-700 ring-slate-200"}>
                          {plan.isActive ? "有効" : "無効"}
                        </Badge>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {plan.description || "説明なし"}
                      </p>
                    </Card>
                  ))}
                </div>
              </div>
            </Section>

            <Section title="会員プラン紐づけ">
              <Card>
                <form onSubmit={saveSubscription} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                  <label className="block">
                    <span className="text-sm font-bold text-slate-700">メンバー</span>
                    <select name="userId" className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3">
                      {data.users.map((user) => (
                        <option key={user.id} value={user.id}>{user.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm font-bold text-slate-700">プラン</span>
                    <select name="membershipPlanId" className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3">
                      {data.membershipPlans.map((plan) => (
                        <option key={plan.id} value={plan.id}>{plan.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm font-bold text-slate-700">開始月</span>
                    <input name="startedAt" type="month" defaultValue={yearMonth} className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3" />
                  </label>
                  <button className="min-h-12 rounded-lg bg-blue-800 px-4 text-sm font-black text-white">
                    紐づけ
                  </button>
                </form>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {data.memberSubscriptions.map((subscription) => {
                    const user = data.users.find((item) => item.id === subscription.userId);
                    return (
                      <div key={subscription.id} className="rounded-lg bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-black text-slate-950">{user?.name ?? "不明なユーザー"}</p>
                          <Badge className={subscriptionStatusTone[subscription.status]}>
                            {subscriptionStatusLabels[subscription.status]}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm font-bold text-slate-500">
                          {subscription.planNameSnapshot} / {formatCurrency(subscription.monthlyFeeSnapshot)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </Section>

            <Section title="船主/還元先・配分ルール">
              <div className="space-y-3">
                {boats.map((boat) => {
                  const ownership = data.boatOwnerships.find((item) => item.boatId === boat.id);
                  const policy = data.boatRevenuePolicies.find((item) => item.boatId === boat.id);

                  return (
                    <Card key={boat.id}>
                      <form onSubmit={(event) => void saveBoatSettings(event, boat.id)} className="space-y-3">
                        <input type="hidden" name="ownershipId" value={ownership?.id ?? ""} />
                        <input type="hidden" name="createdAt" value={ownership?.createdAt ?? ""} />
                        <input type="hidden" name="policyId" value={policy?.id ?? ""} />
                        <input type="hidden" name="policyCreatedAt" value={policy?.createdAt ?? ""} />
                        <p className="flex items-center gap-2 font-black text-blue-950">
                          <Ship size={18} aria-hidden="true" />
                          {boat.name}
                        </p>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <label className="block">
                            <span className="text-sm font-bold text-slate-700">船主名</span>
                            <input name="ownerName" defaultValue={ownership?.ownerName ?? ""} className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3" />
                          </label>
                          <label className="block">
                            <span className="text-sm font-bold text-slate-700">所有者ユーザー</span>
                            <select name="ownerUserId" defaultValue={ownership?.ownerUserId ?? ""} className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3">
                              <option value="">未設定</option>
                              {data.users.map((user) => (
                                <option key={user.id} value={user.id}>{user.name}</option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="text-sm font-bold text-slate-700">所有形態</span>
                            <select name="ownershipType" defaultValue={ownership?.ownershipType ?? "co_owner"} className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3">
                              {ownershipTypes.map((type) => (
                                <option key={type} value={type}>{ownershipTypeLabels[type]}</option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="text-sm font-bold text-slate-700">所有割合%</span>
                            <input name="ownershipSharePercent" type="number" defaultValue={ownership?.ownershipSharePercent ?? 100} className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3" />
                          </label>
                          <label className="block">
                            <span className="text-sm font-bold text-slate-700">還元割合%</span>
                            <input name="payoutSharePercent" type="number" defaultValue={ownership?.payoutSharePercent ?? 100} className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3" />
                          </label>
                          <label className="mt-7 flex min-h-12 items-center gap-2 rounded-lg bg-slate-50 px-3 text-sm font-bold">
                            <input name="isPayoutRecipient" type="checkbox" defaultChecked={ownership?.isPayoutRecipient ?? true} className="size-5 accent-blue-800" />
                            還元対象
                          </label>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-4">
                          <input name="ownerReturnRate" type="number" defaultValue={policy?.ownerReturnRate ?? 40} placeholder="船主還元率" className="h-12 rounded-lg border border-slate-200 bg-slate-50 px-3" />
                          <input name="operationFeeRate" type="number" defaultValue={policy?.operationFeeRate ?? 30} placeholder="運営費率" className="h-12 rounded-lg border border-slate-200 bg-slate-50 px-3" />
                          <input name="maintenanceReserveRate" type="number" defaultValue={policy?.maintenanceReserveRate ?? 20} placeholder="メンテ積立率" className="h-12 rounded-lg border border-slate-200 bg-slate-50 px-3" />
                          <input name="localManagementRate" type="number" defaultValue={policy?.localManagementRate ?? 10} placeholder="現地管理費率" className="h-12 rounded-lg border border-slate-200 bg-slate-50 px-3" />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                          <select name="allocationMethod" defaultValue={policy?.allocationMethod ?? "manual"} className="h-12 rounded-lg border border-slate-200 bg-slate-50 px-3">
                            {allocationMethods.map((method) => (
                              <option key={method} value={method}>{allocationMethodLabels[method]}</option>
                            ))}
                          </select>
                          <label className="flex min-h-12 items-center gap-2 rounded-lg bg-slate-50 px-3 text-sm font-bold">
                            <input name="allowManualAdjustment" type="checkbox" defaultChecked={policy?.allowManualAdjustment ?? true} className="size-5 accent-blue-800" />
                            手動調整
                          </label>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <textarea name="payoutMemo" defaultValue={ownership?.payoutMemo ?? ""} placeholder="振込先メモ" className="min-h-20 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3" />
                          <textarea name="adminMemo" defaultValue={ownership?.adminMemo ?? ""} placeholder="管理者メモ" className="min-h-20 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3" />
                          <textarea name="policyMemo" defaultValue={policy?.memo ?? ""} placeholder="配分ルールメモ" className="min-h-20 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3" />
                        </div>
                        <button className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-black text-white">
                          <Save size={18} aria-hidden="true" />
                          船別設定を保存
                        </button>
                      </form>
                    </Card>
                  );
                })}
              </div>
            </Section>

            <Section title="関連画面">
              <div className="grid gap-2 sm:grid-cols-3">
                <Link href="/organization" className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-black text-blue-900 ring-1 ring-sky-100">
                  <ClipboardList size={18} aria-hidden="true" />
                  組織設定
                </Link>
                <Link href="/members" className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-black text-blue-900 ring-1 ring-sky-100">
                  <Users size={18} aria-hidden="true" />
                  メンバー管理
                </Link>
                <Link href="/usage-history" className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-black text-blue-900 ring-1 ring-sky-100">
                  <Coins size={18} aria-hidden="true" />
                  利用履歴
                </Link>
              </div>
            </Section>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
