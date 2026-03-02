import { redirect } from "next/navigation";

import { Notice } from "@/components/notice";
import { LogoutForm } from "@/components/logout-form";
import { getViewerContext } from "@/lib/auth";

export default async function LogoutPage() {
  const { user } = await getViewerContext();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-5 rounded-3xl border border-stone-200 bg-white p-5 shadow-soft sm:p-6">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-clay">Abmelden</p>
        <h1 className="text-3xl font-semibold text-forest">Sitzung beenden</h1>
        <p className="text-sm text-stone-600">Du bist aktuell als {user.email} angemeldet.</p>
      </div>
      <Notice text="Tippe auf den Button, um deine aktuelle Sitzung sicher zu beenden." />
      <LogoutForm />
    </div>
  );
}
