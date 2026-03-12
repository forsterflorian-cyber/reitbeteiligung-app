export function getTrialRequestDuplicateError(status: "requested" | "accepted" | "declined" | "completed" | "withdrawn") {
  if (status === "requested" || status === "accepted") {
    return "Du hast f\u00fcr dieses Pferd bereits eine offene Probeanfrage. Ziehe sie unter Meine Reitbeteiligungen zur\u00fcck, bevor du erneut anfragst.";
  }

  return "Du hast f\u00fcr dieses Pferd bereits einen laufenden oder abgeschlossenen Probetermin.";
}

export function getTrialSlotSelectionError(hasExplicitTrialSlots: boolean, hasSelectedRule: boolean) {
  if (hasSelectedRule || !hasExplicitTrialSlots) {
    return null;
  }

  return "Bitte w\u00e4hle einen verf\u00fcgbaren Probetermin aus.";
}

export function getTrialConversationFailureMessage(hasExplicitTrialSlots: boolean) {
  return hasExplicitTrialSlots
    ? "Deine Anfrage f\u00fcr den Probetermin wurde gesendet. Der Chat konnte nicht erstellt werden."
    : "Deine allgemeine Probeanfrage wurde gesendet. Der Chat konnte nicht erstellt werden.";
}

export function getTrialRequestSuccessMessage(hasExplicitTrialSlots: boolean) {
  return hasExplicitTrialSlots ? "Deine Anfrage f\u00fcr den Probetermin wurde gesendet." : "Deine allgemeine Probeanfrage wurde gesendet.";
}

export function getTrialStatusTransitionError(
  currentStatus: "requested" | "accepted" | "declined" | "completed" | "withdrawn",
  nextStatus: "accepted" | "declined" | "completed"
) {
  if (nextStatus === "completed" && currentStatus !== "accepted") {
    return "Nur angenommene Probetermine k\u00f6nnen als durchgef\u00fchrt markiert werden.";
  }

  if ((nextStatus === "accepted" || nextStatus === "declined") && currentStatus !== "requested") {
    return "Diese Anfrage kann nicht mehr ge\u00e4ndert werden.";
  }

  return null;
}
