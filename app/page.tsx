import { redirect } from "next/navigation";

import { LandingFooter } from "@/components/landing/LandingFooter";
import { Hero } from "@/components/landing/Hero";
import { ProcessSteps } from "@/components/landing/ProcessSteps";
import { RoleCards } from "@/components/landing/RoleCards";
import { TrustCards } from "@/components/landing/TrustCards";
import { getPostAuthDestination } from "@/lib/auth";

export default async function HomePage() {
  const postAuthDestination = await getPostAuthDestination();

  if (postAuthDestination) {
    redirect(postAuthDestination);
  }

  return (
    <div className="space-y-10 pb-6 sm:space-y-14 sm:pb-8">
      <Hero />
      <ProcessSteps />
      <RoleCards />
      <TrustCards />
      <LandingFooter />
    </div>
  );
}

