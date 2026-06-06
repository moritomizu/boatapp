"use client";

import { useSyncExternalStore } from "react";
import { getInitialAppData } from "@/lib/data-source";
import { useMockData } from "@/lib/data-source";
import {
  canUseFirestore,
  getFirestoreAppData,
  saveFirestoreAppData,
} from "@/lib/firebase-repository";
import { firebaseAuth } from "@/lib/firebase";
import type { AppData } from "@/types/domain";

const STORAGE_KEY = "tapiyota-grand-boat-club:app-data:v1";
const STORE_EVENT = "tapiyota-grand-boat-club:app-data-updated";
const LAST_ORGANIZATION_KEY = "tapiyota-grand-boat-club:last-organization-id";
const LAST_BOAT_KEY = "tapiyota-grand-boat-club:last-boat-id";
const UNSELECTED_ORGANIZATION_ID = "org-unselected";
const UNSELECTED_BOAT_ID = "boat-unselected";

const isBrowser = () => typeof window !== "undefined";
const shouldUseFirestore = () => !useMockData && canUseFirestore;

let cachedRaw: string | null | undefined;
let cachedSnapshot: AppData | undefined;
let firestoreLoaded = false;
let firestoreRefreshPromise: Promise<AppData> | undefined;

function normalizeAppData(data: AppData, fallback: AppData): AppData {
  const sourceBoats = data.boats?.length
    ? data.boats
    : data.boat?.id && data.boat.id !== UNSELECTED_BOAT_ID
      ? [data.boat]
      : fallback.boats?.length
        ? fallback.boats
        : fallback.boat?.id && fallback.boat.id !== UNSELECTED_BOAT_ID
          ? [fallback.boat]
          : [];
  const storedOrganizationId = isBrowser()
    ? window.localStorage.getItem(LAST_ORGANIZATION_KEY)
    : undefined;
  const knownOrganizationIds = new Set(
    [
      data.organization?.id,
      data.currentOrganizationId,
      fallback.organization?.id,
      fallback.currentOrganizationId,
      ...sourceBoats.map((boat) => boat.organizationId),
    ].filter(
      (id): id is string =>
        Boolean(id) && id !== UNSELECTED_ORGANIZATION_ID,
    ),
  );
  const organizationId =
    (storedOrganizationId && knownOrganizationIds.has(storedOrganizationId)
      ? storedOrganizationId
      : undefined) ||
    (data.currentOrganizationId &&
    data.currentOrganizationId !== UNSELECTED_ORGANIZATION_ID
      ? data.currentOrganizationId
      : undefined) ||
    (data.organization?.id && data.organization.id !== UNSELECTED_ORGANIZATION_ID
      ? data.organization.id
      : undefined) ||
    knownOrganizationIds.values().next().value ||
    fallback.organization.id;
  const users = data.users?.length ? data.users : fallback.users;
  const authEmail = shouldUseFirestore()
    ? firebaseAuth?.currentUser?.email
    : undefined;
  const authUser = shouldUseFirestore() ? firebaseAuth?.currentUser : undefined;
  const authFallbackUser =
    authEmail && !users.some((user) => user.email === authEmail)
      ? {
          id: authUser?.uid ? `auth-${authUser.uid}` : `auth-${authEmail}`,
          organizationId,
          name: authUser?.displayName || authEmail.split("@")[0] || "ログインユーザー",
          email: authEmail,
          role: "member" as const,
          canSolo: false,
          canNightUse: false,
          notes: "Firebase Authで登録済み。管理者によるメンバー権限設定待ちです。",
          createdAt: new Date().toISOString(),
        }
      : undefined;
  const currentUser =
    users.find((user) => user.email === authEmail) ??
    authFallbackUser ??
    users.find((user) => user.id === data.currentUserId) ??
    users.find((user) => user.email === data.currentUser?.email) ??
    data.currentUser ??
    fallback.currentUser;
  const boats = sourceBoats.filter((boat) => boat.organizationId === organizationId);
  const lastBoatId = isBrowser() ? window.localStorage.getItem(LAST_BOAT_KEY) : undefined;
  const requestedBoatId = lastBoatId || data.currentBoatId || data.boat?.id;
  const selectedBoat =
    boats.find((boat) => boat.id === requestedBoatId) ??
    boats[0] ??
    (data.boat?.id !== UNSELECTED_BOAT_ID ? data.boat : undefined) ??
    fallback.boat;

  if (isBrowser()) {
    window.localStorage.setItem(LAST_ORGANIZATION_KEY, organizationId);
    window.localStorage.setItem(LAST_BOAT_KEY, selectedBoat.id);
  }

  return {
    ...fallback,
    ...data,
    organization: {
      ...fallback.organization,
      ...data.organization,
    },
    currentOrganizationId: organizationId,
    currentBoatId: selectedBoat.id,
    currentUserId: currentUser.id,
    currentUser,
    boat: selectedBoat,
    boats,
    users,
    organizationMembers:
      data.organizationMembers ?? fallback.organizationMembers ?? [],
    organizationRules:
      data.organizationRules ?? fallback.organizationRules ?? [],
    organizationInvites:
      data.organizationInvites ?? fallback.organizationInvites ?? [],
    membershipApplications:
      data.membershipApplications ?? fallback.membershipApplications ?? [],
    memberBoatPermissions:
      data.memberBoatPermissions ?? fallback.memberBoatPermissions ?? [],
    joinRequests: data.joinRequests ?? fallback.joinRequests ?? [],
    memberTripRatings: data.memberTripRatings ?? fallback.memberTripRatings ?? [],
    skillAssessments: data.skillAssessments ?? fallback.skillAssessments ?? [],
    notificationTokens: data.notificationTokens ?? fallback.notificationTokens ?? [],
  };
}

export async function selectCurrentBoat(boatId: string, fallback: AppData = getInitialAppData()) {
  if (isBrowser()) window.localStorage.setItem(LAST_BOAT_KEY, boatId);

  const current = loadClientAppData(fallback);
  const boat = (current.boats?.length ? current.boats : [current.boat]).find(
    (item) => item.id === boatId,
  );
  if (!boat) return current;

  const next = {
    ...current,
    boat,
    currentBoatId: boat.id,
    currentOrganizationId: boat.organizationId,
  };

  if (shouldUseFirestore()) {
    cachedSnapshot = next;
    if (isBrowser()) window.dispatchEvent(new Event(STORE_EVENT));
    return next;
  }

  await saveClientAppData(next);
  return next;
}

export function loadClientAppData(fallback: AppData = getInitialAppData()) {
  if (shouldUseFirestore()) return cachedSnapshot ?? fallback;
  if (!isBrowser()) return fallback;

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === cachedRaw && cachedSnapshot) return cachedSnapshot;

  cachedRaw = stored;
  if (!stored) return fallback;

  try {
    cachedSnapshot = {
      ...fallback,
      ...JSON.parse(stored),
    } as AppData;
    cachedSnapshot = normalizeAppData(cachedSnapshot, fallback);
    return cachedSnapshot;
  } catch {
    cachedSnapshot = fallback;
    return fallback;
  }
}

export async function saveClientAppData(data: AppData) {
  if (shouldUseFirestore()) {
    const previousSnapshot = cachedSnapshot;
    cachedSnapshot = data;
    if (isBrowser()) window.dispatchEvent(new Event(STORE_EVENT));
    await saveFirestoreAppData(data, previousSnapshot);
    return;
  }

  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  cachedRaw = window.localStorage.getItem(STORAGE_KEY);
  cachedSnapshot = data;
  window.dispatchEvent(new Event(STORE_EVENT));
}

export async function updateClientAppData(
  updater: (current: AppData) => AppData,
  fallback: AppData = getInitialAppData(),
) {
  const next = updater(loadClientAppData(fallback));
  await saveClientAppData(next);
  return next;
}

export async function refreshClientAppData(
  fallback: AppData = getInitialAppData(),
  options: { force?: boolean } = {},
) {
  if (!shouldUseFirestore()) return loadClientAppData(fallback);
  if (!options.force && firestoreLoaded && cachedSnapshot) return cachedSnapshot;
  if (!options.force && firestoreRefreshPromise) return firestoreRefreshPromise;

  firestoreRefreshPromise = getFirestoreAppData(fallback)
    .then((data) => {
      cachedSnapshot = normalizeAppData(data, fallback);
      firestoreLoaded = true;
      if (isBrowser()) window.dispatchEvent(new Event(STORE_EVENT));

      return data;
    })
    .catch((error) => {
      console.error("Failed to load Firestore app data", error);
      cachedSnapshot = cachedSnapshot ?? fallback;
      firestoreLoaded = true;
      if (isBrowser()) window.dispatchEvent(new Event(STORE_EVENT));

      return cachedSnapshot;
    })
    .finally(() => {
      firestoreRefreshPromise = undefined;
    });

  return firestoreRefreshPromise;
}

export function resetClientAppData() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(LAST_ORGANIZATION_KEY);
  window.localStorage.removeItem(LAST_BOAT_KEY);
  cachedRaw = null;
  cachedSnapshot = undefined;
  firestoreLoaded = false;
  firestoreRefreshPromise = undefined;
  window.dispatchEvent(new Event(STORE_EVENT));
}

export function useClientAppData(fallback: AppData = getInitialAppData()) {
  return useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener(STORE_EVENT, onStoreChange);
      window.addEventListener("storage", onStoreChange);
      void refreshClientAppData(fallback)
        .then(onStoreChange)
        .catch((error) => {
          console.error("Failed to refresh app data", error);
          onStoreChange();
        });

      return () => {
        window.removeEventListener(STORE_EVENT, onStoreChange);
        window.removeEventListener("storage", onStoreChange);
      };
    },
    () => loadClientAppData(fallback),
    () => fallback,
  );
}
