import type { Reservation } from "@/types/domain";

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
