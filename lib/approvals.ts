import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

export async function isApproved(horseId: string, riderId: string, supabase?: SupabaseClient) {
  const client = supabase ?? createClient();
  const { data } = await client
    .from("approvals")
    .select("status")
    .eq("horse_id", horseId)
    .eq("rider_id", riderId)
    .maybeSingle();

  return data?.status === "approved";
}
