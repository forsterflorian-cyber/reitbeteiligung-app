import type { Route } from "next";
import Link from "next/link";

import { HorseGroupChatThread } from "@/components/horse-group-chat-thread";
import { Notice } from "@/components/notice";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { isApproved } from "@/lib/approvals";
import { requireProfile } from "@/lib/auth";
import { redirectWithFlash } from "@/lib/server-flash";
import type { Approval, Horse, HorseGroupMessage, Profile } from "@/types/database";

function getDisplayName(profile: Profile | null, fallback: string) {
  return profile?.display_name?.trim() || fallback;
}

export default async function HorseGroupChatPage({
  params
}: {
  params: { id: string };
}) {
  const { profile, supabase, user } = await requireProfile();
  const { data: horseData } = await supabase
    .from("horses")
    .select("id, owner_id, title, plz, description, active, created_at")
    .eq("id", params.id)
    .maybeSingle();

  const horse = (horseData as Horse | null) ?? null;

  if (!horse) {
    redirectWithFlash("/dashboard", "error", "Das Pferdeprofil konnte nicht gefunden werden.");
  }

  const isOwner = profile.role === "owner" && user.id === horse.owner_id;
  const riderApproved = profile.role === "rider" ? await isApproved(horse.id, user.id, supabase) : false;

  if (!isOwner && !riderApproved) {
    redirectWithFlash(`/pferde/${horse.id}`, "error", "Der Pferde-Gruppenchat ist erst nach der Freischaltung verfuegbar.");
  }

  const [{ data: approvalData }, { data: messageData }] = await Promise.all([
    supabase.from("approvals").select("horse_id, rider_id, status, created_at").eq("horse_id", horse.id).eq("status", "approved"),
    supabase
      .from("horse_group_messages")
      .select("id, horse_id, sender_id, content, created_at")
      .eq("horse_id", horse.id)
      .order("created_at", { ascending: true })
  ]);

  const approvals = (approvalData as Approval[] | null) ?? [];
  const messages = (messageData as HorseGroupMessage[] | null) ?? [];
  const participantIds = [...new Set([horse.owner_id, ...approvals.map((approval) => approval.rider_id), ...messages.map((message) => message.sender_id)])];
  const { data: participantData } = participantIds.length > 0
    ? await supabase.from("profiles").select("id, role, is_premium, created_at, display_name, phone").in("id", participantIds)
    : { data: [] as Profile[] };

  const participantMap = new Map(((participantData as Profile[] | null) ?? []).map((entry) => [entry.id, entry]));
  const senderNames = Object.fromEntries(
    participantIds.map((participantId) => {
      if (participantId === horse.owner_id) {
        return [participantId, getDisplayName(participantMap.get(participantId) ?? null, "Pferdehalter")];
      }

      return [participantId, getDisplayName(participantMap.get(participantId) ?? null, "Reitbeteiligung")];
    })
  );

  const backHref: Route = profile.role === "owner" ? "/owner/reitbeteiligungen" : "/nachrichten";

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        actions={
          <Link className={buttonVariants("ghost", "w-full sm:w-auto")} href={backHref}>
            {profile.role === "owner" ? "Zurueck zu den Reitbeteiligungen" : "Zurueck zu meinen Nachrichten"}
          </Link>
        }
        subtitle={`Pferdeprofil: ${horse.title}`}
        title="Pferde-Gruppenchat"
      />
      <SectionCard subtitle="Hier schreiben Pferdehalter und alle bereits freigeschalteten Reitbeteiligungen gemeinsam fuer dieses Pferd." title="Teilnehmer & Status">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone="approved">{approvals.length} aktive Reitbeteiligung{approvals.length === 1 ? "" : "en"}</Badge>
            <Badge tone="neutral">Pferdehalter im Chat</Badge>
          </div>
          <Notice text="Der Gruppenchat ist erst nach der Freischaltung sichtbar. Vorher bleibt die Abstimmung im 1:1-Chat zum Probetermin." />
        </div>
      </SectionCard>
      <HorseGroupChatThread currentUserId={user.id} horseId={horse.id} initialMessages={messages} senderNames={senderNames} />
    </div>
  );
}
