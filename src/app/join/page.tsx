"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, KeyRound, LogIn } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, Section } from "@/components/ui";
import { updateClientAppData, useClientAppData } from "@/lib/client-store";
import { getInitialAppData } from "@/lib/data-source";

export default function JoinPage() {
  const data = useClientAppData(getInitialAppData());
  const searchParams = useSearchParams();
  const code = searchParams.get("code")?.trim().toUpperCase() ?? "";
  const invite = data.organizationInvites.find(
    (item) => item.inviteCode.toUpperCase() === code,
  );
  const alreadyMember = data.organizationMembers.some(
    (member) =>
      member.organizationId === data.organization.id &&
      member.userId === data.currentUser.id &&
      member.isActive,
  );

  async function acceptInvite() {
    if (!invite || invite.status !== "pending") return;

    const now = new Date().toISOString();
    await updateClientAppData(
      (current) => {
        const userExists = current.users.some(
          (user) => user.id === current.currentUser.id,
        );
        const memberExists = current.organizationMembers.some(
          (member) =>
            member.organizationId === invite.organizationId &&
            member.userId === current.currentUser.id,
        );

        return {
          ...current,
          users: userExists
            ? current.users.map((user) =>
                user.id === current.currentUser.id
                  ? { ...user, role: invite.role, organizationId: invite.organizationId }
                  : user,
              )
            : [
                {
                  ...current.currentUser,
                  role: invite.role,
                  organizationId: invite.organizationId,
                },
                ...current.users,
              ],
          currentUser: {
            ...current.currentUser,
            role: invite.role,
            organizationId: invite.organizationId,
          },
          organizationMembers: memberExists
            ? current.organizationMembers.map((member) =>
                member.organizationId === invite.organizationId &&
                member.userId === current.currentUser.id
                  ? {
                      ...member,
                      role: invite.role,
                      isActive: true,
                      updatedAt: now,
                    }
                  : member,
              )
            : [
                {
                  id: `org-member-${crypto.randomUUID()}`,
                  organizationId: invite.organizationId,
                  userId: current.currentUser.id,
                  role: invite.role,
                  displayName: current.currentUser.name,
                  email: current.currentUser.email,
                  isActive: true,
                  createdAt: now,
                  updatedAt: now,
                },
                ...current.organizationMembers,
              ],
          organizationInvites: current.organizationInvites.map((item) =>
            item.id === invite.id
              ? {
                  ...item,
                  status: "accepted",
                  acceptedBy: current.currentUser.id,
                  acceptedAt: now,
                  updatedAt: now,
                }
              : item,
          ),
        };
      },
      data,
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-bold text-blue-700">メンバー招待</p>
          <h1 className="text-2xl font-black tracking-normal text-blue-950">
            組織へ参加
          </h1>
          <p className="text-sm leading-6 text-slate-600">
            招待コードを確認し、ログイン中のアカウントを組織メンバーに追加します。
          </p>
        </div>

        <Section title="招待内容">
          <Card>
            {invite ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-lg bg-blue-100 text-blue-800">
                    <KeyRound size={22} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-black text-slate-950">
                      {invite.email}
                    </p>
                    <p className="text-sm font-bold text-slate-500">
                      招待コード: {invite.inviteCode}
                    </p>
                  </div>
                </div>
                <p className="text-sm leading-6 text-slate-600">
                  予定ロール: {invite.role === "owner" ? "共同オーナー" : "メンバー"}
                </p>
                <p className="text-sm leading-6 text-slate-600">
                  有効期限:{" "}
                  {new Intl.DateTimeFormat("ja-JP", {
                    dateStyle: "medium",
                  }).format(new Date(invite.expiresAt))}
                </p>
                {alreadyMember || invite.status === "accepted" ? (
                  <div className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
                    <CheckCircle2 size={18} aria-hidden="true" />
                    参加済みです。
                  </div>
                ) : invite.status !== "pending" ? (
                  <p className="rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-900">
                    この招待は現在利用できません。
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => void acceptInvite()}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-black text-white"
                  >
                    <LogIn size={18} aria-hidden="true" />
                    この組織に参加する
                  </button>
                )}
              </div>
            ) : (
              <p className="text-sm font-semibold leading-6 text-slate-600">
                招待コードが見つかりません。管理者から共有されたURLを確認してください。
              </p>
            )}
          </Card>
        </Section>

        <Link
          href="/home"
          className="flex h-12 items-center justify-center rounded-lg bg-white px-4 text-sm font-black text-blue-900 ring-1 ring-sky-100"
        >
          ホームへ戻る
        </Link>
      </div>
    </AppShell>
  );
}
