import { redirect } from "next/navigation";

import { LandingFooter } from "@/components/landing/LandingFooter";
import { Hero } from "@/components/landing/Hero";
import { ProcessSteps } from "@/components/landing/ProcessSteps";
import { RoleCards } from "@/components/landing/RoleCards";
import { TrustCards } from "@/components/landing/TrustCards";
import { Backdrop } from "@/components/ui/backdrop";
import { getPostAuthDestination } from "@/lib/auth";

export default async function HomePage() {
  const postAuthDestination = await getPostAuthDestination();

  if (postAuthDestination) {
    redirect(postAuthDestination);
  }

  return (
    <div className="relative isolate overflow-hidden">
      <Backdrop className="!inset-x-0 !top-0 !bottom-0" variant="section" />
      <div className="relative z-10 space-y-10 pb-6 sm:space-y-14 sm:pb-8">
        <Hero />
        <ProcessSteps />
        <RoleCards />
        <TrustCards />
        <LandingFooter />
      </div>
    </div>
  );
}

