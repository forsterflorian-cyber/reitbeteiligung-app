import { redirect } from "next/navigation";

import { LandingFooter } from "@/components/blocks/landing-footer";
import { LandingHero } from "@/components/blocks/landing-hero";
import { LandingProcess } from "@/components/blocks/landing-process";
import { LandingRoles } from "@/components/blocks/landing-roles";
import { LandingTrust } from "@/components/blocks/landing-trust";
import { getPostAuthDestination } from "@/lib/auth";

export default async function HomePage() {
  const postAuthDestination = await getPostAuthDestination();

  if (postAuthDestination) {
    redirect(postAuthDestination);
  }

  return (
    <div className="space-y-10 py-2 sm:space-y-14 sm:py-4">
      <LandingHero />
      <LandingProcess />
      <LandingRoles />
      <LandingTrust />
      <LandingFooter />
    </div>
  );
}
