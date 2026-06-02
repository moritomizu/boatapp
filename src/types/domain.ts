export type UserRole = "admin" | "owner" | "member";

export type BoatStatus = "available" | "needs_check" | "in_repair";

export type NoteStatus = "open" | "resolved";

export type HandoverCategory =
  | "hull"
  | "engine"
  | "electrical"
  | "lights"
  | "mooring"
  | "fuel"
  | "equipment"
  | "construction"
  | "fishing_chat"
  | "other";

export type HandoverPriority = "low" | "medium" | "high";

export type HandoverStatus = "unconfirmed" | "in_progress" | "resolved";

export type NotificationCategory =
  | "weather"
  | "reservation"
  | "check"
  | "handover"
  | "support"
  | "maintenance";

export type NotificationPriority = "normal" | "important" | "urgent";

export type NotificationChannel = "in_app" | "push" | "email";

export type SupportCategory =
  | "refueling"
  | "fuel"
  | "engine"
  | "electrical"
  | "lights"
  | "battery"
  | "handling"
  | "docking"
  | "mooring"
  | "equipment"
  | "weather"
  | "other";

export type SupportUrgency = "low" | "medium" | "high";

export type SupportStatus = "open" | "in_progress" | "resolved" | "closed";

export type SupportLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  capturedAt: string;
};

export type SupportAttachment = {
  url: string;
  name: string;
  contentType: string;
  uploadedAt: string;
  uploadedBy: string;
};

export type TargetFish =
  | "seabass"
  | "chinning"
  | "tairubber"
  | "yellowtail"
  | "other";

export type Organization = {
  id: string;
  name: string;
  createdAt: string;
};

export type Boat = {
  id: string;
  organizationId: string;
  name: string;
  status: BoatStatus;
  mooringLocation: string;
  capacity: number;
  fuelType: string;
  engineInfo: string;
  imageUrl: string;
  notes: string;
  updatedAt: string;
};

export type AppUser = {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: UserRole;
  canSolo: boolean;
  canNightUse: boolean;
  notes: string;
  createdAt: string;
};

export type Reservation = {
  id: string;
  organizationId: string;
  boatId: string;
  userId: string;
  startAt: string;
  endAt: string;
  targetFish: TargetFish;
  destinationArea: string;
  passengerCount: number;
  availableSeats: number;
  joinAllowed: boolean;
  comment: string;
  createdAt: string;
  updatedAt: string;
};

export type HandoverNote = {
  id: string;
  organizationId: string;
  boatId: string;
  reservationId?: string;
  title: string;
  body: string;
  category: HandoverCategory;
  priority: HandoverPriority;
  status: HandoverStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
};

export type PreDepartureCheckItems = {
  fuelOk: boolean;
  batterySwitchOn: boolean;
  engineStarted: boolean;
  navigationLightsOk: boolean;
  bilgeOk: boolean;
  mooringRopesOk: boolean;
  lifeJacketsOk: boolean;
  safetyEquipmentOk: boolean;
  weatherChecked: boolean;
  phoneCharged: boolean;
  hullDamageOk: boolean;
  handoverChecked: boolean;
};

export type PostReturnCheckItems = {
  refueled: boolean;
  washed: boolean;
  tiltedUp: boolean;
  batterySwitchOff: boolean;
  trashRemoved: boolean;
  mooringRopesOk: boolean;
  hullAndPropellerOk: boolean;
  lightsOk: boolean;
  equipmentReturned: boolean;
  noHandoverNeeded: boolean;
};

export type PreDepartureCheck = {
  id: string;
  organizationId: string;
  boatId: string;
  reservationId: string;
  userId: string;
  checkedAt: string;
  items: PreDepartureCheckItems;
  hasIssue: boolean;
  comment: string;
  createdAt: string;
  updatedAt: string;
};

export type PostReturnCheck = {
  id: string;
  organizationId: string;
  boatId: string;
  reservationId: string;
  userId: string;
  checkedAt: string;
  items: PostReturnCheckItems;
  hasIssue: boolean;
  comment: string;
  createdAt: string;
  updatedAt: string;
};

export type SupportRequest = {
  id: string;
  organizationId: string;
  boatId: string;
  reservationId?: string;
  title: string;
  category: SupportCategory;
  urgency: SupportUrgency;
  body: string;
  status: SupportStatus;
  createdBy: string;
  assignedTo?: string;
  location?: SupportLocation;
  attachments?: SupportAttachment[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  closedAt?: string;
};

export type SupportMessage = {
  id: string;
  organizationId: string;
  supportRequestId: string;
  body: string;
  createdBy: string;
  createdAt: string;
};

export type MaintenanceLog = {
  id: string;
  organizationId: string;
  boatId: string;
  category: string;
  title: string;
  body: string;
  cost: number;
  performedAt: string;
  createdBy: string;
  createdAt: string;
};

export type AppNotification = {
  id: string;
  organizationId: string;
  boatId: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  body: string;
  relatedPath: string;
  readBy: string[];
  createdAt: string;
};

export type NotificationPreference = {
  userId: string;
  channels: NotificationChannel[];
  weatherAlerts: boolean;
  reservationReminders: boolean;
  checkReminders: boolean;
  handoverAlerts: boolean;
  supportAlerts: boolean;
};

export type AppData = {
  organization: Organization;
  boat: Boat;
  users: AppUser[];
  currentUser: AppUser;
  reservations: Reservation[];
  preDepartureChecks: PreDepartureCheck[];
  postReturnChecks: PostReturnCheck[];
  handoverNotes: HandoverNote[];
  supportRequests: SupportRequest[];
  supportMessages: SupportMessage[];
  maintenanceLogs: MaintenanceLog[];
  notifications: AppNotification[];
  notificationPreferences: NotificationPreference[];
};
