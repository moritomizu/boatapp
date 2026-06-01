import { AppShell } from "@/components/app-shell";
import { CheckWorkflow } from "@/components/checks/check-workflow";
import { preDepartureCheckItems } from "@/lib/check-items";
import { getInitialAppData } from "@/lib/data-source";

type PreDepartureCheckPageProps = {
  searchParams?: Promise<{ reservationId?: string }>;
};

export default async function PreDepartureCheckPage({
  searchParams,
}: PreDepartureCheckPageProps) {
  const params = await searchParams;
  const data = getInitialAppData();

  return (
    <AppShell>
      <CheckWorkflow
        title="出船前チェック"
        description="船に到着してから出航前に確認するチェックリストです。安全確認と前回申し送りの確認をここに残します。"
        mode="pre-departure"
        data={data}
        initialReservationId={params?.reservationId}
        items={preDepartureCheckItems}
        initialHistory={data.preDepartureChecks}
      />
    </AppShell>
  );
}
