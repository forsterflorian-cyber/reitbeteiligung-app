import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ChatThread } from "@/components/chat-thread";
import { StatusBadge } from "@/components/status-badge";
import { requireProfile } from "@/lib/auth";
import type { Approval, Conversation, Horse, Message, TrialRequest } from "@/types/database";

type ContactInfoRecord = {
  partner_email: string | null;
  partner_phone: string | null;
};

function getBackLabel(backHref: Route) {
  return backHref === "/owner/anfragen" ? "Zurueck zu den Anfragen" : "Zurueck zu meinen Anfragen";
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
    .select("id, horse_id, rider_id, owner_id, created_at")
    .eq("id", params.conversation_id)
    .or(`rider_id.eq.${user.id},owner_id.eq.${user.id}`)
    .maybeSingle();

  const conversation = (conversationData as Conversation | null) ?? null;

  if (!conversation) {
    redirect(`${backHref}?error=${encodeURIComponent("Der Chat konnte nicht gefunden werden.")}`);
  }

  const [{ data: horseData }, { data: messagesData }, { data: approvalData }, { data: trialRequestData }] = await Promise.all([
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
      .maybeSingle()
  ]);

  const horse = (horseData as Horse | null) ?? null;
  const messages = (messagesData as Message[] | null) ?? [];
  const approval = (approvalData as Approval | null) ?? null;
  const trialRequest = (trialRequestData as TrialRequest | null) ?? null;

  let contactInfo: ContactInfoRecord | null = null;

  if (approval?.status === "approved") {
    const { data: contactData } = await supabase.rpc("get_conversation_contact_info", {
      p_conversation_id: conversation.id
    });
    const rows = Array.isArray(contactData) ? contactData : contactData ? [contactData] : [];

    contactInfo = (rows[0] as ContactInfoRecord | undefined) ?? null;
  }

  return (
    <div className="space-y-5">
      <Link className="inline-flex min-h-[44px] items-center text-sm font-semibold text-forest hover:text-clay" href={backHref}>
        {getBackLabel(backHref)}
      </Link>
      <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft sm:p-6">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-clay">Chat</p>
            <h1 className="mt-2 text-3xl font-semibold text-forest sm:text-4xl">Probetermin abstimmen</h1>
            <p className="mt-2 text-sm text-stone-600 sm:text-base">
              {horse ? `Pferdeprofil: ${horse.title}` : "Pferdeprofil nicht gefunden"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {trialRequest ? <StatusBadge status={trialRequest.status} /> : <StatusBadge status="requested" />}
            {approval ? <StatusBadge status={approval.status} /> : null}
          </div>
          <p className="text-sm text-stone-600">
            {approval?.status === "approved"
              ? "Der Probetermin ist abgeschlossen und die Reitbeteiligung wurde freigeschaltet."
              : "Bis zur Freischaltung bleibt die Kommunikation direkt hier in der Plattform."}
          </p>
        </div>
      </section>
      {approval?.status === "approved" ? (
        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-soft sm:p-6">
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">Kontakt</p>
              <h2 className="mt-2 text-xl font-semibold text-emerald-900">Kontaktdaten freigeschaltet</h2>
            </div>
            <p className="text-sm text-emerald-900">Ihr koennt jetzt ausserhalb der Plattform kommunizieren.</p>
            <div className="space-y-2 rounded-2xl bg-white/80 p-4 text-sm text-emerald-950">
              <p>{contactInfo?.partner_email ? `E-Mail: ${contactInfo.partner_email}` : "E-Mail: nicht hinterlegt"}</p>
              <p>{contactInfo?.partner_phone ? `Telefon: ${contactInfo.partner_phone}` : "Telefon: nicht hinterlegt"}</p>
            </div>
          </div>
        </section>
      ) : null}
      <ChatThread conversationId={conversation.id} currentUserId={user.id} initialMessages={messages} />
    </div>
  );
}
