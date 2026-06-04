import { mockData } from "@/lib/mock-data";
import type { AppData } from "@/types/domain";

export const useMockData =
  process.env.NEXT_PUBLIC_DATA_SOURCE !== "firebase" ||
  process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

export const getInitialAppData = () => {
  if (useMockData) return mockData;

  return emptyData;
};

const emptyData: AppData = {
  organization: {
    id: "org-unselected",
    name: "TaPiYoTa Grand Boat Club",
    description: "Firestoreデータを読み込み中です。",
    createdAt: new Date(0).toISOString(),
  },
  boat: {
    id: "boat-unselected",
    organizationId: "org-unselected",
    name: "船舶未選択",
    status: "needs_check",
    mooringLocation: "",
    capacity: 0,
    fuelType: "",
    engineInfo: "",
    imageUrl: "/tapoyota_logo.png",
    notes: "",
    isActive: false,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  },
  boats: [],
  users: [],
  currentUser: {
    id: "user-unselected",
    organizationId: "org-unselected",
    name: "ログインユーザー",
    email: "",
    role: "member",
    canSolo: false,
    canNightUse: false,
    notes: "",
    createdAt: new Date(0).toISOString(),
  },
  currentOrganizationId: "org-unselected",
  currentBoatId: "boat-unselected",
  currentUserId: "user-unselected",
  organizationMembers: [],
  memberBoatPermissions: [],
  reservations: [],
  joinRequests: [],
  preDepartureChecks: [],
  postReturnChecks: [],
  handoverNotes: [],
  supportRequests: [],
  supportMessages: [],
  voyageLogs: [],
  memberTripRatings: [],
  skillAssessments: [],
  maintenanceLogs: [],
  notifications: [],
  notificationPreferences: [],
  notificationTokens: [],
};
