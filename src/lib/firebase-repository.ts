"use client";

import { firebaseAuth, firestore, isFirebaseConfigured } from "@/lib/firebase";
import { mockData } from "@/lib/mock-data";
import type {
  AppData,
  AppNotification,
  AppUser,
  Boat,
  HandoverNote,
  JoinRequest,
  MaintenanceLog,
  MemberBoatPermission,
  MemberTripRating,
  NotificationPreference,
  Organization,
  PostReturnCheck,
  PreDepartureCheck,
  Reservation,
  SkillAssessment,
  SupportMessage,
  SupportRequest,
  VoyageLog,
} from "@/types/domain";

type CollectionMap = {
  organizations: Organization;
  boats: Boat;
  users: AppUser;
  memberBoatPermissions: MemberBoatPermission;
  reservations: Reservation;
  joinRequests: JoinRequest;
  preDepartureChecks: PreDepartureCheck;
  postReturnChecks: PostReturnCheck;
  handoverNotes: HandoverNote;
  supportRequests: SupportRequest;
  supportMessages: SupportMessage;
  voyageLogs: VoyageLog;
  memberTripRatings: MemberTripRating;
  skillAssessments: SkillAssessment;
  maintenanceLogs: MaintenanceLog;
  notifications: AppNotification;
  notificationPreferences: NotificationPreference;
};

const collections = [
  "organizations",
  "boats",
  "users",
  "memberBoatPermissions",
  "reservations",
  "joinRequests",
  "preDepartureChecks",
  "postReturnChecks",
  "handoverNotes",
  "supportRequests",
  "supportMessages",
  "voyageLogs",
  "memberTripRatings",
  "skillAssessments",
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
  if (rows.length === 0) return;
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

function documentIdFor<K extends keyof CollectionMap>(
  name: K,
  row: CollectionMap[K],
) {
  return name === "notificationPreferences"
    ? (row as NotificationPreference).userId
    : (row as { id: string }).id;
}

function serialized(value: unknown) {
  return JSON.stringify(removeUndefinedValues(value) ?? {});
}

function changedRows<K extends keyof CollectionMap>(
  name: K,
  nextRows: CollectionMap[K][],
  previousRows: CollectionMap[K][] = [],
) {
  const previousById = new Map(
    previousRows.map((row) => [documentIdFor(name, row), serialized(row)]),
  );

  return nextRows.filter((row) => {
    const id = documentIdFor(name, row);
    return previousById.get(id) !== serialized(row);
  });
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
    memberBoatPermissions,
    reservations,
    joinRequests,
    preDepartureChecks,
    postReturnChecks,
    handoverNotes,
    supportRequests,
    supportMessages,
    voyageLogs,
    memberTripRatings,
    skillAssessments,
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
  const resolvedBoats =
    (boats as Boat[]).length > 0
      ? (boats as Boat[])
      : fallback.boats?.length
        ? fallback.boats
        : [fallback.boat];
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
    boats: resolvedBoats,
    users: resolvedUsers,
    currentUser,
    memberBoatPermissions:
      (memberBoatPermissions as MemberBoatPermission[]).length > 0
        ? (memberBoatPermissions as MemberBoatPermission[])
        : fallback.memberBoatPermissions ?? [],
    reservations:
      (reservations as Reservation[]).length > 0
        ? (reservations as Reservation[])
        : fallback.reservations,
    joinRequests: joinRequests as JoinRequest[],
    preDepartureChecks: preDepartureChecks as PreDepartureCheck[],
    postReturnChecks: postReturnChecks as PostReturnCheck[],
    handoverNotes: handoverNotes as HandoverNote[],
    supportRequests: supportRequests as SupportRequest[],
    supportMessages: supportMessages as SupportMessage[],
    voyageLogs: voyageLogs as VoyageLog[],
    memberTripRatings: memberTripRatings as MemberTripRating[],
    skillAssessments: skillAssessments as SkillAssessment[],
    maintenanceLogs: maintenanceLogs as MaintenanceLog[],
    notifications: notifications as AppNotification[],
    notificationPreferences:
      notificationPreferences as NotificationPreference[],
  };
}

export async function saveFirestoreAppData(
  data: AppData,
  previousData?: AppData,
) {
  if (!canUseFirestore) return;

  await Promise.all([
    writeCollection(
      "organizations",
      changedRows("organizations", [data.organization], previousData ? [previousData.organization] : []),
    ),
    writeCollection(
      "boats",
      changedRows(
        "boats",
        data.boats?.length ? data.boats : [data.boat],
        previousData?.boats?.length
          ? previousData.boats
          : previousData
            ? [previousData.boat]
            : [],
      ),
    ),
    writeCollection("users", changedRows("users", data.users, previousData?.users)),
    writeCollection(
      "memberBoatPermissions",
      changedRows(
        "memberBoatPermissions",
        data.memberBoatPermissions ?? [],
        previousData?.memberBoatPermissions,
      ),
    ),
    writeCollection(
      "reservations",
      changedRows("reservations", data.reservations, previousData?.reservations),
    ),
    writeCollection(
      "joinRequests",
      changedRows("joinRequests", data.joinRequests, previousData?.joinRequests),
    ),
    writeCollection(
      "preDepartureChecks",
      changedRows(
        "preDepartureChecks",
        data.preDepartureChecks,
        previousData?.preDepartureChecks,
      ),
    ),
    writeCollection(
      "postReturnChecks",
      changedRows(
        "postReturnChecks",
        data.postReturnChecks,
        previousData?.postReturnChecks,
      ),
    ),
    writeCollection(
      "handoverNotes",
      changedRows("handoverNotes", data.handoverNotes, previousData?.handoverNotes),
    ),
    writeCollection(
      "supportRequests",
      changedRows(
        "supportRequests",
        data.supportRequests,
        previousData?.supportRequests,
      ),
    ),
    writeCollection(
      "supportMessages",
      changedRows(
        "supportMessages",
        data.supportMessages,
        previousData?.supportMessages,
      ),
    ),
    writeCollection(
      "voyageLogs",
      changedRows("voyageLogs", data.voyageLogs, previousData?.voyageLogs),
    ),
    writeCollection(
      "memberTripRatings",
      changedRows(
        "memberTripRatings",
        data.memberTripRatings,
        previousData?.memberTripRatings,
      ),
    ),
    writeCollection(
      "skillAssessments",
      changedRows(
        "skillAssessments",
        data.skillAssessments,
        previousData?.skillAssessments,
      ),
    ),
    writeCollection(
      "maintenanceLogs",
      changedRows(
        "maintenanceLogs",
        data.maintenanceLogs,
        previousData?.maintenanceLogs,
      ),
    ),
    writeCollection(
      "notifications",
      changedRows("notifications", data.notifications, previousData?.notifications),
    ),
    writeCollection(
      "notificationPreferences",
      changedRows(
        "notificationPreferences",
        data.notificationPreferences,
        previousData?.notificationPreferences,
      ),
    ),
  ]);
}
