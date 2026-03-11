import type { SupabaseClient } from "@supabase/supabase-js";

import { isActiveRelationship } from "./relationship-state.ts";

export async function getApprovalStatus(horseId: string, riderId: string, supabase?: SupabaseClient) {
  const client = supabase ?? (await import("./supabase/server.ts")).createClient();
  const { data } = await client
    .from("approvals")
    .select("status")
    .eq("horse_id", horseId)
    .eq("rider_id", riderId)
    .maybeSingle();

  return data?.status ?? null;
}

export async function isApproved(horseId: string, riderId: string, supabase?: SupabaseClient) {
  return isActiveRelationship(await getApprovalStatus(horseId, riderId, supabase));
}
