import type {
  AppData,
  MemberBoatPermission,
  MembershipApplication,
  PermissionTemplate,
  UserRole,
} from "@/types/domain";

export const applicationTypeLabels: Record<MembershipApplication["applicationType"], string> = {
  member: "メンバー参加",
  invite: "招待コード",
  boat_owner: "船主相談",
  boatos_adoption: "BoatOS導入相談",
  inquiry: "問い合わせ",
};

export const applicationStatusLabels: Record<MembershipApplication["status"], string> = {
  pending: "申請中",
  reviewing: "確認中",
  additional_info_required: "追加確認中",
  approved: "承認済み",
  rejected: "却下",
  on_hold: "保留",
};

export const permissionTemplateLabels: Record<PermissionTemplate, string> = {
  trainee: "トレーニー",
  light_member: "ライトメンバー",
  standard_member: "スタンダードメンバー",
  advanced_member: "アドバンスメンバー",
  owner: "オーナー",
  supporter: "サポーター",
  custom: "カスタム",
};

const normalizeEmail = (email?: string | null) => email?.trim().toLowerCase() ?? "";

export function hasActiveMembership(data: AppData) {
  if (data.currentUser.role === "admin" || data.currentUser.role === "owner") {
    return true;
  }

  return data.organizationMembers.some(
    (member) =>
      member.isActive &&
      member.organizationId === data.organization.id &&
      (member.userId === data.currentUser.id ||
        Boolean(
          data.currentUser.email &&
            normalizeEmail(member.email) === normalizeEmail(data.currentUser.email),
        )),
  );
}

export function latestApplicationForCurrentUser(data: AppData) {
  return data.membershipApplications
    .filter(
      (application) =>
        application.userId === data.currentUser.id ||
        Boolean(
          data.currentUser.email &&
            normalizeEmail(application.profile.email) ===
              normalizeEmail(data.currentUser.email),
        ),
    )
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )[0];
}

export function templateDefaults(template: PermissionTemplate) {
  if (template === "owner") {
    return {
      role: "owner" as UserRole,
      canReserve: true,
      canSolo: true,
      canNightUse: true,
      canUseAsGuestHost: true,
      monthlyLimit: 3,
    };
  }
  if (template === "advanced_member") {
    return {
      role: "member" as UserRole,
      canReserve: true,
      canSolo: true,
      canNightUse: true,
      canUseAsGuestHost: true,
      monthlyLimit: 3,
    };
  }
  if (template === "standard_member") {
    return {
      role: "member" as UserRole,
      canReserve: true,
      canSolo: true,
      canNightUse: false,
      canUseAsGuestHost: false,
      monthlyLimit: 2,
    };
  }
  if (template === "light_member") {
    return {
      role: "member" as UserRole,
      canReserve: true,
      canSolo: false,
      canNightUse: false,
      canUseAsGuestHost: false,
      monthlyLimit: 1,
    };
  }

  return {
    role: "member" as UserRole,
    canReserve: template !== "supporter",
    canSolo: false,
    canNightUse: false,
    canUseAsGuestHost: false,
    monthlyLimit: 0,
  };
}

export function createBoatPermissionsForApplication(
  data: AppData,
  application: MembershipApplication,
  template: PermissionTemplate,
  boatIds: string[],
): MemberBoatPermission[] {
  const defaults = templateDefaults(template);
  const now = new Date().toISOString();

  return boatIds.map((boatId) => ({
    id: `perm-${crypto.randomUUID()}`,
    organizationId: application.organizationId ?? data.organization.id,
    userId: application.userId,
    boatId,
    canReserve: defaults.canReserve,
    canSolo: defaults.canSolo,
    canNightUse: defaults.canNightUse,
    canUseAsGuestHost: defaults.canUseAsGuestHost,
    skillLevel: template === "owner" ? "owner" : defaults.canSolo ? "normal" : "trainee",
    notes: `${permissionTemplateLabels[template]}として承認`,
    createdAt: now,
    updatedAt: now,
  }));
}
