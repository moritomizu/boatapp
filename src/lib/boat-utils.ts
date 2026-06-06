import type { AppData, AppUser, Boat, MemberBoatPermission } from "@/types/domain";

const boatNameCollator = new Intl.Collator("ja-JP", {
  numeric: true,
  sensitivity: "base",
});

export function sortBoatsByDisplayName(boats: Boat[]) {
  return [...boats].sort((a, b) => {
    const orderA = a.displayOrder ?? Number.POSITIVE_INFINITY;
    const orderB = b.displayOrder ?? Number.POSITIVE_INFINITY;
    if (orderA !== orderB) return orderA - orderB;

    const byName = boatNameCollator.compare(a.name, b.name);
    if (byName !== 0) return byName;

    return (
      new Date(a.createdAt ?? a.updatedAt).getTime() -
      new Date(b.createdAt ?? b.updatedAt).getTime()
    );
  });
}

export function getBoats(data: AppData): Boat[] {
  if (data.boats?.length) return sortBoatsByDisplayName(data.boats);
  if (data.boat.id === "boat-unselected") return [];
  return [data.boat];
}

export function findBoat(data: AppData, boatId?: string) {
  return getBoats(data).find((boat) => boat.id === boatId) ?? data.boat;
}

export function getBoatName(data: AppData, boatId?: string) {
  return findBoat(data, boatId).name;
}

export function getMemberBoatPermission(
  data: AppData,
  userId: string,
  boatId: string,
): MemberBoatPermission | undefined {
  return data.memberBoatPermissions?.find(
    (permission) => permission.userId === userId && permission.boatId === boatId,
  );
}

export function canUseBoat(data: AppData, user: AppUser, boat: Boat) {
  if (user.role === "admin" || user.role === "owner") return true;
  const permission = getMemberBoatPermission(data, user.id, boat.id);
  return Boolean(permission?.canReserve);
}

export function reservationWarnings(data: AppData, userId: string, boatId: string) {
  const boat = findBoat(data, boatId);
  const user = data.users.find((item) => item.id === userId) ?? data.currentUser;
  const permission = getMemberBoatPermission(data, user.id, boat.id);
  const warnings: string[] = [];

  if (boat.status === "in_repair") {
    warnings.push("この船は現在修理中です。");
  }

  if (user.role === "member" && !permission?.canReserve) {
    warnings.push("このメンバーはこの船の予約権限がありません。");
  }

  if (!permission?.canSolo && !user.canSolo) {
    warnings.push("このメンバーはこの船の単独利用権限がありません。");
  }

  if (!permission?.canNightUse && !user.canNightUse) {
    warnings.push("このメンバーは夜間利用権限がありません。");
  }

  return warnings;
}
