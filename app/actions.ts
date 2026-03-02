"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOnboardingUser, requireProfile } from "@/lib/auth";
import {
  HORSE_GESCHLECHTER,
  HORSE_IMAGE_BUCKET,
  HORSE_IMAGE_SELECT_FIELDS,
  HORSE_SELECT_FIELDS,
  MAX_HORSE_IMAGES,
  createHorseImageStoragePath,
  isHorseGeschlecht
} from "@/lib/horses";
import { asInteger, asOptionalString, asString, isRole } from "@/lib/forms";
import {
  APPROVAL_STATUS,
  TRIAL_REQUEST_STATUS,
  isApprovalStatus,
  isMutableTrialRequestStatus
} from "@/lib/statuses";
import { createClient } from "@/lib/supabase/server";
import type { Horse, HorseImage, TrialRequest } from "@/types/database";

const PASSWORD_RESET_REDIRECT_URL = "https://reitbeteiligung.app/passwort-zuruecksetzen";

type OwnerRequestRecord = Pick<TrialRequest, "id" | "horse_id" | "rider_id" | "status">;
type HorseOwnerRecord = Pick<Horse, "id" | "owner_id">;
type HorseImageRecord = Pick<HorseImage, "id" | "horse_id" | "storage_path" | "created_at">;
type SupabaseErrorLike = {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message: string;
};

function redirectWithMessage(path: string, key: "error" | "message", message: string): never {
  redirect(`${path}?${key}=${encodeURIComponent(message)}`);
}

function logSupabaseError(context: string, error: SupabaseErrorLike) {
  console.error(`[${context}] ${error.message}`, {
    code: error.code ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null
  });
}

async function getOwnedHorse(supabase: ReturnType<typeof createClient>, horseId: string, ownerId: string) {
  const { data } = await supabase.from("horses").select("id, owner_id").eq("id", horseId).eq("owner_id", ownerId).maybeSingle();

  return (data as HorseOwnerRecord | null) ?? null;
}

async function getOwnedTrialRequest(requestId: string, ownerId: string) {
  const supabase = createClient();
  const { data: request } = await supabase
    .from("trial_requests")
    .select("id, horse_id, rider_id, status")
    .eq("id", requestId)
    .maybeSingle();

  const typedRequest = (request as OwnerRequestRecord | null) ?? null;

  if (!typedRequest) {
    return null;
  }

  const horse = await getOwnedHorse(supabase, typedRequest.horse_id, ownerId);

  if (!horse) {
    return null;
  }

  return { request: typedRequest, supabase };
}

export async function signupAction(formData: FormData) {
  const email = asString(formData.get("email")).toLowerCase();
  const password = asString(formData.get("password"));

  if (!email.includes("@") || password.length < 8) {
    redirectWithMessage("/signup", "error", "Bitte gib eine gueltige E-Mail-Adresse und ein Passwort mit mindestens 8 Zeichen ein.");
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) {
    redirectWithMessage("/signup", "error", "Die Registrierung konnte nicht abgeschlossen werden. Bitte pruefe deine Angaben.");
  }

  if (data.user && data.session) {
    redirect("/onboarding");
  }

  redirectWithMessage("/login", "message", "Konto erstellt. Bitte pruefe dein Postfach, falls eine Bestaetigung aktiv ist.");
}

export async function loginAction(formData: FormData) {
  const email = asString(formData.get("email")).toLowerCase();
  const password = asString(formData.get("password"));

  if (!email.includes("@") || password.length < 8) {
    redirectWithMessage("/login", "error", "Bitte gib E-Mail-Adresse und Passwort ein.");
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error || !data.user) {
    redirectWithMessage("/login", "error", "Die Anmeldung ist fehlgeschlagen. Bitte pruefe E-Mail-Adresse und Passwort.");
  }

  const { data: profile } = await supabase.from("profiles").select("id").eq("id", data.user.id).maybeSingle();

  redirect(profile ? "/dashboard" : "/onboarding");
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = asString(formData.get("email")).toLowerCase();

  if (!email.includes("@")) {
    redirectWithMessage("/passwort-vergessen", "error", "Bitte gib eine gueltige E-Mail-Adresse ein.");
  }

  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: PASSWORD_RESET_REDIRECT_URL
  });

  if (error) {
    redirectWithMessage(
      "/passwort-vergessen",
      "error",
      "Der Link zum Zuruecksetzen konnte nicht versendet werden. Bitte versuche es erneut."
    );
  }

  redirectWithMessage(
    "/passwort-vergessen",
    "message",
    "Wenn ein Konto zu dieser E-Mail-Adresse existiert, wurde ein Link zum Zuruecksetzen versendet."
  );
}

export async function requestTrialAction(formData: FormData) {
  const { supabase, user } = await requireProfile("rider");
  const horseId = asString(formData.get("horseId"));
  const message = asOptionalString(formData.get("message"));

  if (!horseId) {
    redirectWithMessage("/suchen", "error", "Das Pferd konnte nicht gefunden werden.");
  }

  const { data: horseData } = await supabase
    .from("horses")
    .select("id, owner_id")
    .eq("id", horseId)
    .eq("active", true)
    .maybeSingle();

  const horse = (horseData as HorseOwnerRecord | null) ?? null;

  if (!horse) {
    redirectWithMessage("/suchen", "error", "Dieses Pferd ist aktuell nicht verfuegbar.");
  }

  const riderId = user.id;

  const { error } = await supabase.from("trial_requests").insert({
    horse_id: horseId,
    message,
    rider_id: riderId,
    status: TRIAL_REQUEST_STATUS.requested
  });

  if (error) {
    console.error("Trial request insert failed", error);
    redirectWithMessage(`/pferde/${horseId}`, "error", "Probeanfrage konnte nicht gespeichert werden.");
  }

  const { error: conversationError } = await supabase.from("conversations").upsert(
    {
      horse_id: horseId,
      owner_id: horse.owner_id,
      rider_id: riderId
    },
    {
      ignoreDuplicates: true,
      onConflict: "horse_id,rider_id,owner_id"
    }
  );

  if (conversationError) {
    console.error("Conversation insert failed after trial request", conversationError);
    revalidatePath(`/pferde/${horseId}`);
    revalidatePath("/anfragen");
    revalidatePath("/owner/anfragen");
    redirect(
      `/pferde/${horseId}?message=${encodeURIComponent(
        "Deine Anfrage fuer den Probetermin wurde gesendet."
      )}&error=${encodeURIComponent("Chat konnte nicht erstellt werden.")}`
    );
  }

  revalidatePath(`/pferde/${horseId}`);
  revalidatePath("/anfragen");
  revalidatePath("/owner/anfragen");
  redirectWithMessage(`/pferde/${horseId}`, "message", "Deine Anfrage fuer den Probetermin wurde gesendet.");
}

export async function updateTrialRequestStatusAction(formData: FormData) {
  const { user } = await requireProfile("owner");
  const requestId = asString(formData.get("requestId"));
  const nextStatus = asString(formData.get("status"));

  if (!requestId || !isMutableTrialRequestStatus(nextStatus)) {
    redirectWithMessage("/owner/anfragen", "error", "Die Aktion ist ungueltig.");
  }

  const record = await getOwnedTrialRequest(requestId, user.id);

  if (!record) {
    redirectWithMessage("/owner/anfragen", "error", "Die Anfrage konnte nicht gefunden werden.");
  }

  if (nextStatus === TRIAL_REQUEST_STATUS.completed && record.request.status !== TRIAL_REQUEST_STATUS.accepted) {
    redirectWithMessage("/owner/anfragen", "error", "Nur angenommene Probetermine koennen als durchgefuehrt markiert werden.");
  }

  if (
    (nextStatus === TRIAL_REQUEST_STATUS.accepted || nextStatus === TRIAL_REQUEST_STATUS.declined) &&
    record.request.status !== TRIAL_REQUEST_STATUS.requested
  ) {
    redirectWithMessage("/owner/anfragen", "error", "Diese Anfrage kann nicht mehr geaendert werden.");
  }

  const { error } = await record.supabase.from("trial_requests").update({ status: nextStatus }).eq("id", requestId);

  if (error) {
    logSupabaseError("Trial request status update failed", error);
    redirectWithMessage("/owner/anfragen", "error", "Der Status konnte nicht aktualisiert werden.");
  }

  revalidatePath("/owner/anfragen");
  revalidatePath("/anfragen");
  redirectWithMessage("/owner/anfragen", "message", "Der Status wurde aktualisiert.");
}

export async function updateApprovalAction(formData: FormData) {
  const { user } = await requireProfile("owner");
  const requestId = asString(formData.get("requestId"));
  const nextStatus = asString(formData.get("status"));

  if (!requestId || !isApprovalStatus(nextStatus)) {
    redirectWithMessage("/owner/anfragen", "error", "Die Freischaltung ist ungueltig.");
  }

  const record = await getOwnedTrialRequest(requestId, user.id);

  if (!record) {
    redirectWithMessage("/owner/anfragen", "error", "Die Anfrage konnte nicht gefunden werden.");
  }

  if (record.request.status !== TRIAL_REQUEST_STATUS.completed) {
    redirectWithMessage("/owner/anfragen", "error", "Nur durchgefuehrte Probetermine koennen freigeschaltet werden.");
  }

  const { error } = await record.supabase.from("approvals").upsert(
    {
      horse_id: record.request.horse_id,
      rider_id: record.request.rider_id,
      status: nextStatus
    },
    {
      onConflict: "horse_id,rider_id"
    }
  );

  if (error) {
    logSupabaseError("Approval upsert failed", error);
    redirectWithMessage("/owner/anfragen", "error", "Die Freischaltung konnte nicht gespeichert werden.");
  }

  revalidatePath("/owner/anfragen");
  revalidatePath(`/pferde/${record.request.horse_id}`);
  const successMessage = nextStatus === APPROVAL_STATUS.approved ? "Die Reitbeteiligung wurde freigeschaltet." : "Die Freischaltung wurde entzogen.";
  redirectWithMessage("/owner/anfragen", "message", successMessage);
}

export async function logoutAction() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirectWithMessage("/login", "message", "Du bist jetzt abgemeldet.");
}

export async function completeOnboardingAction(formData: FormData) {
  const { supabase, user } = await requireOnboardingUser();
  const role = asString(formData.get("role"));

  if (!isRole(role)) {
    redirectWithMessage("/onboarding", "error", "Bitte waehle Pferdehalter oder Reiter aus.");
  }

  const { error } = await supabase.from("profiles").insert({
    id: user.id,
    role
  });

  if (error) {
    redirectWithMessage("/onboarding", "error", "Das Profil konnte nicht angelegt werden.");
  }

  revalidatePath("/dashboard");
  redirectWithMessage("/dashboard", "message", "Dein Profil wurde angelegt.");
}

export async function saveHorseAction(formData: FormData) {
  const { supabase, user } = await requireProfile("owner");
  const horseId = asString(formData.get("horseId"));
  const title = asString(formData.get("title"));
  const plz = asString(formData.get("plz"));
  const description = asOptionalString(formData.get("description"));
  const stockmassCm = asInteger(formData.get("stockmassCm"));
  const rasse = asOptionalString(formData.get("rasse"));
  const farbe = asOptionalString(formData.get("farbe"));
  const geschlechtValue = asOptionalString(formData.get("geschlecht"));
  const alter = asInteger(formData.get("alter"));
  const active = formData.get("active") === "on";

  if (title.length < 2 || plz.length < 3) {
    redirectWithMessage("/owner/horses", "error", "Titel und PLZ sind erforderlich.");
  }

  if (stockmassCm !== null && stockmassCm <= 0) {
    redirectWithMessage("/owner/horses", "error", "Das Stockmass muss groesser als 0 sein.");
  }

  if (alter !== null && alter <= 0) {
    redirectWithMessage("/owner/horses", "error", "Das Alter muss groesser als 0 sein.");
  }

  if (geschlechtValue && !isHorseGeschlecht(geschlechtValue)) {
    redirectWithMessage("/owner/horses", "error", `Bitte waehle ${HORSE_GESCHLECHTER.join(", ")} fuer das Geschlecht.`);
  }

  const horseValues = {
    active,
    alter,
    description,
    farbe,
    geschlecht: geschlechtValue,
    plz,
    rasse,
    stockmass_cm: stockmassCm,
    title
  };

  if (horseId) {
    const { error } = await supabase.from("horses").update(horseValues).eq("id", horseId).eq("owner_id", user.id);

    if (error) {
      redirectWithMessage("/owner/horses", "error", "Die Reitbeteiligung konnte nicht gespeichert werden.");
    }
  } else {
    const { error } = await supabase.from("horses").insert({
      ...horseValues,
      owner_id: user.id
    });

    if (error) {
      redirectWithMessage("/owner/horses", "error", "Die Reitbeteiligung konnte nicht gespeichert werden.");
    }
  }

  revalidatePath("/owner/horses");
  revalidatePath("/dashboard");
  revalidatePath("/suchen");
  redirectWithMessage("/owner/horses", "message", "Die Reitbeteiligung wurde gespeichert.");
}

export async function uploadHorseImagesAction(formData: FormData) {
  const { supabase, user } = await requireProfile("owner");
  const horseId = asString(formData.get("horseId"));

  if (!horseId) {
    redirectWithMessage("/owner/horses", "error", "Das Pferdeprofil konnte nicht gefunden werden.");
  }

  const horse = await getOwnedHorse(supabase, horseId, user.id);

  if (!horse) {
    redirectWithMessage("/owner/horses", "error", "Du kannst nur Bilder fuer eigene Pferdeprofile hochladen.");
  }

  const rawFiles = formData.getAll("images");
  const files = rawFiles.filter((entry): entry is File => typeof File !== "undefined" && entry instanceof File && entry.size > 0);

  if (files.length === 0) {
    redirectWithMessage("/owner/horses", "error", "Bitte waehle mindestens ein Bild aus.");
  }

  if (files.some((file) => !file.type.startsWith("image/"))) {
    redirectWithMessage("/owner/horses", "error", "Es koennen nur Bilddateien hochgeladen werden.");
  }

  const { data: existingImagesData } = await supabase
    .from("horse_images")
    .select("id, horse_id, storage_path, created_at")
    .eq("horse_id", horseId)
    .order("created_at", { ascending: true });

  const existingImages = (existingImagesData as HorseImageRecord[] | null) ?? [];

  if (existingImages.length + files.length > MAX_HORSE_IMAGES) {
    redirectWithMessage("/owner/horses", "error", `Es koennen maximal ${MAX_HORSE_IMAGES} Bilder gespeichert werden.`);
  }

  const uploadedPaths: string[] = [];

  for (const file of files) {
    const storagePath = createHorseImageStoragePath(user.id, horseId, file.name);
    const { error } = await supabase.storage.from(HORSE_IMAGE_BUCKET).upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type || undefined,
      upsert: false
    });

    if (error) {
      logSupabaseError("Horse image upload failed", error);

      if (uploadedPaths.length > 0) {
        const { error: cleanupError } = await supabase.storage.from(HORSE_IMAGE_BUCKET).remove(uploadedPaths);

        if (cleanupError) {
          logSupabaseError("Horse image upload cleanup failed", cleanupError);
        }
      }

      redirectWithMessage("/owner/horses", "error", "Die Bilder konnten nicht hochgeladen werden.");
    }

    uploadedPaths.push(storagePath);
  }

  const imageRows = uploadedPaths.map((storagePath) => ({
    horse_id: horseId,
    storage_path: storagePath
  }));

  const { error: insertError } = await supabase.from("horse_images").insert(imageRows);

  if (insertError) {
    logSupabaseError("Horse image row insert failed", insertError);
    const { error: cleanupError } = await supabase.storage.from(HORSE_IMAGE_BUCKET).remove(uploadedPaths);

    if (cleanupError) {
      logSupabaseError("Horse image row cleanup failed", cleanupError);
    }

    redirectWithMessage("/owner/horses", "error", "Die Bilder konnten nicht gespeichert werden.");
  }

  revalidatePath("/owner/horses");
  revalidatePath("/suchen");
  revalidatePath(`/pferde/${horseId}`);
  redirectWithMessage("/owner/horses", "message", "Die Bilder wurden gespeichert.");
}

export async function deleteHorseImageAction(formData: FormData) {
  const { supabase, user } = await requireProfile("owner");
  const imageId = asString(formData.get("imageId"));

  if (!imageId) {
    redirectWithMessage("/owner/horses", "error", "Das Bild konnte nicht gefunden werden.");
  }

  const { data: imageData } = await supabase.from("horse_images").select(HORSE_IMAGE_SELECT_FIELDS).eq("id", imageId).maybeSingle();
  const image = (imageData as HorseImageRecord | null) ?? null;

  if (!image) {
    redirectWithMessage("/owner/horses", "error", "Das Bild konnte nicht gefunden werden.");
  }

  const horse = await getOwnedHorse(supabase, image.horse_id, user.id);

  if (!horse) {
    redirectWithMessage("/owner/horses", "error", "Du kannst nur Bilder fuer eigene Pferdeprofile loeschen.");
  }

  const { error: storageError } = await supabase.storage.from(HORSE_IMAGE_BUCKET).remove([image.storage_path]);

  if (storageError) {
    logSupabaseError("Horse image storage delete failed", storageError);
    redirectWithMessage("/owner/horses", "error", "Das Bild konnte nicht geloescht werden.");
  }

  const { error } = await supabase.from("horse_images").delete().eq("id", imageId);

  if (error) {
    logSupabaseError("Horse image row delete failed", error);
    redirectWithMessage("/owner/horses", "error", "Das Bild konnte nicht geloescht werden.");
  }

  revalidatePath("/owner/horses");
  revalidatePath("/suchen");
  revalidatePath(`/pferde/${image.horse_id}`);
  redirectWithMessage("/owner/horses", "message", "Das Bild wurde entfernt.");
}

export async function deleteHorseAction(formData: FormData) {
  const { supabase, user } = await requireProfile("owner");
  const horseId = asString(formData.get("horseId"));

  if (!horseId) {
    redirectWithMessage("/owner/horses", "error", "Das Pferdeprofil konnte nicht gefunden werden.");
  }

  const horse = await getOwnedHorse(supabase, horseId, user.id);

  if (!horse) {
    redirectWithMessage("/owner/horses", "error", "Du kannst nur eigene Pferdeprofile loeschen.");
  }

  const { data: imagesData } = await supabase
    .from("horse_images")
    .select("id, horse_id, storage_path, created_at")
    .eq("horse_id", horseId)
    .order("created_at", { ascending: true });

  const images = (imagesData as HorseImageRecord[] | null) ?? [];
  const imagePaths = images.map((image) => image.storage_path);

  if (imagePaths.length > 0) {
    const { error: storageError } = await supabase.storage.from(HORSE_IMAGE_BUCKET).remove(imagePaths);

    if (storageError) {
      logSupabaseError("Horse image cleanup during horse delete failed", storageError);
    }
  }

  const { error } = await supabase.rpc("delete_owner_horse", {
    p_horse_id: horseId
  });

  if (error) {
    logSupabaseError("Horse delete failed", error);
    redirectWithMessage("/owner/horses", "error", "Pferdeprofil konnte nicht geloescht werden.");
  }

  revalidatePath("/owner/horses");
  revalidatePath("/dashboard");
  revalidatePath("/suchen");
  revalidatePath("/owner/anfragen");
  revalidatePath("/anfragen");
  revalidatePath(`/pferde/${horseId}`);
  redirectWithMessage("/owner/horses", "message", "Das Pferdeprofil wurde geloescht.");
}

export async function saveRiderProfileAction(formData: FormData) {
  const { supabase, user } = await requireProfile("rider");
  const experience = asOptionalString(formData.get("experience"));
  const weight = asInteger(formData.get("weight"));
  const notes = asOptionalString(formData.get("notes"));

  if (weight !== null && weight <= 0) {
    redirectWithMessage("/rider/profile", "error", "Das Gewicht muss groesser als 0 sein.");
  }

  const { error } = await supabase.from("rider_profiles").upsert(
    {
      experience,
      notes,
      user_id: user.id,
      weight
    },
    {
      onConflict: "user_id"
    }
  );

  if (error) {
    redirectWithMessage("/rider/profile", "error", "Das Reiterprofil konnte nicht gespeichert werden.");
  }

  revalidatePath("/rider/profile");
  revalidatePath("/dashboard");
  redirectWithMessage("/rider/profile", "message", "Das Reiterprofil wurde gespeichert.");
}
