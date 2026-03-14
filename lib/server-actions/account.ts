import type { SupabaseClient } from "@supabase/supabase-js";

type AccountDeactivateOutcome =
  | { ok: true }
  | { ok: false; errorCode: string };

export function getAccountDeactivateErrorMessage(errorCode: string, role: "owner" | "rider"): string {
  switch (errorCode) {
    case "ACTIVE_HORSES":
      return "Du hast noch aktive Pferdeprofile. Bitte deaktiviere alle Pferde, bevor du dein Konto löschst.";
    case "ACTIVE_APPROVALS":
      return role === "rider"
        ? "Du hast noch aktive Reitbeteiligungen. Bitte beende sie zuerst im Bereich 'Meine Anfragen'."
        : "Eines deiner Pferde hat noch aktive Reitbeteiligungen. Bitte entziehe alle Freischaltungen zuerst.";
    case "FUTURE_BOOKINGS":
      return role === "rider"
        ? "Du hast noch bevorstehende Buchungen. Bitte storniere sie, bevor du dein Konto löschst."
        : "Eines deiner Pferde hat noch bevorstehende Buchungen. Bitte kläre diese zuerst.";
    case "PENDING_REQUESTS":
      return "Du hast noch offene Probeterminanfragen. Bitte warte auf ihren Abschluss oder ziehe sie zurück.";
    default:
      return "Das Konto konnte nicht gelöscht werden. Bitte versuche es erneut oder wende dich an den Support.";
  }
}

export async function deactivateRiderAccount(supabase: SupabaseClient): Promise<AccountDeactivateOutcome> {
  const { error } = await supabase.rpc("deactivate_rider_account");

  if (error) {
    return { errorCode: error.message, ok: false };
  }

  return { ok: true };
}

export async function deactivateOwnerAccount(supabase: SupabaseClient): Promise<AccountDeactivateOutcome> {
  const { error } = await supabase.rpc("deactivate_owner_account");

  if (error) {
    return { errorCode: error.message, ok: false };
  }

  return { ok: true };
}
