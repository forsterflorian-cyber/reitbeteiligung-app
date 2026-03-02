import type { Profile } from "@/types/database";

import { BottomNav } from "@/components/nav/BottomNav";
import { TopNav } from "@/components/nav/TopNav";

type NavShellProps = {
  email?: string | null;
  profile?: Profile | null;
};

// NavShell keeps the responsive switch in one place so layouts only mount one component.
export function NavShell({ email, profile }: NavShellProps) {
  return (
    <>
      <TopNav email={email} profile={profile} />
      <BottomNav profile={profile} />
    </>
  );
}
