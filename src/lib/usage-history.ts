import { findBoat, getBoats } from "@/lib/boat-utils";
import { getReservationSessionStatus, isReservationActiveForBooking } from "@/lib/reservations";
import type { AppData, Reservation } from "@/types/domain";

export type UsageHistoryEntry = {
  reservation: Reservation;
  boatName: string;
  departedAt?: string;
  returnedAt?: string;
  durationMinutes: number;
  sessionStatus: string;
  preCheckDone: boolean;
  postCheckDone: boolean;
  supportCount: number;
  handoverCount: number;
  hasVoyageLog: boolean;
  voyageId?: string;
  memo: string;
};

export type UsageSummary = {
  thisMonthCount: number;
  totalCount: number;
  totalHours: number;
  nightUseCount: number;
  boatCount: number;
  preCheckRate: number;
  postCheckRate: number;
  supportCreatedCount: number;
  supportAnsweredCount: number;
  handoverCreatedCount: number;
};

export function getOrganizationRule(data: AppData) {
  return (
    data.organizationRules.find(
      (rule) => rule.organizationId === data.organization.id,
    ) ?? {
      id: `rules-${data.organization.id}`,
      organizationId: data.organization.id,
      monthlyReservationLimit: 3,
      standardUsageHours: 4,
      bookingWindowDays: 60,
      allowNightUse: false,
      allowSoloUse: true,
      allowJoinRequests: true,
      allowGuestOnBoard: true,
      requirePreDepartureCheck: true,
      requirePostReturnCheck: true,
      requireFullFuelReturn: true,
      strictLimit: false,
      ruleText: "",
      notes: "",
      emergencyContact: "",
      createdAt: "1970-01-01T00:00:00.000Z",
      updatedAt: "1970-01-01T00:00:00.000Z",
    }
  );
}

export function isSameMonth(value: string, base = new Date()) {
  const date = new Date(value);
  return (
    date.getFullYear() === base.getFullYear() &&
    date.getMonth() === base.getMonth()
  );
}

function minutesBetween(startAt: string, endAt: string) {
  return Math.max(
    0,
    Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000),
  );
}

function isNightReservation(reservation: Reservation) {
  const start = new Date(reservation.startAt).getHours();
  const end = new Date(reservation.endAt).getHours();
  return start < 6 || start >= 18 || end >= 18 || end < 6;
}

export function getUserUsageEntries(data: AppData, userId: string) {
  return data.reservations
    .filter((reservation) => reservation.userId === userId)
    .filter((reservation) => !reservation.deletedAt && !reservation.canceledAt)
    .sort(
      (a, b) =>
        new Date(b.startAt).getTime() - new Date(a.startAt).getTime(),
    )
    .map((reservation) => {
      const voyage = data.voyageLogs.find(
        (item) => item.reservationId === reservation.id,
      );
      const preCheckDone = data.preDepartureChecks.some(
        (item) => item.reservationId === reservation.id,
      );
      const postCheckDone = data.postReturnChecks.some(
        (item) => item.reservationId === reservation.id,
      );
      const supportCount = data.supportRequests.filter(
        (item) => item.reservationId === reservation.id,
      ).length;
      const handoverCount = data.handoverNotes.filter(
        (item) => item.reservationId === reservation.id,
      ).length;

      return {
        reservation,
        boatName: findBoat(data, reservation.boatId).name,
        departedAt: voyage?.departedAt,
        returnedAt: voyage?.returnedAt,
        durationMinutes:
          voyage?.durationMinutes ??
          minutesBetween(reservation.startAt, reservation.endAt),
        sessionStatus: getReservationSessionStatus(reservation, data),
        preCheckDone,
        postCheckDone,
        supportCount,
        handoverCount,
        hasVoyageLog: Boolean(voyage),
        voyageId: voyage?.id,
        memo: voyage?.memo || reservation.comment,
      } satisfies UsageHistoryEntry;
    });
}

export function getUserUsageSummary(data: AppData, userId: string): UsageSummary {
  const entries = getUserUsageEntries(data, userId);
  const completedEntries = entries.filter(
    (entry) =>
      entry.sessionStatus === "returned" ||
      entry.sessionStatus === "closed" ||
      entry.hasVoyageLog,
  );
  const denominator = entries.length || 1;

  return {
    thisMonthCount: entries.filter((entry) =>
      isSameMonth(entry.reservation.startAt),
    ).length,
    totalCount: entries.length,
    totalHours:
      completedEntries.reduce(
        (total, entry) => total + entry.durationMinutes,
        0,
      ) / 60,
    nightUseCount: entries.filter((entry) => isNightReservation(entry.reservation))
      .length,
    boatCount: new Set(entries.map((entry) => entry.reservation.boatId)).size,
    preCheckRate:
      (entries.filter((entry) => entry.preCheckDone).length / denominator) * 100,
    postCheckRate:
      (entries.filter((entry) => entry.postCheckDone).length / denominator) * 100,
    supportCreatedCount: data.supportRequests.filter(
      (item) => item.createdBy === userId,
    ).length,
    supportAnsweredCount: data.supportMessages.filter(
      (item) => item.createdBy === userId,
    ).length,
    handoverCreatedCount: data.handoverNotes.filter(
      (item) => item.createdBy === userId,
    ).length,
  };
}

export function getMonthlyReservationUsage(
  data: AppData,
  userId: string,
  baseDate: string,
) {
  const base = new Date(baseDate);
  const reservations = data.reservations
    .filter((reservation) => reservation.userId === userId)
    .filter(isReservationActiveForBooking)
    .filter((reservation) => isSameMonth(reservation.startAt, base));
  const rule = getOrganizationRule(data);
  const used = reservations.length;
  const limit = rule.monthlyReservationLimit;

  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    exceeds: limit > 0 && used >= limit,
    strictLimit: Boolean(rule.strictLimit),
  };
}

export function getUsableBoatNames(data: AppData, userId: string) {
  const boats = getBoats(data);
  return boats
    .filter((boat) =>
      data.memberBoatPermissions.some(
        (permission) =>
          permission.userId === userId &&
          permission.boatId === boat.id &&
          permission.canReserve,
      ),
    )
    .map((boat) => boat.name);
}
