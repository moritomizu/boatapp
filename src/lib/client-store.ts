"use client";

import { useSyncExternalStore } from "react";
import { getInitialAppData } from "@/lib/data-source";
import { useMockData } from "@/lib/data-source";
import {
  canUseFirestore,
  getFirestoreAppData,
  saveFirestoreAppData,
} from "@/lib/firebase-repository";
import type { AppData } from "@/types/domain";

const STORAGE_KEY = "tapiyota-grand-boat-club:app-data:v1";
const STORE_EVENT = "tapiyota-grand-boat-club:app-data-updated";
const LAST_ORGANIZATION_KEY = "tapiyota-grand-boat-club:last-organization-id";
const LAST_BOAT_KEY = "tapiyota-grand-boat-club:last-boat-id";

const isBrowser = () => typeof window !== "undefined";
const shouldUseFirestore = () => !useMockData && canUseFirestore;

let cachedRaw: string | null | undefined;
let cachedSnapshot: AppData | undefined;
let firestoreLoaded = false;
let firestoreRefreshPromise: Promise<AppData> | undefined;

function normalizeAppData(data: AppData, fallback: AppData): AppData {
  const organizations = data.organization;
  const organizationId =
    (isBrowser() && window.localStorage.getItem(LAST_ORGANIZATION_KEY)) ||
    data.currentOrganizationId ||
    organizations.id ||
    fallback.organization.id;
  const users = data.users?.length ? data.users : fallback.users;
  const currentUser =
    users.find((user) => user.id === data.currentUserId) ??
    users.find((user) => user.email === data.currentUser?.email) ??
    data.currentUser ??
    fallback.currentUser;
  const boats = (data.boats?.length ? data.boats : fallback.boats?.length ? fallback.boats : [data.boat])
    .filter((boat) => boat.organizationId === organizationId);
  const availableBoats = boats.filter((boat) => {
    if (currentUser.role === "admin" || currentUser.role === "owner") return true;
    return data.memberBoatPermissions?.some(
      (permission) =>
        permission.organizationId === organizationId &&
        permission.boatId === boat.id &&
        permission.userId === currentUser.id &&
        permission.canReserve,
    );
  });
  const lastBoatId = isBrowser() ? window.localStorage.getItem(LAST_BOAT_KEY) : undefined;
  const requestedBoatId = lastBoatId || data.currentBoatId || data.boat?.id;
  const selectedBoat =
    availableBoats.find((boat) => boat.id === requestedBoatId) ??
    availableBoats[0] ??
    boats[0] ??
    data.boat ??
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
    memberBoatPermissions:
      data.memberBoatPermissions ?? fallback.memberBoatPermissions ?? [],
    joinRequests: data.joinRequests ?? fallback.joinRequests ?? [],
    memberTripRatings: data.memberTripRatings ?? fallback.memberTripRatings ?? [],
    skillAssessments: data.skillAssessments ?? fallback.skillAssessments ?? [],
  };
}

export async function selectCurrentBoat(boatId: string, fallback: AppData = getInitialAppData()) {
  if (isBrowser()) window.localStorage.setItem(LAST_BOAT_KEY, boatId);

  return updateClientAppData(
    (current) => {
      const boat = (current.boats?.length ? current.boats : [current.boat]).find(
        (item) => item.id === boatId,
      );
      if (!boat) return current;

      return {
        ...current,
        boat,
        currentBoatId: boat.id,
        currentOrganizationId: boat.organizationId,
      };
    },
    fallback,
  );
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
) {
  if (!shouldUseFirestore()) return loadClientAppData(fallback);
  if (firestoreLoaded && cachedSnapshot) return cachedSnapshot;
  if (firestoreRefreshPromise) return firestoreRefreshPromise;

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
