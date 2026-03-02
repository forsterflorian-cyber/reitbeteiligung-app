import type { Metadata } from "next";

import "@/app/globals.css";
import { NavShell } from "@/components/nav/NavShell";
import { getViewerContext } from "@/lib/auth";

export const metadata: Metadata = {
  title: "reitbeteiligung.app",
  description: "Reitbeteiligungen mit klaren Rollen, mobilen Abläufen und einfacher Übersicht."
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { profile, user } = await getViewerContext();

  return (
    <html lang="de">
      <body>
        <NavShell email={user?.email} profile={profile} />
        <main>
          {/* Bottom navigation is fixed on mobile, so content keeps extra bottom padding there. */}
          <div className="mx-auto w-full max-w-md px-4 py-5 pb-28 sm:max-w-2xl sm:px-5 sm:py-6 sm:pb-28 md:max-w-4xl md:pb-8 lg:max-w-6xl lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
