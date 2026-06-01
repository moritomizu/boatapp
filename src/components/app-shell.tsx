"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Anchor,
  Bell,
  CalendarDays,
  ClipboardCheck,
  Home,
  LifeBuoy,
  MessageSquareWarning,
} from "lucide-react";
import type { ReactNode } from "react";

const navItems = [
  { href: "/home", label: "ホーム", icon: Home },
  { href: "/reservations", label: "予約", icon: CalendarDays },
  { href: "/checks/pre-departure", label: "チェック", icon: ClipboardCheck },
  { href: "/support", label: "相談", icon: LifeBuoy },
  { href: "/handovers", label: "申し送り", icon: MessageSquareWarning },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-20 border-b border-sky-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/home" className="flex items-center gap-2">
            <span className="grid size-10 place-items-center rounded-2xl bg-blue-700 text-white">
              <Anchor size={22} aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-blue-950">
                TaPiYoTa Grand Boat Club
              </span>
              <span className="block text-xs text-slate-500">
                Boat operations
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/notifications"
              className="relative grid size-10 place-items-center rounded-full border border-sky-200 text-blue-900"
              aria-label="通知"
            >
              <Bell size={19} aria-hidden="true" />
              <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-rose-500" />
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-sky-200 px-3 py-2 text-xs font-semibold text-blue-900"
            >
              ログイン
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-sky-100 bg-white/95 shadow-[0_-8px_28px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
        <div className="grid grid-cols-5 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href.startsWith("/checks") && pathname.startsWith("/checks"));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-semibold ${
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
