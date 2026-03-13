import { redirect } from "next/navigation";

import { getViewerContext } from "@/lib/auth";
import { getUserNotifications } from "@/lib/server-actions/notifications";
import { NotificationCard } from "@/components/notifications/notification-card";
import { PageHeader } from "@/components/ui/page-header";

export default async function BenachrichtigungenPage() {
  const { supabase, user } = await getViewerContext();

  if (!user) {
    redirect("/login");
  }

  const notifications = await getUserNotifications(supabase);

  return (
    <div className="space-y-4">
      <PageHeader title="Benachrichtigungen" />
      {notifications.length === 0 ? (
        <p className="text-sm text-stone-500">Keine Benachrichtigungen vorhanden.</p>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <NotificationCard key={notification.id} notification={notification} />
          ))}
        </div>
      )}
    </div>
  );
}
