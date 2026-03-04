import type { Route } from "next";
import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { StatusTone } from "@/lib/status-display";
import type { TrialRequestStatus } from "@/types/database";

type HorseCalendarHeroProps = {
  description: string;
  detailHref: Route;
  isOwner: boolean;
  locationLine: string;
  nextTrialRangeLabel?: string | null;
  nextTrialRiderName?: string | null;
  nextTrialStatus?: TrialRequestStatus | null;
  ownerPlanLabel: string;
  ownerPlanTone: StatusTone;
  title: string;
};

export function HorseCalendarHero({
  description,
  detailHref,
  isOwner,
  locationLine,
  nextTrialRangeLabel,
  nextTrialRiderName,
  nextTrialStatus,
  ownerPlanLabel,
  ownerPlanTone,
  title
}: HorseCalendarHeroProps) {
  return (
    <div className="ui-horse-context">
      <div className="ui-horse-context-grid">
        <div className="space-y-2">
          <p className="ui-eyebrow">Pferdeprofil</p>
          <h2 className="font-serif text-2xl text-stone-900 sm:text-3xl">{title}</h2>
          <p className="ui-inline-meta">{locationLine}</p>
          <p className="text-sm leading-6 text-stone-600">{description}</p>
        </div>
        <div className="flex flex-col gap-3 lg:items-end">
          <div className="ui-kpi-row">
            <Badge tone="approved">Aktiv</Badge>
            <Badge tone={ownerPlanTone}>{ownerPlanLabel}</Badge>
          </div>
          {isOwner && nextTrialStatus && nextTrialRangeLabel ? (
            <Card className="w-full max-w-sm border-stone-200 bg-white/90 p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-stone-900">{"N\u00e4chstes Probereiten"}</p>
                  <StatusBadge status={nextTrialStatus} />
                </div>
                <p className="text-sm font-medium text-stone-800">{nextTrialRangeLabel}</p>
                <p className="text-xs leading-5 text-stone-600">
                  {nextTrialRiderName ? `Mit ${nextTrialRiderName}` : "Mit einem Reiter aus deinen offenen Probeterminen"}
                </p>
                <Link
                  className={buttonVariants(
                    "ghost",
                    "min-h-0 justify-start px-0 py-0 text-sm font-semibold text-forest hover:bg-transparent"
                  )}
                  href={"/owner/anfragen" as Route}
                >
                  Zu den Probeterminen
                </Link>
              </div>
            </Card>
          ) : null}
          <Link className={buttonVariants("secondary", "w-full lg:w-auto")} href={detailHref}>
            {"Pferdeprofil \u00f6ffnen"}
          </Link>
        </div>
      </div>
    </div>
  );
}
