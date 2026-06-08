import { getBoats } from "@/lib/boat-utils";
import { getReservationSessionStatus } from "@/lib/reservations";
import type {
  AppData,
  Boat,
  BoatRevenuePolicy,
  MemberSubscription,
  MonthlyBoatRevenueSummary,
  MonthlyRevenueReport,
  Reservation,
} from "@/types/domain";

export const ownershipTypeLabels = {
  sole_owner: "単独所有",
  co_owner: "共同所有",
  partner_owner: "パートナー艇",
  managed_boat: "管理委託艇",
};

export const allocationMethodLabels = {
  manual: "手動配分",
  most_used_boat: "最多利用艇帰属",
  usage_count_proration: "利用回数按分",
  usage_time_proration: "利用時間按分",
  custom: "カスタム",
};

export const reportStatusLabels = {
  draft: "下書き",
  reviewing: "確認中",
  confirmed: "確定済み",
  reopened: "再オープン",
};

export const subscriptionStatusLabels = {
  active: "有効",
  paused: "休止",
  cancelled: "解約",
  trial: "トライアル",
};

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(Math.round(value || 0));

export function currentYearMonth(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthRange(yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number);
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);

  return { start, end };
}

function isInMonth(iso: string | undefined, yearMonth: string) {
  if (!iso) return false;
  const date = new Date(iso);
  const { start, end } = monthRange(yearMonth);

  return date.getTime() >= start.getTime() && date.getTime() < end.getTime();
}

function durationHours(startAt: string, endAt: string) {
  return Math.max(
    0,
    (new Date(endAt).getTime() - new Date(startAt).getTime()) /
      (1000 * 60 * 60),
  );
}

function activeSubscriptions(data: AppData, yearMonth: string) {
  const { end } = monthRange(yearMonth);

  return data.memberSubscriptions.filter((subscription) => {
    if (subscription.organizationId !== data.organization.id) return false;
    if (subscription.status !== "active" && subscription.status !== "trial") {
      return false;
    }
    if (new Date(subscription.startedAt).getTime() >= end.getTime()) {
      return false;
    }
    if (subscription.endedAt && new Date(subscription.endedAt).getTime() < monthRange(yearMonth).start.getTime()) {
      return false;
    }

    return true;
  });
}

function completedReservations(data: AppData, yearMonth: string) {
  return data.reservations.filter((reservation) => {
    if (reservation.organizationId !== data.organization.id) return false;
    if (!isInMonth(reservation.startAt, yearMonth)) return false;
    if (reservation.deletedAt || reservation.canceledAt) return false;

    const status = getReservationSessionStatus(reservation, data);
    const hasCompletedVoyage = data.voyageLogs.some(
      (voyage) =>
        voyage.reservationId === reservation.id && voyage.status === "completed",
    );

    return status === "closed" || hasCompletedVoyage;
  });
}

function matchingVoyages(data: AppData, yearMonth: string) {
  return data.voyageLogs.filter(
    (voyage) =>
      voyage.organizationId === data.organization.id &&
      voyage.status === "completed" &&
      isInMonth(voyage.returnedAt ?? voyage.departedAt ?? voyage.updatedAt, yearMonth),
  );
}

function defaultPolicy(data: AppData, boat: Boat): BoatRevenuePolicy {
  const now = new Date().toISOString();

  return {
    id: `revenue-policy-${boat.id}`,
    organizationId: data.organization.id,
    boatId: boat.id,
    ownerReturnRate: 40,
    operationFeeRate: 30,
    maintenanceReserveRate: 20,
    localManagementRate: 10,
    allocationMethod: "manual",
    allowManualAdjustment: true,
    memo: "",
    createdAt: now,
    updatedAt: now,
  };
}

function splitByPolicy(revenue: number, policy: BoatRevenuePolicy) {
  return {
    ownerReturnAmount: Math.round((revenue * policy.ownerReturnRate) / 100),
    operationFeeAmount: Math.round((revenue * policy.operationFeeRate) / 100),
    maintenanceReserveAmount: Math.round(
      (revenue * policy.maintenanceReserveRate) / 100,
    ),
    localManagementAmount: Math.round(
      (revenue * policy.localManagementRate) / 100,
    ),
  };
}

function addAmount(map: Map<string, number>, boatId: string, amount: number) {
  map.set(boatId, (map.get(boatId) ?? 0) + amount);
}

function allocateSuggestions(
  subscriptions: MemberSubscription[],
  reservations: Reservation[],
) {
  const mostUsed = new Map<string, number>();
  const byCount = new Map<string, number>();
  const byTime = new Map<string, number>();

  subscriptions.forEach((subscription) => {
    const userReservations = reservations.filter(
      (reservation) => reservation.userId === subscription.userId,
    );
    if (userReservations.length === 0) return;

    const countByBoat = new Map<string, number>();
    const hoursByBoat = new Map<string, number>();

    userReservations.forEach((reservation) => {
      countByBoat.set(
        reservation.boatId,
        (countByBoat.get(reservation.boatId) ?? 0) + 1,
      );
      hoursByBoat.set(
        reservation.boatId,
        (hoursByBoat.get(reservation.boatId) ?? 0) +
          durationHours(reservation.startAt, reservation.endAt),
      );
    });

    const mostUsedBoatId = [...countByBoat.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0]?.[0];
    if (mostUsedBoatId) {
      addAmount(mostUsed, mostUsedBoatId, subscription.monthlyFeeSnapshot);
    }

    const totalCount = [...countByBoat.values()].reduce(
      (total, value) => total + value,
      0,
    );
    countByBoat.forEach((count, boatId) => {
      addAmount(
        byCount,
        boatId,
        totalCount > 0
          ? (subscription.monthlyFeeSnapshot * count) / totalCount
          : 0,
      );
    });

    const totalHours = [...hoursByBoat.values()].reduce(
      (total, value) => total + value,
      0,
    );
    hoursByBoat.forEach((hours, boatId) => {
      addAmount(
        byTime,
        boatId,
        totalHours > 0
          ? (subscription.monthlyFeeSnapshot * hours) / totalHours
          : 0,
      );
    });
  });

  return { mostUsed, byCount, byTime };
}

export function generateMonthlyRevenueReport(
  data: AppData,
  yearMonth: string,
  existingReport?: MonthlyRevenueReport,
): MonthlyRevenueReport {
  const now = new Date().toISOString();
  const boats = getBoats(data);
  const subscriptions = activeSubscriptions(data, yearMonth);
  const reservations = data.reservations.filter(
    (reservation) =>
      reservation.organizationId === data.organization.id &&
      isInMonth(reservation.startAt, yearMonth) &&
      !reservation.deletedAt,
  );
  const completed = completedReservations(data, yearMonth);
  const cancelled = reservations.filter((reservation) => reservation.canceledAt);
  const voyages = matchingVoyages(data, yearMonth);
  const suggestions = allocateSuggestions(subscriptions, completed);
  const existingByBoat = new Map(
    existingReport?.boatSummaries.map((summary) => [summary.boatId, summary]),
  );

  const boatSummaries: MonthlyBoatRevenueSummary[] = boats.map((boat) => {
    const boatReservations = completed.filter(
      (reservation) => reservation.boatId === boat.id,
    );
    const boatVoyages = voyages.filter((voyage) => voyage.boatId === boat.id);
    const usageHours = boatReservations.reduce(
      (total, reservation) =>
        total + durationHours(reservation.startAt, reservation.endAt),
      0,
    );
    const navigationHours = boatVoyages.reduce(
      (total, voyage) =>
        total +
        ((voyage.navigationSummary?.durationMinutes ??
          voyage.durationMinutes ??
          0) /
          60),
      0,
    );
    const navigationDistanceKm = boatVoyages.reduce(
      (total, voyage) =>
        total +
        (voyage.navigationSummary?.totalDistanceKm ?? voyage.distanceKm ?? 0),
      0,
    );
    const suggestedRevenueByMostUsedBoat = Math.round(
      suggestions.mostUsed.get(boat.id) ?? 0,
    );
    const suggestedRevenueByUsageCount = Math.round(
      suggestions.byCount.get(boat.id) ?? 0,
    );
    const suggestedRevenueByUsageTime = Math.round(
      suggestions.byTime.get(boat.id) ?? 0,
    );
    const policy =
      data.boatRevenuePolicies.find((item) => item.boatId === boat.id) ??
      defaultPolicy(data, boat);
    const existing = existingByBoat.get(boat.id);
    const finalAllocatedRevenue =
      existing?.finalAllocatedRevenue ?? suggestedRevenueByUsageCount;
    const split = splitByPolicy(finalAllocatedRevenue, policy);

    return {
      boatId: boat.id,
      boatNameSnapshot: boat.name,
      usageCount: boatReservations.length,
      usageHours: Number(usageHours.toFixed(1)),
      navigationHours: Number(navigationHours.toFixed(1)),
      navigationDistanceKm: Number(navigationDistanceKm.toFixed(1)),
      guestUseCount: boatReservations.filter(
        (reservation) => reservation.passengerCount > 1,
      ).length,
      ownerBlockedDays: existing?.ownerBlockedDays ?? 0,
      maintenanceBlockedDays: existing?.maintenanceBlockedDays ?? 0,
      cancelledCount: cancelled.filter(
        (reservation) => reservation.boatId === boat.id,
      ).length,
      weatherCancelledCount: existing?.weatherCancelledCount ?? 0,
      suggestedRevenueByMostUsedBoat,
      suggestedRevenueByUsageCount,
      suggestedRevenueByUsageTime,
      finalAllocatedRevenue,
      ownerReturnAmount: existing?.ownerReturnAmount ?? split.ownerReturnAmount,
      operationFeeAmount:
        existing?.operationFeeAmount ?? split.operationFeeAmount,
      maintenanceReserveAmount:
        existing?.maintenanceReserveAmount ?? split.maintenanceReserveAmount,
      localManagementAmount:
        existing?.localManagementAmount ?? split.localManagementAmount,
      adjustmentReason: existing?.adjustmentReason ?? "",
      adminMemo: existing?.adminMemo ?? "",
    };
  });

  return {
    id: existingReport?.id ?? `monthly-revenue-${data.organization.id}-${yearMonth}`,
    organizationId: data.organization.id,
    yearMonth,
    status: existingReport?.status ?? "draft",
    totalMembers: data.organizationMembers.filter(
      (member) => member.organizationId === data.organization.id && member.isActive,
    ).length,
    activeMembers: subscriptions.length,
    totalMembershipRevenue: subscriptions.reduce(
      (total, subscription) => total + subscription.monthlyFeeSnapshot,
      0,
    ),
    totalReservations: reservations.length,
    completedReservations: completed.length,
    cancelledReservations: cancelled.length,
    weatherCancelledReservations: existingReport?.weatherCancelledReservations ?? 0,
    totalUsageHours: Number(
      boatSummaries
        .reduce((total, summary) => total + summary.usageHours, 0)
        .toFixed(1),
    ),
    totalNavigationHours: Number(
      boatSummaries
        .reduce((total, summary) => total + (summary.navigationHours ?? 0), 0)
        .toFixed(1),
    ),
    totalNavigationDistanceKm: Number(
      boatSummaries
        .reduce(
          (total, summary) => total + (summary.navigationDistanceKm ?? 0),
          0,
        )
        .toFixed(1),
    ),
    boatSummaries,
    createdAt: existingReport?.createdAt ?? now,
    updatedAt: now,
    confirmedAt: existingReport?.confirmedAt,
    confirmedBy: existingReport?.confirmedBy,
  };
}
