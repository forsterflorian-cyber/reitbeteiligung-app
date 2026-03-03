import type { Route } from "next";
import Link from "next/link";

import { acceptBookingRequestAction, declineBookingRequestAction, deleteRiderRelationshipAction, saveRiderBookingLimitAction, updateApprovalAction, updateTrialRequestStatusAction } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Notice } from "@/components/notice";
import { AppPageShell } from "@/components/ui/app-page-shell";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { requireProfile } from "@/lib/auth";
import { formatWeeklyHoursLimit } from "@/lib/booking-limits";
import { readSearchParam } from "@/lib/search-params";
import type { Approval, BookingRequest, Conversation, Horse, Message, Profile, RiderBookingLimit, RiderProfile, TrialRequest } from "@/types/database";

type OwnerRequestItem = TrialRequest & {
  horse?: Horse | null;
};

type OwnerBookingRequestItem = BookingRequest & {
  horse?: Horse | null;
};

type ActiveRelationshipItem = {
  approval: Approval;
  conversation: Conversation | null;
  horse: Horse | null;
  latestTrial: OwnerRequestItem | null;
  riderBookingLimit: RiderBookingLimit | null;
};

type ContactInfoRecord = {
  partner_name: string | null;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatDateRange(startAt: string | null, endAt: string | null) {
  if (!startAt || !endAt) {
    return "Zeitpunkt wird geprüft";
  }

  return `${formatDateTime(startAt)} bis ${formatDateTime(endAt)}`;
}

function hasUnreadMessage(conversation: Conversation | null, latestMessage: Message | null, currentUserId: string) {
  if (!conversation || !latestMessage || latestMessage.sender_id === currentUserId) {
    return false;
  }

  const lastReadAt = conversation.owner_last_read_at ?? conversation.created_at;
  return Date.parse(latestMessage.created_at) > Date.parse(lastReadAt);
}

const inlineLinkClassName = buttonVariants(
  "ghost",
  "min-h-0 justify-start px-0 py-0 text-sm font-semibold text-forest hover:bg-transparent hover:text-clay"
);

export default async function OwnerAnfragenPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { supabase, user } = await requireProfile("owner");
  const error = readSearchParam(searchParams, "error");
  const message = readSearchParam(searchParams, "message");
  const { data: horsesData } = await supabase
    .from("horses")
    .select("id, owner_id, title, plz, description, active, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  const horses = (horsesData as Horse[] | null) ?? [];
  const horseIds = horses.map((horse) => horse.id);

  let requests: TrialRequest[] = [];
  let approvals: Approval[] = [];
  let conversationsArray: Conversation[] = [];
  let bookingRequests: BookingRequest[] = [];
  let riderBookingLimits: RiderBookingLimit[] = [];

  if (horseIds.length > 0) {
    const [{ data: requestsData }, { data: approvalsData }, { data: conversationsData }, { data: bookingRequestsData }, { data: riderBookingLimitsData }] = await Promise.all([
      supabase
        .from("trial_requests")
        .select("id, horse_id, rider_id, status, message, availability_rule_id, requested_start_at, requested_end_at, created_at")
        .in("horse_id", horseIds)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("approvals").select("horse_id, rider_id, status, created_at").in("horse_id", horseIds),
      supabase
        .from("conversations")
        .select("id, horse_id, rider_id, owner_id, owner_last_read_at, rider_last_read_at, created_at")
        .eq("owner_id", user.id)
        .in("horse_id", horseIds),
      supabase
        .from("booking_requests")
        .select("id, slot_id, availability_rule_id, horse_id, rider_id, status, requested_start_at, requested_end_at, recurrence_rrule, created_at")
        .in("horse_id", horseIds)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("rider_booking_limits")
        .select("horse_id, rider_id, weekly_hours_limit, created_at, updated_at")
        .in("horse_id", horseIds)
    ]);

    requests = (requestsData as TrialRequest[] | null) ?? [];
    approvals = (approvalsData as Approval[] | null) ?? [];
    conversationsArray = (conversationsData as Conversation[] | null) ?? [];
    bookingRequests = (bookingRequestsData as BookingRequest[] | null) ?? [];
    riderBookingLimits = (riderBookingLimitsData as RiderBookingLimit[] | null) ?? [];
  }

  const conversationIds = conversationsArray.map((conversation) => conversation.id);
  const { data: latestMessagesData } = conversationIds.length > 0
    ? await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, content, created_at")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false })
    : { data: [] as Message[] };

  const contactInfoEntries = await Promise.all(
    conversationsArray.map(async (conversation) => {
      const { data } = await supabase.rpc("get_conversation_contact_info", {
        p_conversation_id: conversation.id
      });
      const rows = Array.isArray(data) ? data : data ? [data] : [];
      const record = (rows[0] as ContactInfoRecord | undefined) ?? null;
      return [conversation.id, record] as const;
    })
  );

  const horseMap = new Map(horses.map((horse) => [horse.id, horse]));
  const approvalMap = new Map(approvals.map((approval) => [`${approval.horse_id}:${approval.rider_id}`, approval]));
  const conversationMap = new Map(conversationsArray.map((conversation) => [`${conversation.horse_id}:${conversation.rider_id}`, conversation]));
  const riderBookingLimitMap = new Map(riderBookingLimits.map((limit) => [`${limit.horse_id}:${limit.rider_id}`, limit]));
  const conversationInfo = new Map(contactInfoEntries);
  const latestMessages = new Map<string, Message>();

  (((latestMessagesData as Message[] | null) ?? [])).forEach((latestMessage) => {
    if (!latestMessages.has(latestMessage.conversation_id)) {
      latestMessages.set(latestMessage.conversation_id, latestMessage);
    }
  });

  const items: OwnerRequestItem[] = requests.map((request) => ({
    ...request,
    horse: horseMap.get(request.horse_id) ?? null
  }));
  const bookingItems: OwnerBookingRequestItem[] = bookingRequests.map((request) => ({
    ...request,
    horse: horseMap.get(request.horse_id) ?? null
  }));
  const latestTrialByPair = new Map<string, OwnerRequestItem>();

  // The newest trial per rider+horse keeps the later management actions anchored
  // to one relationship instead of mixing historical trial rows into active lists.
  items.forEach((item) => {
    const key = `${item.horse_id}:${item.rider_id}`;

    if (!latestTrialByPair.has(key)) {
      latestTrialByPair.set(key, item);
    }
  });

  const activeRelationships: ActiveRelationshipItem[] = approvals
    .filter((approval) => approval.status === "approved")
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
    .map((approval) => {
      const key = `${approval.horse_id}:${approval.rider_id}`;

      return {
        approval,
        conversation: conversationMap.get(key) ?? null,
        horse: horseMap.get(approval.horse_id) ?? null,
        latestTrial: latestTrialByPair.get(key) ?? null,
        riderBookingLimit: riderBookingLimitMap.get(key) ?? null
      };
    });

  const trialPipelineItems = items.filter((item) => approvalMap.get(`${item.horse_id}:${item.rider_id}`)?.status !== "approved");
  const trialPipelineCount = trialPipelineItems.length;
  const approvedCount = activeRelationships.length;

  return (
    <AppPageShell>
      <PageHeader
        actions={
          <>
            <Link className={buttonVariants("primary", "w-full sm:w-auto")} href="/owner/horses">
              Pferde anlegen
            </Link>
            <a className={buttonVariants("secondary", "w-full sm:w-auto")} href="#probetermine">
              Probetermine
            </a>
            <a className={buttonVariants("ghost", "w-full sm:w-auto")} href="#aktive-reitbeteiligungen">
              Reitbeteiligungen
            </a>
          </>
        }
        backdropVariant="hero"
        eyebrow="Pferdehalter"
        subtitle="Bearbeite Probetermine, Freischaltungen und konkrete Terminanfragen deiner Reiter."
        surface
        title="Anfragen verwalten"
      />
      <Notice text={error} tone="error" />
      <Notice text={message} tone="success" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Probetermine</p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">{trialPipelineCount}</p>
          <p className="mt-1 text-sm text-stone-600">{"Von Anfrage bis zur Entscheidung über die Aufnahme."}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Reitbeteiligungen</p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">{approvedCount}</p>
          <p className="mt-1 text-sm text-stone-600">{"Aktive Reitbeteiligungen, die offene Zeiten buchen dürfen."}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Buchungsanfragen</p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">{bookingItems.length}</p>
          <p className="mt-1 text-sm text-stone-600">Konkrete Termine innerhalb deiner Verfügbarkeiten.</p>
        </Card>
      </div>
      <SectionCard
        id="aktive-reitbeteiligungen"
        subtitle="Hier verwaltest du laufende Reitbeteiligungen, offene Zeitfenster und konkrete Terminbuchungen."
        title="Aktive Reitbeteiligungen"
      >
        {activeRelationships.length === 0 ? (
          <EmptyState
            description="Sobald du einen Reiter nach dem Probetermin aufnimmst, erscheint die Reitbeteiligung hier mit Kontingent, Chat und Verwaltungsaktionen."
            title="Noch keine aktive Reitbeteiligung"
          />
        ) : (
          <div className="space-y-3">
            {activeRelationships.map((item) => {
              const { approval, conversation, horse, latestTrial, riderBookingLimit } = item;
              const contact = conversation ? (conversationInfo.get(conversation.id) ?? null) : null;
              const riderName = contact?.partner_name?.trim() || "Reiter";
              const hasUnread = hasUnreadMessage(conversation, conversation ? (latestMessages.get(conversation.id) ?? null) : null, user.id);

              return (
                <Card className="p-5" key={`${approval.horse_id}:${approval.rider_id}`}>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">Aktive Reitbeteiligung</p>
                      <p className="font-semibold text-ink">{horse?.title ?? "Pferdeprofil nicht gefunden"}</p>
                      <p className="text-sm text-stone-600">Reiter: {riderName}</p>
                    </div>
                    <p className="text-sm font-semibold text-ink">{`Freigeschaltet seit ${formatDateTime(approval.created_at)}`}</p>
                    {latestTrial?.requested_start_at && latestTrial?.requested_end_at ? (
                      <p className="text-sm text-stone-600">{`Durchgeführter Probetermin: ${formatDateRange(latestTrial.requested_start_at, latestTrial.requested_end_at)}`}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="approved">Aktive Reitbeteiligung</Badge>
                      {hasUnread ? <Badge tone="info">Neue Nachricht</Badge> : null}
                    </div>
                    <Notice text="Diese Reitbeteiligung kann jetzt in offenen Zeitfenstern konkrete Termine anfragen." tone="success" />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <a className={buttonVariants("primary", "w-full")} href={`/pferde/${approval.horse_id}/kalender#kalender-bearbeiten`}>
                        Offene Zeiten verwalten
                      </a>
                      <a className={buttonVariants("secondary", "w-full")} href={`/pferde/${approval.horse_id}/kalender#offene-terminanfragen`}>
                        Terminanfragen prüfen
                      </a>
                    </div>
                    <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-stone-900">Wochenkontingent</p>
                          <p className="text-sm text-stone-600">
                            Lege fest, wie viele Stunden diese Reitbeteiligung pro Woche selbstständig buchen darf.
                          </p>
                        </div>
                        <form action={saveRiderBookingLimitAction} className="space-y-3">
                          <input name="horseId" type="hidden" value={approval.horse_id} />
                          <input name="riderId" type="hidden" value={approval.rider_id} />
                          <div>
                            <label htmlFor={`weeklyHoursLimit-active-${approval.horse_id}-${approval.rider_id}`}>Stunden pro Woche</label>
                            <input
                              defaultValue={riderBookingLimit?.weekly_hours_limit ?? ""}
                              id={`weeklyHoursLimit-active-${approval.horse_id}-${approval.rider_id}`}
                              max={40}
                              min={1}
                              name="weeklyHoursLimit"
                              placeholder="z. B. 4"
                              type="number"
                            />
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-stone-500">
                              {riderBookingLimit
                                ? `Aktuell: ${formatWeeklyHoursLimit(riderBookingLimit.weekly_hours_limit)}`
                                : "Aktuell ist kein festes Wochenkontingent hinterlegt."}
                            </p>
                            <Button className="w-full sm:w-auto" type="submit" variant="secondary">
                              Kontingent speichern
                            </Button>
                          </div>
                        </form>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {latestTrial ? (
                        <form action={updateApprovalAction}>
                          <input name="requestId" type="hidden" value={latestTrial.id} />
                          <input name="status" type="hidden" value="revoked" />
                          <Button className="w-full" type="submit" variant="secondary">
                            Freischaltung entziehen
                          </Button>
                        </form>
                      ) : null}
                      <form action={deleteRiderRelationshipAction}>
                        <input name="horseId" type="hidden" value={approval.horse_id} />
                        <input name="riderId" type="hidden" value={approval.rider_id} />
                        <ConfirmSubmitButton
                          confirmMessage={"Möchtest du diese Reitbeteiligung wirklich löschen? Das Wochenkontingent wird ebenfalls entfernt."}
                          idleLabel={"Reitbeteiligung löschen"}
                          pendingLabel={"Wird gelöscht..."}
                        />
                      </form>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                      <Link className={inlineLinkClassName} href={`/pferde/${approval.horse_id}/kalender` as Route}>
                        Kalender öffnen
                      </Link>
                      <Link className={inlineLinkClassName} href={`/pferde/${approval.horse_id}` as Route}>
                        Pferdeprofil ansehen
                      </Link>
                      <Link className={inlineLinkClassName} href={`/owner/reiter/${approval.rider_id}` as Route}>
                        Reiterprofil ansehen
                      </Link>
                      {conversation ? (
                        <Link className={inlineLinkClassName} href={`/chat/${conversation.id}` as Route}>
                          Zum Chat
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </SectionCard>
      <SectionCard
        id="probetermine"
        subtitle={"Nimm Probetermine an, lehne sie ab oder entscheide nach dem Termin über eine neue Reitbeteiligung."}
        title="Probetermine"
      >
        {trialPipelineItems.length === 0 ? (
          <EmptyState
            description="Sobald Reiter Probetermine für deine Pferdeprofile anfragen, erscheinen sie hier gesammelt."
            title="Noch keine Probetermin-Anfragen"
          />
        ) : (
          <div className="space-y-3">
            {trialPipelineItems.map((request) => {
              const approval = approvalMap.get(`${request.horse_id}:${request.rider_id}`) ?? null;
              const conversation = conversationMap.get(`${request.horse_id}:${request.rider_id}`) ?? null;
              const contact = conversation ? (conversationInfo.get(conversation.id) ?? null) : null;
              const riderName = contact?.partner_name?.trim() || "Reiter";
              const hasUnread = hasUnreadMessage(conversation, conversation ? (latestMessages.get(conversation.id) ?? null) : null, user.id);
              const riderBookingLimit = riderBookingLimitMap.get(`${request.horse_id}:${request.rider_id}`) ?? null;

              return (
                <Card className="p-5" key={request.id}>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">Pferdeprofil</p>
                      <p className="font-semibold text-ink">{request.horse?.title ?? "Pferdeprofil nicht gefunden"}</p>
                      <p className="text-sm text-stone-600">Reiter: {riderName}</p>
                    </div>
                    {request.requested_start_at && request.requested_end_at ? (
                      <p className="text-sm font-semibold text-ink">{formatDateRange(request.requested_start_at, request.requested_end_at)}</p>
                    ) : null}
                    <p className="text-sm leading-6 text-stone-600">{request.message?.trim() || "Keine Nachricht hinterlegt."}</p>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge status={request.status} />
                      {approval ? <StatusBadge status={approval.status} /> : null}
                      {hasUnread ? <Badge tone="info">Neue Nachricht</Badge> : null}
                    </div>
                    {approval?.status === "approved" && conversation ? (
                      <Notice text="Kontaktdaten sind jetzt im Chat sichtbar." tone="success" />
                    ) : null}
                    <div className="space-y-2">
                      {request.status === "requested" ? (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <form action={updateTrialRequestStatusAction}>
                            <input name="requestId" type="hidden" value={request.id} />
                            <input name="status" type="hidden" value="accepted" />
                            <Button className="w-full" type="submit" variant="primary">
                              Annehmen
                            </Button>
                          </form>
                          <form action={updateTrialRequestStatusAction}>
                            <input name="requestId" type="hidden" value={request.id} />
                            <input name="status" type="hidden" value="declined" />
                            <Button className="w-full border-rose-300 text-rose-700 hover:border-rose-400 hover:bg-rose-50 hover:text-rose-700" type="submit" variant="secondary">
                              Ablehnen
                            </Button>
                          </form>
                        </div>
                      ) : null}
                      {request.status === "accepted" ? (
                        <form action={updateTrialRequestStatusAction}>
                          <input name="requestId" type="hidden" value={request.id} />
                          <input name="status" type="hidden" value="completed" />
                          <Button className="w-full" type="submit" variant="primary">
                            Als durchgeführt markieren
                          </Button>
                        </form>
                      ) : null}
                      {request.status === "completed" ? (
                        <form action={updateApprovalAction}>
                          <input name="requestId" type="hidden" value={request.id} />
                          <input name="status" type="hidden" value="approved" />
                          <Button className="w-full" type="submit" variant="primary">
                            Als Reitbeteiligung aufnehmen
                          </Button>
                        </form>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                      <Link className={inlineLinkClassName} href={`/pferde/${request.horse_id}` as Route}>
                        Pferdeprofil ansehen
                      </Link>
                      <Link className={inlineLinkClassName} href={`/owner/reiter/${request.rider_id}` as Route}>
                        Reiterprofil ansehen
                      </Link>
                      {conversation ? (
                        <Link className={inlineLinkClassName} href={`/chat/${conversation.id}` as Route}>
                          Zum Chat
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </SectionCard>
      <SectionCard
        id="buchungsanfragen"
        subtitle="Hier bearbeitest du konkrete Buchungsanfragen innerhalb deiner Verfügbarkeitsfenster."
        title="Terminanfragen"
      >
        {bookingItems.length === 0 ? (
          <EmptyState
            description="Sobald freigeschaltete Reiter konkrete Termine anfragen, erscheinen sie hier gesammelt."
            title="Noch keine Terminanfragen"
          />
        ) : (
          <div className="space-y-3">
            {bookingItems.map((request) => {
              const conversation = conversationMap.get(`${request.horse_id}:${request.rider_id}`) ?? null;
              const contact = conversation ? (conversationInfo.get(conversation.id) ?? null) : null;
              const riderName = contact?.partner_name?.trim() || "Reiter";
              const hasUnread = hasUnreadMessage(conversation, conversation ? (latestMessages.get(conversation.id) ?? null) : null, user.id);
              const riderBookingLimit = riderBookingLimitMap.get(`${request.horse_id}:${request.rider_id}`) ?? null;

              return (
                <Card className="p-5" key={request.id}>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">Terminanfrage</p>
                      <p className="font-semibold text-ink">{request.horse?.title ?? "Pferdeprofil nicht gefunden"}</p>
                      <p className="text-sm text-stone-600">Reiter: {riderName}</p>
                    </div>
                    <p className="text-sm font-semibold text-ink">{formatDateRange(request.requested_start_at, request.requested_end_at)}</p>
                    {request.recurrence_rrule ? <p className="text-sm text-stone-600">Wiederholung: {request.recurrence_rrule}</p> : null}
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge status={request.status} />
                      {riderBookingLimit ? <Badge tone="neutral">{formatWeeklyHoursLimit(riderBookingLimit.weekly_hours_limit)}</Badge> : null}
                      {hasUnread ? <Badge tone="info">Neue Nachricht</Badge> : null}
                    </div>
                    {request.status === "requested" ? (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <form action={acceptBookingRequestAction}>
                          <input name="requestId" type="hidden" value={request.id} />
                          <Button className="w-full" type="submit" variant="primary">
                            Annehmen
                          </Button>
                        </form>
                        <form action={declineBookingRequestAction}>
                          <input name="requestId" type="hidden" value={request.id} />
                          <Button className="w-full border-rose-300 text-rose-700 hover:border-rose-400 hover:bg-rose-50 hover:text-rose-700" type="submit" variant="secondary">
                            Ablehnen
                          </Button>
                        </form>
                      </div>
                    ) : null}
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                      <Link className={inlineLinkClassName} href={`/pferde/${request.horse_id}/kalender` as Route}>
                        Zum Kalender
                      </Link>
                      <Link className={inlineLinkClassName} href={`/pferde/${request.horse_id}` as Route}>
                        Pferdeprofil ansehen
                      </Link>
                      <Link className={inlineLinkClassName} href={`/owner/reiter/${request.rider_id}` as Route}>
                        Reiterprofil ansehen
                      </Link>
                      {conversation ? (
                        <Link className={inlineLinkClassName} href={`/chat/${conversation.id}` as Route}>
                          Zum Chat
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </SectionCard>
    </AppPageShell>
  );
}
