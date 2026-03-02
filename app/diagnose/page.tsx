import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
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
    return <p className="text-sm text-stone-600">Kein Fehler.</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Card className="p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Code</p>
        <p className="mt-2 text-sm text-rose-700">{String(error.code ?? "-")}</p>
      </Card>
      <Card className="p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Meldung</p>
        <p className="mt-2 text-sm text-rose-700">{error.message ?? "-"}</p>
      </Card>
      <Card className="p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Details</p>
        <p className="mt-2 text-sm text-rose-700">{error.details ?? "-"}</p>
      </Card>
      <Card className="p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Hinweis</p>
        <p className="mt-2 text-sm text-rose-700">{error.hint ?? "-"}</p>
      </Card>
    </div>
  );
}

function DiagnosticsJson({ value }: { value: unknown }) {
  return <pre className="overflow-x-auto rounded-2xl bg-sand p-4 text-xs leading-6 text-ink">{JSON.stringify(value, null, 2)}</pre>;
}

function DiagnosticsCard({ count, description, error, rows, title }: DiagnosticsCardProps) {
  return (
    <SectionCard subtitle={description} title={title}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge tone="info">Zeilen: {rows.length}</Badge>
          {typeof count === "number" ? <Badge tone="neutral">Count: {count}</Badge> : null}
        </div>
        <DiagnosticsErrorBlock error={error} />
        <DiagnosticsJson value={rows} />
      </div>
    </SectionCard>
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
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        subtitle="Diese Seite zeigt direkt die Server-Abfragen mit deiner aktuellen Sitzung und den dazugehörigen Fehlern."
        title="Pferde-Sichtbarkeit prüfen"
      />

      <SectionCard subtitle="Auth User ID aus dem Supabase Server-Client." title="Authentifizierung">
        <div className="space-y-4">
          <Badge tone="info">{user.id}</Badge>
          <DiagnosticsErrorBlock error={authError} />
        </div>
      </SectionCard>

      <SectionCard subtitle="select * from profiles where id = user.id" title="Profil">
        <div className="space-y-4">
          <Badge tone="info">Zeilen: {profileRow ? 1 : 0}</Badge>
          <DiagnosticsErrorBlock error={profileError} />
          <DiagnosticsJson value={profileRow} />
        </div>
      </SectionCard>

      <DiagnosticsCard count={horsesCount ?? null} description="select count(*) from horses" error={horsesCountError} rows={[]} title="Alle Pferde zählen" />
      <DiagnosticsCard description="select top 5 * from horses where active = true" error={activeHorsesError} rows={activeHorses} title="Aktive Pferdeprofile" />

      {role === "owner" ? (
        <DiagnosticsCard
          description="select top 5 * from horses where owner_id = user.id"
          error={ownerHorsesError}
          rows={ownerHorses}
          title="Eigene Pferdeprofile"
        />
      ) : (
        <EmptyState
          description={"Die Owner-Abfrage wird nur angezeigt, wenn dein Profil die Rolle \"owner\" hat."}
          title="Keine Owner-Diagnose für dieses Profil"
        />
      )}
    </div>
  );
}