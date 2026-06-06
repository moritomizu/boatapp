import type {
  NavigationSummary,
  StopCandidate,
  TrackPoint,
  VoyageLog,
} from "@/types/domain";

const earthRadiusKm = 6371;
const stoppedSpeedKmh = 1;
const stopCandidateRadiusKm = 0.03;
const stopCandidateMinMinutes = 3;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export function calculatePointDistanceKm(
  previous: Pick<TrackPoint, "latitude" | "longitude">,
  point: Pick<TrackPoint, "latitude" | "longitude">,
) {
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

  return earthRadiusKm * c;
}

export function calculateDistanceKm(points: TrackPoint[]) {
  if (points.length < 2) return 0;

  return points.slice(1).reduce((total, point, index) => {
    const previous = points[index];

    return total + calculatePointDistanceKm(previous, point);
  }, 0);
}

export function calculateSegmentSpeeds(points: TrackPoint[]) {
  if (points.length < 2) return [];

  return points.slice(1).map((point, index) => {
    const previous = points[index];
    const distanceKm = calculatePointDistanceKm(previous, point);
    const hours =
      (new Date(point.capturedAt).getTime() -
        new Date(previous.capturedAt).getTime()) /
      3600000;

    return point.speedKmh ?? (point.speed !== undefined ? point.speed * 3.6 : hours > 0 ? distanceKm / hours : 0);
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

export function shouldRecordTrackPoint(
  points: TrackPoint[],
  point: TrackPoint,
  options: { minDistanceMeters?: number; minSeconds?: number; force?: boolean } = {},
) {
  if (options.force || points.length === 0) return true;

  const previous = points[points.length - 1];
  const distanceMeters = calculatePointDistanceKm(previous, point) * 1000;
  const elapsedSeconds =
    (new Date(point.capturedAt).getTime() -
      new Date(previous.capturedAt).getTime()) /
    1000;

  return (
    distanceMeters >= (options.minDistanceMeters ?? 12) ||
    elapsedSeconds >= (options.minSeconds ?? 30)
  );
}

export function enrichTrackPointSpeed(
  points: TrackPoint[],
  point: TrackPoint,
): TrackPoint {
  if (point.speedKmh !== undefined || point.speed !== undefined || points.length === 0) {
    return {
      ...point,
      speedKmh:
        point.speedKmh ??
        (point.speed !== undefined ? Number((point.speed * 3.6).toFixed(1)) : undefined),
    };
  }

  const previous = points[points.length - 1];
  const elapsedHours =
    (new Date(point.capturedAt).getTime() -
      new Date(previous.capturedAt).getTime()) /
    3600000;
  const distanceKm = calculatePointDistanceKm(previous, point);

  return {
    ...point,
    speedKmh: elapsedHours > 0 ? Number((distanceKm / elapsedHours).toFixed(1)) : 0,
  };
}

export function calculateNavigationSummary(
  points: TrackPoint[],
  startedAt?: string,
  endedAt?: string,
): NavigationSummary {
  const departurePoint = points[0];
  const returnPoint = points[points.length - 1];
  const resolvedStartedAt = startedAt ?? departurePoint?.capturedAt;
  const resolvedEndedAt = endedAt ?? returnPoint?.capturedAt;
  const durationMinutes =
    calculateDurationMinutes(resolvedStartedAt, resolvedEndedAt) ?? 0;
  const totalDistanceKm = Number(calculateDistanceKm(points).toFixed(2));
  const segmentSpeeds = calculateSegmentSpeeds(points);
  const movingTimeMinutes = points.slice(1).reduce((total, point, index) => {
    const previous = points[index];
    const speed = segmentSpeeds[index] ?? 0;
    const minutes =
      (new Date(point.capturedAt).getTime() -
        new Date(previous.capturedAt).getTime()) /
      60000;

    return speed >= stoppedSpeedKmh ? total + Math.max(0, minutes) : total;
  }, 0);
  const stoppedTimeMinutes = Math.max(0, durationMinutes - movingTimeMinutes);

  return {
    startedAt: resolvedStartedAt,
    endedAt: resolvedEndedAt,
    durationMinutes,
    totalDistanceKm,
    movingTimeMinutes: Math.round(movingTimeMinutes),
    stoppedTimeMinutes: Math.round(stoppedTimeMinutes),
    averageSpeedKmh:
      durationMinutes > 0
        ? Number((totalDistanceKm / (durationMinutes / 60)).toFixed(1))
        : 0,
    maxSpeedKmh: Number(calculateMaxSpeedKmh(points).toFixed(1)),
    trackPointCount: points.length,
    departurePoint,
    returnPoint,
  };
}

export function detectStopCandidates(points: TrackPoint[]): StopCandidate[] {
  const candidates: StopCandidate[] = [];
  let cluster: TrackPoint[] = [];

  points.forEach((point) => {
    if (cluster.length === 0) {
      cluster = [point];
      return;
    }

    const anchor = cluster[0];
    const distanceKm = calculatePointDistanceKm(anchor, point);
    if (distanceKm <= stopCandidateRadiusKm) {
      cluster.push(point);
      return;
    }

    const candidate = createStopCandidate(cluster, candidates.length);
    if (candidate) candidates.push(candidate);
    cluster = [point];
  });

  const lastCandidate = createStopCandidate(cluster, candidates.length);
  if (lastCandidate) candidates.push(lastCandidate);

  return candidates;
}

function createStopCandidate(
  cluster: TrackPoint[],
  index: number,
): StopCandidate | undefined {
  if (cluster.length < 2) return undefined;

  const startedAt = cluster[0].capturedAt;
  const endedAt = cluster[cluster.length - 1].capturedAt;
  const durationMinutes = calculateDurationMinutes(startedAt, endedAt) ?? 0;
  if (durationMinutes < stopCandidateMinMinutes) return undefined;

  const latitude =
    cluster.reduce((total, point) => total + point.latitude, 0) / cluster.length;
  const longitude =
    cluster.reduce((total, point) => total + point.longitude, 0) / cluster.length;

  return {
    id: `stop-${index + 1}`,
    latitude,
    longitude,
    startedAt,
    endedAt,
    durationMinutes,
    pointCount: cluster.length,
  };
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
