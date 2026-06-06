"use client";

import Link from "next/link";
import { Clock, LogOut, User } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge, Card, Section } from "@/components/ui";
import { resetClientAppData, useClientAppData } from "@/lib/client-store";
import { getInitialAppData } from "@/lib/data-source";
import { firebaseAuth } from "@/lib/firebase";
import {
  applicationStatusLabels,
  applicationTypeLabels,
  latestApplicationForCurrentUser,
} from "@/lib/membership";

export default function PendingPage() {
  const data = useClientAppData(getInitialAppData());
  const application = latestApplicationForCurrentUser(data);

  async function logout() {
    if (firebaseAuth) {
      const { signOut } = await import("firebase/auth");
      await signOut(firebaseAuth);
    }
    resetClientAppData();
    window.location.href = "/login";
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-bold text-blue-700">承認待ち</p>
          <h1 className="text-2xl font-black tracking-normal text-blue-950">
            参加申請を受け付けました
          </h1>
          <p className="text-sm leading-6 text-slate-600">
            管理者の確認後、利用できる船や機能が表示されます。承認までは予約・出船チェック・航海ログなどの機能は利用できません。
          </p>
        </div>

        {application ? (
          <Section title="申請状況">
            <Card>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-blue-950">
                    {applicationTypeLabels[application.applicationType]}
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
                    {new Intl.DateTimeFormat("ja-JP", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(application.createdAt))}
                  </p>
                </div>
                <Badge className="bg-amber-100 text-amber-900 ring-amber-200">
                  {applicationStatusLabels[application.status]}
                </Badge>
              </div>
              {application.adminMessage ? (
                <p className="mt-3 rounded-lg bg-sky-50 p-3 text-sm font-bold leading-6 text-blue-900">
                  管理者メッセージ: {application.adminMessage}
                </p>
              ) : null}
              {application.rejectionReason ? (
                <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm font-bold leading-6 text-rose-800">
                  理由: {application.rejectionReason}
                </p>
              ) : null}
            </Card>
          </Section>
        ) : (
          <Card>
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 text-blue-800" size={22} aria-hidden="true" />
              <div>
                <p className="font-black text-blue-950">
                  参加申請がまだありません
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  アカウント作成後、所属クラブへの参加申請を送信してください。
                </p>
              </div>
            </div>
          </Card>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <Link
            href="/apply"
            className="flex min-h-12 items-center justify-center rounded-lg bg-blue-800 px-4 text-sm font-black text-white"
          >
            申請フォームへ
          </Link>
          <Link
            href="/profile"
            className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-sky-200 bg-white px-4 text-sm font-black text-blue-900"
          >
            <User size={17} aria-hidden="true" />
            プロフィール確認
          </Link>
        </div>

        <button
          type="button"
          onClick={() => void logout()}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 text-sm font-black text-rose-800"
        >
          <LogOut size={17} aria-hidden="true" />
          ログアウト
        </button>
      </div>
    </AppShell>
  );
}
