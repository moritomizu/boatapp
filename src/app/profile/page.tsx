"use client";

import { useState } from "react";
import { Save, User } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, Section } from "@/components/ui";
import { updateClientAppData, useClientAppData } from "@/lib/client-store";
import { getInitialAppData } from "@/lib/data-source";

export default function ProfilePage() {
  const initialData = getInitialAppData();
  const data = useClientAppData(initialData);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [form, setForm] = useState({
    name: data.currentUser.name,
    phone: data.currentUser.phone ?? "",
    emergencyContact: data.currentUser.emergencyContact ?? "",
    licenseMemo: data.currentUser.licenseMemo ?? "",
    notes: data.currentUser.notes ?? "",
  });

  function updateForm<T extends keyof typeof form>(
    key: T,
    value: (typeof form)[T],
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
      name: form.name,
      phone: form.phone,
      emergencyContact: form.emergencyContact,
      licenseMemo: form.licenseMemo,
      notes: form.notes,
    };

    try {
      await updateClientAppData(
        (current) => ({
          ...current,
          currentUser: updatedUser,
          users: current.users.map((user) =>
            user.id === updatedUser.id ? updatedUser : user,
          ),
          organizationMembers: current.organizationMembers.map((member) =>
            member.userId === updatedUser.id
              ? {
                  ...member,
                  displayName: updatedUser.name,
                  updatedAt: new Date().toISOString(),
                }
              : member,
          ),
        }),
        data,
      );
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
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
                className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                required
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">電話番号</span>
              <input
                value={form.phone}
                onChange={(event) => updateForm("phone", event.target.value)}
                className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">緊急連絡先</span>
              <input
                value={form.emergencyContact}
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
                value={form.licenseMemo}
                onChange={(event) => updateForm("licenseMemo", event.target.value)}
                className="mt-2 min-h-24 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-base outline-none ring-blue-600 focus:ring-2"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">備考</span>
              <textarea
                value={form.notes}
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
