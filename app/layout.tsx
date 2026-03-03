import type { Metadata } from "next";

import "@/app/globals.css";
import { NavShell } from "@/components/nav/NavShell";
import { Backdrop } from "@/components/ui/backdrop";
import { getViewerContext } from "@/lib/auth";
import { getUnreadMessageCount } from "@/lib/chat-notifications";

export const metadata: Metadata = {
  title: "reitbeteiligung.app",
  description: "Reitbeteiligungen mit klaren Rollen, mobilen Abl\u00e4ufen und einfacher \u00dcbersicht."
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { profile, supabase, user } = await getViewerContext();
  const isAuthed = Boolean(user);
  const unreadMessages = user ? await getUnreadMessageCount(supabase, profile, user.id) : 0;

  return (
    <html lang="de">
      <body className={isAuthed ? "bg-stone-50" : undefined}>
        {isAuthed ? <Backdrop className="fixed inset-0 z-0" variant="pattern" /> : null}
        {isAuthed ? (
          <div className="pointer-events-none fixed inset-0 z-0">
            <Backdrop className="!inset-x-0 !top-0 !bottom-0" variant="section" />
          </div>
        ) : null}
        <div className="relative z-10">
          <NavShell email={user?.email} profile={profile} unreadMessages={unreadMessages} />
          <main>
            <div className="mx-auto w-full max-w-md px-4 py-5 pb-28 sm:max-w-2xl sm:px-5 sm:py-6 sm:pb-28 md:max-w-4xl md:pb-8 lg:max-w-6xl lg:px-8 lg:py-8">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
