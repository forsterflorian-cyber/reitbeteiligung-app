type HorseValidationInput = {
  allowedSexes: readonly string[];
  birthYear: number | null;
  currentYear: number;
  heightCm: number | null;
  plz: string;
  sexValue: string | null;
  title: string;
};

export function getHorseValidationError(input: HorseValidationInput) {
  if (input.title.length < 2) {
    return "Bitte gib einen Titel mit mindestens 2 Zeichen an.";
  }

  if (!/^\d{5}$/.test(input.plz)) {
    return "Die PLZ muss genau 5 Ziffern haben.";
  }

  if (input.heightCm !== null && (input.heightCm < 50 || input.heightCm > 220)) {
    return "Das Stockma? muss zwischen 50 und 220 cm liegen.";
  }

  if (input.birthYear !== null && (input.birthYear < 1980 || input.birthYear > input.currentYear)) {
    return       `Das Geburtsjahr muss zwischen 1980 und ${input.currentYear} liegen.`;
  }

  if (input.sexValue && !input.allowedSexes.includes(input.sexValue)) {
    return `Bitte w?hle ${input.allowedSexes.join(', ')} f?r das Geschlecht.`;
  }

  return null;
}

export function getHorseCreateLimitError(planLabel: string, horseLimit: number) {
  const horseLabel = horseLimit === 1 ? "1 Pferd" : `${horseLimit} Pferde`;

  return `Im Tarif ${planLabel} sind ${horseLabel} enthalten. F?r weitere Pferde brauchst du sp?ter den bezahlten Tarif.`;
}

export function getHorseDeleteError(
  reason: "active_relationships" | "constraints" | "failed" | "forbidden" | "missing"
) {
  switch (reason) {
    case "missing":
      return "Das Pferdeprofil konnte nicht gefunden werden.";
    case "forbidden":
      return "Du kannst nur eigene Pferdeprofile l?schen.";
    case "active_relationships":
      return "Pferdeprofile mit aktiven Reitbeteiligungen k?nnen nicht gel?scht werden.";
    case "constraints":
      return "Das Pferd hat noch aktive Termine oder Anfragen und kann derzeit nicht gel?scht werden.";
    default:
      return "Pferdeprofil konnte nicht gel?scht werden.";
  }
}
