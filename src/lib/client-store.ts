"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { getInitialAppData } from "@/lib/data-source";
import { useMockData } from "@/lib/data-source";
import {
  canUseFirestore,
  getFirestoreAppData,
  saveFirestoreAppData,
} from "@/lib/firebase-repository";
import { firebaseAuth } from "@/lib/firebase";
import { isBootstrapAdminEmail, normalizeEmail } from "@/lib/bootstrap-admin";
import type { AppData, AppNotification, AppUser, UserRole } from "@/types/domain";

const STORAGE_KEY = "tapiyota-grand-boat-club:app-data:v1";
const STORE_EVENT = "tapiyota-grand-boat-club:app-data-updated";
const LAST_ORGANIZATION_KEY = "tapiyota-grand-boat-club:last-organization-id";
const LAST_BOAT_KEY = "tapiyota-grand-boat-club:last-boat-id";
const AUTH_UID_KEY = "tapiyota-grand-boat-club:auth-uid";
const AUTH_EMAIL_KEY = "tapiyota-grand-boat-club:auth-email";
const AUTH_NAME_KEY = "tapiyota-grand-boat-club:auth-name";
const UNSELECTED_ORGANIZATION_ID = "org-unselected";
const UNSELECTED_BOAT_ID = "boat-unselected";

const isBrowser = () => typeof window !== "undefined";
const shouldUseFirestore = () => !useMockData && canUseFirestore;

let cachedRaw: string | null | undefined;
let cachedSnapshot: AppData | undefined;
let firestoreLoaded = false;
let firestoreRefreshPromise: Promise<AppData> | undefined;

function storedAuthIdentity() {
  if (!isBrowser()) return {};

  return {
    uid: window.localStorage.getItem(AUTH_UID_KEY) ?? undefined,
    email: window.localStorage.getItem(AUTH_EMAIL_KEY) ?? undefined,
    name: window.localStorage.getItem(AUTH_NAME_KEY) ?? undefined,
  };
}

function completeUser(
  user: AppUser,
  options: {
    organizationId: string;
    authEmail?: string | null;
    authName?: string | null;
  },
): AppUser {
  const email = user.email || options.authEmail || "";
  const name =
    user.name ||
    options.authName ||
    email.split("@")[0] ||
    "ログインユーザー";

  return {
    ...user,
    organizationId: user.organizationId || options.organizationId,
    name,
    email,
    role: user.role ?? "member",
    canSolo: Boolean(user.canSolo),
    canNightUse: Boolean(user.canNightUse),
    notes: user.notes ?? "",
    createdAt: user.createdAt || new Date().toISOString(),
  };
}

function completeNotification(
  notification: Partial<AppNotification>,
  fallback: { organizationId: string; boatId: string },
): AppNotification {
  return {
    id: notification.id || `notification-${crypto.randomUUID()}`,
    organizationId: notification.organizationId || fallback.organizationId,
    boatId: notification.boatId || fallback.boatId,
    category: notification.category ?? "support",
    priority: notification.priority ?? "normal",
    title: notification.title || "通知",
    body: notification.body || "",
    relatedPath: notification.relatedPath || "/notifications",
    recipientUserIds: Array.isArray(notification.recipientUserIds)
      ? notification.recipientUserIds
      : undefined,
    readBy: Array.isArray(notification.readBy) ? notification.readBy : [],
    createdAt: notification.createdAt || new Date().toISOString(),
  };
}

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
  const rawUsers = data.users?.length ? data.users : fallback.users;
  const organizationMembers =
    data.organizationMembers ?? fallback.organizationMembers ?? [];
  const membershipApplications =
    data.membershipApplications ?? fallback.membershipApplications ?? [];
  const authUser = shouldUseFirestore() ? firebaseAuth?.currentUser : undefined;
  const storedAuth = shouldUseFirestore() ? storedAuthIdentity() : {};
  const authEmail = authUser?.email ?? storedAuth.email;
  const normalizedAuthEmail = normalizeEmail(authEmail);
  const authUid = authUser?.uid ?? storedAuth.uid;
  const authName = authUser?.displayName ?? storedAuth.name;
  const matchedMember = normalizedAuthEmail
    ? organizationMembers.find(
        (member) =>
          member.isActive &&
          member.organizationId === organizationId &&
          normalizeEmail(member.email) === normalizedAuthEmail,
      )
    : undefined;
  const approvedApplication = normalizedAuthEmail
    ? membershipApplications
        .filter(
          (application) =>
            application.status === "approved" &&
            normalizeEmail(application.profile.email) === normalizedAuthEmail,
        )
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )[0]
    : undefined;
  const isBootstrapAdmin = isBootstrapAdminEmail(authEmail);
  const fallbackRole: UserRole =
    isBootstrapAdmin
      ? "admin"
      : matchedMember?.role ??
    (approvedApplication?.approvedRole as UserRole | undefined) ??
    "member";
  const fallbackCanOperate = fallbackRole === "admin" || fallbackRole === "owner";
  const users = rawUsers.map((user) =>
    completeUser(user, {
      organizationId,
      authEmail: normalizeEmail(user.email) === normalizedAuthEmail ? authEmail : undefined,
      authName: normalizeEmail(user.email) === normalizedAuthEmail ? authName : undefined,
    }),
  );
  const matchedUser = normalizedAuthEmail
    ? users.find((user) => normalizeEmail(user.email) === normalizedAuthEmail)
    : undefined;
  const roleFromMembership =
    isBootstrapAdmin ? "admin" : matchedMember?.role;
  const resolvedMatchedUser: AppUser | undefined = matchedUser
    ? {
        ...matchedUser,
        role: roleFromMembership ?? matchedUser.role,
        canSolo:
          matchedUser.canSolo ||
          roleFromMembership === "admin" ||
          roleFromMembership === "owner",
        canNightUse:
          matchedUser.canNightUse ||
          roleFromMembership === "admin" ||
          roleFromMembership === "owner",
      }
    : undefined;
  const authFallbackUser: AppUser | undefined =
    authEmail && !matchedUser
      ? {
          id:
            matchedMember?.userId ??
            approvedApplication?.userId ??
            (authUid ? `auth-${authUid}` : `auth-${normalizedAuthEmail}`),
          organizationId,
          name:
            matchedMember?.displayName ||
            approvedApplication?.profile.name ||
            authName ||
            authEmail.split("@")[0] ||
            "ログインユーザー",
          email: authEmail,
          role: fallbackRole,
          canSolo: fallbackCanOperate,
          canNightUse: fallbackCanOperate,
          notes:
            fallbackRole === "admin"
              ? "Bootstrap adminとして復旧しました。Firestoreのusers/organizationMembersにも同じメールを登録してください。"
              : "Firebase Authで登録済み。管理者によるメンバー権限設定待ちです。",
          createdAt: new Date().toISOString(),
        }
      : undefined;
  const resolvedCurrentUser =
    authEmail || authUid
      ? resolvedMatchedUser ??
        users.find((user) => authUid && user.id === `auth-${authUid}`) ??
        authFallbackUser ??
        fallback.currentUser
      : users.find((user) => user.id === data.currentUserId) ??
        users.find(
          (user) =>
            normalizeEmail(user.email) === normalizeEmail(data.currentUser?.email),
        ) ??
        data.currentUser ??
        fallback.currentUser;
  const currentUser = completeUser(resolvedCurrentUser, {
    organizationId,
    authEmail,
    authName,
  });
  const boats = sourceBoats.filter((boat) => boat.organizationId === organizationId);
  const lastBoatId = isBrowser() ? window.localStorage.getItem(LAST_BOAT_KEY) : undefined;
  const requestedBoatId = lastBoatId || data.currentBoatId || data.boat?.id;
  const selectedBoat =
    boats.find((boat) => boat.id === requestedBoatId) ??
    boats[0] ??
    (data.boat?.id !== UNSELECTED_BOAT_ID ? data.boat : undefined) ??
    fallback.boat;
  const notifications = (data.notifications ?? fallback.notifications ?? []).map(
    (notification) =>
      completeNotification(notification, {
        organizationId,
        boatId: selectedBoat.id,
      }),
  );

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
    organizationMembers,
    organizationRules:
      data.organizationRules ?? fallback.organizationRules ?? [],
    organizationInvites:
      data.organizationInvites ?? fallback.organizationInvites ?? [],
    membershipApplications,
    boatOwnerships:
      data.boatOwnerships ?? fallback.boatOwnerships ?? [],
    membershipPlans:
      data.membershipPlans ?? fallback.membershipPlans ?? [],
    memberSubscriptions:
      data.memberSubscriptions ?? fallback.memberSubscriptions ?? [],
    boatRevenuePolicies:
      data.boatRevenuePolicies ?? fallback.boatRevenuePolicies ?? [],
    monthlyRevenueReports:
      data.monthlyRevenueReports ?? fallback.monthlyRevenueReports ?? [],
    boatMaintenanceFunds:
      data.boatMaintenanceFunds ?? fallback.boatMaintenanceFunds ?? [],
    organizationSafetyFunds:
      data.organizationSafetyFunds ?? fallback.organizationSafetyFunds ?? [],
    fundTransactions:
      data.fundTransactions ?? fallback.fundTransactions ?? [],
    memberBoatPermissions:
      data.memberBoatPermissions ?? fallback.memberBoatPermissions ?? [],
    joinRequests: data.joinRequests ?? fallback.joinRequests ?? [],
    memberTripRatings: data.memberTripRatings ?? fallback.memberTripRatings ?? [],
    skillAssessments: data.skillAssessments ?? fallback.skillAssessments ?? [],
    notifications,
    notificationPreferences:
      data.notificationPreferences ?? fallback.notificationPreferences ?? [],
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
  if (shouldUseFirestore()) {
    if (cachedSnapshot) return cachedSnapshot;
    cachedSnapshot = normalizeAppData(fallback, fallback);
    return cachedSnapshot;
  }
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
      cachedSnapshot = normalizeAppData(cachedSnapshot ?? fallback, fallback);
      firestoreLoaded = true;
      if (isBrowser()) window.dispatchEvent(new Event(STORE_EVENT));

      return cachedSnapshot;
    })
    .finally(() => {
      firestoreRefreshPromise = undefined;
    });

  return firestoreRefreshPromise;
}

export function rememberAuthenticatedUser(user: {
  uid?: string | null;
  email?: string | null;
  displayName?: string | null;
}) {
  if (!isBrowser()) return;
  if (user.uid) window.localStorage.setItem(AUTH_UID_KEY, user.uid);
  if (user.email) window.localStorage.setItem(AUTH_EMAIL_KEY, user.email);
  if (user.displayName) window.localStorage.setItem(AUTH_NAME_KEY, user.displayName);
  cachedRaw = null;
  cachedSnapshot = undefined;
  firestoreLoaded = false;
  firestoreRefreshPromise = undefined;
  window.dispatchEvent(new Event(STORE_EVENT));
}

export function resetClientAppData() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(LAST_ORGANIZATION_KEY);
  window.localStorage.removeItem(LAST_BOAT_KEY);
  window.localStorage.removeItem(AUTH_UID_KEY);
  window.localStorage.removeItem(AUTH_EMAIL_KEY);
  window.localStorage.removeItem(AUTH_NAME_KEY);
  cachedRaw = null;
  cachedSnapshot = undefined;
  firestoreLoaded = false;
  firestoreRefreshPromise = undefined;
  window.dispatchEvent(new Event(STORE_EVENT));
}

export function useClientAppData(fallback: AppData = getInitialAppData()) {
  const [stableFallback] = useState(fallback);
  const subscribe = useCallback((onStoreChange: () => void) => {
      window.addEventListener(STORE_EVENT, onStoreChange);
      window.addEventListener("storage", onStoreChange);

      return () => {
        window.removeEventListener(STORE_EVENT, onStoreChange);
        window.removeEventListener("storage", onStoreChange);
      };
  }, []);
  const getSnapshot = useCallback(
    () => loadClientAppData(stableFallback),
    [stableFallback],
  );
  const getServerSnapshot = useCallback(() => stableFallback, [stableFallback]);

  useEffect(() => {
    void refreshClientAppData(stableFallback).catch((error) => {
      console.error("Failed to refresh app data", error);
    });
  }, [stableFallback]);

  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
}
