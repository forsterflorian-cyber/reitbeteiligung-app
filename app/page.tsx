import Link from "next/link";

export default function HomePage() {
  return (
    <section className="space-y-5">
      <div className="space-y-4 rounded-3xl border border-stone-200 bg-white p-5 shadow-soft sm:p-6">
        <span className="inline-flex rounded-full bg-sand px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-forest">
          Reitbeteiligung mit Supabase
        </span>
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-forest sm:text-4xl">
            Reitbeteiligungen mobil und klar verwalten.
          </h1>
          <p className="text-base text-stone-600">
            Registriere dich, wähle deine Rolle als Pferdehalter oder Reiter und organisiere Reitbeteiligung, Probetermin und Anfragen in einer einfachen Übersicht.
          </p>
        </div>
        <div className="space-y-3">
          <Link className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-forest px-5 py-3 text-base font-semibold text-white hover:bg-forest/90" href="/signup">
            Konto erstellen
          </Link>
          <Link className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-stone-300 px-5 py-3 text-base font-semibold text-ink hover:border-forest hover:text-forest" href="/login">
            Anmelden
          </Link>
        </div>
      </div>
      <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft sm:p-6">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-clay">Kernfunktionen</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Was bereits enthalten ist</h2>
          </div>
          <ul className="space-y-3 text-sm text-stone-600">
            <li className="rounded-2xl bg-sand p-4">Supabase Auth mit E-Mail und Passwort sowie serverseitigem Schutz für alle wichtigen Seiten.</li>
            <li className="rounded-2xl bg-sand p-4">Onboarding für Pferdehalter und Reiter direkt in <span className="font-semibold text-ink">public.profiles</span>.</li>
            <li className="rounded-2xl bg-sand p-4">Mobile-first Oberflächen für Reitbeteiligung, Probetermin und Profilpflege.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
