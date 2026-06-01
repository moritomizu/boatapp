import Image from "next/image";
import { Edit3, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge, Card, Field, Section } from "@/components/ui";
import { getInitialAppData } from "@/lib/data-source";
import { boatStatusLabels, boatStatusTone, roleLabels } from "@/lib/labels";

export default function BoatsPage() {
  const data = getInitialAppData();
  const canEdit = data.currentUser.role === "admin";

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-bold text-blue-700">船舶情報</p>
          <h1 className="text-3xl font-black tracking-normal text-blue-950">
            {data.boat.name}
          </h1>
          <p className="text-sm leading-6 text-slate-600">
            管理者は編集可能。共同オーナーとメンバーは閲覧専用です。
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border border-sky-100 bg-white shadow-sm">
          <div className="relative aspect-[4/3] w-full sm:aspect-[16/9]">
            <Image
              src={data.boat.imageUrl}
              alt={`${data.boat.name}のイメージ`}
              fill
              sizes="(min-width: 768px) 960px, 100vw"
              className="object-cover"
              priority
            />
          </div>
          <div className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={boatStatusTone[data.boat.status]}>
                {boatStatusLabels[data.boat.status]}
              </Badge>
              <Badge className="bg-slate-100 text-slate-700 ring-slate-200">
                {roleLabels[data.currentUser.role]}として表示
              </Badge>
            </div>
            {canEdit ? (
              <button className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 text-sm font-black text-white sm:w-auto">
                <Edit3 size={18} aria-hidden="true" />
                船舶情報を編集
              </button>
            ) : (
              <div className="flex items-start gap-2 rounded-lg bg-sky-50 p-3 text-sm font-semibold leading-6 text-blue-900">
                <ShieldCheck className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
                閲覧専用です。変更が必要な場合は管理者へ連絡してください。
              </div>
            )}
          </div>
        </div>

        <Section title="基本情報">
          <Card>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Field label="船名" value={data.boat.name} />
              <Field label="係留場所" value={data.boat.mooringLocation} />
              <Field label="定員" value={`${data.boat.capacity}名`} />
              <Field label="燃料種別" value={data.boat.fuelType} />
              <Field label="エンジン情報" value={data.boat.engineInfo} />
              <Field
                label="最終更新日"
                value={new Intl.DateTimeFormat("ja-JP", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(data.boat.updatedAt))}
              />
            </dl>
          </Card>
        </Section>

        <Section title="備考">
          <Card>
            <p className="text-sm leading-7 text-slate-700">{data.boat.notes}</p>
          </Card>
        </Section>
      </div>
    </AppShell>
  );
}
