import type { SupabaseClient } from "@supabase/supabase-js";

import type { Conversation, Message, Profile } from "@/types/database";

type ConversationReadState = Pick<Conversation, "id" | "created_at" | "owner_last_read_at" | "rider_last_read_at">;

export async function getUnreadMessageCount(
  supabase: SupabaseClient,
  profile: Profile | null | undefined,
  userId: string | null | undefined
) {
  if (!profile || !userId) {
    return 0;
  }

  const filterColumn = profile.role === "owner" ? "owner_id" : "rider_id";
  const { data: conversationsData } = await supabase
    .from("conversations")
    .select("id, owner_last_read_at, rider_last_read_at, created_at")
    .eq(filterColumn, userId);

  const conversations = (conversationsData as ConversationReadState[] | null) ?? [];
  const conversationIds = conversations.map((conversation) => conversation.id);

  if (conversationIds.length === 0) {
    return 0;
  }

  const { data: messagesData } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, content, created_at")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: false });

  const latestMessages = new Map<string, Message>();

  (((messagesData as Message[] | null) ?? [])).forEach((message) => {
    if (!latestMessages.has(message.conversation_id)) {
      latestMessages.set(message.conversation_id, message);
    }
  });

  return conversations.reduce((count, conversation) => {
    const latestMessage = latestMessages.get(conversation.id);

    if (!latestMessage || latestMessage.sender_id === userId) {
      return count;
    }

    const lastReadAt =
      profile.role === "owner"
        ? conversation.owner_last_read_at ?? conversation.created_at
        : conversation.rider_last_read_at ?? conversation.created_at;

    return Date.parse(latestMessage.created_at) > Date.parse(lastReadAt) ? count + 1 : count;
  }, 0);
}
