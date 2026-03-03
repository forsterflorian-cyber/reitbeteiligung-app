import type { SupabaseClient } from "@supabase/supabase-js";

import type { Approval, Horse, Profile } from "@/types/database";

export type OwnerPlanKey = "free" | "trial" | "paid";
export type OwnerPlanUsage = {
  approvedRiderCount: number;
  horseCount: number;
};

export const FREE_OWNER_HORSE_LIMIT = 1;
export const FREE_OWNER_APPROVAL_LIMIT = 1;
export const TRIAL_OWNER_HORSE_LIMIT = 1;
export const TRIAL_OWNER_APPROVAL_LIMIT = 2;
export const TRIAL_PLAN_DAYS = 14;

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

const PAID_PLAN: OwnerPlan = {
  bookingFeaturesEnabled: true,
  key: "paid",
  label: "Bezahlt",
  maxApprovedRiders: null,
  maxHorses: null,
  remainingApprovalSlots: null,
  remainingHorseSlots: null,
  summary: "Mehrere Pferde und mehrere Reitbeteiligungen sind für dich freigeschaltet."
};

function getRemainingTrialDays(createdAt: string) {
  const startedAt = Date.parse(createdAt);

  if (Number.isNaN(startedAt)) {
    return 0;
  }

  const elapsedMs = Date.now() - startedAt;
  const elapsedDays = Math.floor(elapsedMs / 86400000);
  return Math.max(0, TRIAL_PLAN_DAYS - elapsedDays);
}

function isTrialPlan(profile: Pick<Profile, "created_at" | "is_premium" | "role"> | null | undefined) {
  if (!profile || profile.role !== "owner" || profile.is_premium) {
    return false;
  }

  return getRemainingTrialDays(profile.created_at) > 0;
}

function buildLimitedPlan({
  key,
  label,
  maxApprovedRiders,
  maxHorses,
  summary
}: {
  key: OwnerPlanKey;
  label: string;
  maxApprovedRiders: number;
  maxHorses: number;
  summary: string;
}) {
  return (usage: OwnerPlanUsage): OwnerPlan => ({
    bookingFeaturesEnabled: true,
    key,
    label,
    maxApprovedRiders,
    maxHorses,
    remainingApprovalSlots: Math.max(0, maxApprovedRiders - usage.approvedRiderCount),
    remainingHorseSlots: Math.max(0, maxHorses - usage.horseCount),
    summary
  });
}

const getFreePlan = buildLimitedPlan({
  key: "free",
  label: "Kostenlos",
  maxApprovedRiders: FREE_OWNER_APPROVAL_LIMIT,
  maxHorses: FREE_OWNER_HORSE_LIMIT,
  summary: "1 Pferd und 1 Reitbeteiligung sind vollständig kostenlos enthalten."
});

function getTrialPlan(profile: Pick<Profile, "created_at">, usage: OwnerPlanUsage) {
  const remainingTrialDays = getRemainingTrialDays(profile.created_at);
  const basePlan = buildLimitedPlan({
    key: "trial",
    label: "Testphase",
    maxApprovedRiders: TRIAL_OWNER_APPROVAL_LIMIT,
    maxHorses: TRIAL_OWNER_HORSE_LIMIT,
    summary:
      remainingTrialDays > 0
        ? `1 Pferd und bis zu 2 Reitbeteiligungen sind in deiner Testphase noch ${remainingTrialDays} Tage freigeschaltet.`
        : "1 Pferd und bis zu 2 Reitbeteiligungen waren in deiner Testphase enthalten."
  });

  return basePlan(usage);
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
  profile: Pick<Profile, "role" | "is_premium" | "created_at"> | null | undefined,
  usage: OwnerPlanUsage = EMPTY_USAGE
): OwnerPlan {
  if (!profile || profile.role !== "owner") {
    return getFreePlan(usage);
  }

  if (profile.is_premium) {
    return PAID_PLAN;
  }

  if (isTrialPlan(profile)) {
    return getTrialPlan(profile, usage);
  }

  return getFreePlan(usage);
}

export function canCreateHorseProfile(
  profile: Pick<Profile, "role" | "is_premium" | "created_at"> | null | undefined,
  usage: OwnerPlanUsage = EMPTY_USAGE
) {
  if (!profile || profile.role !== "owner") {
    return false;
  }

  const plan = getOwnerPlan(profile, usage);
  return plan.maxHorses === null || usage.horseCount < plan.maxHorses;
}

export function canApproveRider(
  profile: Pick<Profile, "role" | "is_premium" | "created_at"> | null | undefined,
  usage: OwnerPlanUsage = EMPTY_USAGE,
  currentStatus: Approval["status"] | null = null
) {
  if (!profile || profile.role !== "owner") {
    return false;
  }

  if (currentStatus === "approved") {
    return true;
  }

  const plan = getOwnerPlan(profile, usage);
  return plan.maxApprovedRiders === null || usage.approvedRiderCount < plan.maxApprovedRiders;
}

export function canUseBookingFeatures(
  profile: Pick<Profile, "role" | "is_premium" | "created_at"> | null | undefined,
  usage: OwnerPlanUsage = EMPTY_USAGE
) {
  return getOwnerPlan(profile, usage).bookingFeaturesEnabled;
}