import type { createClient } from "./supabase/server.ts";

type SupabaseClient = ReturnType<typeof createClient>;

export type DomainEventType = "booking_cancelled" | "booking_created" | "booking_rescheduled" | "calendar_block_created" | "calendar_block_deleted" | "trial_accepted";

type DomainEventPayload = Record<string, null | string>;

export async function emitDomainEvent(
  supabase: SupabaseClient,
  event: {
    event_type: DomainEventType;
    horse_id: string;
    payload: DomainEventPayload;
    rider_id?: null | string;
  }
): Promise<void> {
  await supabase.from("domain_events").insert({
    event_type: event.event_type,
    horse_id: event.horse_id,
    payload: event.payload,
    rider_id: event.rider_id ?? null
  });
  // intentionally not checking error — domain events are non-blocking side effects
}
