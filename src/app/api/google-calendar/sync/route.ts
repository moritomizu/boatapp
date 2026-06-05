import { NextResponse } from "next/server";
import { getFirebaseAdminServices } from "@/lib/firebase-admin";
import { targetFishLabels } from "@/lib/labels";
import type { AppUser, Boat, Reservation } from "@/types/domain";

export const runtime = "nodejs";

type SyncAction = "upsert" | "cancel" | "test";

type SyncBody = {
  action?: SyncAction;
  boat?: Boat;
  reservation?: Reservation;
  user?: AppUser;
};

type GoogleEventResponse = {
  id?: string;
  htmlLink?: string;
  error?: {
    message?: string;
  };
};

const tokenEndpoint = "https://oauth2.googleapis.com/token";
const calendarEndpoint = "https://www.googleapis.com/calendar/v3/calendars";

function calendarConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN,
  );
}

async function verifyRequest(request: Request) {
  const admin = getFirebaseAdminServices();
  if (!admin) return true;

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";
  if (!token) return false;

  try {
    await admin.auth.verifyIdToken(token);
    return true;
  } catch {
    return false;
  }
}

async function accessToken() {
  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN ?? "",
      grant_type: "refresh_token",
    }),
  });

  const result = (await response.json()) as { access_token?: string; error_description?: string };
  if (!response.ok || !result.access_token) {
    throw new Error(result.error_description || "Google OAuthトークンを取得できませんでした。");
  }

  return result.access_token;
}

function eventTitle(boat: Boat, reservation: Reservation, user: AppUser, canceled = false) {
  const prefix = canceled ? "【キャンセル】【BoatOS】" : "【BoatOS】";
  return `${prefix}${boat.name}｜${targetFishLabels[reservation.targetFish]}便｜${user.name}`;
}

function eventDescription(boat: Boat, reservation: Reservation, user: AppUser, canceled = false) {
  return [
    canceled ? "この予約はBoatOSでキャンセルされました。" : undefined,
    "この予定はBoatOSから自動作成されました。",
    "",
    `船名: ${boat.name}`,
    `予約者: ${user.name}`,
    `利用日時: ${reservation.startAt} - ${reservation.endAt}`,
    `釣りもの: ${targetFishLabels[reservation.targetFish]}`,
    `行き先エリア: ${reservation.destinationArea}`,
    `同乗予定人数: ${reservation.passengerCount}`,
    `空き席数: ${reservation.availableSeats}`,
    `便乗歓迎: ${reservation.joinAllowed ? "true" : "false"}`,
    `コメント: ${reservation.comment || "なし"}`,
    `BoatOS予約ID: ${reservation.id}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function googleEvent(boat: Boat, reservation: Reservation, user: AppUser, canceled = false) {
  return {
    summary: eventTitle(boat, reservation, user, canceled),
    description: eventDescription(boat, reservation, user, canceled),
    location: reservation.destinationArea,
    start: {
      dateTime: reservation.startAt,
      timeZone: "Asia/Tokyo",
    },
    end: {
      dateTime: reservation.endAt,
      timeZone: "Asia/Tokyo",
    },
  };
}

async function googleRequest({
  method,
  calendarId,
  eventId,
  body,
}: {
  method: "POST" | "PUT" | "PATCH";
  calendarId: string;
  eventId?: string;
  body: unknown;
}) {
  const token = await accessToken();
  const encodedCalendarId = encodeURIComponent(calendarId);
  const url = eventId
    ? `${calendarEndpoint}/${encodedCalendarId}/events/${encodeURIComponent(eventId)}`
    : `${calendarEndpoint}/${encodedCalendarId}/events`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const result = (await response.json()) as GoogleEventResponse;

  if (!response.ok) {
    throw new Error(result.error?.message || "Google Calendar APIへの同期に失敗しました。");
  }

  return result;
}

async function upsertEvent(boat: Boat, reservation: Reservation, user: AppUser) {
  if (!boat.googleCalendarId) {
    throw new Error("GoogleカレンダーIDが設定されていません。");
  }

  const event = googleEvent(boat, reservation, user);
  if (reservation.googleEventId) {
    return googleRequest({
      method: "PUT",
      calendarId: boat.googleCalendarId,
      eventId: reservation.googleEventId,
      body: event,
    });
  }

  return googleRequest({
    method: "POST",
    calendarId: boat.googleCalendarId,
    body: event,
  });
}

async function cancelEvent(boat: Boat, reservation: Reservation, user: AppUser) {
  if (!boat.googleCalendarId) {
    throw new Error("GoogleカレンダーIDが設定されていません。");
  }

  if (!reservation.googleEventId) {
    return upsertEvent(boat, reservation, user);
  }

  return googleRequest({
    method: "PATCH",
    calendarId: boat.googleCalendarId,
    eventId: reservation.googleEventId,
    body: googleEvent(boat, reservation, user, true),
  });
}

async function testEvent(boat: Boat) {
  if (!boat.googleCalendarId) {
    throw new Error("GoogleカレンダーIDが設定されていません。");
  }
  const now = new Date();
  const end = new Date(now.getTime() + 30 * 60 * 1000);

  return googleRequest({
    method: "POST",
    calendarId: boat.googleCalendarId,
    body: {
      summary: `【BoatOSテスト】${boat.name}`,
      description: "BoatOSのGoogleカレンダー連携テストイベントです。",
      start: { dateTime: now.toISOString(), timeZone: "Asia/Tokyo" },
      end: { dateTime: end.toISOString(), timeZone: "Asia/Tokyo" },
    },
  });
}

export async function POST(request: Request) {
  if (!(await verifyRequest(request))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!calendarConfigured()) {
    return NextResponse.json({
      ok: false,
      error: "google_oauth_not_configured",
      message:
        "GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET、GOOGLE_REFRESH_TOKENを設定してください。",
    });
  }

  const body = (await request.json()) as SyncBody;
  if (!body.action || !body.boat) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  try {
    const result =
      body.action === "test"
        ? await testEvent(body.boat)
        : body.action === "cancel" && body.reservation && body.user
          ? await cancelEvent(body.boat, body.reservation, body.user)
          : body.action === "upsert" && body.reservation && body.user
            ? await upsertEvent(body.boat, body.reservation, body.user)
            : undefined;

    if (!result) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      eventId: result.id,
      htmlLink: result.htmlLink,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: "google_calendar_sync_failed",
      message:
        error instanceof Error
          ? error.message
          : "Googleカレンダー同期に失敗しました。",
    });
  }
}
