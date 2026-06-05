"use client";

import { firebaseAuth } from "@/lib/firebase";
import type { AppUser, Boat, Reservation } from "@/types/domain";

type SyncAction = "upsert" | "cancel" | "test";

export type GoogleCalendarSyncResult = {
  ok: boolean;
  eventId?: string;
  htmlLink?: string;
  error?: string;
  message?: string;
};

export function shouldSyncReservationToGoogle(boat: Boat) {
  return Boolean(boat.googleCalendarSyncEnabled && boat.googleCalendarId);
}

export async function syncGoogleCalendar(input: {
  action: SyncAction;
  boat: Boat;
  reservation?: Reservation;
  user?: AppUser;
}): Promise<GoogleCalendarSyncResult> {
  try {
    const idToken = firebaseAuth?.currentUser
      ? await firebaseAuth.currentUser.getIdToken()
      : undefined;
    const response = await fetch("/api/google-calendar/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify(input),
    });
    const result = (await response.json().catch(() => undefined)) as
      | GoogleCalendarSyncResult
      | undefined;

    return result ?? { ok: response.ok };
  } catch (error) {
    return {
      ok: false,
      error: "network_error",
      message:
        error instanceof Error
          ? error.message
          : "Googleカレンダー同期に失敗しました。",
    };
  }
}
