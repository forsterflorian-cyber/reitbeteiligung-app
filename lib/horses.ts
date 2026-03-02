import type { SupabaseClient } from "@supabase/supabase-js";

export const HORSE_SELECT_FIELDS = "id, owner_id, title, plz, description, active, created_at";
export const HORSE_IMAGE_SELECT_FIELDS = "id, horse_id, storage_path, created_at";
export const HORSE_IMAGE_BUCKET = "horse-images";
export const MAX_HORSE_IMAGES = 5;
export const HORSE_GESCHLECHTER = ["stute", "wallach", "hengst"] as const;

export function isHorseGeschlecht(value: string | null): value is (typeof HORSE_GESCHLECHTER)[number] {
  return value !== null && HORSE_GESCHLECHTER.includes(value as (typeof HORSE_GESCHLECHTER)[number]);
}

export function createHorseImageStoragePath(ownerId: string, horseId: string, fileName: string) {
  const rawExtension = fileName.includes(".") ? fileName.split(".").pop() ?? "jpg" : "jpg";
  const extension = rawExtension.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";

  return `${ownerId}/${horseId}/${crypto.randomUUID()}.${extension}`;
}

export function getHorseImageUrl(supabase: SupabaseClient, storagePath: string) {
  return supabase.storage.from(HORSE_IMAGE_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}
