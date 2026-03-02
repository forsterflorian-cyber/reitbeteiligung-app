type StatusBadgeProps = {
  status: string;
};

const statusMap: Record<string, { label: string; className: string }> = {
  requested: {
    label: "Angefragt",
    className: "bg-amber-100 text-amber-800"
  },
  accepted: {
    label: "Angenommen",
    className: "bg-sky-100 text-sky-800"
  },
  declined: {
    label: "Abgelehnt",
    className: "bg-rose-100 text-rose-800"
  },
  completed: {
    label: "Durchgefuehrt",
    className: "bg-emerald-100 text-emerald-800"
  },
  approved: {
    label: "Freigeschaltet",
    className: "bg-emerald-100 text-emerald-800"
  },
  revoked: {
    label: "Freischaltung entzogen",
    className: "bg-stone-200 text-stone-700"
  }
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = status.toLowerCase();
  const variant = statusMap[normalized] ?? {
    label: status,
    className: "bg-stone-200 text-stone-700"
  };

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${variant.className}`}>
      {variant.label}
    </span>
  );
}
