"use client";

import { firebaseAuth, firestore, isFirebaseConfigured } from "@/lib/firebase";
import { mockData } from "@/lib/mock-data";
import type {
  AppData,
  AppNotification,
  AppUser,
  Boat,
  HandoverNote,
  MaintenanceLog,
  NotificationPreference,
  Organization,
  PostReturnCheck,
  PreDepartureCheck,
  Reservation,
  SupportMessage,
  SupportRequest,
} from "@/types/domain";

type CollectionMap = {
  organizations: Organization;
  boats: Boat;
  users: AppUser;
  reservations: Reservation;
  preDepartureChecks: PreDepartureCheck;
  postReturnChecks: PostReturnCheck;
  handoverNotes: HandoverNote;
  supportRequests: SupportRequest;
  supportMessages: SupportMessage;
  maintenanceLogs: MaintenanceLog;
  notifications: AppNotification;
  notificationPreferences: NotificationPreference;
};

const collections = [
  "organizations",
  "boats",
  "users",
  "reservations",
  "preDepartureChecks",
  "postReturnChecks",
  "handoverNotes",
  "supportRequests",
  "supportMessages",
  "maintenanceLogs",
  "notifications",
  "notificationPreferences",
] as const;

export const canUseFirestore =
  isFirebaseConfigured && Boolean(firestore);

type FirestoreValue =
  | string
  | number
  | boolean
  | null
  | FirestoreValue[]
  | { [key: string]: FirestoreValue };

function removeUndefinedValues(value: unknown): FirestoreValue | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) {
    return value
      .map((item) => removeUndefinedValues(item))
      .filter((item): item is FirestoreValue => item !== undefined);
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => [key, removeUndefinedValues(item)] as const)
        .filter((entry): entry is readonly [string, FirestoreValue] => {
          return entry[1] !== undefined;
        }),
    ) as { [key: string]: FirestoreValue };
  }

  return value as FirestoreValue;
}

async function readCollection<K extends keyof CollectionMap>(name: K) {
  if (!firestore) return [];

  const { collection, getDocs } = await import("firebase/firestore");
  const snapshot = await getDocs(collection(firestore, name));

  return snapshot.docs.map((document) => document.data() as CollectionMap[K]);
}

async function getCurrentAuthEmail() {
  const auth = firebaseAuth;
  if (!auth) return undefined;
  if (auth.currentUser?.email) return auth.currentUser.email;

  const { onAuthStateChanged } = await import("firebase/auth");

  return new Promise<string | undefined>((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user?.email ?? undefined);
    });
    window.setTimeout(() => {
      unsubscribe();
      resolve(undefined);
    }, 1200);
  });
}

async function writeCollection<K extends keyof CollectionMap>(
  name: K,
  rows: CollectionMap[K][],
) {
  if (!firestore) return;
  const db = firestore;

  const { doc, writeBatch } = await import("firebase/firestore");
  const batch = writeBatch(db);

  rows.forEach((row) => {
    const id =
      name === "notificationPreferences"
        ? (row as NotificationPreference).userId
        : (row as { id: string }).id;
    batch.set(
      doc(db, name, id),
      (removeUndefinedValues(row) ?? {}) as { [key: string]: FirestoreValue },
    );
  });

  await batch.commit();
}

export async function deleteFirestoreDocument(
  name: keyof CollectionMap,
  id: string,
) {
  if (!firestore) return;

  const { deleteDoc, doc } = await import("firebase/firestore");
  await deleteDoc(doc(firestore, name, id));
}

export async function getFirestoreAppData(fallback: AppData = mockData) {
  if (!canUseFirestore) return fallback;

  const [
    organizations,
    boats,
    users,
    reservations,
    preDepartureChecks,
    postReturnChecks,
    handoverNotes,
    supportRequests,
    supportMessages,
    maintenanceLogs,
    notifications,
    notificationPreferences,
  ] = await Promise.all(collections.map((name) => readCollection(name)));

  const organization =
    (organizations as Organization[]).find(
      (item) => item.id === fallback.organization.id,
    ) ??
    (organizations as Organization[])[0] ??
    fallback.organization;
  const boat =
    (boats as Boat[]).find((item) => item.id === fallback.boat.id) ??
    (boats as Boat[])[0] ??
    fallback.boat;
  const resolvedUsers =
    (users as AppUser[]).length > 0 ? (users as AppUser[]) : fallback.users;
  const authEmail = await getCurrentAuthEmail();
  const currentUser =
    resolvedUsers.find((user) => user.email === authEmail) ??
    resolvedUsers.find((user) => user.role === "admin") ??
    fallback.currentUser;

  return {
    organization,
    boat,
    users: resolvedUsers,
    currentUser,
    reservations:
      (reservations as Reservation[]).length > 0
        ? (reservations as Reservation[])
        : fallback.reservations,
    preDepartureChecks: preDepartureChecks as PreDepartureCheck[],
    postReturnChecks: postReturnChecks as PostReturnCheck[],
    handoverNotes: handoverNotes as HandoverNote[],
    supportRequests: supportRequests as SupportRequest[],
    supportMessages: supportMessages as SupportMessage[],
    maintenanceLogs: maintenanceLogs as MaintenanceLog[],
    notifications: notifications as AppNotification[],
    notificationPreferences:
      notificationPreferences as NotificationPreference[],
  };
}

export async function saveFirestoreAppData(data: AppData) {
  if (!canUseFirestore) return;

  await Promise.all([
    writeCollection("organizations", [data.organization]),
    writeCollection("boats", [data.boat]),
    writeCollection("users", data.users),
    writeCollection("reservations", data.reservations),
    writeCollection("preDepartureChecks", data.preDepartureChecks),
    writeCollection("postReturnChecks", data.postReturnChecks),
    writeCollection("handoverNotes", data.handoverNotes),
    writeCollection("supportRequests", data.supportRequests),
    writeCollection("supportMessages", data.supportMessages),
    writeCollection("maintenanceLogs", data.maintenanceLogs),
    writeCollection("notifications", data.notifications),
    writeCollection("notificationPreferences", data.notificationPreferences),
  ]);
}
