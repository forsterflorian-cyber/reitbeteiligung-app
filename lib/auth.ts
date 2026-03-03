import { redirect } from "next/navigation";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/types/database";

export async function getProfileByUserId(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("id, role, is_premium, display_name, phone, created_at, trial_started_at")
    .eq("id", userId)
    .maybeSingle();

  return (data as Profile | null) ?? null;
}

export async function getViewerContext() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { profile: null, supabase, user: null as User | null };
  }

  const profile = await getProfileByUserId(supabase, user.id);

  return { profile, supabase, user };
}

export async function requireUser() {
  const { supabase, user } = await getViewerContext();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}

export async function requireProfile(requiredRole?: UserRole) {
  const { supabase, user } = await requireUser();
  const profile = await getProfileByUserId(supabase, user.id);

  if (!profile) {
    redirect("/onboarding");
  }

  if (requiredRole && profile.role !== requiredRole) {
    redirect("/dashboard");
  }

  return { profile, supabase, user };
}

export async function requireOnboardingUser() {
  const { supabase, user } = await requireUser();
  const profile = await getProfileByUserId(supabase, user.id);

  if (profile) {
    redirect("/dashboard");
  }

  return { supabase, user };
}

export async function getPostAuthDestination() {
  const { profile, user } = await getViewerContext();

  if (!user) {
    return null;
  }

  return profile ? "/dashboard" : "/onboarding";
}
