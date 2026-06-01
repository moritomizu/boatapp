import { AppShell } from "@/components/app-shell";
import { CheckWorkflow } from "@/components/checks/check-workflow";
import { postReturnCheckItems } from "@/lib/check-items";
import { getInitialAppData } from "@/lib/data-source";

type PostReturnCheckPageProps = {
  searchParams?: Promise<{ reservationId?: string }>;
};

export default async function PostReturnCheckPage({
  searchParams,
}: PostReturnCheckPageProps) {
  const params = await searchParams;
  const data = getInitialAppData();

  return (
    <AppShell>
      <CheckWorkflow
        title="帰港後チェック"
        description="利用終了後、離船前に行うチェックリストです。次回利用者が安心して乗れる状態を残します。"
        mode="post-return"
        data={data}
        initialReservationId={params?.reservationId}
        items={postReturnCheckItems}
        initialHistory={data.postReturnChecks}
      />
    </AppShell>
  );
}
