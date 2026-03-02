import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

function HorseSilhouette() {
  return (
    <svg aria-hidden="true" className="h-28 w-28 text-stone-300/80 sm:h-32 sm:w-32" viewBox="0 0 120 120" fill="none">
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

// The hero visual uses a device-style card instead of a generic image.
// That keeps the landing brand-led and immediately tied to product workflow.
export function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[28rem] lg:mx-0">
      <div className="pointer-events-none absolute inset-x-6 top-10 h-48 rounded-full bg-[radial-gradient(circle,_rgba(16,185,129,0.14),_transparent_68%)] blur-2xl" />
      <div className="pointer-events-none absolute -right-6 bottom-10 h-28 w-28 rounded-full bg-[radial-gradient(circle,_rgba(120,113,108,0.15),_transparent_70%)] blur-2xl" />
      <Card className="relative overflow-hidden rounded-[2rem] border-stone-200/90 bg-white/95 p-4 shadow-sm sm:p-5">
        <div className="pointer-events-none absolute right-2 top-3 opacity-80">
          <HorseSilhouette />
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Heute</p>
              <p className="text-sm font-semibold text-stone-900">Probetermin mit Lisa</p>
            </div>
            <Badge tone="pending">Ausstehend</Badge>
          </div>

          <div className="mx-auto w-full max-w-[16rem] rounded-[1.8rem] border border-stone-200 bg-white p-3 shadow-sm">
            <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-stone-200" />
            <div className="space-y-3 rounded-[1.4rem] border border-stone-200 bg-stone-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">reitbeteiligung.app</p>
                  <p className="text-sm font-semibold text-stone-900">Apollo</p>
                </div>
                <Badge tone="approved">Aktiv</Badge>
              </div>
              <div className="space-y-2 rounded-2xl border border-stone-200 bg-white p-3">
                <p className="text-sm font-semibold text-stone-900">Freischaltung abgeschlossen</p>
                <p className="text-xs leading-5 text-stone-600">Kontaktdaten sind jetzt sichtbar und weitere Termine koennen geplant werden.</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-2xl border border-stone-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-stone-900">01 Probetermin</p>
                <p className="text-xs text-stone-500">Anfrage mit kurzer Nachricht</p>
              </div>
              <Badge tone="pending">Ausstehend</Badge>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-stone-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-stone-900">02 Freischaltung</p>
                <p className="text-xs text-stone-500">Kontaktdaten erst danach</p>
              </div>
              <Badge tone="approved">Freigeschaltet</Badge>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-stone-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-stone-900">03 Termin</p>
                <p className="text-xs text-stone-500">Kalender und Status im Blick</p>
              </div>
              <Badge tone="info">Bestaetigt</Badge>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

