import type { createClient } from "../supabase/server";
import type { Horse } from "../../types/database";

type HorseValidationInput = {
  allowedSexes: readonly string[];
  birthYear: number | null;
  currentYear: number;
  heightCm: number | null;
  plz: string;
  sexValue: string | null;
  title: string;
};

type HorseOwnerRecord = Pick<Horse, "id" | "owner_id">;

function readString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export function getHorseValidationError(input: HorseValidationInput) {
  if (input.title.length < 2) {
    return "Bitte gib einen Titel mit mindestens 2 Zeichen an.";
  }

  if (!/^\d{5}$/.test(input.plz)) {
    return "Die PLZ muss genau 5 Ziffern haben.";
  }

  if (input.heightCm !== null && (input.heightCm < 50 || input.heightCm > 220)) {
    return "Das Stockma\u00df muss zwischen 50 und 220 cm liegen.";
  }

  if (input.birthYear !== null && (input.birthYear < 1980 || input.birthYear > input.currentYear)) {
    return `Das Geburtsjahr muss zwischen 1980 und ${input.currentYear} liegen.`;
  }

  if (input.sexValue && !input.allowedSexes.includes(input.sexValue)) {
    return `Bitte w\u00e4hle ${input.allowedSexes.join(', ')} f\u00fcr das Geschlecht.`;
  }

  return null;
}

export function getHorseCreateLimitError(planLabel: string, horseLimit: number) {
  const horseLabel = horseLimit === 1 ? "1 Pferd" : `${horseLimit} Pferde`;
  return `Im Tarif ${planLabel} sind ${horseLabel} enthalten. F\u00fcr weitere Pferde brauchst du sp\u00e4ter den bezahlten Tarif.`;
}

export function getHorseDeleteError(
  reason: "active_relationships" | "constraints" | "failed" | "forbidden" | "missing"
) {
  switch (reason) {
    case "missing":
      return "Das Pferdeprofil konnte nicht gefunden werden.";
    case "forbidden":
      return "Du kannst nur eigene Pferdeprofile l\u00f6schen.";
    case "active_relationships":
      return "Pferdeprofile mit aktiven Reitbeteiligungen k\u00f6nnen nicht gel\u00f6scht werden.";
    case "constraints":
      return "Das Pferd hat noch aktive Termine oder Anfragen und kann derzeit nicht gel\u00f6scht werden.";
    default:
      return "Pferdeprofil konnte nicht gel\u00f6scht werden.";
  }
}

export function getHorseSaveRevalidationPaths() {
  return ["/owner/horses", "/owner/pferde-verwalten", "/dashboard", "/suchen"] as const;
}

export function getHorseDeleteRevalidationPaths(horseId: string) {
  return [
    "/owner/horses",
    "/owner/pferde-verwalten",
    "/owner/reitbeteiligungen",
    "/dashboard",
    "/suchen",
    "/owner/anfragen",
    "/anfragen",
    `/pferde/${horseId}`
  ] as const;
}

export function getOwnerRedirectPath(formData: FormData, fallback = "/owner/horses") {
  const redirectTo = readString(formData.get("redirectTo"));

  if (!redirectTo.startsWith("/owner/")) {
    return fallback;
  }

  return redirectTo;
}

export async function getOwnedHorse(
  supabase: ReturnType<typeof createClient>,
  horseId: string,
  ownerId: string
) {
  const { data } = await supabase
    .from("horses")
    .select("id, owner_id")
    .eq("id", horseId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  return (data as HorseOwnerRecord | null) ?? null;
}
