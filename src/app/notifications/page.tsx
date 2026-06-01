import { AppShell } from "@/components/app-shell";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { getInitialAppData } from "@/lib/data-source";

export default function NotificationsPage() {
  const data = getInitialAppData();

  return (
    <AppShell>
      <NotificationCenter data={data} />
    </AppShell>
  );
}
