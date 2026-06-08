"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  Home,
  LifeBuoy,
  LogOut,
  Navigation,
  Settings,
  User,
  Ship,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
} from "firebase/auth";
import { Badge } from "@/components/ui";
import {
  rememberAuthenticatedUser,
  refreshClientAppData,
  resetClientAppData,
  selectCurrentBoat,
  useClientAppData,
} from "@/lib/client-store";
import { getInitialAppData } from "@/lib/data-source";
import { firebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import { normalizeEmail } from "@/lib/bootstrap-admin";
import { canUseBoat, getBoats } from "@/lib/boat-utils";
import { getReservationSessionStatus } from "@/lib/reservations";
import { hasActiveMembership } from "@/lib/membership";

const navItems = [
  { href: "/home", label: "ホーム", icon: Home },
  { href: "/reservations", label: "予約", icon: CalendarDays },
  { href: "/support", label: "相談", icon: LifeBuoy },
  { href: "/boats", label: "船舶", icon: Ship },
];

const isSameDateKey = (value: string) => {
  const now = new Date();
  const target = new Date(value);
  return (
    now.getFullYear() === target.getFullYear() &&
    now.getMonth() === target.getMonth() &&
    now.getDate() === target.getDate()
  );
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const initialData = getInitialAppData();
  const data = useClientAppData(initialData);
  const [authReady, setAuthReady] = useState(
    !isFirebaseConfigured || !firebaseAuth || Boolean(firebaseAuth.currentUser),
  );
  const [signedInEmail, setSignedInEmail] = useState(
    firebaseAuth?.currentUser?.email ?? "",
  );
  const currentUserName =
    data.currentUser.name ||
    data.currentUser.email?.split("@")[0] ||
    "利用者";
  const membershipAllowedPath =
    pathname === "/apply" ||
    pathname === "/pending" ||
    pathname === "/profile" ||
    pathname === "/login" ||
    pathname.startsWith("/join");
  const membershipActive = hasActiveMembership(data);
  const authDataSynced =
    !signedInEmail ||
    normalizeEmail(data.currentUser.email) === normalizeEmail(signedInEmail);

  useEffect(() => {
    if (!firebaseAuth || !isFirebaseConfigured) {
      return;
    }

    let active = true;
    void setPersistence(firebaseAuth, browserLocalPersistence).catch(() => undefined);
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (!active) return;
      setAuthReady(true);
      setSignedInEmail(user?.email ?? "");
      if (user) {
        rememberAuthenticatedUser(user);
        void refreshClientAppData(initialData, { force: true });
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [initialData]);
  const boats = getBoats(data);
  const usableBoats = boats.filter((boat) => canUseBoat(data, data.currentUser, boat));
  const activeVoyage = data.voyageLogs.find(
    (voyage) => voyage.boatId === data.boat.id && voyage.status === "underway",
  );
  const todaysReservation = data.reservations.find((reservation) =>
    reservation.boatId === data.boat.id && isSameDateKey(reservation.startAt),
  );
  const todaysVoyage = todaysReservation
    ? data.voyageLogs.find(
        (voyage) => voyage.reservationId === todaysReservation.id,
      )
    : undefined;
  const preCheckDone = todaysReservation
    ? data.preDepartureChecks.some(
        (check) => check.reservationId === todaysReservation.id,
      )
    : false;
  const postCheckDone = todaysReservation
    ? data.postReturnChecks.some(
        (check) => check.reservationId === todaysReservation.id,
      )
    : false;
  const todaySessionStatus = todaysReservation
    ? getReservationSessionStatus(todaysReservation, data)
    : undefined;
  const departureHref = activeVoyage
    ? `/voyages?reservationId=${activeVoyage.reservationId}`
    : todaysReservation
      ? todaySessionStatus === "closed"
        ? `/reservations#reservation-${todaysReservation.id}`
        : (todaysVoyage?.status === "completed" || todaySessionStatus === "underway") && !postCheckDone
        ? `/checks/post-return?reservationId=${todaysReservation.id}`
        : preCheckDone || todaySessionStatus === "pre_checked"
        ? `/voyages?reservationId=${todaysReservation.id}`
        : `/checks/pre-departure?reservationId=${todaysReservation.id}`
      : "/reservations";
  const departureLabel = activeVoyage
    ? "航行中"
    : todaysReservation &&
        (todaysVoyage?.status === "completed" || todaySessionStatus === "underway") &&
        !postCheckDone
      ? "帰港"
      : "出船";

  if (!authReady && !membershipAllowedPath) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 px-4 text-slate-950">
        <div className="w-full max-w-sm rounded-lg border border-sky-100 bg-white p-5 text-center shadow-sm">
          <div className="mx-auto grid size-14 place-items-center overflow-hidden rounded-full bg-blue-700 p-1">
            <Image
              src="/tapiyota_icon.jpg"
              alt=""
              width={48}
              height={48}
              className="h-full w-full object-contain"
              aria-hidden="true"
              priority
            />
          </div>
          <p className="mt-4 text-lg font-black text-blue-950">
            ログイン状態を確認しています
          </p>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
            Google認証とクラブ情報を読み込んでいます。数秒お待ちください。
          </p>
        </div>
      </div>
    );
  }

  if (isFirebaseConfigured && authReady && !signedInEmail && !membershipAllowedPath) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 px-4 text-slate-950">
        <div className="w-full max-w-sm rounded-lg border border-sky-100 bg-white p-5 text-center shadow-sm">
          <p className="text-lg font-black text-blue-950">
            ログインが必要です
          </p>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
            セッションを確認できませんでした。もう一度ログインしてください。
          </p>
          <Link
            href="/login"
            className="mt-4 flex h-12 items-center justify-center rounded-lg bg-blue-800 px-4 text-sm font-black text-white"
          >
            ログインへ
          </Link>
        </div>
      </div>
    );
  }

  if (
    isFirebaseConfigured &&
    authReady &&
    signedInEmail &&
    !authDataSynced &&
    !membershipAllowedPath
  ) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 px-4 text-slate-950">
        <div className="w-full max-w-sm rounded-lg border border-sky-100 bg-white p-5 text-center shadow-sm">
          <div className="mx-auto grid size-14 place-items-center overflow-hidden rounded-full bg-blue-700 p-1">
            <Image
              src="/tapiyota_icon.jpg"
              alt=""
              width={48}
              height={48}
              className="h-full w-full object-contain"
              aria-hidden="true"
              priority
            />
          </div>
          <p className="mt-4 text-lg font-black text-blue-950">
            クラブ情報を読み込んでいます
          </p>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
            {signedInEmail} の権限情報を反映しています。
          </p>
        </div>
      </div>
    );
  }

  async function logout() {
    if (firebaseAuth) {
      const { signOut } = await import("firebase/auth");
      await signOut(firebaseAuth);
    }
    resetClientAppData();
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-20 border-b border-sky-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/home" className="flex items-center gap-2">
            <span className="grid size-10 place-items-center overflow-hidden rounded-full bg-blue-700 p-1 text-white">
              <Image
                src="/tapiyota_icon.jpg"
                alt=""
                width={40}
                height={40}
                className="h-full w-full object-contain"
                aria-hidden="true"
              />
            </span>
            <span className="hidden sm:block">
              <span className="block text-sm font-semibold text-blue-950">
                TaPiYoTa Grand Boat Club
              </span>
              <span className="block text-xs text-slate-500">
                Boat operations
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <details className="relative">
              <summary
                className="flex min-h-10 min-w-0 cursor-pointer list-none items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-2 text-blue-950 marker:hidden"
                aria-label={`対象船舶: ${data.boat.name}`}
              >
                <Ship size={17} aria-hidden="true" />
                <span className="hidden max-w-32 truncate text-xs font-black sm:block">
                  {data.boat.name}
                </span>
                <ChevronDown size={15} aria-hidden="true" />
              </summary>
              <div className="fixed inset-x-3 bottom-24 z-50 max-h-[70vh] overflow-y-auto rounded-2xl border border-sky-100 bg-white p-4 shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-12 sm:w-80 sm:max-w-[calc(100vw-16px)] sm:rounded-lg sm:p-3">
                <p className="text-sm font-black text-blue-950 sm:text-xs sm:text-slate-500">
                  船を切り替え
                </p>
                <div className="mt-2 space-y-2">
                  {boats.map((boat) => {
                    const usable = usableBoats.some((item) => item.id === boat.id);
                    const selected = boat.id === data.boat.id;

                    return (
                      <button
                        key={boat.id}
                        type="button"
                        disabled={!usable}
                        onClick={() => void selectCurrentBoat(boat.id, data)}
                        className="flex min-h-14 w-full items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 text-left disabled:opacity-50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-base font-black text-slate-900 sm:text-sm">
                            {boat.name}
                          </span>
                          <span className="block text-xs font-bold text-slate-500">
                            {selected ? "現在選択中" : usable ? "表示切替可" : "利用権限なし"}
                          </span>
                        </span>
                        {selected ? <Check size={18} className="text-blue-800" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </details>
            <Link
              href="/notifications"
              className="relative grid size-10 place-items-center rounded-full border border-sky-200 text-blue-900"
              aria-label="通知"
            >
              <Bell size={19} aria-hidden="true" />
              <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-rose-500" />
            </Link>
            <details className="relative">
              <summary
                className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-sky-200 px-3 py-2 text-left text-xs font-semibold text-blue-900 marker:hidden"
                aria-label={`現在の利用者: ${currentUserName}`}
              >
                <Badge className="bg-sky-100 text-blue-800 ring-sky-200">
                  {currentUserName.slice(0, 1)}
                </Badge>
                <ChevronDown size={15} aria-hidden="true" />
              </summary>
              <div className="absolute right-0 top-12 z-50 w-64 rounded-lg border border-sky-100 bg-white p-3 shadow-xl">
                <p className="text-sm font-black text-blue-950">
                  {currentUserName}
                </p>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  {data.organization.name}
                </p>
                <div className="mt-3 space-y-2">
                  <Link
                    href="/profile"
                    className="flex min-h-11 items-center gap-2 rounded-lg bg-slate-50 px-3 text-sm font-black text-slate-800"
                  >
                    <User size={17} aria-hidden="true" />
                    プロフィール編集
                  </Link>
                  <Link
                    href="/usage-history"
                    className="flex min-h-11 items-center gap-2 rounded-lg bg-slate-50 px-3 text-sm font-black text-slate-800"
                  >
                    <BookOpen size={17} aria-hidden="true" />
                    利用履歴
                  </Link>
                  <Link
                    href="/my-log"
                    className="flex min-h-11 items-center gap-2 rounded-lg bg-slate-50 px-3 text-sm font-black text-slate-800"
                  >
                    <Navigation size={17} aria-hidden="true" />
                    航海履歴
                  </Link>
                  {data.currentUser.role === "admin" || data.currentUser.role === "owner" ? (
                    <Link
                      href="/admin"
                      className="flex min-h-11 items-center gap-2 rounded-lg bg-slate-50 px-3 text-sm font-black text-slate-800"
                    >
                      <Home size={17} aria-hidden="true" />
                      運営TOP
                    </Link>
                  ) : null}
                  <Link
                    href="/organization"
                    className="flex min-h-11 items-center gap-2 rounded-lg bg-slate-50 px-3 text-sm font-black text-slate-800"
                  >
                    <Settings size={17} aria-hidden="true" />
                    組織設定
                  </Link>
                  {data.currentUser.role === "admin" || data.currentUser.role === "owner" ? (
                    <Link
                      href="/revenue"
                      className="flex min-h-11 items-center gap-2 rounded-lg bg-slate-50 px-3 text-sm font-black text-slate-800"
                    >
                      <BookOpen size={17} aria-hidden="true" />
                      会費配分
                    </Link>
                  ) : null}
                  {data.currentUser.role === "admin" || data.currentUser.role === "owner" ? (
                    <Link
                      href="/funds"
                      className="flex min-h-11 items-center gap-2 rounded-lg bg-slate-50 px-3 text-sm font-black text-slate-800"
                    >
                      <Settings size={17} aria-hidden="true" />
                      基金管理
                    </Link>
                  ) : null}
                  <Link
                    href="/members"
                    className="flex min-h-11 items-center gap-2 rounded-lg bg-slate-50 px-3 text-sm font-black text-slate-800"
                  >
                    <Ship size={17} aria-hidden="true" />
                    メンバー管理
                  </Link>
                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="flex min-h-11 w-full items-center gap-2 rounded-lg bg-rose-50 px-3 text-sm font-black text-rose-800"
                  >
                    <LogOut size={17} aria-hidden="true" />
                    ログアウト
                  </button>
                </div>
              </div>
            </details>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5">
        {!membershipActive && !membershipAllowedPath ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
              <p className="text-lg font-black">
                管理者の承認後に利用できます
              </p>
              <p className="mt-2 text-sm font-bold leading-6">
                予約、出船チェック、航海ログ、サポート要請などの機能は、所属クラブへの参加申請と管理者承認後に表示されます。
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Link
                href="/pending"
                className="flex min-h-12 items-center justify-center rounded-lg bg-blue-800 px-4 text-sm font-black text-white"
              >
                承認状況を見る
              </Link>
              <Link
                href="/apply"
                className="flex min-h-12 items-center justify-center rounded-lg border border-sky-200 bg-white px-4 text-sm font-black text-blue-900"
              >
                参加申請へ
              </Link>
            </div>
          </div>
        ) : (
          children
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-sky-100 bg-white/95 shadow-[0_-8px_28px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
        <div className="grid grid-cols-5 items-end px-1 pb-[max(env(safe-area-inset-bottom),8px)] pt-2">
          {navItems.slice(0, 2).map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href.startsWith("/checks") && pathname.startsWith("/checks")) ||
              (item.href === "/boats" && pathname.startsWith("/handovers"));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold ${
                  active ? "bg-blue-700 text-white" : "text-slate-500"
                }`}
              >
                <Icon size={21} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
          <Link
            href={departureHref}
            className={`mx-1 flex min-h-16 -translate-y-2 flex-col items-center justify-center gap-1 rounded-2xl bg-blue-800 text-[11px] font-black text-white shadow-lg shadow-blue-950/20 ${
              pathname.startsWith("/voyages") || pathname.startsWith("/checks")
                ? "ring-2 ring-blue-200"
                : ""
            }`}
          >
            <Navigation size={24} aria-hidden="true" />
            {departureLabel}
          </Link>
          {navItems.slice(2).map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href === "/boats" && pathname.startsWith("/handovers"));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold ${
                  active ? "bg-blue-700 text-white" : "text-slate-500"
                }`}
              >
                <Icon size={21} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
