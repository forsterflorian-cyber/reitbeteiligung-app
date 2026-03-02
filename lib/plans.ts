import type { Profile } from "@/types/database";

export type OwnerPlanKey = "basis" | "premium";

type OwnerPlan = {
  key: OwnerPlanKey;
  label: string;
  bookingFeaturesEnabled: boolean;
  summary: string;
};

const BASIS_PLAN: OwnerPlan = {
  bookingFeaturesEnabled: false,
  key: "basis",
  label: "Basis",
  summary: "Buchungs- und Kalenderfunktionen werden mit Premium freigeschaltet."
};

const PREMIUM_PLAN: OwnerPlan = {
  bookingFeaturesEnabled: true,
  key: "premium",
  label: "Premium",
  summary: "Buchungs- und Kalenderfunktionen sind für deine Pferde aktiv."
};

export function getOwnerPlan(profile: Pick<Profile, "role" | "is_premium"> | null | undefined): OwnerPlan {
  if (!profile || profile.role !== "owner") {
    return BASIS_PLAN;
  }

  return profile.is_premium ? PREMIUM_PLAN : BASIS_PLAN;
}

export function canUseBookingFeatures(profile: Pick<Profile, "role" | "is_premium"> | null | undefined) {
  return getOwnerPlan(profile).bookingFeaturesEnabled;
}