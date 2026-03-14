import type { SupabaseClient } from "@supabase/supabase-js";

type AccountDeleteOutcome =
  | { ok: true }
  | { ok: false; errorCode: string };

export function getAccountDeleteErrorMessage(errorCode: string, role: "owner" | "rider"): string {
  switch (errorCode) {
    case "ACTIVE_HORSES":
      return "Du hast noch aktive Pferdeprofile. Bitte deaktiviere alle Pferde, bevor du dein Konto loeschst.";
    case "ACTIVE_APPROVALS":
      return role === "rider"
        ? "Du hast noch aktive Reitbeteiligungen. Bitte beende sie zuerst im Bereich 'Meine Anfragen'."
        : "Eines deiner Pferde hat noch aktive Reitbeteiligungen. Bitte entziehe alle Freischaltungen zuerst.";
    case "FUTURE_BOOKINGS":
      return role === "rider"
        ? "Du hast noch bevorstehende Buchungen. Bitte storniere sie, bevor du dein Konto loeschst."
        : "Eines deiner Pferde hat noch bevorstehende Buchungen. Bitte klaere diese zuerst.";
    case "PENDING_REQUESTS":
      return "Du hast noch offene Probeterminanfragen. Bitte warte auf ihren Abschluss oder ziehe sie zurueck.";
    default:
      return "Das Konto konnte nicht geloescht werden. Bitte versuche es erneut oder wende dich an den Support.";
  }
}

export async function deleteRiderAccount(supabase: SupabaseClient): Promise<AccountDeleteOutcome> {
  const { error } = await supabase.rpc("delete_rider_account");

  if (error) {
    return { errorCode: error.message, ok: false };
  }

  return { ok: true };
}

export async function deleteOwnerAccount(supabase: SupabaseClient): Promise<AccountDeleteOutcome> {
  const { error } = await supabase.rpc("delete_owner_account");

  if (error) {
    return { errorCode: error.message, ok: false };
  }

  return { ok: true };
}
