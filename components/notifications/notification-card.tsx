import type { Notification } from "@/types/database";

import { markNotificationReadAction } from "@/app/actions";
import { Card } from "@/components/ui/card";
import { cx } from "@/lib/cx";

type NotificationCardProps = {
  notification: Notification;
};

function getNotificationTitle(eventType: string, payload: Record<string, unknown>): string {
  switch (eventType) {
    case "booking_created":
      return "Neue Buchung";
    case "booking_cancelled":
      return payload["reason"] === "owner_block" ? "Termin abgesagt (Sperrung)" : "Termin abgesagt";
    case "booking_rescheduled":
      return "Termin verschoben";
    case "trial_accepted":
      return "Probe angenommen";
    default:
      return "Benachrichtigung";
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function NotificationCard({ notification }: NotificationCardProps) {
  const isUnread = notification.read_at === null;
  const title = getNotificationTitle(notification.event_type, notification.payload);

  return (
    <Card
      className={cx(
        "flex items-start justify-between gap-4 p-4",
        isUnread ? "border-amber-200 bg-amber-50/60" : "opacity-75"
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <p className={cx("text-sm font-semibold text-stone-800", isUnread && "text-amber-900")}>{title}</p>
        <p className="text-xs text-stone-500">{formatDate(notification.created_at)}</p>
      </div>
      {isUnread ? (
        <form action={markNotificationReadAction} className="shrink-0">
          <input name="notificationId" type="hidden" value={notification.id} />
          <button
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:border-stone-300 hover:text-stone-900"
            type="submit"
          >
            Gelesen
          </button>
        </form>
      ) : null}
    </Card>
  );
}
