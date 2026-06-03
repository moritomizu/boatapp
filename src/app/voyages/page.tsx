import { AppShell } from "@/components/app-shell";
import { VoyageBoard } from "@/components/voyages/voyage-board";
import { getInitialAppData } from "@/lib/data-source";

type VoyagesPageProps = {
  searchParams?: Promise<{ reservationId?: string }>;
};

export default async function VoyagesPage({ searchParams }: VoyagesPageProps) {
  const params = await searchParams;
  const data = getInitialAppData();

  return (
    <AppShell>
      <VoyageBoard
        data={data}
        initialReservationId={params?.reservationId}
      />
    </AppShell>
  );
}
