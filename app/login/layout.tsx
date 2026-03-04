import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  icons: {
    icon: "/brand/logo-mark.svg",
    shortcut: "/brand/logo-mark.svg"
  }
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
