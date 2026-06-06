import { AppShell } from "@/components/app-shell";
import { VoyageLogReview } from "@/components/voyages/voyage-log-review";
import { getInitialAppData } from "@/lib/data-source";

type VoyageLogReviewPageProps = {
  params: Promise<{ logId: string }>;
};

export default async function VoyageLogReviewPage({
  params,
}: VoyageLogReviewPageProps) {
  const { logId } = await params;
  const data = getInitialAppData();

  return (
    <AppShell>
      <VoyageLogReview data={data} logId={logId} />
    </AppShell>
  );
}
