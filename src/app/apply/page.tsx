"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Send } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, Section } from "@/components/ui";
import { updateClientAppData, useClientAppData } from "@/lib/client-store";
import { getInitialAppData } from "@/lib/data-source";
import { applicationTypeLabels } from "@/lib/membership";
import type {
  LicenseType,
  MembershipApplication,
  MembershipApplicationType,
} from "@/types/domain";

const purposes = ["釣り", "クルージング", "家族利用", "花火/イベント利用", "船長経験を積みたい", "将来的に船を持ちたい", "遊漁船開業に興味がある"];
const managementTools = ["LINE", "Googleカレンダー", "TimeTree", "Excel", "紙", "その他"];

export default function ApplyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const data = useClientAppData(getInitialAppData());
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [form, setForm] = useState({
    applicationType: (searchParams.get("inviteCode") ? "invite" : "member") as MembershipApplicationType,
    inviteCode: searchParams.get("inviteCode") ?? "",
    name: data.currentUser.name,
    email: data.currentUser.email,
    phone: data.currentUser.phone ?? "",
    birthDate: "",
    emergencyContact: data.currentUser.emergencyContact ?? "",
    area: "",
    hasLicense: false,
    licenseType: "none",
    acquiredYear: "",
    boatingExperience: "ほぼなし",
    nightNavigationExperience: false,
    dockingExperience: false,
    previousBoatTypes: "",
    selectedPurposes: [] as string[],
    desiredFrequency: "monthly_1",
    wantsSoloNavigation: false,
    wantsNightUse: false,
    wantsGuestUse: false,
    wantsEventUse: false,
    referrer: "",
    message: "",
    boatName: "",
    boatType: "",
    homePort: "",
    organizationName: "",
    businessType: "プレジャーボート共同運営",
    boatCount: 1,
    currentManagementTools: [] as string[],
    painPoints: "",
  });

  function update<T extends keyof typeof form>(key: T, value: (typeof form)[T]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleArray(key: "selectedPurposes" | "currentManagementTools", value: string) {
    setForm((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((item) => item !== value)
        : [...current[key], value],
    }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "saving") return;
    setState("saving");
    setErrorMessage("");

    const now = new Date().toISOString();
    const application: MembershipApplication = {
      id: `application-${crypto.randomUUID()}`,
      userId: data.currentUser.id,
      organizationId: data.organization.id,
      applicationType: form.applicationType,
      status: "pending",
      inviteCode: form.inviteCode || undefined,
      profile: {
        name: form.name,
        email: form.email,
        phone: form.phone,
        birthDate: form.birthDate,
        emergencyContact: form.emergencyContact,
        area: form.area,
      },
      licenseInfo: {
        hasLicense: form.hasLicense,
        licenseType: form.licenseType as LicenseType,
        acquiredYear: form.acquiredYear ? Number(form.acquiredYear) : undefined,
      },
      experienceInfo: {
        boatingExperience: form.boatingExperience,
        nightNavigationExperience: form.nightNavigationExperience,
        dockingExperience: form.dockingExperience,
        previousBoatTypes: form.previousBoatTypes
          .split(/[、,\n]/)
          .map((item) => item.trim())
          .filter(Boolean),
      },
      usageIntent: {
        purposes: form.selectedPurposes,
        desiredFrequency: form.desiredFrequency as "monthly_1" | "monthly_2" | "monthly_3_plus",
        wantsSoloNavigation: form.wantsSoloNavigation,
        wantsNightUse: form.wantsNightUse,
        wantsGuestUse: form.wantsGuestUse,
        wantsEventUse: form.wantsEventUse,
      },
      boatOwnerInfo:
        form.applicationType === "boat_owner"
          ? {
              boatName: form.boatName,
              boatType: form.boatType,
              homePort: form.homePort,
            }
          : undefined,
      adoptionInfo:
        form.applicationType === "boatos_adoption"
          ? {
              organizationName: form.organizationName,
              businessType: form.businessType,
              boatCount: Number(form.boatCount) || 0,
              currentManagementTools: form.currentManagementTools,
              painPoints: form.painPoints,
            }
          : undefined,
      message: form.message,
      referrer: form.referrer,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await updateClientAppData(
        (current) => ({
          ...current,
          membershipApplications: [application, ...(current.membershipApplications ?? [])],
        }),
        data,
      );
      router.push("/pending");
    } catch (error) {
      setErrorMessage(
        error instanceof Error && error.message
          ? error.message
          : "Firestoreへの保存に失敗しました。",
      );
      setState("error");
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-bold text-blue-700">参加申請</p>
          <h1 className="text-2xl font-black tracking-normal text-blue-950">
            BoatOS利用申請
          </h1>
          <p className="text-sm leading-6 text-slate-600">
            アカウント作成後、所属クラブまたは導入相談の申請を送信します。承認までは予約・出船機能は利用できません。
          </p>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <Section title="利用目的">
            <Card>
              <div className="space-y-2">
                {(Object.keys(applicationTypeLabels) as MembershipApplicationType[]).map((type) => (
                  <label key={type} className="flex min-h-12 items-center gap-3 rounded-lg bg-slate-50 px-3 text-sm font-black text-slate-800">
                    <input
                      type="radio"
                      checked={form.applicationType === type}
                      onChange={() => update("applicationType", type)}
                      className="size-5 accent-blue-800"
                    />
                    {applicationTypeLabels[type]}
                  </label>
                ))}
              </div>
            </Card>
          </Section>

          <Section title="基本情報">
            <Card>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["name", "氏名"],
                  ["email", "メールアドレス"],
                  ["phone", "電話番号"],
                  ["birthDate", "生年月日"],
                  ["emergencyContact", "緊急連絡先"],
                  ["area", "居住エリア"],
                ].map(([key, label]) => (
                  <label key={key} className="block">
                    <span className="text-sm font-bold text-slate-700">{label}</span>
                    <input
                      type={key === "birthDate" ? "date" : key === "email" ? "email" : "text"}
                      value={String(form[key as keyof typeof form] ?? "")}
                      onChange={(event) =>
                        update(key as keyof typeof form, event.target.value as never)
                      }
                      className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                    />
                  </label>
                ))}
              </div>
            </Card>
          </Section>

          {form.applicationType === "invite" ? (
            <Section title="招待コード">
              <Card>
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">招待コード</span>
                  <input
                    value={form.inviteCode}
                    onChange={(event) => update("inviteCode", event.target.value.toUpperCase())}
                    className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base font-black outline-none ring-blue-600 focus:ring-2"
                  />
                </label>
              </Card>
            </Section>
          ) : null}

          {form.applicationType === "boat_owner" ? (
            <Section title="船主相談">
              <Card>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ["boatName", "船名"],
                    ["boatType", "船種"],
                    ["homePort", "港/係留場所"],
                  ].map(([key, label]) => (
                    <label key={key} className="block">
                      <span className="text-sm font-bold text-slate-700">{label}</span>
                      <input
                        value={String(form[key as keyof typeof form] ?? "")}
                        onChange={(event) =>
                          update(key as keyof typeof form, event.target.value as never)
                        }
                        className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                      />
                    </label>
                  ))}
                </div>
              </Card>
            </Section>
          ) : null}

          {form.applicationType === "boatos_adoption" ? (
            <Section title="導入相談">
              <Card>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-bold text-slate-700">会社名/団体名</span>
                    <input
                      value={form.organizationName}
                      onChange={(event) => update("organizationName", event.target.value)}
                      className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-bold text-slate-700">運営している船の数</span>
                    <input
                      type="number"
                      min={0}
                      value={form.boatCount}
                      onChange={(event) => update("boatCount", Number(event.target.value))}
                      className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                    />
                  </label>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {managementTools.map((tool) => (
                    <label key={tool} className="flex min-h-11 items-center gap-2 rounded-lg bg-slate-50 px-3 text-sm font-bold">
                      <input
                        type="checkbox"
                        checked={form.currentManagementTools.includes(tool)}
                        onChange={() => toggleArray("currentManagementTools", tool)}
                        className="size-5 accent-blue-800"
                      />
                      {tool}
                    </label>
                  ))}
                </div>
              </Card>
            </Section>
          ) : null}

          {form.applicationType === "member" || form.applicationType === "invite" ? (
            <>
              <Section title="免許・経験">
                <Card>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex min-h-12 items-center gap-2 rounded-lg bg-slate-50 px-3 text-sm font-black">
                      <input
                        type="checkbox"
                        checked={form.hasLicense}
                        onChange={(event) => update("hasLicense", event.target.checked)}
                        className="size-5 accent-blue-800"
                      />
                      小型船舶免許あり
                    </label>
                    <label className="block">
                      <span className="text-sm font-bold text-slate-700">免許種別</span>
                      <select
                        value={form.licenseType}
                        onChange={(event) => update("licenseType", event.target.value)}
                        className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                      >
                        <option value="none">なし</option>
                        <option value="first_class">1級</option>
                        <option value="second_class">2級</option>
                        <option value="special">特殊</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-sm font-bold text-slate-700">免許取得年</span>
                      <input
                        type="number"
                        value={form.acquiredYear}
                        onChange={(event) => update("acquiredYear", event.target.value)}
                        className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-bold text-slate-700">操船経験</span>
                      <select
                        value={form.boatingExperience}
                        onChange={(event) => update("boatingExperience", event.target.value)}
                        className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                      >
                        {["ほぼなし", "同乗経験あり", "レンタルボート経験あり", "自船/共同艇の操船経験あり", "遊漁船/業務経験あり"].map((item) => (
                          <option key={item}>{item}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </Card>
              </Section>

              <Section title="利用目的・希望">
                <Card>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {purposes.map((purpose) => (
                      <label key={purpose} className="flex min-h-11 items-center gap-2 rounded-lg bg-slate-50 px-3 text-sm font-bold">
                        <input
                          type="checkbox"
                          checked={form.selectedPurposes.includes(purpose)}
                          onChange={() => toggleArray("selectedPurposes", purpose)}
                          className="size-5 accent-blue-800"
                        />
                        {purpose}
                      </label>
                    ))}
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {[
                      ["wantsSoloNavigation", "単独出船を希望"],
                      ["wantsNightUse", "夜間利用を希望"],
                      ["wantsGuestUse", "家族・友人同伴を希望"],
                      ["wantsEventUse", "イベント利用を希望"],
                    ].map(([key, label]) => (
                      <label key={key} className="flex min-h-11 items-center gap-2 rounded-lg bg-slate-50 px-3 text-sm font-bold">
                        <input
                          type="checkbox"
                          checked={Boolean(form[key as keyof typeof form])}
                          onChange={(event) =>
                            update(key as keyof typeof form, event.target.checked as never)
                          }
                          className="size-5 accent-blue-800"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </Card>
              </Section>
            </>
          ) : null}

          <Section title="自由記入">
            <Card>
              <label className="block">
                <span className="text-sm font-bold text-slate-700">紹介者</span>
                <input
                  value={form.referrer}
                  onChange={(event) => update("referrer", event.target.value)}
                  className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-base outline-none ring-blue-600 focus:ring-2"
                />
              </label>
              <label className="mt-3 block">
                <span className="text-sm font-bold text-slate-700">管理者に伝えたいこと</span>
                <textarea
                  value={form.message}
                  onChange={(event) => update("message", event.target.value)}
                  className="mt-2 min-h-28 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-base outline-none ring-blue-600 focus:ring-2"
                />
              </label>
            </Card>
          </Section>

          {state === "error" ? (
            <p className="rounded-lg bg-rose-50 p-3 text-sm font-bold text-rose-800">
              申請の保存に失敗しました。Firestore Rulesで
              membershipApplications の作成権限を確認してください。
              {errorMessage ? ` 詳細: ${errorMessage}` : ""}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={state === "saving"}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-5 text-base font-black text-white disabled:bg-slate-300"
          >
            <Send size={21} aria-hidden="true" />
            {state === "saving" ? "送信中..." : "参加申請を送信"}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
