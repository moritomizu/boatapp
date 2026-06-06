"use client";

import { useEffect, useMemo, useState } from "react";
import { Save, User } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge, Card, Section } from "@/components/ui";
import {
  refreshClientAppData,
  updateClientAppData,
  useClientAppData,
} from "@/lib/client-store";
import { getInitialAppData } from "@/lib/data-source";
import {
  applicationStatusLabels,
  applicationTypeLabels,
  latestApplicationForCurrentUser,
} from "@/lib/membership";

export default function ProfilePage() {
  const initialData = useMemo(() => getInitialAppData(), []);
  const data = useClientAppData(initialData);
  const latestApplication = latestApplicationForCurrentUser(data);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [form, setForm] = useState<Partial<{
    name: string;
    phone: string;
    emergencyContact: string;
    licenseMemo: string;
    notes: string;
  }>>({});

  useEffect(() => {
    void refreshClientAppData(initialData, { force: true });
  }, [initialData]);

  function updateForm<T extends keyof typeof form>(
    key: T,
    value: string,
  ) {
    if (saveState !== "idle") setSaveState("idle");
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveState === "saving") return;
    setSaveState("saving");

    const updatedUser = {
      ...data.currentUser,
      name: form.name ?? data.currentUser.name,
      phone: form.phone ?? data.currentUser.phone ?? "",
      emergencyContact:
        form.emergencyContact ?? data.currentUser.emergencyContact ?? "",
      licenseMemo: form.licenseMemo ?? data.currentUser.licenseMemo ?? "",
      notes: form.notes ?? data.currentUser.notes ?? "",
    };

    try {
      await updateClientAppData(
        (current) => {
          const existingUser = current.users.find(
            (user) =>
              user.id === updatedUser.id ||
              (user.email && user.email === updatedUser.email),
          );
          const nextUser = existingUser
            ? { ...existingUser, ...updatedUser, id: existingUser.id }
            : updatedUser;

          return {
            ...current,
            currentUser: nextUser,
            currentUserId: nextUser.id,
            users: existingUser
              ? current.users.map((user) =>
                  user.id === existingUser.id ? nextUser : user,
                )
              : [nextUser, ...current.users],
            organizationMembers: current.organizationMembers.map((member) =>
              member.userId === nextUser.id
                ? {
                    ...member,
                    displayName: nextUser.name,
                    updatedAt: new Date().toISOString(),
                  }
                : member,
            ),
          };
        },
        data,
      );
      setForm({});
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-bold text-blue-700">プロフィール</p>
          <h1 className="text-2xl font-black tracking-normal text-blue-950">
            利用者情報
          </h1>
          <p className="text-sm leading-6 text-slate-600">
            連絡先、緊急連絡先、船舶免許メモを管理します。
          </p>
        </div>

        {latestApplication?.adminMessage ? (
          <div id="membership-message" className="scroll-mt-24">
            <Section title="参加申請・承認メッセージ">
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-blue-950">
                      {applicationTypeLabels[latestApplication.applicationType]}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {latestApplication.reviewedAt
                        ? new Intl.DateTimeFormat("ja-JP", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(new Date(latestApplication.reviewedAt))
                        : "管理者確認中"}
                    </p>
                  </div>
                  <Badge className="bg-sky-100 text-blue-800 ring-sky-200">
                    {applicationStatusLabels[latestApplication.status]}
                  </Badge>
                </div>
                <p className="mt-3 rounded-lg bg-sky-50 p-3 text-sm font-bold leading-6 text-blue-900">
                  {latestApplication.adminMessage}
                </p>
              </Card>
            </Section>
          </div>
        ) : null}

        <Section title="プロフィール編集">
          <form
            onSubmit={saveProfile}
            className="space-y-4 rounded-lg border border-sky-100 bg-white p-4 shadow-sm"
          >
            <Card>
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-lg bg-sky-100 text-blue-800">
                  <User size={22} aria-hidden="true" />
                </span>
                <div>
                  <p className="font-black text-blue-950">{data.currentUser.email}</p>
                  <p className="mt-1 text-sm font-bold text-slate-500">
                    {data.organization.name}
                  </p>
                </div>
              </div>
            </Card>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">表示名</span>
              <input
                value={form.name ?? data.currentUser.name}
                onChange={(event) => updateForm("name", event.target.value)}
                className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                required
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">電話番号</span>
              <input
                value={form.phone ?? data.currentUser.phone ?? ""}
                onChange={(event) => updateForm("phone", event.target.value)}
                className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">緊急連絡先</span>
              <input
                value={
                  form.emergencyContact ??
                  data.currentUser.emergencyContact ??
                  ""
                }
                onChange={(event) =>
                  updateForm("emergencyContact", event.target.value)
                }
                className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">
                船舶免許情報メモ
              </span>
              <textarea
                value={form.licenseMemo ?? data.currentUser.licenseMemo ?? ""}
                onChange={(event) => updateForm("licenseMemo", event.target.value)}
                className="mt-2 min-h-24 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-base outline-none ring-blue-600 focus:ring-2"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">備考</span>
              <textarea
                value={form.notes ?? data.currentUser.notes ?? ""}
                onChange={(event) => updateForm("notes", event.target.value)}
                className="mt-2 min-h-24 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-base outline-none ring-blue-600 focus:ring-2"
              />
            </label>

            {saveState === "error" ? (
              <p className="rounded-lg bg-rose-50 p-3 text-sm font-bold text-rose-800">
                保存に失敗しました。通信状態とFirestore Rulesを確認してください。
              </p>
            ) : saveState === "saved" ? (
              <p className="rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
                プロフィールを保存しました。
              </p>
            ) : null}

            <button
              type="submit"
              disabled={saveState === "saving"}
              className="flex h-13 w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 text-base font-black text-white disabled:bg-slate-300"
            >
              <Save size={20} aria-hidden="true" />
              {saveState === "saving" ? "保存中..." : "保存する"}
            </button>
          </form>
        </Section>
      </div>
    </AppShell>
  );
}
