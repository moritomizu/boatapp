"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Coins,
  LifeBuoy,
  Plus,
  Save,
  Ship,
  Wrench,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge, Card, Section } from "@/components/ui";
import { getBoats } from "@/lib/boat-utils";
import { updateClientAppData, useClientAppData } from "@/lib/client-store";
import { getInitialAppData } from "@/lib/data-source";
import {
  costResponsibilities,
  costResponsibilityLabels,
  fundReasons,
  fundTransactionReasonLabels,
  fundTransactionTypeLabels,
  getBoatFund,
  getSafetyFund,
  recalculateFunds,
  safetyTransactions,
  transactionsForBoat,
} from "@/lib/funds";
import { formatCurrency } from "@/lib/revenue";
import type {
  CostResponsibility,
  FundTransaction,
  FundTransactionReason,
  FundTransactionType,
  FundType,
} from "@/types/domain";

const transactionTone: Record<FundTransactionType, string> = {
  contribution: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  expense: "bg-rose-100 text-rose-800 ring-rose-200",
  adjustment: "bg-amber-100 text-amber-900 ring-amber-200",
};

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function isInMonth(iso: string, yearMonth: string) {
  return iso.startsWith(yearMonth);
}

function transactionAmountForBalance(type: FundTransactionType, amount: number) {
  return type === "expense" ? -Math.abs(amount) : type === "contribution" ? Math.abs(amount) : amount;
}

export default function FundsPage() {
  const initialData = useMemo(() => getInitialAppData(), []);
  const data = useClientAppData(initialData);
  const boats = getBoats(data);
  const isAdmin = data.currentUser.role === "admin";
  const isOwner = data.currentUser.role === "owner" || isAdmin;
  const [scope, setScope] = useState<FundType>("boat_maintenance");
  const [selectedBoatId, setSelectedBoatId] = useState(data.boat.id);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const ownedBoatIds = new Set(
    data.boatOwnerships
      .filter(
        (ownership) =>
          ownership.organizationId === data.organization.id &&
          ownership.ownerUserId === data.currentUser.id,
      )
      .map((ownership) => ownership.boatId),
  );
  const visibleBoats = isAdmin
    ? boats
    : boats.filter((boat) => ownedBoatIds.has(boat.id));
  const selectedBoat = visibleBoats.find((boat) => boat.id === selectedBoatId) ?? visibleBoats[0];
  const safetyFund = getSafetyFund(data);
  const boatFunds = visibleBoats.map((boat) => ({
    boat,
    fund: getBoatFund(data, boat.id),
    transactions: transactionsForBoat(data, boat.id),
  }));
  const selectedBoatTransactions = selectedBoat
    ? transactionsForBoat(data, selectedBoat.id)
    : [];
  const allTransactions =
    scope === "organization_safety"
      ? safetyTransactions(data)
      : selectedBoatTransactions;
  const month = currentMonth();
  const monthlyContributions = data.fundTransactions
    .filter((transaction) => isInMonth(transaction.createdAt, month))
    .filter((transaction) => transaction.type === "contribution")
    .reduce((total, transaction) => total + Math.abs(transaction.amount), 0);
  const monthlyExpenses = data.fundTransactions
    .filter((transaction) => isInMonth(transaction.createdAt, month))
    .filter((transaction) => transaction.type === "expense")
    .reduce((total, transaction) => total + Math.abs(transaction.amount), 0);
  const maintenanceFundTotal = boatFunds.reduce(
    (total, item) => total + item.fund.balance,
    0,
  );

  async function addTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin || saveState === "saving") return;
    const form = new FormData(event.currentTarget);
    const fundType = String(form.get("fundType")) as FundType;
    const type = String(form.get("type")) as FundTransactionType;
    const amount = Number(form.get("amount") || 0);
    const boatId = String(form.get("boatId") || "");
    const relatedMaintenanceLogId = String(form.get("relatedMaintenanceLogId") || "");
    const currentBalance =
      fundType === "boat_maintenance"
        ? getBoatFund(data, boatId).balance
        : getSafetyFund(data).balance;
    const nextBalance = currentBalance + transactionAmountForBalance(type, amount);

    if (fundType === "boat_maintenance" && !boatId) {
      setSaveState("error");
      return;
    }
    if (nextBalance < 0) {
      const proceed = window.confirm(
        "この支出により残高がマイナスになります。登録しますか？",
      );
      if (!proceed) return;
    }

    setSaveState("saving");
    const now = new Date().toISOString();
    const transaction: FundTransaction = {
      id: `fund-tx-${crypto.randomUUID()}`,
      organizationId: data.organization.id,
      fundType,
      boatId: fundType === "boat_maintenance" ? boatId : undefined,
      type,
      amount,
      reason: String(form.get("reason")) as FundTransactionReason,
      costResponsibility: String(form.get("costResponsibility")) as CostResponsibility,
      description: String(form.get("description") || ""),
      relatedBoatId: boatId || undefined,
      relatedMaintenanceLogId: relatedMaintenanceLogId || undefined,
      adminMemo: String(form.get("adminMemo") || ""),
      createdAt: now,
      createdBy: data.currentUser.id,
    };

    try {
      await updateClientAppData(
        (current) =>
          recalculateFunds({
            ...current,
            fundTransactions: [transaction, ...current.fundTransactions],
            maintenanceLogs: relatedMaintenanceLogId
              ? current.maintenanceLogs.map((log) =>
                  log.id === relatedMaintenanceLogId
                    ? {
                        ...log,
                        costResponsibility: transaction.costResponsibility,
                        useFund:
                          transaction.costResponsibility === "boat_maintenance_fund" ||
                          transaction.costResponsibility === "organization_safety_fund",
                        fundTransactionId: transaction.id,
                        adminMemo: transaction.adminMemo,
                      }
                    : log,
                )
              : current.maintenanceLogs,
          }),
        data,
      );
      event.currentTarget.reset();
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  function renderTransaction(transaction: FundTransaction) {
    const boat = boats.find((item) => item.id === transaction.boatId);
    const maintenance = data.maintenanceLogs.find(
      (log) => log.id === transaction.relatedMaintenanceLogId,
    );

    return (
      <Card key={transaction.id}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-black text-blue-950">
              {fundTransactionReasonLabels[transaction.reason]}
            </p>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
              {transaction.description || "説明なし"}
            </p>
          </div>
          <Badge className={transactionTone[transaction.type]}>
            {fundTransactionTypeLabels[transaction.type]}
          </Badge>
        </div>
        <div className="mt-3 grid gap-2 text-sm font-bold text-slate-600 sm:grid-cols-3">
          <p>金額: {formatCurrency(transaction.amount)}</p>
          <p>負担区分: {costResponsibilityLabels[transaction.costResponsibility]}</p>
          <p>船: {boat?.name ?? "共通"}</p>
        </div>
        {maintenance ? (
          <p className="mt-3 rounded-lg bg-sky-50 p-3 text-sm font-bold text-blue-900">
            メンテナンス台帳連携: {maintenance.title}
          </p>
        ) : null}
        {transaction.adminMemo ? (
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {transaction.adminMemo}
          </p>
        ) : null}
      </Card>
    );
  }

  if (!isOwner) {
    return (
      <AppShell>
        <Card>
          <p className="font-black text-blue-950">
            基金管理は管理者/オーナー向け機能です。
          </p>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-bold text-blue-700">基金管理</p>
          <h1 className="text-2xl font-black tracking-normal text-blue-950">
            メンテ積立・安全基金
          </h1>
          <p className="text-sm leading-6 text-slate-600">
            船ごとのメンテナンス積立と、クラブ全体の安全基金を管理します。船別メンテ積立は原則として対象船専用です。
          </p>
        </div>

        <Section title="組織全体サマリー">
          <div className="grid gap-3 sm:grid-cols-4">
            <Card>
              <p className="text-xs font-bold text-slate-500">共通安全基金</p>
              <p className="mt-2 text-2xl font-black text-blue-950">
                {formatCurrency(safetyFund.balance)}
              </p>
            </Card>
            <Card>
              <p className="text-xs font-bold text-slate-500">船別積立合計</p>
              <p className="mt-2 text-2xl font-black text-blue-950">
                {formatCurrency(maintenanceFundTotal)}
              </p>
            </Card>
            <Card>
              <p className="text-xs font-bold text-slate-500">当月積立</p>
              <p className="mt-2 text-2xl font-black text-emerald-800">
                {formatCurrency(monthlyContributions)}
              </p>
            </Card>
            <Card>
              <p className="text-xs font-bold text-slate-500">当月支出</p>
              <p className="mt-2 text-2xl font-black text-rose-800">
                {formatCurrency(monthlyExpenses)}
              </p>
            </Card>
          </div>
        </Section>

        <Section title="船別メンテ積立">
          <div className="grid gap-3 sm:grid-cols-2">
            {boatFunds.map(({ boat, fund, transactions }) => {
              const monthContributions = transactions
                .filter((transaction) => isInMonth(transaction.createdAt, month))
                .filter((transaction) => transaction.type === "contribution")
                .reduce((total, transaction) => total + Math.abs(transaction.amount), 0);
              const monthExpenses = transactions
                .filter((transaction) => isInMonth(transaction.createdAt, month))
                .filter((transaction) => transaction.type === "expense")
                .reduce((total, transaction) => total + Math.abs(transaction.amount), 0);

              return (
                <button
                  key={boat.id}
                  type="button"
                  onClick={() => {
                    setScope("boat_maintenance");
                    setSelectedBoatId(boat.id);
                  }}
                  className={`rounded-lg border bg-white p-4 text-left shadow-sm ${
                    selectedBoat?.id === boat.id && scope === "boat_maintenance"
                      ? "border-blue-300 ring-2 ring-blue-100"
                      : "border-sky-100"
                  }`}
                >
                  <p className="flex items-center gap-2 font-black text-blue-950">
                    <Ship size={18} aria-hidden="true" />
                    {boat.name}
                  </p>
                  <p className="mt-2 text-2xl font-black text-blue-950">
                    {formatCurrency(fund.balance)}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-bold">
                    <span className="rounded-lg bg-emerald-50 p-2 text-emerald-800">
                      累計積立 {formatCurrency(fund.totalContributed)}
                    </span>
                    <span className="rounded-lg bg-rose-50 p-2 text-rose-800">
                      累計支出 {formatCurrency(fund.totalSpent)}
                    </span>
                    <span className="rounded-lg bg-slate-50 p-2 text-slate-700">
                      当月積立 {formatCurrency(monthContributions)}
                    </span>
                    <span className="rounded-lg bg-slate-50 p-2 text-slate-700">
                      当月支出 {formatCurrency(monthExpenses)}
                    </span>
                  </div>
                  <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
                    この積立は、原則としてこの船の通常メンテナンス・消耗品・軽微修理に使用します。
                  </p>
                </button>
              );
            })}
            {boatFunds.length === 0 ? (
              <Card>
                <p className="text-sm font-semibold text-slate-600">
                  表示できる船別メンテ積立はありません。
                </p>
              </Card>
            ) : null}
          </div>
        </Section>

        <Section title="共通安全基金">
          <Card>
            <button
              type="button"
              onClick={() => setScope("organization_safety")}
              className="flex w-full items-start gap-3 text-left"
            >
              <span className="grid size-11 place-items-center rounded-lg bg-sky-100 text-blue-800">
                <LifeBuoy size={22} aria-hidden="true" />
              </span>
              <span>
                <span className="block text-lg font-black text-blue-950">
                  {formatCurrency(safetyFund.balance)}
                </span>
                <span className="mt-1 block text-sm font-semibold leading-6 text-slate-600">
                  共通安全基金は、クラブ全体の安全性を高めるための基金です。ライフジャケット、予備ロープ、救急用品、安全講習などに利用します。
                </span>
              </span>
            </button>
          </Card>
        </Section>

        {isAdmin ? (
          <Section title="入出金を追加">
            <Card>
              <form onSubmit={addTransaction} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="block">
                    <span className="text-sm font-bold text-slate-700">基金種別</span>
                    <select
                      name="fundType"
                      defaultValue={scope}
                      onChange={(event) => setScope(event.target.value as FundType)}
                      className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3"
                    >
                      <option value="boat_maintenance">船別メンテ積立</option>
                      <option value="organization_safety">共通安全基金</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm font-bold text-slate-700">対象船</span>
                    <select
                      name="boatId"
                      defaultValue={selectedBoat?.id ?? ""}
                      className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3"
                    >
                      {boats.map((boat) => (
                        <option key={boat.id} value={boat.id}>{boat.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm font-bold text-slate-700">種別</span>
                    <select name="type" className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3">
                      <option value="contribution">積立</option>
                      <option value="expense">支出</option>
                      <option value="adjustment">調整</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm font-bold text-slate-700">金額</span>
                    <input name="amount" type="number" min={0} required className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3" />
                  </label>
                  <label className="block">
                    <span className="text-sm font-bold text-slate-700">支出理由</span>
                    <select name="reason" className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3">
                      {fundReasons.map((reason) => (
                        <option key={reason} value={reason}>{fundTransactionReasonLabels[reason]}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm font-bold text-slate-700">費用負担区分</span>
                    <select name="costResponsibility" className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3">
                      {costResponsibilities.map((responsibility) => (
                        <option key={responsibility} value={responsibility}>{costResponsibilityLabels[responsibility]}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-bold text-slate-700">関連メンテナンス台帳</span>
                    <select name="relatedMaintenanceLogId" className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3">
                      <option value="">紐付けなし</option>
                      {data.maintenanceLogs.map((log) => (
                        <option key={log.id} value={log.id}>{log.title}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm font-bold text-slate-700">説明</span>
                    <input name="description" className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3" />
                  </label>
                </div>
                <textarea name="adminMemo" placeholder="管理者メモ" className="min-h-20 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3" />
                <div className="rounded-lg bg-amber-50 p-3 text-sm font-bold leading-6 text-amber-900">
                  <AlertTriangle size={17} className="mr-1 inline" aria-hidden="true" />
                  利用者の明らかな過失やルール違反による破損は、メンテ積立ではなく、利用者負担・保険対応・管理者判断の対象です。
                </div>
                <button
                  disabled={saveState === "saving"}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-black text-white disabled:bg-slate-300"
                >
                  <Plus size={18} aria-hidden="true" />
                  {saveState === "saving" ? "保存中..." : "入出金を登録"}
                </button>
                {saveState === "saved" ? (
                  <p className="rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
                    保存しました。
                  </p>
                ) : saveState === "error" ? (
                  <p className="rounded-lg bg-rose-50 p-3 text-sm font-bold text-rose-800">
                    保存に失敗しました。対象船やFirestore Rulesを確認してください。
                  </p>
                ) : null}
              </form>
            </Card>
          </Section>
        ) : null}

        <Section
          title={
            scope === "organization_safety"
              ? "共通安全基金 履歴"
              : `${selectedBoat?.name ?? "船別"} メンテ積立 履歴`
          }
        >
          <div className="space-y-3">
            {allTransactions.slice(0, 20).map(renderTransaction)}
            {allTransactions.length === 0 ? (
              <Card>
                <p className="text-sm font-semibold text-slate-600">
                  入出金履歴はまだありません。
                </p>
              </Card>
            ) : null}
          </div>
        </Section>

        <Section title="関連画面">
          <div className="grid gap-2 sm:grid-cols-3">
            <Link href="/boats" className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-black text-blue-900 ring-1 ring-sky-100">
              <Wrench size={18} aria-hidden="true" />
              メンテナンス台帳
            </Link>
            <Link href="/revenue" className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-black text-blue-900 ring-1 ring-sky-100">
              <Coins size={18} aria-hidden="true" />
              会費配分
            </Link>
            <Link href="/organization" className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-black text-blue-900 ring-1 ring-sky-100">
              <Save size={18} aria-hidden="true" />
              組織設定
            </Link>
          </div>
        </Section>
      </div>
    </AppShell>
  );
}
