"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOnboardingUser, requireProfile } from "@/lib/auth";
import {
  HORSE_GESCHLECHTER,
  HORSE_IMAGE_BUCKET,
  HORSE_IMAGE_SELECT_FIELDS,
  MAX_HORSE_IMAGES,
  createHorseImageStoragePath,
  sortHorseImages
} from "@/lib/horses";
import { asInteger, asOptionalString, asString, isRole } from "@/lib/forms";
import {
  APPROVAL_STATUS,
  TRIAL_REQUEST_STATUS,
  isTrialRequestLifecycleStatus,
  isOwnerTrialDecisionStatus,
  isMutableTrialRequestStatus
} from "@/lib/statuses";
import { createClient } from "@/lib/supabase/server";
import { canCreateHorseProfile, canStartOwnerTrial, getOwnerPlan, getOwnerPlanUsage } from "@/lib/plans";
import { redirectWithFlash } from "@/lib/server-flash";
import { isTrialRuleBlocked } from "@/lib/trial-slots";
import {
  getTrialConversationFailureMessage,
  getTrialRequestDuplicateError,
  getTrialRequestSuccessMessage,
  getTrialSlotSelectionError
} from "@/lib/server-actions/trial";
import {
  cancelTrialRequestForRider,
  updateTrialRequestStatusForOwner
} from "@/lib/server-actions/trial-actions";
import {
  removeRelationshipForOwner,
  updateRelationshipApprovalForOwner
} from "@/lib/server-actions/relationships";
import {
  getHorseCreateLimitError,
  getHorseDeleteError,
  getHorseDeleteRevalidationPaths,
  getHorseSaveRevalidationPaths,
  getHorseValidationError,
  getOwnedHorse,
  getOwnerRedirectPath
} from "@/lib/server-actions/horse";
import { deleteHorseImageForOwner, uploadHorseImagesForOwner } from "@/lib/server-actions/horse-actions";
import {
  buildAvailabilityWindows,
  buildSingleAvailabilityWindow,
  createCalendarBlockForOwner as createCalendarBlockWithRpcForOwner,
  getActiveAvailabilityRanges,
  getAvailabilityAccessError,
  getAvailabilityConflictError,
  getAvailabilityInvalidWindowError,
  getAvailabilityLoadError,
  getAvailabilityPlannerDayError,
  getAvailabilityRevalidationPaths,
  getAvailabilitySaveError,
  getAvailabilitySavedMessage,
  getAvailabilityTimeError,
  getCalendarBlockAccessError,
  getCalendarBlockInvalidWindowError,
  getCalendarBlockPlannerDayError,
  getCalendarBlockQuarterHourError,
  getCalendarBlockRevalidationPaths,
  getCalendarRedirectPath,
  getCalendarBlockSavedMessage,
  getCalendarBlockSaveError,
  getCalendarBlockTimeError,
  isAvailabilityPreset,
  parseClockTime,
  resolveAvailabilityDays
} from "@/lib/server-actions/calendar";
import {
  createAvailabilityDayForOwner,
  createAvailabilityRuleForOwner,
  createCalendarBlockForOwner,
  deleteAvailabilityRuleForOwner,
  deleteCalendarBlockForOwner,
  moveAvailabilityRuleForOwner,
  moveCalendarBlockForOwner,
  resizeAvailabilityRuleForOwner,
  resizeCalendarBlockForOwner,
  updateAvailabilityDayForOwner,
  updateCalendarBlockForOwner
} from "@/lib/server-actions/calendar-actions";
import {
  acceptBookingRequestForOwner,
  cancelOperationalBookingForOwner,
  cancelOperationalBookingForRider,
  declineBookingRequestForOwner,
  rescheduleOperationalBookingForOwner,
  rescheduleOperationalBookingForRider,
  requestBookingForRider
} from "@/lib/server-actions/bookings";
import { saveRiderBookingLimitForOwner } from "@/lib/server-actions/booking-limits";
import { markNotificationRead } from "@/lib/server-actions/notifications";
import type { Approval, AvailabilityRule, CalendarBlock, Horse, HorseBookingMode, HorseImage, TrialRequest } from "@/types/database";

const PASSWORD_RESET_REDIRECT_URL = "https://reitbeteiligung.app/passwort-zuruecksetzen";

type HorseOwnerRecord = Pick<Horse, "id" | "owner_id">;
type HorseImageRecord = Pick<HorseImage, "id" | "horse_id" | "path" | "storage_path" | "position" | "created_at">;
type CalendarBlockRecord = Pick<CalendarBlock, "id" | "horse_id" | "title" | "start_at" | "end_at" | "created_at">;
type AvailabilityRuleRecord = Pick<AvailabilityRule, "id" | "horse_id" | "slot_id" | "start_at" | "end_at" | "active" | "is_trial_slot" | "created_at">;
type SupabaseErrorLike = {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message: string;
};

function redirectWithMessage(path: string, key: "error" | "message", message: string): never {
  return redirectWithFlash(path, key === "error" ? "error" : "success", message);
}

function logSupabaseError(context: string, error: SupabaseErrorLike) {
  console.error(`[${context}] ${error.message}`, {
    code: error.code ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null
  });
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
  const availabilityRuleId = asOptionalString(formData.get("availabilityRuleId"));
  const message = asOptionalString(formData.get("message"));

  if (!horseId) {
    redirectWithMessage("/suchen", "error", "Das Pferd konnte nicht gefunden werden.");
  }

  const redirectPath = `/pferde/${horseId}`;

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
  const { data: existingOwnRequestData } = await supabase
    .from("trial_requests")
    .select("id, status, created_at")
    .eq("horse_id", horseId)
    .eq("rider_id", riderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const existingOwnRequest = (existingOwnRequestData as Pick<TrialRequest, "id" | "status"> | null) ?? null;

  if (existingOwnRequest && isTrialRequestLifecycleStatus(existingOwnRequest.status)) {
    redirectWithMessage(redirectPath, "error", getTrialRequestDuplicateError(existingOwnRequest.status));
  }

  const nowIso = new Date().toISOString();
  const { data: activeTrialRulesData, error: activeTrialRulesError } = await supabase
    .from("availability_rules")
    .select("id, horse_id, slot_id, start_at, end_at, active, is_trial_slot, created_at")
    .eq("horse_id", horseId)
    .eq("active", true)
    .eq("is_trial_slot", true)
    .gt("end_at", nowIso);

  if (activeTrialRulesError) {
    logSupabaseError("Trial request slot lookup failed", activeTrialRulesError);
    redirectWithMessage(redirectPath, "error", "Die verfuegbaren Probetermine konnten nicht geladen werden.");
  }

  const activeTrialRules = (activeTrialRulesData as AvailabilityRuleRecord[] | null) ?? [];
  const hasExplicitTrialSlots = activeTrialRules.length > 0;
  let selectedRule: AvailabilityRuleRecord | null = null;

  if (availabilityRuleId) {
    selectedRule = activeTrialRules.find((rule) => rule.id === availabilityRuleId) ?? null;

    if (!selectedRule) {
      redirectWithMessage(redirectPath, "error", "Dieser Probetermin ist nicht mehr verfuegbar.");
    }

    const [{ data: occupancyData, error: occupancyError }, { data: reservedRequestData, error: reservedRequestError }] = await Promise.all([
      supabase.rpc("get_horse_calendar_occupancy", {
        p_horse_id: horseId
      }),
      supabase
        .from("trial_requests")
        .select("availability_rule_id, requested_start_at, requested_end_at, status")
        .eq("horse_id", horseId)
    ]);

    if (occupancyError) {
      logSupabaseError("Trial request occupancy lookup failed", occupancyError);
      redirectWithMessage(redirectPath, "error", "Die verfuegbaren Probetermine konnten nicht geladen werden.");
    }

    if (reservedRequestError) {
      logSupabaseError("Trial request reservation lookup failed", reservedRequestError);
      redirectWithMessage(redirectPath, "error", "Die verfuegbaren Probetermine konnten nicht geladen werden.");
    }

    const occupiedRanges = ((occupancyData as Array<{ start_at: string; end_at: string }> | null) ?? []);
    const reservedRequests = ((reservedRequestData as Array<Pick<TrialRequest, "availability_rule_id" | "requested_start_at" | "requested_end_at" | "status">> | null) ?? []);

    if (isTrialRuleBlocked(selectedRule, occupiedRanges, reservedRequests)) {
      redirectWithMessage(redirectPath, "error", "Dieser Probetermin ist nicht mehr verfuegbar.");
    }
  } else {
    const trialSlotSelectionError = getTrialSlotSelectionError(hasExplicitTrialSlots, Boolean(selectedRule));

    if (trialSlotSelectionError) {
      redirectWithMessage(redirectPath, "error", trialSlotSelectionError);
    }
  }

  const trialInsert = {
    availability_rule_id: selectedRule?.id ?? null,
    horse_id: horseId,
    message,
    requested_end_at: selectedRule?.end_at ?? null,
    requested_start_at: selectedRule?.start_at ?? null,
    rider_id: riderId,
    status: TRIAL_REQUEST_STATUS.requested
  };

  const { error } = await supabase.from("trial_requests").insert(trialInsert);

  if (error) {
    logSupabaseError("Trial request insert failed", error);
    redirectWithMessage(redirectPath, "error", "Probeanfrage konnte nicht gespeichert werden.");
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
    revalidatePath(`/pferde/${horseId}/kalender`);
    revalidatePath("/anfragen");
    revalidatePath("/nachrichten");
    revalidatePath("/owner/anfragen");
    redirectWithMessage(
      `/pferde/${horseId}`,
      "error",
      getTrialConversationFailureMessage(hasExplicitTrialSlots)
    );
  }

  revalidatePath(`/pferde/${horseId}`);
  revalidatePath(`/pferde/${horseId}/kalender`);
  revalidatePath("/anfragen");
  revalidatePath("/nachrichten");
  revalidatePath("/owner/anfragen");
  redirectWithMessage(
    `/pferde/${horseId}`,
    "message",
    getTrialRequestSuccessMessage(hasExplicitTrialSlots)
  );
}

export async function cancelTrialRequestAction(formData: FormData) {
  const { supabase, user } = await requireProfile("rider");
  const requestId = asString(formData.get("requestId"));

  if (!requestId) {
    redirectWithMessage("/anfragen", "error", "Die Probeanfrage konnte nicht gefunden werden.");
  }

  const result = await cancelTrialRequestForRider({
    logSupabaseError,
    requestId,
    riderId: user.id,
    supabase
  });

  if (!result.ok) {
    redirectWithMessage(result.redirectPath, "error", result.message);
  }

  for (const path of result.paths) {
    revalidatePath(path);
  }

  redirectWithMessage(result.redirectPath, "message", result.message);
}

export async function updateTrialRequestStatusAction(formData: FormData) {
  const { supabase, user } = await requireProfile("owner");
  const requestId = asString(formData.get("requestId"));
  const nextStatus = asString(formData.get("status"));

  if (!requestId || !isMutableTrialRequestStatus(nextStatus)) {
    redirectWithMessage("/owner/anfragen", "error", "Die Aktion ist ungueltig.");
  }

  const result = await updateTrialRequestStatusForOwner({
    logSupabaseError,
    nextStatus,
    ownerId: user.id,
    requestId,
    supabase
  });

  if (!result.ok) {
    redirectWithMessage(result.redirectPath, "error", result.message);
  }

  for (const path of result.paths) {
    revalidatePath(path);
  }

  redirectWithMessage(result.redirectPath, "message", result.message);
}

export async function updateApprovalAction(formData: FormData) {
  const { profile, user } = await requireProfile("owner");
  const redirectPath = getOwnerRedirectPath(formData, "/owner/anfragen");
  const requestId = asString(formData.get("requestId"));
  const nextStatus = asString(formData.get("status"));

  if (!requestId || !isOwnerTrialDecisionStatus(nextStatus)) {
    redirectWithMessage(redirectPath, "error", "Die Freischaltung ist ungueltig.");
  }

  const result = await updateRelationshipApprovalForOwner({
    logSupabaseError,
    nextStatus,
    ownerId: user.id,
    ownerProfile: profile,
    redirectPath,
    requestId,
    supabase: createClient()
  });

  if (!result.ok) {
    redirectWithMessage(result.redirectPath, "error", result.message);
  }

  for (const path of result.paths) {
    revalidatePath(path);
  }

  revalidatePath(redirectPath);
  redirectWithMessage(result.redirectPath, "message", result.message);
}
export async function saveRiderBookingLimitAction(formData: FormData) {
  const { supabase, user } = await requireProfile("owner");
  const horseId = asString(formData.get("horseId"));
  const riderId = asString(formData.get("riderId"));
  const weeklyHoursLimitInput = asString(formData.get("weeklyHoursLimit"));
  const weeklyHoursLimit = asInteger(formData.get("weeklyHoursLimit"));

  if (!horseId || !riderId) {
    redirectWithMessage("/owner/anfragen", "error", "Das Kontingent konnte nicht zugeordnet werden.");
  }

  const result = await saveRiderBookingLimitForOwner({
    horseId,
    logSupabaseError,
    ownerId: user.id,
    riderId,
    supabase,
    weeklyHoursLimit,
    weeklyHoursLimitInput
  });

  if (!result.ok) {
    redirectWithMessage(result.redirectPath, "error", result.message);
  }

  for (const path of result.paths) {
    revalidatePath(path);
  }

  redirectWithMessage(result.redirectPath, "message", result.message);
}

export async function deleteRiderRelationshipAction(formData: FormData) {
  const { supabase, user } = await requireProfile("owner");
  const horseId = asString(formData.get("horseId"));
  const riderId = asString(formData.get("riderId"));
  const redirectPath = getOwnerRedirectPath(formData, "/owner/reitbeteiligungen");

  if (!horseId || !riderId) {
    redirectWithMessage(redirectPath, "error", "Die Reitbeteiligung konnte nicht zugeordnet werden.");
  }

  const result = await removeRelationshipForOwner({
    horseId,
    logSupabaseError,
    ownerId: user.id,
    redirectPath,
    riderId,
    supabase
  });

  if (!result.ok) {
    redirectWithMessage(result.redirectPath, "error", result.message);
  }

  for (const path of result.paths) {
    revalidatePath(path);
  }

  redirectWithMessage(result.redirectPath, "message", result.message);
}
export async function startOwnerTrialAction(formData: FormData) {
  const { profile, supabase } = await requireProfile("owner");
  const redirectTo = asString(formData.get("redirectTo"));
  const redirectPath = redirectTo.startsWith("/") ? redirectTo : "/dashboard";

  if (!canStartOwnerTrial(profile)) {
    const message = profile.trial_started_at
      ? "Deine Testphase wurde bereits genutzt."
      : getOwnerPlan(profile).key === "trial"
        ? "Deine Testphase laeuft bereits."
        : "Die Testphase kann aktuell nicht gestartet werden.";
    redirectWithMessage(redirectPath, "error", message);
  }

  const { error } = await supabase
    .from("profiles")
    .update({ trial_started_at: new Date().toISOString() })
    .eq("id", profile.id);

  if (error) {
    logSupabaseError("Owner trial start failed", error);
    redirectWithMessage(redirectPath, "error", "Die Testphase konnte nicht gestartet werden.");
  }

  revalidatePath("/dashboard");
  revalidatePath("/owner/horses");
  revalidatePath("/owner/pferde-verwalten");
  revalidatePath("/profil");
  redirectWithMessage(redirectPath, "message", "Deine Testphase wurde gestartet.");
}
export async function logoutAction() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirectWithMessage("/login", "message", "Du bist jetzt abgemeldet.");
}

export async function completeOnboardingAction(formData: FormData) {
  const { supabase, user } = await requireOnboardingUser();
  const role = asString(formData.get("role"));
  const displayName = asString(formData.get("displayName"));
  const phone = asOptionalString(formData.get("phone"));

  if (!isRole(role)) {
    redirectWithMessage("/onboarding", "error", "Bitte waehle Pferdehalter oder Reiter aus.");
  }

  if (displayName.length < 2) {
    redirectWithMessage("/onboarding", "error", "Bitte gib deinen Namen an.");
  }

  if (phone && phone.length < 6) {
    redirectWithMessage("/onboarding", "error", "Bitte gib eine gueltige Telefonnummer an oder lasse das Feld leer.");
  }

  const { error } = await supabase.from("profiles").insert({
    display_name: displayName,
    id: user.id,
    phone,
    role
  });

  if (error) {
    logSupabaseError("Profile insert failed", error);
    redirectWithMessage("/onboarding", "error", "Das Profil konnte nicht angelegt werden.");
  }

  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  redirectWithMessage("/dashboard", "message", "Dein Profil wurde angelegt.");
}

export async function saveProfileDetailsAction(formData: FormData) {
  const { supabase, user } = await requireProfile();
  const displayName = asString(formData.get("displayName"));
  const phone = asOptionalString(formData.get("phone"));

  if (displayName.length < 2) {
    redirectWithMessage("/profil", "error", "Bitte gib deinen Namen an.");
  }

  if (phone && phone.length < 6) {
    redirectWithMessage("/profil", "error", "Bitte gib eine gueltige Telefonnummer an oder lasse das Feld leer.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      phone
    })
    .eq("id", user.id);

  if (error) {
    logSupabaseError("Profile update failed", error);
    redirectWithMessage("/profil", "error", "Das Profil konnte nicht gespeichert werden.");
  }

  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/profil");
  revalidatePath("/anfragen");
  revalidatePath("/nachrichten");
  revalidatePath("/owner/anfragen");
  redirectWithMessage("/profil", "message", "Dein Profil wurde gespeichert.");
}

export async function saveHorseAction(formData: FormData) {
  const { profile, supabase, user } = await requireProfile("owner");
  const redirectPath = getOwnerRedirectPath(formData);
  const horseId = asString(formData.get("horseId"));
  const successRedirectPath = horseId ? "/dashboard" : "/owner/pferde-verwalten";
  const title = asString(formData.get("title"));
  const plz = asString(formData.get("plz"));
  const locationAddress = asOptionalString(formData.get("locationAddress"));
  const locationNotes = asOptionalString(formData.get("locationNotes"));
  const description = asOptionalString(formData.get("description"));
  const heightCm = asInteger(formData.get("heightCm"));
  const breed = asOptionalString(formData.get("breed"));
  const color = asOptionalString(formData.get("color"));
  const sexValue = asOptionalString(formData.get("sex"));
  const birthYear = asInteger(formData.get("birthYear"));
  const active = formData.get("active") === "on";
  const bookingModeRaw = asString(formData.get("bookingMode"));
  const bookingMode: HorseBookingMode =
    bookingModeRaw === "free" ? "free" : bookingModeRaw === "window" ? "window" : "slots";
  const currentYear = new Date().getFullYear();

  const horseValidationError = getHorseValidationError({
    allowedSexes: HORSE_GESCHLECHTER,
    birthYear,
    currentYear,
    heightCm,
    plz,
    sexValue,
    title
  });

  if (horseValidationError) {
    redirectWithMessage(redirectPath, "error", horseValidationError);
  }

  const horseValues = {
    active,
    birth_year: birthYear,
    booking_mode: bookingMode,
    breed,
    color,
    description,
    height_cm: heightCm,
    location_address: locationAddress,
    location_notes: locationNotes,
    plz,
    sex: sexValue,
    title
  };

  if (horseId) {
    const { error } = await supabase.from("horses").update(horseValues).eq("id", horseId).eq("owner_id", user.id);

    if (error) {
      redirectWithMessage(redirectPath, "error", "Das Pferdeprofil konnte nicht gespeichert werden.");
    }
  } else {
    const ownerUsage = await getOwnerPlanUsage(supabase, user.id);

    if (!canCreateHorseProfile(profile, ownerUsage)) {
      const ownerPlan = getOwnerPlan(profile, ownerUsage);
      const horseLimit = ownerPlan.maxHorses ?? 0;

      redirectWithMessage(redirectPath, "error", getHorseCreateLimitError(ownerPlan.label, horseLimit));
    }

    const { error } = await supabase.from("horses").insert({
      ...horseValues,
      owner_id: user.id
    });

    if (error) {
      redirectWithMessage(redirectPath, "error", "Das Pferdeprofil konnte nicht gespeichert werden.");
    }
  }

  for (const path of getHorseSaveRevalidationPaths()) {
    revalidatePath(path);
  }

  redirectWithMessage(successRedirectPath, "message", "Das Pferdeprofil wurde gespeichert.");
}

export async function uploadHorseImagesAction(formData: FormData) {
  const { supabase, user } = await requireProfile("owner");
  const redirectPath = getOwnerRedirectPath(formData, "/owner/pferde-verwalten");
  const horseId = asString(formData.get("horseId"));

  if (!horseId) {
    redirectWithMessage(redirectPath, "error", getHorseDeleteError("missing"));
  }

  const rawFiles = formData.getAll("images");
  const files = rawFiles.filter((entry): entry is File => typeof File !== "undefined" && entry instanceof File && entry.size > 0);
  const result = await uploadHorseImagesForOwner({
    files,
    horseId,
    logSupabaseError,
    ownerId: user.id,
    supabase
  });

  if (!result.ok) {
    redirectWithMessage(redirectPath, "error", result.message);
  }

  revalidatePath("/owner/horses");
  revalidatePath("/owner/pferde-verwalten");
  revalidatePath("/suchen");
  revalidatePath(`/pferde/${result.horseId}`);
  redirectWithMessage(redirectPath, "message", "Die Bilder wurden gespeichert.");
}
export async function deleteHorseImageAction(formData: FormData) {
  const { supabase, user } = await requireProfile("owner");
  const redirectPath = getOwnerRedirectPath(formData, "/owner/pferde-verwalten");
  const imageId = asString(formData.get("imageId"));

  if (!imageId) {
    redirectWithMessage(redirectPath, "error", "Das Bild konnte nicht gefunden werden.");
  }

  const result = await deleteHorseImageForOwner({
    imageId,
    logSupabaseError,
    ownerId: user.id,
    supabase
  });

  if (!result.ok) {
    redirectWithMessage(redirectPath, "error", result.message);
  }

  revalidatePath("/owner/horses");
  revalidatePath("/owner/pferde-verwalten");
  revalidatePath("/suchen");
  revalidatePath(`/pferde/${result.horseId}`);
  redirectWithMessage(redirectPath, "message", "Das Bild wurde entfernt.");
}
export async function createAvailabilityDayAction(formData: FormData) {
  const { supabase, user } = await requireProfile("owner");
  const result = await createAvailabilityDayForOwner({
    formData,
    logSupabaseError,
    ownerId: user.id,
    supabase
  });

  if (!result.ok) {
    redirectWithMessage(result.redirectPath, "error", result.message);
  }

  for (const path of result.paths) {
    revalidatePath(path);
  }

  redirectWithMessage(result.redirectPath, "message", result.successMessage);
}

export async function updateAvailabilityDayAction(formData: FormData) {
  const { supabase, user } = await requireProfile("owner");
  const result = await updateAvailabilityDayForOwner({
    formData,
    logSupabaseError,
    ownerId: user.id,
    supabase
  });

  if (!result.ok) {
    redirectWithMessage(result.redirectPath, "error", result.message);
  }

  for (const path of result.paths) {
    revalidatePath(path);
  }

  redirectWithMessage(result.redirectPath, "message", result.successMessage);
}

export async function resizeAvailabilityRuleAction(formData: FormData) {
  const { supabase, user } = await requireProfile("owner");
  const result = await resizeAvailabilityRuleForOwner({
    formData,
    logSupabaseError,
    ownerId: user.id,
    supabase
  });

  if (!result.ok) {
    redirectWithMessage(result.redirectPath, "error", result.message);
  }

  for (const path of result.paths) {
    revalidatePath(path);
  }

  redirectWithMessage(result.redirectPath, "message", result.successMessage);
}

export async function moveAvailabilityRuleAction(formData: FormData) {
  const { supabase, user } = await requireProfile("owner");
  const result = await moveAvailabilityRuleForOwner({
    formData,
    logSupabaseError,
    ownerId: user.id,
    supabase
  });

  if (!result.ok) {
    redirectWithMessage(result.redirectPath, "error", result.message);
  }

  for (const path of result.paths) {
    revalidatePath(path);
  }

  redirectWithMessage(result.redirectPath, "message", result.successMessage);
}

export async function createCalendarBlockAction(formData: FormData) {
  const { supabase, user } = await requireProfile("owner");
  const result = await createCalendarBlockForOwner({
    formData,
    logSupabaseError,
    ownerId: user.id,
    supabase
  });

  if (!result.ok) {
    redirectWithMessage(result.redirectPath, "error", result.message);
  }

  for (const path of result.paths) {
    revalidatePath(path);
  }

  redirectWithMessage(result.redirectPath, "message", result.successMessage);
}

export async function updateCalendarBlockAction(formData: FormData) {
  const { supabase, user } = await requireProfile("owner");
  const result = await updateCalendarBlockForOwner({
    formData,
    logSupabaseError,
    ownerId: user.id,
    supabase
  });

  if (!result.ok) {
    redirectWithMessage(result.redirectPath, "error", result.message);
  }

  for (const path of result.paths) {
    revalidatePath(path);
  }

  redirectWithMessage(result.redirectPath, "message", result.successMessage);
}

export async function resizeCalendarBlockAction(formData: FormData) {
  const { supabase, user } = await requireProfile("owner");
  const result = await resizeCalendarBlockForOwner({
    formData,
    logSupabaseError,
    ownerId: user.id,
    supabase
  });

  if (!result.ok) {
    redirectWithMessage(result.redirectPath, "error", result.message);
  }

  for (const path of result.paths) {
    revalidatePath(path);
  }

  redirectWithMessage(result.redirectPath, "message", result.successMessage);
}

export async function moveCalendarBlockAction(formData: FormData) {
  const { supabase, user } = await requireProfile("owner");
  const result = await moveCalendarBlockForOwner({
    formData,
    logSupabaseError,
    ownerId: user.id,
    supabase
  });

  if (!result.ok) {
    redirectWithMessage(result.redirectPath, "error", result.message);
  }

  for (const path of result.paths) {
    revalidatePath(path);
  }

  redirectWithMessage(result.redirectPath, "message", result.successMessage);
}

export async function deleteCalendarBlockAction(formData: FormData) {
  const { supabase, user } = await requireProfile("owner");
  const blockId = asString(formData.get("blockId"));

  if (!blockId) {
    redirectWithMessage("/owner/horses", "error", getCalendarBlockAccessError("missing_block"));
  }

  const result = await deleteCalendarBlockForOwner({
    blockId,
    logSupabaseError,
    ownerId: user.id,
    supabase
  });

  if (!result.ok) {
    redirectWithMessage("/owner/horses", "error", result.message);
  }

  const redirectPath = `/pferde/${result.horseId}/kalender`;

  for (const pathToRevalidate of result.paths) {
    revalidatePath(pathToRevalidate);
  }
  redirectWithMessage(redirectPath, "message", result.successMessage);
}

export async function createCalendarBlockV1Action(formData: FormData) {
  const { supabase, user } = await requireProfile("owner");
  const horseId = asString(formData.get("horseId"));

  if (!horseId) {
    redirectWithMessage("/owner/horses", "error", getCalendarBlockAccessError("missing_horse"));
  }

  const redirectPath = `/pferde/${horseId}/kalender`;
  const selectedDate = asString(formData.get("selectedDate")) || new Date().toISOString().slice(0, 10);
  const startTime = parseClockTime(asString(formData.get("startTime")));
  const endTime = parseClockTime(asString(formData.get("endTime")));

  if (!startTime || !endTime) {
    redirectWithMessage(redirectPath, "error", getCalendarBlockTimeError());
  }

  const window = buildSingleAvailabilityWindow(selectedDate, startTime, endTime);

  if (!window) {
    redirectWithMessage(redirectPath, "error", getCalendarBlockInvalidWindowError());
  }

  const title = asOptionalString(formData.get("title"));

  const result = await createCalendarBlockWithRpcForOwner({
    endAt: window.endAt,
    horseId,
    logSupabaseError,
    startAt: window.startAt,
    supabase,
    ...(title ? { title } : {})
  });

  if (!result.ok) {
    redirectWithMessage(redirectPath, "error", result.message);
  }

  for (const path of result.paths) {
    revalidatePath(path);
  }

  redirectWithMessage(redirectPath, "message", result.message);
}

export async function createAvailabilityRuleAction(formData: FormData) {
  const { supabase, user } = await requireProfile("owner");
  const result = await createAvailabilityRuleForOwner({
    formData,
    logSupabaseError,
    ownerId: user.id,
    supabase
  });

  if (!result.ok) {
    redirectWithMessage(result.redirectPath, "error", result.message);
  }

  for (const path of result.paths) {
    revalidatePath(path);
  }

  redirectWithMessage(result.redirectPath, "message", result.successMessage);
}

export async function deleteAvailabilityRuleAction(formData: FormData) {
  const { supabase, user } = await requireProfile("owner");
  const ruleId = asString(formData.get("ruleId"));

  if (!ruleId) {
    redirectWithMessage("/owner/horses", "error", "Das Verf\u00fcgbarkeitsfenster konnte nicht gefunden werden.");
  }

  const result = await deleteAvailabilityRuleForOwner({
    logSupabaseError,
    ownerId: user.id,
    ruleId,
    supabase
  });

  if (!result.ok) {
    redirectWithMessage("/owner/horses", "error", result.message);
  }

  const redirectPath = `/pferde/${result.horseId}/kalender#kalender-liste`;

  for (const pathToRevalidate of result.paths) {
    revalidatePath(pathToRevalidate);
  }
  redirectWithMessage(redirectPath, "message", result.successMessage);
}
export async function requestBookingAction(formData: FormData) {
  const { supabase, user } = await requireProfile("rider");
  const result = await requestBookingForRider({
    formData,
    logSupabaseError,
    supabase,
    userId: user.id
  });
  if (!result.ok) {
    redirectWithMessage(result.redirectPath, "error", result.message);
  }

  for (const path of result.paths) {
    revalidatePath(path);
  }

  redirectWithMessage(result.redirectPath, "message", result.message);
}

export async function acceptBookingRequestAction(formData: FormData) {
  const { supabase, user } = await requireProfile("owner");
  const requestId = asString(formData.get("requestId"));

  if (!requestId) {
    redirectWithMessage("/owner/reitbeteiligungen", "error", "Die Buchungsanfrage konnte nicht gefunden werden.");
  }

  const result = await acceptBookingRequestForOwner({
    logSupabaseError,
    ownerId: user.id,
    requestId,
    supabase
  });

  if (!result.ok) {
    redirectWithMessage(result.redirectPath, "error", result.message);
  }

  for (const path of result.paths) {
    revalidatePath(path);
  }

  redirectWithMessage(result.redirectPath, "message", result.message);
}

export async function declineBookingRequestAction(formData: FormData) {
  const { supabase, user } = await requireProfile("owner");
  const requestId = asString(formData.get("requestId"));

  if (!requestId) {
    redirectWithMessage("/owner/reitbeteiligungen", "error", "Die Buchungsanfrage konnte nicht gefunden werden.");
  }

  const result = await declineBookingRequestForOwner({
    ownerId: user.id,
    requestId,
    supabase
  });

  if (!result.ok) {
    redirectWithMessage(result.redirectPath, "error", result.message);
  }

  for (const path of result.paths) {
    revalidatePath(path);
  }

  redirectWithMessage(result.redirectPath, "message", result.message);
}

export async function cancelOperationalBookingForRiderAction(formData: FormData) {
  const { supabase, user } = await requireProfile("rider");
  const bookingId = asString(formData.get("bookingId"));

  if (!bookingId) {
    redirectWithMessage("/anfragen", "error", "Der Termin konnte nicht gefunden werden.");
  }

  const result = await cancelOperationalBookingForRider({
    bookingId,
    logSupabaseError,
    riderId: user.id,
    supabase
  });

  if (!result.ok) {
    redirectWithMessage(result.redirectPath, "error", result.message);
  }

  for (const path of result.paths) {
    revalidatePath(path);
  }

  redirectWithMessage(result.redirectPath, "message", result.message);
}

export async function cancelOperationalBookingForOwnerAction(formData: FormData) {
  const { supabase, user } = await requireProfile("owner");
  const bookingId = asString(formData.get("bookingId"));

  if (!bookingId) {
    redirectWithMessage("/owner/reitbeteiligungen", "error", "Der Termin konnte nicht gefunden werden.");
  }

  const result = await cancelOperationalBookingForOwner({
    bookingId,
    logSupabaseError,
    ownerId: user.id,
    supabase
  });

  if (!result.ok) {
    redirectWithMessage(result.redirectPath, "error", result.message);
  }

  for (const path of result.paths) {
    revalidatePath(path);
  }

  redirectWithMessage(result.redirectPath, "message", result.message);
}

export async function rescheduleOperationalBookingForRiderAction(formData: FormData) {
  const { supabase, user } = await requireProfile("rider");
  const bookingId = asString(formData.get("bookingId"));
  const ruleId = asString(formData.get("ruleId"));
  const startAt = asString(formData.get("startAt"));
  const endAt = asString(formData.get("endAt"));

  if (!bookingId || !ruleId || !startAt || !endAt) {
    redirectWithMessage("/anfragen", "error", "Die Umbuchung konnte nicht zugeordnet werden.");
  }

  const result = await rescheduleOperationalBookingForRider({
    bookingId,
    endAtInput: endAt,
    logSupabaseError,
    riderId: user.id,
    ruleId,
    startAtInput: startAt,
    supabase
  });

  if (!result.ok) {
    redirectWithMessage(result.redirectPath, "error", result.message);
  }

  for (const path of result.paths) {
    revalidatePath(path);
  }

  redirectWithMessage(result.redirectPath, "message", result.message);
}

export async function rescheduleOperationalBookingForOwnerAction(formData: FormData) {
  const { supabase, user } = await requireProfile("owner");
  const bookingId = asString(formData.get("bookingId"));
  const ruleId = asString(formData.get("ruleId"));
  const startAt = asString(formData.get("startAt"));
  const endAt = asString(formData.get("endAt"));

  if (!bookingId || !ruleId || !startAt || !endAt) {
    redirectWithMessage("/owner/reitbeteiligungen", "error", "Die Umbuchung konnte nicht zugeordnet werden.");
  }

  const result = await rescheduleOperationalBookingForOwner({
    bookingId,
    endAtInput: endAt,
    logSupabaseError,
    ownerId: user.id,
    ruleId,
    startAtInput: startAt,
    supabase
  });

  if (!result.ok) {
    redirectWithMessage(result.redirectPath, "error", result.message);
  }

  for (const path of result.paths) {
    revalidatePath(path);
  }

  redirectWithMessage(result.redirectPath, "message", result.message);
}

export async function deleteHorseAction(formData: FormData) {
  const { supabase, user } = await requireProfile("owner");
  const redirectPath = getOwnerRedirectPath(formData, "/owner/pferde-verwalten");
  const horseId = asString(formData.get("horseId"));

  if (!horseId) {
    redirectWithMessage(redirectPath, "error", "Das Pferdeprofil konnte nicht gefunden werden.");
  }

  const horse = await getOwnedHorse(supabase, horseId, user.id);

  if (!horse) {
    redirectWithMessage(redirectPath, "error", getHorseDeleteError("forbidden"));
  }

  const { data: activeApprovalData } = await supabase
    .from("approvals")
    .select("horse_id")
    .eq("horse_id", horseId)
    .eq("status", "approved")
    .limit(1);
  const hasActiveRiderRelationship = ((activeApprovalData as Array<Pick<Approval, "horse_id">> | null) ?? []).length > 0;

  if (hasActiveRiderRelationship) {
    redirectWithMessage(redirectPath, "error", getHorseDeleteError("active_relationships"));
  }

  const { data: imagesData } = await supabase
    .from("horse_images")
    .select(HORSE_IMAGE_SELECT_FIELDS)
    .eq("horse_id", horseId)
    .order("created_at", { ascending: true });

  const images = sortHorseImages(
    (Array.isArray(imagesData) ? (imagesData as HorseImageRecord[]) : []).filter((image) => image.id)
  );
  const imagePaths = images.map((image) => image.path ?? image.storage_path ?? null).filter((imagePath): imagePath is string => Boolean(imagePath));

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

    if (error.code === "23503") {
      redirectWithMessage(redirectPath, "error", getHorseDeleteError("constraints"));
    }

    redirectWithMessage(redirectPath, "error", getHorseDeleteError("failed"));
  }

  for (const path of getHorseDeleteRevalidationPaths(horseId)) {
    revalidatePath(path);
  }

  redirectWithMessage(redirectPath, "message", "Das Pferdeprofil wurde gel?scht.");
}

export async function saveRiderProfileAction(formData: FormData) {
  const { supabase, user } = await requireProfile("rider");
  const experience = asOptionalString(formData.get("experience"));
  const weight = asInteger(formData.get("weight"));
  const preferredDays = asOptionalString(formData.get("preferredDays"));
  const goals = asOptionalString(formData.get("goals"));
  const notes = asOptionalString(formData.get("notes"));

  if (weight !== null && weight <= 0) {
    redirectWithMessage("/rider/profile", "error", "Das Gewicht muss groesser als 0 sein.");
  }

  if (preferredDays && preferredDays.length < 3) {
    redirectWithMessage("/rider/profile", "error", "Bitte beschreibe deine typische Verfuegbarkeit etwas genauer.");
  }

  const { error } = await supabase.from("rider_profiles").upsert(
    {
      experience,
      goals,
      notes,
      preferred_days: preferredDays,
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

export async function markNotificationReadAction(formData: FormData) {
  const { supabase } = await requireProfile();
  const notificationId = asString(formData.get("notificationId"));
  if (!notificationId) return;
  await markNotificationRead(supabase, notificationId);
  revalidatePath("/benachrichtigungen");
}

import {
  correctHorseActivityAction as correctHorseActivityActionImpl,
  logHorseActivityAction as logHorseActivityActionImpl
} from "@/lib/server-actions/activities";

export async function logHorseActivityAction(formData: FormData) {
  return logHorseActivityActionImpl(formData);
}

export async function correctHorseActivityAction(formData: FormData) {
  return correctHorseActivityActionImpl(formData);
}

