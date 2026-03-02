import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type DiagnosticsError = {
  code?: number | string | null;
  details?: string | null;
  hint?: string | null;
  message?: string | null;
} | null | undefined;

type DiagnosticsCardProps = {
  count?: number | null;
  description: string;
  error: DiagnosticsError;
  rows: unknown[];
  title: string;
};

function DiagnosticsErrorBlock({ error }: { error: DiagnosticsError }) {
  if (!error) {
    return <p className="text-sm text-emerald-700">Kein Fehler.</p>;
  }

  return (
    <dl className="space-y-2 text-sm text-red-700">
      <div>
        <dt className="font-semibold text-red-800">Code</dt>
        <dd>{String(error.code ?? "-")}</dd>
      </div>
      <div>
        <dt className="font-semibold text-red-800">Meldung</dt>
        <dd>{error.message ?? "-"}</dd>
      </div>
      <div>
        <dt className="font-semibold text-red-800">Details</dt>
        <dd>{error.details ?? "-"}</dd>
      </div>
      <div>
        <dt className="font-semibold text-red-800">Hinweis</dt>
        <dd>{error.hint ?? "-"}</dd>
      </div>
    </dl>
  );
}

function DiagnosticsJson({ value }: { value: unknown }) {
  return <pre className="mt-3 overflow-x-auto rounded-2xl bg-sand p-4 text-xs leading-6 text-ink">{JSON.stringify(value, null, 2)}</pre>;
}

function DiagnosticsCard({ count, description, error, rows, title }: DiagnosticsCardProps) {
  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft sm:p-6">
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <p className="mt-1 text-sm text-stone-600">{description}</p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-stone-700">
          <span className="inline-flex rounded-full bg-sand px-3 py-1 font-semibold">Zeilen: {rows.length}</span>
          {typeof count === "number" ? <span className="inline-flex rounded-full bg-sand px-3 py-1 font-semibold">Count: {count}</span> : null}
        </div>
        <DiagnosticsErrorBlock error={error} />
        <DiagnosticsJson value={rows} />
      </div>
    </section>
  );
}

export default async function DiagnosePage() {
  const supabase = createClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profileData, error: profileError } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const profileRow = (profileData as Record<string, unknown> | null) ?? null;
  const roleValue = profileRow ? profileRow["role"] : null;
  const role = roleValue === "owner" || roleValue === "rider" ? roleValue : null;

  const { count: horsesCount, error: horsesCountError } = await supabase.from("horses").select("*", { count: "exact", head: true });
  const { data: activeHorsesData, error: activeHorsesError } = await supabase
    .from("horses")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(5);

  const activeHorses = (activeHorsesData as Record<string, unknown>[] | null) ?? [];

  let ownerHorses: Record<string, unknown>[] = [];
  let ownerHorsesError: DiagnosticsError = null;

  if (role === "owner") {
    const { data: ownerHorsesData, error } = await supabase
      .from("horses")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);

    ownerHorses = (ownerHorsesData as Record<string, unknown>[] | null) ?? [];
    ownerHorsesError = error;
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-clay">Diagnose</p>
        <h1 className="text-3xl font-semibold text-forest sm:text-4xl">Pferde-Sichtbarkeit pruefen</h1>
        <p className="text-sm text-stone-600 sm:text-base">Diese Seite zeigt direkt die Server-Abfragen mit deiner aktuellen Sitzung und den dazugehoerigen Fehlern.</p>
      </div>

      <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft sm:p-6">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">Authentifizierung</h2>
          <p className="text-sm text-stone-600">Auth User ID aus dem Supabase Server-Client.</p>
          <div className="inline-flex rounded-full bg-sand px-3 py-1 text-sm font-semibold text-ink">{user.id}</div>
          <DiagnosticsErrorBlock error={authError} />
        </div>
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft sm:p-6">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">Profil</h2>
          <p className="text-sm text-stone-600">select * from profiles where id = user.id</p>
          <div className="inline-flex rounded-full bg-sand px-3 py-1 text-sm font-semibold text-ink">Zeilen: {profileRow ? 1 : 0}</div>
          <DiagnosticsErrorBlock error={profileError} />
          <DiagnosticsJson value={profileRow} />
        </div>
      </section>

      <DiagnosticsCard
        count={horsesCount ?? null}
        description="select count(*) from horses"
        error={horsesCountError}
        rows={[]}
        title="Alle Pferde zaehlen"
      />

      <DiagnosticsCard
        description="select top 5 * from horses where active = true"
        error={activeHorsesError}
        rows={activeHorses}
        title="Aktive Pferdeprofile"
      />

      {role === "owner" ? (
        <DiagnosticsCard
          description="select top 5 * from horses where owner_id = user.id"
          error={ownerHorsesError}
          rows={ownerHorses}
          title="Eigene Pferdeprofile"
        />
      ) : (
        <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft sm:p-6">
          <p className="text-sm text-stone-600">Die Owner-Abfrage wird nur angezeigt, wenn dein Profil die Rolle &quot;owner&quot; hat.</p>
        </section>
      )}
    </div>
  );
}