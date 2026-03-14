import type { Notification } from "@/types/database";

import { markNotificationReadAction } from "@/app/actions";
import { Card } from "@/components/ui/card";
import { cx } from "@/lib/cx";

type NotificationCardProps = {
  notification: Notification;
};

function formatSlot(isoStart: string, isoEnd: string): string {
  const start = new Date(isoStart);
  const end = new Date(isoEnd);
  const day = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "long", timeZone: "UTC" }).format(start);
  const t1 = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(start);
  const t2 = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(end);
  return `${day} ${t1}–${t2}`;
}

function getNotificationTitle(eventType: string, payload: Record<string, unknown>): string {
  const horseName = typeof payload["horse_name"] === "string" ? payload["horse_name"] : null;
  const horseFor = horseName ? ` für ${horseName}` : "";
  const startAt = typeof payload["start_at"] === "string" ? payload["start_at"] : null;
  const endAt = typeof payload["end_at"] === "string" ? payload["end_at"] : null;
  const slot = startAt && endAt ? `: ${formatSlot(startAt, endAt)}` : "";

  switch (eventType) {
    case "booking_created": {
      const riderName = typeof payload["rider_name"] === "string" ? payload["rider_name"] : null;
      if (riderName) {
        return `${riderName} hat einen Termin${horseFor}${slot} gebucht`;
      }
      return `Neuer Termin${horseFor}${slot}`;
    }
    case "booking_cancelled": {
      const reason = payload["reason"];
      const cancelledBy = payload["cancelled_by"];
      const suffix = reason === "owner_block"
        ? " wurde wegen einer Sperrung abgesagt"
        : cancelledBy === "owner"
          ? " wurde vom Pferdehalter abgesagt"
          : " wurde abgesagt";
      return `Termin${horseFor}${slot}${suffix}`;
    }
    case "booking_rescheduled": {
      const oldStart = typeof payload["old_start_at"] === "string" ? payload["old_start_at"] : null;
      const oldEnd = typeof payload["old_end_at"] === "string" ? payload["old_end_at"] : null;
      const newStart = typeof payload["new_start_at"] === "string" ? payload["new_start_at"] : null;
      const newEnd = typeof payload["new_end_at"] === "string" ? payload["new_end_at"] : null;
      if (oldStart && oldEnd && newStart && newEnd) {
        return `Termin${horseFor} verschoben: ${formatSlot(oldStart, oldEnd)} → ${formatSlot(newStart, newEnd)}`;
      }
      return `Termin${horseFor} wurde verschoben`;
    }
    case "trial_accepted":
      return `Probe${horseFor} wurde angenommen`;
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
