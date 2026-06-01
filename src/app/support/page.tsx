import { AppShell } from "@/components/app-shell";
import { SupportBoard } from "@/components/support/support-board";
import { getInitialAppData } from "@/lib/data-source";

type SupportPageProps = {
  searchParams?: Promise<{ reservationId?: string }>;
};

export default async function SupportPage({ searchParams }: SupportPageProps) {
  const params = await searchParams;
  const data = getInitialAppData();

  return (
    <AppShell>
      <SupportBoard
        data={data}
        initialDraft={{ reservationId: params?.reservationId }}
      />
    </AppShell>
  );
}
