import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ChatThread } from "@/components/chat-thread";
import { StatusBadge } from "@/components/status-badge";
import { Notice } from "@/components/notice";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { buttonVariants } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth";
import { getRoleLabel } from "@/lib/profiles";
import type { Approval, Conversation, Horse, Message, TrialRequest } from "@/types/database";

type ContactInfoRecord = {
  partner_email: string | null;
  partner_name: string | null;
  partner_phone: string | null;
};

function getBackLabel(backHref: Route) {
  return backHref === "/owner/anfragen" ? "Zurück zu den Anfragen" : "Zurück zu meinen Anfragen";
}

export default async function ChatPage({
  params
}: {
  params: { conversation_id: string };
}) {
  const { profile, supabase, user } = await requireProfile();
  const backHref: Route = profile.role === "owner" ? "/owner/anfragen" : "/anfragen";
  const { data: conversationData } = await supabase
    .from("conversations")
    .select("id, horse_id, rider_id, owner_id, owner_last_read_at, rider_last_read_at, created_at")
    .eq("id", params.conversation_id)
    .or(`rider_id.eq.${user.id},owner_id.eq.${user.id}`)
    .maybeSingle();

  const conversation = (conversationData as Conversation | null) ?? null;

  if (!conversation) {
    redirect(`${backHref}?error=${encodeURIComponent("Der Chat konnte nicht gefunden werden.")}`);
  }

  await supabase.rpc("mark_conversation_read", {
    p_conversation_id: conversation.id
  });

  const [{ data: horseData }, { data: messagesData }, { data: approvalData }, { data: trialRequestData }, { data: contactData }] = await Promise.all([
    supabase
      .from("horses")
      .select("id, owner_id, title, plz, description, active, created_at")
      .eq("id", conversation.horse_id)
      .maybeSingle(),
    supabase
      .from("messages")
      .select("id, conversation_id, sender_id, content, created_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("approvals")
      .select("horse_id, rider_id, status, created_at")
      .eq("horse_id", conversation.horse_id)
      .eq("rider_id", conversation.rider_id)
      .maybeSingle(),
    supabase
      .from("trial_requests")
      .select("id, horse_id, rider_id, status, message, created_at")
      .eq("horse_id", conversation.horse_id)
      .eq("rider_id", conversation.rider_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.rpc("get_conversation_contact_info", {
      p_conversation_id: conversation.id
    })
  ]);

  const horse = (horseData as Horse | null) ?? null;
  const messages = (messagesData as Message[] | null) ?? [];
  const approval = (approvalData as Approval | null) ?? null;
  const trialRequest = (trialRequestData as TrialRequest | null) ?? null;
  const contactRows = Array.isArray(contactData) ? contactData : contactData ? [contactData] : [];
  const contactInfo = (contactRows[0] as ContactInfoRecord | undefined) ?? null;
  const partnerLabel = contactInfo?.partner_name?.trim() || getRoleLabel(profile.role === "owner" ? "rider" : "owner");

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        actions={
          <Link className={buttonVariants("ghost", "w-full sm:w-auto")} href={backHref}>
            {getBackLabel(backHref)}
          </Link>
        }
        subtitle={horse ? `Pferdeprofil: ${horse.title}` : "Pferdeprofil nicht gefunden"}
        title={`Chat mit ${partnerLabel}`}
      />
      <SectionCard subtitle="Status und Kontaktfreigabe richten sich nach dem aktuellen Ablauf eurer Anfrage." title="Chatstatus">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {trialRequest ? <StatusBadge status={trialRequest.status} /> : <StatusBadge status="requested" />}
            {approval ? <StatusBadge status={approval.status} /> : null}
            <Badge tone="neutral">{profile.role === "owner" ? "Pferdehalter" : "Reiter"}</Badge>
          </div>
          <Notice
            text={
              approval?.status === "approved"
                ? "Der Probetermin ist abgeschlossen und die Reitbeteiligung wurde freigeschaltet."
                : "Bis zur Freischaltung bleibt die Kommunikation direkt hier in der Plattform. Neue Nachrichten werden in deinen Anfragen markiert."
            }
          />
        </div>
      </SectionCard>
      {approval?.status === "approved" ? (
        <SectionCard subtitle="Kontaktdaten werden erst nach der Freischaltung eingeblendet." title="Kontakt freigeschaltet">
          <div className="space-y-4">
            <p className="text-sm text-ink">Ihr könnt jetzt außerhalb der Plattform kommunizieren.</p>
            <div className="space-y-2 rounded-2xl border border-stone-200 bg-sand p-4 text-sm text-ink">
              <p>Name: {partnerLabel}</p>
              <p>{contactInfo?.partner_email ? `E-Mail: ${contactInfo.partner_email}` : "E-Mail: nicht hinterlegt"}</p>
              <p>{contactInfo?.partner_phone ? `Telefon: ${contactInfo.partner_phone}` : "Telefon: nicht hinterlegt"}</p>
            </div>
          </div>
        </SectionCard>
      ) : null}
      <ChatThread conversationId={conversation.id} currentUserId={user.id} initialMessages={messages} partnerLabel={partnerLabel} />
    </div>
  );
}