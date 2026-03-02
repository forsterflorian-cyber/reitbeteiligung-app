import { Card } from "@/components/ui/card";

type HeroVisualTone = "pending" | "approved" | "internal";

type WorkflowCardProps = {
  title: string;
  statusLabel: string;
  tone: HeroVisualTone;
  meta: string;
  subtext?: string;
  ctaLabel?: string;
};

const badgeClassNames: Record<HeroVisualTone, string> = {
  pending: "border border-amber-200 bg-amber-100 text-amber-800",
  approved: "border border-emerald-200 bg-emerald-100 text-emerald-800",
  internal: "border border-stone-200 bg-stone-100 text-stone-700"
};

function StatusPill({ label, tone }: { label: string; tone: HeroVisualTone }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeClassNames[tone]}`}>
      {label}
    </span>
  );
}

function HorseSilhouette() {
  return (
    <svg aria-hidden="true" className="h-40 w-40 text-stone-700" viewBox="0 0 120 120" fill="none">
      <path
        d="M77 20c7 4 12 10 14 18l8 6c3 2 5 5 5 9v11c0 4-2 7-6 8l-10 3-6 14c-2 5-7 8-12 8H55c-5 0-10-3-12-8l-3-8-11-2c-5-1-9-6-9-11V57c0-4 2-7 5-9l16-9 10-17c3-5 9-8 15-8h11z"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M48 39c7 3 14 5 22 5" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M77 56c5 3 10 5 17 5" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <circle cx="67" cy="35" r="3" fill="currentColor" />
    </svg>
  );
}

function WorkflowCard({ title, statusLabel, tone, meta, subtext, ctaLabel }: WorkflowCardProps) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white/95 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-stone-900">{title}</p>
          <p className="text-sm text-stone-700">{meta}</p>
        </div>
        <StatusPill label={statusLabel} tone={tone} />
      </div>
      {subtext ? <p className="mt-2 text-xs leading-5 text-stone-600">{subtext}</p> : null}
      {ctaLabel ? (
        <div className="mt-3 inline-flex min-h-[32px] items-center rounded-xl border border-stone-200 bg-stone-50 px-3 text-xs font-semibold text-stone-700">
          {ctaLabel}
        </div>
      ) : null}
    </div>
  );
}

// The landing visual intentionally mirrors the real product workflow instead of
// using abstract placeholder cards. That keeps the value proposition obvious.
export function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[30rem] lg:mx-0">
      <div className="pointer-events-none absolute inset-x-6 top-8 h-52 rounded-full bg-[radial-gradient(circle,_rgba(16,185,129,0.12),_transparent_68%)] blur-3xl" />
      <Card className="relative overflow-hidden rounded-[2rem] border-stone-200/90 bg-white p-4 shadow-md sm:p-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(5,150,105,0.08),_transparent_38%),radial-gradient(circle_at_bottom_left,_rgba(214,211,209,0.45),_transparent_45%)]" />
        <div className="pointer-events-none absolute -bottom-8 -right-4 opacity-10">
          <HorseSilhouette />
        </div>

        <div className="relative z-10 flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-stone-50/90 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">reitbeteiligung.app</p>
            <p className="text-sm font-semibold text-stone-900">Organisiert statt Nachrichten-Chaos</p>
          </div>
          <span aria-hidden="true" className="h-10 w-10 rounded-full border border-stone-200 bg-white shadow-sm" />
        </div>

        <div className="relative z-10 mt-4 space-y-3">
          <WorkflowCard
            title="Probetermin-Anfrage"
            statusLabel="Ausstehend"
            tone="pending"
            meta="Wunschtermin: Sa, 10:00"
            ctaLabel="Details"
          />
          <WorkflowCard
            title="Freischaltung"
            statusLabel="Freigeschaltet"
            tone="approved"
            meta="Kontaktdaten sichtbar"
            subtext="Chat bleibt intern bis zur Freigabe"
          />
          <WorkflowCard
            title="Terminbuchung"
            statusLabel="Bestätigt"
            tone="approved"
            meta="Mi, 18:00 - 19:00"
            subtext="Einzeltermin"
          />

          <div className="rounded-2xl border border-stone-200 bg-white/95 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-stone-900">Nachricht</p>
              <StatusPill label="Intern" tone="internal" />
            </div>
            <p className="mt-2 text-sm leading-6 text-stone-700">&quot;Passt dir Mittwoch oder Freitag?&quot;</p>
          </div>
        </div>
      </Card>
    </div>
  );
}