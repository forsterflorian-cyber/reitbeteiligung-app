import {
  HORSE_IMAGE_BUCKET,
  HORSE_IMAGE_SELECT_FIELDS,
  MAX_HORSE_IMAGES,
  createHorseImageStoragePath,
  sortHorseImages
} from "../horses";
import { getOwnedHorse } from "./horse";
import type { HorseImage } from "../../types/database";
import type { createClient } from "../supabase/server";

type HorseImageRecord = Pick<HorseImage, "id" | "horse_id" | "path" | "storage_path" | "position" | "created_at">;
type SupabaseClient = ReturnType<typeof createClient>;
type SupabaseErrorLike = {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message: string;
};
type LogSupabaseError = (context: string, error: SupabaseErrorLike) => void;

type HorseImageActionResult =
  | {
      message: string;
      ok: false;
    }
  | {
      horseId: string;
      ok: true;
    };

export async function uploadHorseImagesForOwner(input: {
  files: File[];
  horseId: string;
  logSupabaseError: LogSupabaseError;
  ownerId: string;
  supabase: SupabaseClient;
}): Promise<HorseImageActionResult> {
  const horse = await getOwnedHorse(input.supabase, input.horseId, input.ownerId);

  if (!horse) {
    return {
      message: "Du kannst nur Bilder f\u00fcr eigene Pferdeprofile hochladen.",
      ok: false
    };
  }

  if (input.files.length === 0) {
    return {
      message: "Bitte w\u00e4hle mindestens ein Bild aus.",
      ok: false
    };
  }

  if (input.files.some((file) => !file.type.startsWith("image/"))) {
    return {
      message: "Es k\u00f6nnen nur Bilddateien hochgeladen werden.",
      ok: false
    };
  }

  const { data: existingImagesData } = await input.supabase
    .from("horse_images")
    .select(HORSE_IMAGE_SELECT_FIELDS)
    .eq("horse_id", input.horseId)
    .order("created_at", { ascending: true });

  const existingImages = sortHorseImages(
    (Array.isArray(existingImagesData) ? (existingImagesData as HorseImageRecord[]) : []).filter((image) => image.id)
  );

  if (existingImages.length + input.files.length > MAX_HORSE_IMAGES) {
    return {
      message: `Es k\u00f6nnen maximal ${MAX_HORSE_IMAGES} Bilder gespeichert werden.`,
      ok: false
    };
  }

  const nextPosition = existingImages.reduce((maxPosition, image) => {
    const position = typeof image.position === "number" ? image.position : 0;
    return Math.max(maxPosition, position + 1);
  }, 0);

  const uploads = input.files.map((file, index) => {
    const imageId = crypto.randomUUID();
    const path = createHorseImageStoragePath(input.horseId, imageId, file.name);

    return {
      file,
      id: imageId,
      path,
      position: nextPosition + index
    };
  });

  const preparedImageIds: string[] = [];
  const uploadedPaths: string[] = [];

  const rollbackBatch = async () => {
    if (uploadedPaths.length > 0) {
      const { error: storageCleanupError } = await input.supabase.storage.from(HORSE_IMAGE_BUCKET).remove(uploadedPaths);

      if (storageCleanupError) {
        input.logSupabaseError("Horse image batch storage cleanup failed", storageCleanupError);
      }
    }

    if (preparedImageIds.length > 0) {
      const { error: rowCleanupError } = await input.supabase.from("horse_images").delete().in("id", preparedImageIds);

      if (rowCleanupError) {
        input.logSupabaseError("Horse image batch row cleanup failed", rowCleanupError);
      }
    }
  };

  for (const upload of uploads) {
    const { error: insertError } = await input.supabase.rpc("prepare_owner_horse_image", {
      p_horse_id: input.horseId,
      p_image_id: upload.id,
      p_path: upload.path,
      p_position: upload.position
    });

    if (insertError) {
      input.logSupabaseError("Horse image row prepare failed", insertError);
      await rollbackBatch();
      return {
        message: "Die Bilder konnten nicht gespeichert werden.",
        ok: false
      };
    }

    preparedImageIds.push(upload.id);

    const { error: uploadError } = await input.supabase.storage.from(HORSE_IMAGE_BUCKET).upload(upload.path, upload.file, {
      cacheControl: "3600",
      contentType: upload.file.type || undefined,
      upsert: false
    });

    if (uploadError) {
      input.logSupabaseError("Horse image upload failed", uploadError);
      await rollbackBatch();
      return {
        message: "Die Bilder konnten nicht hochgeladen werden.",
        ok: false
      };
    }

    uploadedPaths.push(upload.path);
  }

  return {
    horseId: input.horseId,
    ok: true
  };
}

export async function deleteHorseImageForOwner(input: {
  imageId: string;
  logSupabaseError: LogSupabaseError;
  ownerId: string;
  supabase: SupabaseClient;
}): Promise<HorseImageActionResult> {
  const { data: imageData } = await input.supabase
    .from("horse_images")
    .select(HORSE_IMAGE_SELECT_FIELDS)
    .eq("id", input.imageId)
    .maybeSingle();
  const image = (imageData as HorseImageRecord | null) ?? null;

  if (!image) {
    return {
      message: "Das Bild konnte nicht gefunden werden.",
      ok: false
    };
  }

  const horse = await getOwnedHorse(input.supabase, image.horse_id, input.ownerId);

  if (!horse) {
    return {
      message: "Du kannst nur Bilder f\u00fcr eigene Pferdeprofile l\u00f6schen.",
      ok: false
    };
  }

  const imagePath = image.path ?? image.storage_path ?? null;

  if (!imagePath) {
    return {
      message: "Das Bild konnte nicht gel\u00f6scht werden.",
      ok: false
    };
  }

  const { error: storageError } = await input.supabase.storage.from(HORSE_IMAGE_BUCKET).remove([imagePath]);

  if (storageError) {
    input.logSupabaseError("Horse image storage delete failed", storageError);
    return {
      message: "Das Bild konnte nicht gel\u00f6scht werden.",
      ok: false
    };
  }

  const { error } = await input.supabase.from("horse_images").delete().eq("id", input.imageId);

  if (error) {
    input.logSupabaseError("Horse image row delete failed", error);
    return {
      message: "Das Bild konnte nicht gel\u00f6scht werden.",
      ok: false
    };
  }

  return {
    horseId: image.horse_id,
    ok: true
  };
}