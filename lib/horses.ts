import type { SupabaseClient } from "@supabase/supabase-js";

import type { HorseImage } from "@/types/database";

export const HORSE_SELECT_FIELDS = "*";
export const HORSE_IMAGE_SELECT_FIELDS = "*";
export const HORSE_IMAGE_BUCKET = "horse-images";
export const MAX_HORSE_IMAGES = 5;
export const HORSE_GESCHLECHTER = ["stute", "wallach", "hengst"] as const;

export function isHorseGeschlecht(value: string | null): value is (typeof HORSE_GESCHLECHTER)[number] {
  return value !== null && HORSE_GESCHLECHTER.includes(value as (typeof HORSE_GESCHLECHTER)[number]);
}

export function getHorseAge(birthYear: number | null | undefined, currentYear = new Date().getFullYear()) {
  if (typeof birthYear !== "number") {
    return null;
  }

  const age = currentYear - birthYear;
  return age >= 0 ? age : null;
}

export function sortHorseImages<T extends Pick<HorseImage, "position" | "created_at">>(images: T[]) {
  return [...images].sort((left, right) => {
    const leftPosition = typeof left.position === "number" ? left.position : Number.MAX_SAFE_INTEGER;
    const rightPosition = typeof right.position === "number" ? right.position : Number.MAX_SAFE_INTEGER;

    if (leftPosition !== rightPosition) {
      return leftPosition - rightPosition;
    }

    const leftCreatedAt = left.created_at ? Date.parse(left.created_at) : 0;
    const rightCreatedAt = right.created_at ? Date.parse(right.created_at) : 0;
    const leftTimestamp = Number.isFinite(leftCreatedAt) ? leftCreatedAt : 0;
    const rightTimestamp = Number.isFinite(rightCreatedAt) ? rightCreatedAt : 0;

    return leftTimestamp - rightTimestamp;
  });
}

export function createHorseImageStoragePath(horseId: string, imageId: string, fileName: string) {
  const rawExtension = fileName.includes(".") ? fileName.split(".").pop() ?? "jpg" : "jpg";
  const extension = rawExtension.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";

  return `horses/${horseId}/${imageId}.${extension}`;
}

export async function getHorseImageUrl(supabase: SupabaseClient, storagePath: string | null | undefined) {
  if (!storagePath) {
    return null;
  }

  const { data, error } = await supabase.storage.from(HORSE_IMAGE_BUCKET).createSignedUrl(storagePath, 60 * 60);

  if (error) {
    return null;
  }

  return data.signedUrl;
}