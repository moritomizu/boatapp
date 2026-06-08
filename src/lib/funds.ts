import type {
  AppData,
  BoatMaintenanceFund,
  CostResponsibility,
  FundTransaction,
  FundTransactionReason,
  FundTransactionType,
  FundType,
  OrganizationSafetyFund,
} from "@/types/domain";

export const fundTypeLabels: Record<FundType, string> = {
  boat_maintenance: "船別メンテ積立",
  organization_safety: "共通安全基金",
};

export const fundTransactionTypeLabels: Record<FundTransactionType, string> = {
  contribution: "積立",
  expense: "支出",
  adjustment: "調整",
};

export const fundTransactionReasonLabels: Record<FundTransactionReason, string> = {
  monthly_allocation: "月次配分",
  regular_maintenance: "通常メンテナンス",
  minor_repair: "軽微修理",
  consumables: "消耗品",
  safety_equipment: "安全備品",
  damage_repair: "破損修理",
  user_damage: "利用者破損",
  insurance_related: "保険対応",
  owner_contribution: "船主補填",
  manual_adjustment: "管理者調整",
  other: "その他",
};

export const costResponsibilityLabels: Record<CostResponsibility, string> = {
  boat_maintenance_fund: "船別メンテ積立",
  organization_safety_fund: "共通安全基金",
  boat_owner: "船主負担",
  user: "利用者負担",
  insurance: "保険対応",
  undecided: "未確定",
  other: "その他",
};

export const fundReasons = Object.keys(
  fundTransactionReasonLabels,
) as FundTransactionReason[];

export const costResponsibilities = Object.keys(
  costResponsibilityLabels,
) as CostResponsibility[];

export function signedAmount(transaction: Pick<FundTransaction, "type" | "amount">) {
  if (transaction.type === "expense") return -Math.abs(transaction.amount);
  if (transaction.type === "adjustment") return transaction.amount;
  return Math.abs(transaction.amount);
}

export function fundBalance(transactions: FundTransaction[]) {
  return transactions.reduce((total, transaction) => total + signedAmount(transaction), 0);
}

export function fundTotals(transactions: FundTransaction[]) {
  return {
    balance: fundBalance(transactions),
    totalContributed: transactions
      .filter((transaction) => transaction.type === "contribution")
      .reduce((total, transaction) => total + Math.abs(transaction.amount), 0),
    totalSpent: transactions
      .filter((transaction) => transaction.type === "expense")
      .reduce((total, transaction) => total + Math.abs(transaction.amount), 0),
  };
}

export function getBoatFund(data: AppData, boatId: string): BoatMaintenanceFund {
  const existing = data.boatMaintenanceFunds.find((fund) => fund.boatId === boatId);
  const transactions = data.fundTransactions.filter(
    (transaction) =>
      transaction.fundType === "boat_maintenance" &&
      transaction.boatId === boatId,
  );
  const totals = fundTotals(transactions);
  const now = new Date().toISOString();

  return {
    id: existing?.id ?? `fund-${boatId}`,
    organizationId: data.organization.id,
    boatId,
    balance: transactions.length ? totals.balance : existing?.balance ?? 0,
    totalContributed: transactions.length
      ? totals.totalContributed
      : existing?.totalContributed ?? 0,
    totalSpent: transactions.length ? totals.totalSpent : existing?.totalSpent ?? 0,
    createdAt: existing?.createdAt ?? now,
    updatedAt: existing?.updatedAt ?? now,
  };
}

export function getSafetyFund(data: AppData): OrganizationSafetyFund {
  const existing = data.organizationSafetyFunds.find(
    (fund) => fund.organizationId === data.organization.id,
  );
  const transactions = data.fundTransactions.filter(
    (transaction) =>
      transaction.fundType === "organization_safety" &&
      transaction.organizationId === data.organization.id,
  );
  const totals = fundTotals(transactions);
  const now = new Date().toISOString();

  return {
    id: existing?.id ?? `safety-fund-${data.organization.id}`,
    organizationId: data.organization.id,
    balance: transactions.length ? totals.balance : existing?.balance ?? 0,
    totalContributed: transactions.length
      ? totals.totalContributed
      : existing?.totalContributed ?? 0,
    totalSpent: transactions.length ? totals.totalSpent : existing?.totalSpent ?? 0,
    createdAt: existing?.createdAt ?? now,
    updatedAt: existing?.updatedAt ?? now,
  };
}

export function recalculateFunds(data: AppData): AppData {
  const now = new Date().toISOString();
  const boatFunds = (data.boats?.length ? data.boats : [data.boat]).map((boat) => ({
    ...getBoatFund(data, boat.id),
    updatedAt: now,
  }));
  const safetyFund = {
    ...getSafetyFund(data),
    updatedAt: now,
  };

  return {
    ...data,
    boatMaintenanceFunds: boatFunds,
    organizationSafetyFunds: [
      safetyFund,
      ...data.organizationSafetyFunds.filter((fund) => fund.id !== safetyFund.id),
    ],
  };
}

export function transactionsForBoat(data: AppData, boatId: string) {
  return data.fundTransactions
    .filter(
      (transaction) =>
        transaction.fundType === "boat_maintenance" &&
        transaction.boatId === boatId,
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}

export function safetyTransactions(data: AppData) {
  return data.fundTransactions
    .filter(
      (transaction) =>
        transaction.fundType === "organization_safety" &&
        transaction.organizationId === data.organization.id,
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}
