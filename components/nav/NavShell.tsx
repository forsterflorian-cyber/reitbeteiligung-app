import type { Profile } from "@/types/database";

import { BottomNav } from "@/components/nav/BottomNav";
import { TopNav } from "@/components/nav/TopNav";

type NavShellProps = {
  email?: string | null;
  profile?: Profile | null;
  unreadMessages?: number;
};

export function NavShell({ email, profile, unreadMessages = 0 }: NavShellProps) {
  return (
    <>
      <TopNav email={email} profile={profile} unreadMessages={unreadMessages} />
      <BottomNav profile={profile} unreadMessages={unreadMessages} />
    </>
  );
}
