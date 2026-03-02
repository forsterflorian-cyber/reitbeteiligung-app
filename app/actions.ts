"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOnboardingUser, requireProfile } from "@/lib/auth";
import { asInteger, asOptionalString, asString, isRole } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

function redirectWithMessage(path: string, key: "error" | "message", message: string): never {
  redirect(`${path}?${key}=${encodeURIComponent(message)}`);
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle();

  redirect(profile ? "/dashboard" : "/onboarding");
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
