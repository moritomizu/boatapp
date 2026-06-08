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
  | "maintenance"
  | "membership";

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

export type GoogleSyncStatus =
  | "not_synced"
  | "synced"
  | "failed"
  | "disabled";

export type SkillAssessmentStatus =
  | "training"
  | "solo_ready"
  | "needs_practice";

export type JoinRequestStatus = "requested" | "approved" | "declined";

export type OrganizationInviteStatus =
  | "pending"
  | "accepted"
  | "expired"
  | "revoked";

export type MembershipApplicationType =
  | "member"
  | "invite"
  | "boat_owner"
  | "boatos_adoption"
  | "inquiry";

export type MembershipApplicationStatus =
  | "pending"
  | "reviewing"
  | "additional_info_required"
  | "approved"
  | "rejected"
  | "on_hold";

export type PermissionTemplate =
  | "trainee"
  | "light_member"
  | "standard_member"
  | "advanced_member"
  | "owner"
  | "supporter"
  | "custom";

export type LicenseType = "first_class" | "second_class" | "special" | "none";

export type BoatSkillLevel =
  | "trainee"
  | "beginner"
  | "normal"
  | "advanced"
  | "owner";

export type BoatOwnershipType =
  | "sole_owner"
  | "co_owner"
  | "partner_owner"
  | "managed_boat";

export type MemberSubscriptionStatus =
  | "active"
  | "paused"
  | "cancelled"
  | "trial";

export type RevenueAllocationMethod =
  | "manual"
  | "most_used_boat"
  | "usage_count_proration"
  | "usage_time_proration"
  | "custom";

export type MonthlyRevenueReportStatus =
  | "draft"
  | "reviewing"
  | "confirmed"
  | "reopened";

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
  speed?: number;
  speedKmh?: number;
  heading?: number;
  altitude?: number;
  lowAccuracy?: boolean;
  capturedAt: string;
};

export type StopCandidate = {
  id: string;
  latitude: number;
  longitude: number;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  pointCount: number;
};

export type NavigationSummary = {
  startedAt?: string;
  endedAt?: string;
  durationMinutes: number;
  totalDistanceKm: number;
  movingTimeMinutes: number;
  stoppedTimeMinutes: number;
  averageSpeedKmh: number;
  maxSpeedKmh: number;
  trackPointCount: number;
  departurePoint?: TrackPoint;
  returnPoint?: TrackPoint;
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
  contact?: string;
  activityArea?: string;
  ruleSummary?: string;
  createdAt: string;
  updatedAt?: string;
};

export type OrganizationRule = {
  id: string;
  organizationId: string;
  monthlyReservationLimit: number;
  standardUsageHours: number;
  bookingWindowDays: number;
  allowNightUse: boolean;
  allowSoloUse: boolean;
  allowJoinRequests: boolean;
  allowGuestOnBoard: boolean;
  requirePreDepartureCheck: boolean;
  requirePostReturnCheck: boolean;
  requireFullFuelReturn: boolean;
  strictLimit?: boolean;
  ruleText: string;
  notes: string;
  emergencyContact: string;
  createdAt: string;
  updatedAt: string;
};

export type OrganizationInvite = {
  id: string;
  organizationId: string;
  email: string;
  role: Exclude<UserRole, "admin">;
  inviteCode: string;
  status: OrganizationInviteStatus;
  memo: string;
  invitedBy: string;
  expiresAt: string;
  acceptedBy?: string;
  acceptedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type BoatOwnership = {
  id: string;
  organizationId: string;
  boatId: string;
  ownerUserId?: string;
  ownerName: string;
  ownershipType: BoatOwnershipType;
  ownershipSharePercent?: number;
  isPayoutRecipient: boolean;
  payoutSharePercent?: number;
  payoutMemo?: string;
  adminMemo?: string;
  createdAt: string;
  updatedAt: string;
};

export type MembershipPlan = {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  monthlyFee: number;
  monthlyReservationLimit?: number;
  weekendReservationLimit?: number;
  accessibleBoatIds?: string[];
  canGuestUse?: boolean;
  canNightUse?: boolean;
  canEventUse?: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MemberSubscription = {
  id: string;
  organizationId: string;
  userId: string;
  membershipPlanId: string;
  status: MemberSubscriptionStatus;
  startedAt: string;
  endedAt?: string;
  monthlyFeeSnapshot: number;
  planNameSnapshot: string;
  createdAt: string;
  updatedAt: string;
};

export type BoatRevenuePolicy = {
  id: string;
  organizationId: string;
  boatId: string;
  ownerReturnRate: number;
  operationFeeRate: number;
  maintenanceReserveRate: number;
  localManagementRate: number;
  allocationMethod: RevenueAllocationMethod;
  allowManualAdjustment: boolean;
  memo?: string;
  createdAt: string;
  updatedAt: string;
};

export type MonthlyBoatRevenueSummary = {
  boatId: string;
  boatNameSnapshot: string;
  usageCount: number;
  usageHours: number;
  navigationHours?: number;
  navigationDistanceKm?: number;
  guestUseCount?: number;
  ownerBlockedDays?: number;
  maintenanceBlockedDays?: number;
  cancelledCount?: number;
  weatherCancelledCount?: number;
  suggestedRevenueByMostUsedBoat?: number;
  suggestedRevenueByUsageCount?: number;
  suggestedRevenueByUsageTime?: number;
  finalAllocatedRevenue: number;
  ownerReturnAmount: number;
  operationFeeAmount: number;
  maintenanceReserveAmount: number;
  localManagementAmount: number;
  adjustmentReason?: string;
  adminMemo?: string;
};

export type MonthlyRevenueReport = {
  id: string;
  organizationId: string;
  yearMonth: string;
  status: MonthlyRevenueReportStatus;
  totalMembers: number;
  activeMembers: number;
  totalMembershipRevenue: number;
  totalReservations?: number;
  completedReservations?: number;
  cancelledReservations?: number;
  weatherCancelledReservations?: number;
  totalUsageHours?: number;
  totalNavigationHours?: number;
  totalNavigationDistanceKm?: number;
  boatSummaries: MonthlyBoatRevenueSummary[];
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
  confirmedBy?: string;
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
  inspectionCertificateImageUrls?: string[];
  nextInspectionDate?: string;
  googleCalendarSyncEnabled?: boolean;
  googleCalendarId?: string;
  googleCalendarName?: string;
  googleLastSyncAt?: string;
  googleSyncError?: string | null;
  notes: string;
  isActive?: boolean;
  displayOrder?: number;
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
  avatarUrl?: string;
  phone?: string;
  emergencyContact?: string;
  licenseMemo?: string;
  licenseImageUrls?: string[];
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

export type MembershipApplication = {
  id: string;
  userId: string;
  organizationId?: string;
  applicationType: MembershipApplicationType;
  status: MembershipApplicationStatus;
  inviteCode?: string;
  profile: {
    name: string;
    email: string;
    phone?: string;
    birthDate?: string;
    emergencyContact?: string;
    area?: string;
  };
  licenseInfo?: {
    hasLicense: boolean;
    licenseType?: LicenseType;
    acquiredYear?: number;
  };
  experienceInfo?: {
    boatingExperience?: string;
    nightNavigationExperience?: boolean;
    dockingExperience?: boolean;
    previousBoatTypes?: string[];
  };
  usageIntent?: {
    purposes?: string[];
    desiredFrequency?: "monthly_1" | "monthly_2" | "monthly_3_plus";
    wantsSoloNavigation?: boolean;
    wantsNightUse?: boolean;
    wantsGuestUse?: boolean;
    wantsEventUse?: boolean;
  };
  boatOwnerInfo?: {
    boatName?: string;
    boatType?: string;
    size?: string;
    makerModel?: string;
    engineType?: string;
    capacity?: number;
    inspectionStatus?: string;
    insuranceStatus?: string;
    banStatus?: string;
    homePort?: string;
    currentUsageFrequency?: string;
  };
  adoptionInfo?: {
    organizationName?: string;
    businessType?: string;
    boatCount?: number;
    currentManagementTools?: string[];
    painPoints?: string;
  };
  message?: string;
  referrer?: string;
  adminMemo?: string;
  adminMessage?: string;
  rejectionReason?: string;
  approvedRole?: UserRole;
  permissionTemplate?: PermissionTemplate;
  approvedBoatIds?: string[];
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
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
  canceledAt?: string;
  deletedAt?: string;
  googleEventId?: string | null;
  googleSyncStatus?: GoogleSyncStatus;
  googleLastSyncedAt?: string | null;
  googleSyncError?: string | null;
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
  navigationSummary?: NavigationSummary;
  stopCandidates?: StopCandidate[];
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
  recipientUserIds?: string[];
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
  organizationRules: OrganizationRule[];
  organizationInvites: OrganizationInvite[];
  membershipApplications: MembershipApplication[];
  boatOwnerships: BoatOwnership[];
  membershipPlans: MembershipPlan[];
  memberSubscriptions: MemberSubscription[];
  boatRevenuePolicies: BoatRevenuePolicy[];
  monthlyRevenueReports: MonthlyRevenueReport[];
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
