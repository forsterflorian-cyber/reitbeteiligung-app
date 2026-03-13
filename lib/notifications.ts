import type { DomainEventType } from "./domain-events.ts";
import type { createClient } from "./supabase/server.ts";

type SupabaseClient = ReturnType<typeof createClient>;

export async function createNotification(
  supabase: SupabaseClient,
  params: {
    eventType: DomainEventType;
    horseId: string | null;
    payload: Record<string, unknown>;
    userId: string;
  }
): Promise<void> {
  await supabase.rpc("insert_notification", {
    p_event_type: params.eventType,
    p_horse_id: params.horseId ?? null,
    p_payload: params.payload,
    p_user_id: params.userId
  });
  // intentionally not checking error — notifications are non-blocking side effects
}
