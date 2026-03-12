import type { SupabaseClient } from "@supabase/supabase-js";

import type { HorseGroupMessage, Message } from "@/types/database";

export type ConversationContactInfo = {
  partner_email: string | null;
  partner_name: string | null;
  partner_phone: string | null;
};

type ConversationSummaryRow = {
  conversation_id: string;
  latest_message_content: string | null;
  latest_message_created_at: string | null;
  latest_message_id: string | null;
  latest_message_sender_id: string | null;
  partner_email: string | null;
  partner_name: string | null;
  partner_phone: string | null;
};

type HorseGroupMessageSummaryRow = Pick<HorseGroupMessage, "content" | "created_at" | "horse_id" | "id" | "sender_id">;

function hasLatestMessage(row: ConversationSummaryRow) {
  return Boolean(row.latest_message_id && row.latest_message_sender_id && row.latest_message_created_at && row.latest_message_content !== null);
}

export function buildConversationSummaryMaps(rows: readonly ConversationSummaryRow[]) {
  const conversationInfo = new Map<string, ConversationContactInfo | null>();
  const latestMessages = new Map<string, Message>();

  rows.forEach((row) => {
    conversationInfo.set(row.conversation_id, {
      partner_email: row.partner_email ?? null,
      partner_name: row.partner_name ?? null,
      partner_phone: row.partner_phone ?? null
    });

    if (!hasLatestMessage(row)) {
      return;
    }

    latestMessages.set(row.conversation_id, {
      content: row.latest_message_content as string,
      conversation_id: row.conversation_id,
      created_at: row.latest_message_created_at as string,
      id: row.latest_message_id as string,
      sender_id: row.latest_message_sender_id as string
    });
  });

  return {
    conversationInfo,
    latestMessages
  };
}

export async function loadConversationSummaryMaps(supabase: SupabaseClient, conversationIds: readonly string[]) {
  const uniqueConversationIds = [...new Set(conversationIds)];

  if (uniqueConversationIds.length === 0) {
    return {
      conversationInfo: new Map<string, ConversationContactInfo | null>(),
      latestMessages: new Map<string, Message>()
    };
  }

  const { data } = await supabase.rpc("get_conversation_summaries", {
    p_conversation_ids: uniqueConversationIds
  });

  return buildConversationSummaryMaps((data as ConversationSummaryRow[] | null) ?? []);
}

export function buildLatestHorseGroupMessageMap(rows: readonly HorseGroupMessageSummaryRow[]) {
  const latestMessagesByHorse = new Map<string, HorseGroupMessage>();

  rows.forEach((row) => {
    if (latestMessagesByHorse.has(row.horse_id)) {
      return;
    }

    latestMessagesByHorse.set(row.horse_id, {
      content: row.content,
      created_at: row.created_at,
      horse_id: row.horse_id,
      id: row.id,
      sender_id: row.sender_id
    });
  });

  return latestMessagesByHorse;
}

export async function loadLatestHorseGroupMessages(supabase: SupabaseClient, horseIds: readonly string[]) {
  const uniqueHorseIds = [...new Set(horseIds)];

  if (uniqueHorseIds.length === 0) {
    return new Map<string, HorseGroupMessage>();
  }

  const { data } = await supabase.rpc("get_latest_horse_group_messages", {
    p_horse_ids: uniqueHorseIds
  });

  return buildLatestHorseGroupMessageMap((data as HorseGroupMessageSummaryRow[] | null) ?? []);
}
