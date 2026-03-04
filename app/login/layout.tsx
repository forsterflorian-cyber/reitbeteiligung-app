import type { Metadata } from "next";
import type { ReactNode } from "react";

import { LoginNav } from "@/components/landing/LoginNav";

export const metadata: Metadata = {
  icons: {
    icon: "/brand/logo-mark.svg",
    shortcut: "/brand/logo-mark.svg"
  }
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`body > div.relative.z-10 > header:first-of-type { display: none; }`}</style>
      <div className="-mt-5 space-y-6 sm:-mt-6 sm:space-y-8 md:-mt-8 lg:-mt-8">
        <LoginNav />
        {children}
      </div>
    </>
  );
}
