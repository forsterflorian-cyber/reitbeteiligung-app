export function getApprovalTransitionError(requestStatus: "requested" | "accepted" | "declined" | "completed") {
  if (requestStatus !== "completed") {
    return "Nur durchgef\u00fchrte Probetermine k\u00f6nnen freigeschaltet werden.";
  }

  return null;
}

export function getApprovalSavedMessage(nextStatus: "approved" | "revoked") {
  return nextStatus === "approved" ? "Die Reitbeteiligung wurde freigeschaltet." : "Die Freischaltung wurde entzogen.";
}

export function getDeleteRelationshipError(hasApproval: boolean) {
  if (hasApproval) {
    return null;
  }

  return "F\u00fcr diese Reitbeteiligung gibt es nichts mehr zu l\u00f6schen.";
}
