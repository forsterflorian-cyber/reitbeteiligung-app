import { redirect } from "next/navigation";

import { AuthPanel } from "@/components/blocks/auth-panel";
import { Notice } from "@/components/notice";
import { LogoutForm } from "@/components/logout-form";
import { getViewerContext } from "@/lib/auth";

export default async function LogoutPage() {
  const { user } = await getViewerContext();

  if (!user) {
    redirect("/login");
  }

  return (
    <AuthPanel
      eyebrow="Abmelden"
      subtitle={`Du bist aktuell als ${user.email} angemeldet.`}
      title="Sitzung beenden"
    >
      <Notice text="Tippe auf den Button, um deine aktuelle Sitzung sicher zu beenden." />
      <LogoutForm />
    </AuthPanel>
  );
}