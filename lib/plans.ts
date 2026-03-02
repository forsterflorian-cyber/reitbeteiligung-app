import type { SupabaseClient } from "@supabase/supabase-js";

import type { Approval, Horse, Profile } from "@/types/database";

export type OwnerPlanKey = "basis" | "premium";
export type OwnerPlanUsage = {
  approvedRiderCount: number;
  horseCount: number;
};

export const FREE_OWNER_HORSE_LIMIT = 1;
export const FREE_OWNER_APPROVAL_LIMIT = 1;

type OwnerPlan = {
  bookingFeaturesEnabled: boolean;
  key: OwnerPlanKey;
  label: string;
  maxApprovedRiders: number | null;
  maxHorses: number | null;
  remainingApprovalSlots: number | null;
  remainingHorseSlots: number | null;
  summary: string;
};

const EMPTY_USAGE: OwnerPlanUsage = {
  approvedRiderCount: 0,
  horseCount: 0
};

const PREMIUM_PLAN: OwnerPlan = {
  bookingFeaturesEnabled: true,
  key: "premium",
  label: "Premium",
  maxApprovedRiders: null,
  maxHorses: null,
  remainingApprovalSlots: null,
  remainingHorseSlots: null,
  summary: "Mehrere Pferde und mehrere Reitbeteiligungen sind für dich freigeschaltet."
};

function getBasisPlan(usage: OwnerPlanUsage): OwnerPlan {
  const remainingHorseSlots = Math.max(0, FREE_OWNER_HORSE_LIMIT - usage.horseCount);
  const remainingApprovalSlots = Math.max(0, FREE_OWNER_APPROVAL_LIMIT - usage.approvedRiderCount);
  const freeAllowanceUsedUp = remainingHorseSlots === 0 && remainingApprovalSlots === 0;

  return {
    bookingFeaturesEnabled: true,
    key: "basis",
    label: "Kostenlos",
    maxApprovedRiders: FREE_OWNER_APPROVAL_LIMIT,
    maxHorses: FREE_OWNER_HORSE_LIMIT,
    remainingApprovalSlots,
    remainingHorseSlots,
    summary: freeAllowanceUsedUp
      ? "1 Pferd und 1 Reitbeteiligung sind kostenlos enthalten. Das freie Kontingent ist aktuell ausgeschöpft."
      : "1 Pferd und 1 Reitbeteiligung sind vollständig kostenlos enthalten."
  };
}

export async function getOwnerPlanUsage(supabase: SupabaseClient, ownerId: string): Promise<OwnerPlanUsage> {
  const { data: horsesData } = await supabase.from("horses").select("id").eq("owner_id", ownerId);
  const horses = (horsesData as Array<Pick<Horse, "id">> | null) ?? [];
  const horseIds = horses.map((horse) => horse.id);

  if (horseIds.length === 0) {
    return EMPTY_USAGE;
  }

  const { data: approvalsData } = await supabase
    .from("approvals")
    .select("horse_id")
    .in("horse_id", horseIds)
    .eq("status", "approved");

  const approvals = (approvalsData as Array<Pick<Approval, "horse_id">> | null) ?? [];

  return {
    approvedRiderCount: approvals.length,
    horseCount: horses.length
  };
}

export function getOwnerPlan(
  profile: Pick<Profile, "role" | "is_premium"> | null | undefined,
  usage: OwnerPlanUsage = EMPTY_USAGE
): OwnerPlan {
  if (!profile || profile.role !== "owner") {
    return getBasisPlan(usage);
  }

  return profile.is_premium ? PREMIUM_PLAN : getBasisPlan(usage);
}

export function canCreateHorseProfile(
  profile: Pick<Profile, "role" | "is_premium"> | null | undefined,
  usage: OwnerPlanUsage = EMPTY_USAGE
) {
  if (!profile || profile.role !== "owner") {
    return false;
  }

  return profile.is_premium || usage.horseCount < FREE_OWNER_HORSE_LIMIT;
}

export function canApproveRider(
  profile: Pick<Profile, "role" | "is_premium"> | null | undefined,
  usage: OwnerPlanUsage = EMPTY_USAGE,
  currentStatus: Approval["status"] | null = null
) {
  if (!profile || profile.role !== "owner") {
    return false;
  }

  if (profile.is_premium || currentStatus === "approved") {
    return true;
  }

  return usage.approvedRiderCount < FREE_OWNER_APPROVAL_LIMIT;
}

export function canUseBookingFeatures(
  profile: Pick<Profile, "role" | "is_premium"> | null | undefined,
  usage: OwnerPlanUsage = EMPTY_USAGE
) {
  return getOwnerPlan(profile, usage).bookingFeaturesEnabled;
}