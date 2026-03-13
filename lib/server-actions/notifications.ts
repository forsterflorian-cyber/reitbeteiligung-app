import type { createClient } from "../supabase/server.ts";
import type { Notification } from "../../types/database";

type SupabaseClient = ReturnType<typeof createClient>;

export async function getUserNotifications(supabase: SupabaseClient): Promise<Notification[]> {
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  return (data as Notification[] | null) ?? [];
}

export async function getUnreadNotificationCount(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase
    .from("notifications")
    .select("id")
    .is("read_at", null);

  return ((data as unknown[] | null) ?? []).length;
}

export async function markNotificationRead(
  supabase: SupabaseClient,
  notificationId: string
): Promise<void> {
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .is("read_at", null);
  // rowcount = 0 is not an error:
  // — already read → no-op (idempotent)
  // — foreign or missing notification → filtered silently by RLS
}
