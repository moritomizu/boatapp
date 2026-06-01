import { Edit3, Plus, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge, Card, Section } from "@/components/ui";
import { getInitialAppData } from "@/lib/data-source";
import { roleLabels } from "@/lib/labels";

const roleTone = {
  admin: "bg-blue-100 text-blue-900 ring-blue-200",
  owner: "bg-cyan-100 text-cyan-900 ring-cyan-200",
  member: "bg-slate-100 text-slate-700 ring-slate-200",
};

export default function MembersPage() {
  const data = getInitialAppData();
  const canEdit = data.currentUser.role === "admin";

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-bold text-blue-700">メンバー管理</p>
          <h1 className="text-3xl font-black tracking-normal text-blue-950">
            権限と利用条件
          </h1>
          <p className="text-sm leading-6 text-slate-600">
            単独出船、夜間利用、備考を一覧化し、将来の利用制限に接続します。
          </p>
        </div>

        {canEdit ? (
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="rounded-lg bg-sky-50 p-3 text-sm font-semibold text-blue-900">
              管理者として表示中。追加・編集UIを接続できる状態です。
            </div>
            <button className="flex h-12 items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-black text-white">
              <Plus size={19} aria-hidden="true" />
              メンバー追加
            </button>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-lg bg-sky-50 p-3 text-sm font-semibold leading-6 text-blue-900">
            <ShieldCheck className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
            閲覧専用です。権限変更は管理者が行います。
          </div>
        )}

        <Section title="メンバー一覧">
          <div className="space-y-3">
            {data.users.map((user) => (
              <Card key={user.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black text-slate-950">
                      {user.name}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{user.email}</p>
                  </div>
                  <Badge className={roleTone[user.role]}>
                    {roleLabels[user.role]}
                  </Badge>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-bold text-slate-500">単独出船</p>
                    <p className="mt-1 font-black text-slate-950">
                      {user.canSolo ? "可" : "不可"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-bold text-slate-500">夜間利用</p>
                    <p className="mt-1 font-black text-slate-950">
                      {user.canNightUse ? "可" : "不可"}
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-6 text-slate-600">
                  {user.notes}
                </p>

                {canEdit ? (
                  <button className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-sky-200 text-sm font-black text-blue-900">
                    <Edit3 size={17} aria-hidden="true" />
                    編集
                  </button>
                ) : null}
              </Card>
            ))}
          </div>
        </Section>
      </div>
    </AppShell>
  );
}
