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

export type VoyageStatus = "planned" | "underway" | "completed";

export type VoyageReviewStatus = "unreviewed" | "safe" | "needs_review";

export type ReservationSessionStatus =
  | "scheduled"
  | "pre_checked"
  | "underway"
  | "returned"
  | "closed";

export type SkillAssessmentStatus =
  | "training"
  | "solo_ready"
  | "needs_practice";

export type JoinRequestStatus = "requested" | "approved" | "declined";

export type BoatSkillLevel =
  | "trainee"
  | "beginner"
  | "normal"
  | "advanced"
  | "owner";

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

export type TrackPoint = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  capturedAt: string;
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
  description?: string;
  ownerUserId?: string;
  createdAt: string;
  updatedAt?: string;
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
  isActive?: boolean;
  allowNightUse?: boolean;
  allowSoloUse?: boolean;
  allowBeginnerUse?: boolean;
  adminNotes?: string;
  createdAt?: string;
  updatedAt: string;
};

export type AppUser = {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  emergencyContact?: string;
  licenseMemo?: string;
  canSolo: boolean;
  canNightUse: boolean;
  notes: string;
  createdAt: string;
};

export type OrganizationMember = {
  id: string;
  organizationId: string;
  userId: string;
  role: UserRole;
  displayName: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MemberBoatPermission = {
  id: string;
  organizationId: string;
  userId: string;
  boatId: string;
  canReserve: boolean;
  canSolo: boolean;
  canNightUse: boolean;
  canUseAsGuestHost: boolean;
  skillLevel: BoatSkillLevel;
  notes: string;
  createdAt: string;
  updatedAt: string;
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
  sessionStatus?: ReservationSessionStatus;
  createdAt: string;
  updatedAt: string;
};

export type JoinRequest = {
  id: string;
  organizationId: string;
  boatId: string;
  reservationId: string;
  userId: string;
  message: string;
  status: JoinRequestStatus;
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
  estimatedCost?: number;
  attachments?: SupportAttachment[];
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
  imageUrls?: string[];
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
  imageUrls?: string[];
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
  handoverNoteId?: string;
  category: string;
  title: string;
  body: string;
  cost: number;
  performedAt: string;
  createdBy: string;
  createdAt: string;
};

export type VoyageLog = {
  id: string;
  organizationId: string;
  boatId: string;
  reservationId: string;
  userId: string;
  status: VoyageStatus;
  departedAt?: string;
  returnedAt?: string;
  durationMinutes?: number;
  distanceKm?: number;
  trackPoints: TrackPoint[];
  passengerCount: number;
  memo: string;
  reviewStatus?: VoyageReviewStatus;
  reviewMemo?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type MemberTripRating = {
  id: string;
  organizationId: string;
  boatId: string;
  reservationId: string;
  userId: string;
  evaluatorId: string;
  safetyScore: number;
  preparationScore: number;
  communicationScore: number;
  boatCareScore: number;
  overallScore: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
};

export type SkillAssessment = {
  id: string;
  organizationId: string;
  boatId: string;
  userId: string;
  assessorId: string;
  dockingScore: number;
  departureScore: number;
  navigationRulesScore: number;
  weatherJudgmentScore: number;
  emergencyScore: number;
  equipmentScore: number;
  status: SkillAssessmentStatus;
  recommendation: string;
  assessedAt: string;
  createdAt: string;
  updatedAt: string;
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

export type NotificationToken = {
  id: string;
  organizationId: string;
  userId: string;
  token: string;
  platform: "web";
  userAgent: string;
  deviceLabel: string;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
  disabledAt?: string;
};

export type AppData = {
  organization: Organization;
  boat: Boat;
  boats?: Boat[];
  users: AppUser[];
  currentUser: AppUser;
  currentOrganizationId?: string;
  currentBoatId?: string;
  currentUserId?: string;
  organizationMembers: OrganizationMember[];
  memberBoatPermissions: MemberBoatPermission[];
  reservations: Reservation[];
  joinRequests: JoinRequest[];
  preDepartureChecks: PreDepartureCheck[];
  postReturnChecks: PostReturnCheck[];
  handoverNotes: HandoverNote[];
  supportRequests: SupportRequest[];
  supportMessages: SupportMessage[];
  voyageLogs: VoyageLog[];
  memberTripRatings: MemberTripRating[];
  skillAssessments: SkillAssessment[];
  maintenanceLogs: MaintenanceLog[];
  notifications: AppNotification[];
  notificationPreferences: NotificationPreference[];
  notificationTokens: NotificationToken[];
};
