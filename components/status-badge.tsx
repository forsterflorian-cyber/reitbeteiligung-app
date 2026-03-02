import type { ApprovalStatus, BookingRequestStatus, TrialRequestStatus } from "@/types/database";

import { Badge } from "@/components/ui/badge";
import { getStatusDisplay } from "@/lib/status-display";

type StatusBadgeProps = {
  status: TrialRequestStatus | ApprovalStatus | BookingRequestStatus;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const display = getStatusDisplay(status);

  return <Badge tone={display.tone}>{display.label}</Badge>;
}
