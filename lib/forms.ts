export function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export function asOptionalString(value: FormDataEntryValue | null) {
  const parsed = asString(value);
  return parsed.length > 0 ? parsed : null;
}

export function asInteger(value: FormDataEntryValue | null) {
  const parsed = asString(value);

  if (!parsed) {
    return null;
  }

  const number = Number.parseInt(parsed, 10);
  return Number.isNaN(number) ? null : number;
}

export function isRole(value: string): value is "owner" | "rider" {
  return value === "owner" || value === "rider";
}
