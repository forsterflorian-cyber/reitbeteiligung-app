import type { Profile, UserRole } from "@/types/database";

export function getRoleLabel(role: UserRole) {
  return role === "owner" ? "Pferdehalter" : "Reiter";
}

export function getProfileDisplayName(profile: Pick<Profile, "display_name" | "role"> | null | undefined, email?: string | null) {
  const displayName = profile?.display_name?.trim();

  if (displayName) {
    return displayName;
  }

  const emailPrefix = email?.split("@")[0]?.trim();

  if (emailPrefix) {
    return emailPrefix;
  }

  return profile ? getRoleLabel(profile.role) : "Gast";
}