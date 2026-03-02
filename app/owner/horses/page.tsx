import { deleteHorseAction, saveHorseAction } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { requireProfile } from "@/lib/auth";
import { readSearchParam } from "@/lib/search-params";
import type { Horse } from "@/types/database";

type OwnerHorsesPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

const deletePrompt =
  "Moechtest du dieses Pferdeprofil wirklich loeschen? Alle Probetermine, Freischaltungen, Verfuegbarkeiten und Chats werden mitgeloescht.";

export default async function OwnerHorsesPage({ searchParams }: OwnerHorsesPageProps) {
  const { supabase, user } = await requireProfile("owner");
  const error = readSearchParam(searchParams, "error");
  const message = readSearchParam(searchParams, "message");
  const { data } = await supabase
    .from("horses")
    .select("id, owner_id, title, plz, description, active, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  const horses = (data as Horse[] | null) ?? [];

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-clay">Inserat</p>
        <h1 className="text-3xl font-semibold text-forest sm:text-4xl">Reitbeteiligung anlegen</h1>
        <p className="text-sm text-stone-600 sm:text-base">Bearbeite deine Reitbeteiligung in einer mobilen Einspaltenansicht ohne horizontales Scrollen.</p>
      </div>
      <Notice text={error} tone="error" />
      <Notice text={message} tone="success" />
      <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft sm:p-6">
        <h2 className="text-xl font-semibold text-ink">Neue Reitbeteiligung</h2>
        <form action={saveHorseAction} className="mt-4 space-y-4">
          <div>
            <label htmlFor="title">Titel</label>
            <input id="title" name="title" placeholder="Ruhige Reitbeteiligung in Potsdam" required type="text" />
          </div>
          <div>
            <label htmlFor="plz">PLZ</label>
            <input id="plz" name="plz" placeholder="14467" required type="text" />
          </div>
          <div>
            <label htmlFor="description">Beschreibung</label>
            <textarea id="description" name="description" placeholder="Beschreibe Erfahrung, Tage und den gewuenschten Ablauf fuer den Probetermin." rows={5} />
          </div>
          <label className="flex min-h-[44px] items-center gap-3 rounded-2xl border border-stone-300 px-4 py-3 text-sm text-ink">
            <input className="h-4 w-4 rounded border-stone-300" defaultChecked name="active" type="checkbox" />
            Reitbeteiligung freischalten
          </label>
          <SubmitButton idleLabel="Reitbeteiligung speichern" pendingLabel="Wird gespeichert..." />
        </form>
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ink">Bestehende Reitbeteiligungen</h2>
        {horses.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-5 text-sm text-stone-600">
            Noch keine Reitbeteiligung vorhanden.
          </div>
        ) : (
          horses.map((horse) => (
            <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft sm:p-6" key={horse.id}>
              <form action={saveHorseAction} className="space-y-4">
                <input name="horseId" type="hidden" value={horse.id} />
                <div>
                  <label htmlFor={`title-${horse.id}`}>Titel</label>
                  <input defaultValue={horse.title} id={`title-${horse.id}`} name="title" required type="text" />
                </div>
                <div>
                  <label htmlFor={`plz-${horse.id}`}>PLZ</label>
                  <input defaultValue={horse.plz} id={`plz-${horse.id}`} name="plz" required type="text" />
                </div>
                <div>
                  <label htmlFor={`description-${horse.id}`}>Beschreibung</label>
                  <textarea defaultValue={horse.description ?? ""} id={`description-${horse.id}`} name="description" rows={5} />
                </div>
                <label className="flex min-h-[44px] items-center gap-3 rounded-2xl border border-stone-300 px-4 py-3 text-sm text-ink">
                  <input className="h-4 w-4 rounded border-stone-300" defaultChecked={horse.active} name="active" type="checkbox" />
                  Reitbeteiligung freischalten
                </label>
                <SubmitButton idleLabel="Reitbeteiligung aktualisieren" pendingLabel="Wird aktualisiert..." />
              </form>
              <div className="mt-4 border-t border-stone-200 pt-4">
                <p className="text-sm text-stone-600">Dieses Pferdeprofil wird inklusive aller zugehoerigen Anfragen, Freischaltungen, Verfuegbarkeiten und Chats geloescht.</p>
                <form action={deleteHorseAction} className="mt-3">
                  <input name="horseId" type="hidden" value={horse.id} />
                  <ConfirmSubmitButton
                    className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-rose-300 bg-white px-5 py-3 text-base font-semibold text-rose-700 hover:border-rose-400 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70"
                    confirmMessage={deletePrompt}
                    idleLabel="Pferdeprofil loeschen"
                    pendingLabel="Wird geloescht..."
                  />
                </form>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
