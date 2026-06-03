"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarDays,
  ClipboardCheck,
  Home,
  LifeBuoy,
  Navigation,
  Ship,
} from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui";
import { useClientAppData } from "@/lib/client-store";
import { getInitialAppData } from "@/lib/data-source";
import { roleLabels } from "@/lib/labels";

const navItems = [
  { href: "/home", label: "ホーム", icon: Home },
  { href: "/reservations", label: "予約", icon: CalendarDays },
  { href: "/checks/pre-departure", label: "チェック", icon: ClipboardCheck },
  { href: "/voyages", label: "航行", icon: Navigation },
  { href: "/support", label: "相談", icon: LifeBuoy },
  { href: "/boats", label: "船舶", icon: Ship },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const data = useClientAppData(getInitialAppData());

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-20 border-b border-sky-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/home" className="flex items-center gap-2">
            <span className="grid size-10 place-items-center overflow-hidden rounded-2xl bg-blue-700 p-1 text-white">
              <Image
                src="/tapoyota_logo.png"
                alt=""
                width={40}
                height={40}
                className="h-full w-full object-contain"
                aria-hidden="true"
              />
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
              href="/boats"
              className="hidden min-w-0 items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-2 text-blue-950 sm:flex"
              aria-label={`対象船舶: ${data.boat.name}`}
            >
              <Ship size={17} aria-hidden="true" />
              <span className="max-w-32 truncate text-xs font-black">
                {data.boat.name}
              </span>
            </Link>
            <Link
              href="/boats"
              className="grid size-10 place-items-center rounded-full border border-sky-200 bg-sky-50 text-blue-900 sm:hidden"
              aria-label={`対象船舶: ${data.boat.name}`}
            >
              <Ship size={19} aria-hidden="true" />
            </Link>
            <Link
              href="/notifications"
              className="relative grid size-10 place-items-center rounded-full border border-sky-200 text-blue-900"
              aria-label="通知"
            >
              <Bell size={19} aria-hidden="true" />
              <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-rose-500" />
            </Link>
            <Link
              href="/members"
              className="hidden rounded-full border border-sky-200 px-3 py-2 text-left text-xs font-semibold text-blue-900 sm:block"
            >
              <span className="block max-w-32 truncate">
                {data.currentUser.name}
              </span>
              <span className="block text-[10px] text-slate-500">
                {roleLabels[data.currentUser.role]}
              </span>
            </Link>
            <Link
              href="/members"
              className="sm:hidden"
              aria-label={`現在の利用者: ${data.currentUser.name}`}
            >
              <Badge className="bg-sky-100 text-blue-800 ring-sky-200">
                {data.currentUser.name.slice(0, 2)}
              </Badge>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-sky-100 bg-white/95 shadow-[0_-8px_28px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
        <div className="grid grid-cols-6 px-1 pb-[max(env(safe-area-inset-bottom),8px)] pt-2">
          {navItems.map((item) => {
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
        </div>
      </nav>
    </div>
  );
}
