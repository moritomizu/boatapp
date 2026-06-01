import { AppShell } from "@/components/app-shell";
import { HandoverBoard } from "@/components/handovers/handover-board";
import { getInitialAppData } from "@/lib/data-source";

type HandoversPageProps = {
  searchParams?: Promise<{
    reservationId?: string;
    title?: string;
    body?: string;
  }>;
};

export default async function HandoversPage({
  searchParams,
}: HandoversPageProps) {
  const params = await searchParams;
  const data = getInitialAppData();

  return (
    <AppShell>
      <HandoverBoard
        data={data}
        initialDraft={{
          reservationId: params?.reservationId,
          title: params?.title,
          body: params?.body,
        }}
      />
    </AppShell>
  );
}
