import type { TrackPoint, VoyageLog } from "@/types/domain";

const earthRadiusKm = 6371;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export function calculateDistanceKm(points: TrackPoint[]) {
  if (points.length < 2) return 0;

  return points.slice(1).reduce((total, point, index) => {
    const previous = points[index];
    const latDiff = toRadians(point.latitude - previous.latitude);
    const lonDiff = toRadians(point.longitude - previous.longitude);
    const previousLat = toRadians(previous.latitude);
    const currentLat = toRadians(point.latitude);
    const a =
      Math.sin(latDiff / 2) ** 2 +
      Math.cos(previousLat) *
        Math.cos(currentLat) *
        Math.sin(lonDiff / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return total + earthRadiusKm * c;
  }, 0);
}

export function calculateSegmentSpeeds(points: TrackPoint[]) {
  if (points.length < 2) return [];

  return points.slice(1).map((point, index) => {
    const previous = points[index];
    const distanceKm = calculateDistanceKm([previous, point]);
    const hours =
      (new Date(point.capturedAt).getTime() -
        new Date(previous.capturedAt).getTime()) /
      3600000;

    return hours > 0 ? distanceKm / hours : 0;
  });
}

export function calculateAverageSpeedKmh(
  distanceKm?: number,
  durationMinutes?: number,
) {
  if (!distanceKm || !durationMinutes) return 0;

  return distanceKm / (durationMinutes / 60);
}

export function calculateMaxSpeedKmh(points: TrackPoint[]) {
  const speeds = calculateSegmentSpeeds(points);

  return speeds.length > 0 ? Math.max(...speeds) : 0;
}

export function calculateDurationMinutes(startAt?: string, endAt?: string) {
  if (!startAt || !endAt) return undefined;

  const durationMs = new Date(endAt).getTime() - new Date(startAt).getTime();

  return Math.max(0, Math.round(durationMs / 60000));
}

export function createVoyageLog(
  voyage: Omit<VoyageLog, "id" | "createdAt" | "updatedAt">,
): VoyageLog {
  const now = new Date().toISOString();

  return {
    ...voyage,
    id: `voyage-${crypto.randomUUID()}`,
    createdAt: now,
    updatedAt: now,
  };
}

export function formatDuration(minutes?: number) {
  if (minutes === undefined) return "-";

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${remainingMinutes}分`;

  return `${hours}時間${remainingMinutes}分`;
}
