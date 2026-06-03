import type {
  BoatStatus,
  HandoverCategory,
  HandoverPriority,
  HandoverStatus,
  NotificationCategory,
  NotificationPriority,
  SupportCategory,
  SupportStatus,
  SupportUrgency,
  TargetFish,
  UserRole,
  VoyageReviewStatus,
  VoyageStatus,
} from "@/types/domain";

export const roleLabels: Record<UserRole, string> = {
  admin: "管理者",
  owner: "共同オーナー",
  member: "メンバー",
};

export const boatStatusLabels: Record<BoatStatus, string> = {
  available: "利用可能",
  needs_check: "要確認",
  in_repair: "修理中",
};

export const boatStatusTone: Record<BoatStatus, string> = {
  available: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  needs_check: "bg-amber-100 text-amber-900 ring-amber-200",
  in_repair: "bg-rose-100 text-rose-800 ring-rose-200",
};

export const targetFishLabels: Record<TargetFish, string> = {
  seabass: "シーバス",
  chinning: "チニング",
  tairubber: "タイラバ",
  yellowtail: "青物",
  other: "その他",
};

export const handoverCategoryLabels: Record<HandoverCategory, string> = {
  hull: "船体",
  engine: "エンジン",
  electrical: "電装",
  lights: "ライト",
  mooring: "ロープ/係留",
  fuel: "給油",
  equipment: "備品",
  construction: "工事予定",
  fishing_chat: "釣果/雑談",
  other: "その他",
};

export const handoverPriorityLabels: Record<HandoverPriority, string> = {
  low: "低",
  medium: "中",
  high: "高",
};

export const handoverPriorityTone: Record<HandoverPriority, string> = {
  low: "bg-slate-100 text-slate-700 ring-slate-200",
  medium: "bg-amber-100 text-amber-900 ring-amber-200",
  high: "bg-rose-100 text-rose-800 ring-rose-200",
};

export const handoverStatusLabels: Record<HandoverStatus, string> = {
  unconfirmed: "未確認",
  in_progress: "対応中",
  resolved: "解決済み",
};

export const handoverStatusTone: Record<HandoverStatus, string> = {
  unconfirmed: "bg-orange-100 text-orange-900 ring-orange-200",
  in_progress: "bg-blue-100 text-blue-900 ring-blue-200",
  resolved: "bg-emerald-100 text-emerald-800 ring-emerald-200",
};

export const notificationCategoryLabels: Record<NotificationCategory, string> = {
  weather: "天候/海況",
  reservation: "予約",
  check: "チェック",
  handover: "申し送り",
  support: "サポート",
  maintenance: "メンテナンス",
};

export const notificationPriorityLabels: Record<NotificationPriority, string> = {
  normal: "通常",
  important: "重要",
  urgent: "緊急",
};

export const notificationPriorityTone: Record<NotificationPriority, string> = {
  normal: "bg-sky-100 text-blue-800 ring-sky-200",
  important: "bg-amber-100 text-amber-900 ring-amber-200",
  urgent: "bg-rose-100 text-rose-800 ring-rose-200",
};

export const supportCategoryLabels: Record<SupportCategory, string> = {
  refueling: "給油",
  fuel: "燃料",
  engine: "エンジン",
  electrical: "電装",
  lights: "ライト",
  battery: "バッテリー",
  handling: "操船",
  docking: "着岸",
  mooring: "係留/ロープ",
  equipment: "備品",
  weather: "天候判断",
  other: "その他",
};

export const supportUrgencyLabels: Record<SupportUrgency, string> = {
  low: "低：確認・相談",
  medium: "中：早めに回答希望",
  high: "高：すぐ確認してほしい",
};

export const supportUrgencyTone: Record<SupportUrgency, string> = {
  low: "bg-sky-100 text-blue-800 ring-sky-200",
  medium: "bg-amber-100 text-amber-900 ring-amber-200",
  high: "bg-rose-100 text-rose-800 ring-rose-200",
};

export const supportStatusLabels: Record<SupportStatus, string> = {
  open: "未対応",
  in_progress: "対応中",
  resolved: "解決済み",
  closed: "クローズ",
};

export const supportStatusTone: Record<SupportStatus, string> = {
  open: "bg-orange-100 text-orange-900 ring-orange-200",
  in_progress: "bg-blue-100 text-blue-900 ring-blue-200",
  resolved: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  closed: "bg-slate-100 text-slate-700 ring-slate-200",
};

export const voyageStatusLabels: Record<VoyageStatus, string> = {
  planned: "出船前",
  underway: "航行中",
  completed: "帰港済み",
};

export const voyageStatusTone: Record<VoyageStatus, string> = {
  planned: "bg-sky-100 text-blue-800 ring-sky-200",
  underway: "bg-amber-100 text-amber-900 ring-amber-200",
  completed: "bg-emerald-100 text-emerald-800 ring-emerald-200",
};

export const voyageReviewStatusLabels: Record<VoyageReviewStatus, string> = {
  unreviewed: "未評価",
  safe: "適正利用",
  needs_review: "要確認",
};

export const voyageReviewStatusTone: Record<VoyageReviewStatus, string> = {
  unreviewed: "bg-slate-100 text-slate-700 ring-slate-200",
  safe: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  needs_review: "bg-rose-100 text-rose-800 ring-rose-200",
};
