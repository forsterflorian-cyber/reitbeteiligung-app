import type { Metadata } from "next";

import "@/app/globals.css";
import { AppHeader } from "@/components/app-header";
import { MobileNav } from "@/components/mobile-nav";
import { getViewerContext } from "@/lib/auth";

export const metadata: Metadata = {
  title: "reitbeteiligung.app",
  description: "Reitbeteiligungen mit klaren Rollen, mobilen Ablaeufen und einfacher Übersicht."
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { profile, user } = await getViewerContext();

  return (
    <html lang="de">
      <body>
        <AppHeader email={user?.email} profile={profile} />
        <main>
          <div className="mx-auto w-full max-w-md px-4 py-5 pb-24 sm:max-w-lg sm:px-5 sm:py-6 sm:pb-24 md:max-w-2xl md:px-6 md:py-8 md:pb-8">
            {children}
          </div>
        </main>
        <MobileNav profile={profile} />
      </body>
    </html>
  );
}

