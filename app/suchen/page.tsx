import type { Route } from "next";
import Link from "next/link";

import { Notice } from "@/components/notice";
import { getViewerContext } from "@/lib/auth";
import type { Horse } from "@/types/database";

export default async function SuchenPage() {
  const { user, supabase } = await getViewerContext();
  const { data } = await supabase
    .from("horses")
    .select("id, owner_id, title, plz, description, active, created_at")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(8);

  const horses = (data as Horse[] | null) ?? [];

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-clay">Suchen</p>
        <h1 className="text-3xl font-semibold text-forest sm:text-4xl">Reitbeteiligung finden</h1>
        <p className="text-sm text-stone-600 sm:text-base">Hier findest du freigeschaltete Pferdeprofile und kommst direkt zur Anfrage fuer deinen Probetermin.</p>
      </div>
      {!user ? <Notice text="Melde dich an, um einen Probetermin anzufragen und spaeter freigeschaltet zu werden." /> : null}
      <div className="space-y-3">
        {horses.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-5 text-sm text-stone-600">
            Aktuell sind keine freigeschalteten Reitbeteiligungen sichtbar.
          </div>
        ) : (
          horses.map((horse) => (
            <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft" key={horse.id}>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-clay">Pferdeprofil</p>
                  <h2 className="mt-1 text-xl font-semibold text-ink">{horse.title}</h2>
                  <p className="mt-1 text-sm text-stone-600">PLZ {horse.plz}</p>
                </div>
                <p className="text-sm text-stone-600">{horse.description ?? "Noch keine Beschreibung vorhanden."}</p>
                <Link
                  className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-forest px-4 py-3 text-sm font-semibold text-white hover:bg-forest/90"
                  href={`/pferde/${horse.id}` as Route}
                >
                  Pferdeprofil ansehen
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
