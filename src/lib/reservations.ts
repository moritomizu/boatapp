import type { AppData, Reservation, ReservationSessionStatus } from "@/types/domain";

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(new Date(iso));

export const formatTime = (iso: string) =>
  new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

export const isSameDay = (a: string, b: string) => {
  const left = new Date(a);
  const right = new Date(b);

  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
};

export const hasTimeOverlap = (
  current: Pick<Reservation, "id" | "startAt" | "endAt">,
  reservations: Reservation[],
) => {
  const start = new Date(current.startAt).getTime();
  const end = new Date(current.endAt).getTime();

  return reservations.some((reservation) => {
    if (reservation.id === current.id) {
      return false;
    }

    const otherStart = new Date(reservation.startAt).getTime();
    const otherEnd = new Date(reservation.endAt).getTime();

    return start < otherEnd && otherStart < end;
  });
};

export const findNextReservation = (reservations: Reservation[]) => {
  const now = Date.now();

  return [...reservations]
    .filter((reservation) => new Date(reservation.startAt).getTime() >= now)
    .sort(
      (a, b) =>
        new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    )[0];
};

export const getReservationSessionStatus = (
  reservation: Reservation,
  data: Pick<
    AppData,
    "preDepartureChecks" | "postReturnChecks" | "voyageLogs"
  >,
): ReservationSessionStatus => {
  if (reservation.sessionStatus) return reservation.sessionStatus;

  const postCheckDone = data.postReturnChecks.some(
    (check) => check.reservationId === reservation.id,
  );
  if (postCheckDone) return "returned";

  const voyage = data.voyageLogs.find(
    (item) => item.reservationId === reservation.id,
  );
  if (voyage?.status === "underway" || voyage?.status === "completed") {
    return "underway";
  }

  const preCheckDone = data.preDepartureChecks.some(
    (check) => check.reservationId === reservation.id,
  );
  if (preCheckDone) return "pre_checked";

  return "scheduled";
};

export const withReservationSessionStatus = (
  reservation: Reservation,
  sessionStatus: ReservationSessionStatus,
): Reservation => ({
  ...reservation,
  sessionStatus,
  updatedAt: new Date().toISOString(),
});
