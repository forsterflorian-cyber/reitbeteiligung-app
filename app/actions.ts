"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOnboardingUser, requireProfile } from "@/lib/auth";
import { asInteger, asOptionalString, asString, isRole } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import type { Conversation, Horse, TrialRequest } from "@/types/database";

const PASSWORD_RESET_REDIRECT_URL = "https://reitbeteiligung.app/passwort-zuruecksetzen";

type OwnerRequestRecord = Pick<TrialRequest, "id" | "horse_id" | "rider_id" | "status">;
type ConversationLookupRecord = Pick<Conversation, "id">;
type HorseOwnerRecord = Pick<Horse, "id" | "owner_id">;

function redirectWithMessage(path: string, key: "error" | "message", message: string): never {
  redirect(`${path}?${key}=${encodeURIComponent(message)}`);
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

  const { data: horse } = await supabase
    .from("horses")
    .select("id")
    .eq("id", typedRequest.horse_id)
    .eq("owner_id", ownerId)
    .maybeSingle();

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

  const { data: existingConversationData, error: conversationLookupError } = await supabase
    .from("conversations")
    .select("id")
    .eq("horse_id", horseId)
    .eq("rider_id", user.id)
    .eq("owner_id", horse.owner_id)
    .maybeSingle();

  if (conversationLookupError) {
    redirectWithMessage(`/pferde/${horseId}`, "error", "Der Chat konnte nicht vorbereitet werden. Bitte versuche es erneut.");
  }

  const existingConversation = (existingConversationData as ConversationLookupRecord | null) ?? null;

  if (!existingConversation) {
    const { error: conversationInsertError } = await supabase.from("conversations").insert({
      horse_id: horseId,
      owner_id: horse.owner_id,
      rider_id: user.id
    });

    if (conversationInsertError) {
      redirectWithMessage(`/pferde/${horseId}`, "error", "Der Chat konnte nicht vorbereitet werden. Bitte versuche es erneut.");
    }
  }

  const { error } = await supabase.from("trial_requests").insert({
    horse_id: horseId,
    message,
    rider_id: user.id,
    status: "requested"
  });

  if (error) {
    redirectWithMessage(`/pferde/${horseId}`, "error", "Die Anfrage fuer den Probetermin konnte nicht gespeichert werden.");
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

  if (!requestId || !["accepted", "declined", "completed"].includes(nextStatus)) {
    redirectWithMessage("/owner/anfragen", "error", "Die Aktion ist ungueltig.");
  }

  const record = await getOwnedTrialRequest(requestId, user.id);

  if (!record) {
    redirectWithMessage("/owner/anfragen", "error", "Die Anfrage konnte nicht gefunden werden.");
  }

  if (nextStatus === "completed" && record.request.status !== "accepted") {
    redirectWithMessage("/owner/anfragen", "error", "Nur angenommene Probetermine koennen als durchgefuehrt markiert werden.");
  }

  if ((nextStatus === "accepted" || nextStatus === "declined") && record.request.status !== "requested") {
    redirectWithMessage("/owner/anfragen", "error", "Diese Anfrage kann nicht mehr geaendert werden.");
  }

  const { error } = await record.supabase.from("trial_requests").update({ status: nextStatus }).eq("id", requestId);

  if (error) {
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

  if (!requestId || !["approved", "revoked"].includes(nextStatus)) {
    redirectWithMessage("/owner/anfragen", "error", "Die Freischaltung ist ungueltig.");
  }

  const record = await getOwnedTrialRequest(requestId, user.id);

  if (!record) {
    redirectWithMessage("/owner/anfragen", "error", "Die Anfrage konnte nicht gefunden werden.");
  }

  if (record.request.status !== "completed") {
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
    redirectWithMessage("/owner/anfragen", "error", "Die Freischaltung konnte nicht gespeichert werden.");
  }

  revalidatePath("/owner/anfragen");
  revalidatePath(`/pferde/${record.request.horse_id}`);
  const successMessage = nextStatus === "approved" ? "Die Reitbeteiligung wurde freigeschaltet." : "Die Freischaltung wurde entzogen.";
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
  const active = formData.get("active") === "on";

  if (title.length < 2 || plz.length < 3) {
    redirectWithMessage("/owner/horses", "error", "Titel und PLZ sind erforderlich.");
  }

  if (horseId) {
    const { error } = await supabase
      .from("horses")
      .update({ active, description, plz, title })
      .eq("id", horseId)
      .eq("owner_id", user.id);

    if (error) {
      redirectWithMessage("/owner/horses", "error", "Die Reitbeteiligung konnte nicht gespeichert werden.");
    }
  } else {
    const { error } = await supabase.from("horses").insert({
      active,
      description,
      owner_id: user.id,
      plz,
      title
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
