import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const migrationsDir = new URL("../supabase/migrations/", import.meta.url);

function getSortedMigrationFiles() {
  return readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right));
}

function getLatestFunctionDefinition(functionName) {
  let latestDefinition = null;

  for (const filename of getSortedMigrationFiles()) {
    const sql = readFileSync(new URL(filename, migrationsDir), "utf8");
    const pattern = new RegExp(`create or replace function public\\.${functionName}\\([^)]*\\)[\\s\\S]*?\\$\\$;`, "gi");
    let match = pattern.exec(sql);

    while (match) {
      latestDefinition = {
        filename,
        sql: match[0]
      };
      match = pattern.exec(sql);
    }
  }

  return latestDefinition;
}

test("Occupancy-RPC bleibt ein read-only Snapshot fuer aktive operative Belegung", () => {
  const occupancy = getLatestFunctionDefinition("get_horse_calendar_occupancy");

  assert.ok(occupancy, "Die aktuelle Definition von get_horse_calendar_occupancy fehlt.");
  assert.equal(
    occupancy.filename,
    "20260312191500_read_only_horse_calendar_occupancy.sql"
  );
  assert.ok(
    !occupancy.sql.includes("cleanup_inactive_operational_bookings"),
    "Der Read-RPC darf kein Cleanup ausloesen."
  );
  assert.match(
    occupancy.sql,
    /requests\.status = 'accepted'/,
    "Operative Belegung darf nur accepted-Requests mit Booking abbilden."
  );
  assert.match(
    occupancy.sql,
    /from public\.calendar_blocks as blocks/,
    "Kalender-Sperren muessen weiter Teil der Occupancy-Projektion bleiben."
  );
});

test("Cleanup bleibt an explizite Write-Pfade gebunden", () => {
  for (const functionName of [
    "accept_booking_request",
    "direct_book_operational_slot",
    "reschedule_operational_booking"
  ]) {
    const definition = getLatestFunctionDefinition(functionName);

    assert.ok(definition, `Die aktuelle Definition von ${functionName} fehlt.`);
    assert.match(
      definition.sql,
      /perform public\.cleanup_inactive_operational_bookings\(/,
      `${functionName} soll Cleanup nur explizit im Write-Pfad ausfuehren.`
    );
  }
});

test("Cleanup-Funktion loescht ausschliesslich bookings mit nicht-accepted Request-Status", () => {
  const cleanup = getLatestFunctionDefinition("cleanup_inactive_operational_bookings");

  assert.ok(cleanup, "Die aktuelle Definition von cleanup_inactive_operational_bookings fehlt.");
  assert.equal(
    cleanup.filename,
    "20260312113000_active_operational_booking_occupancy.sql"
  );
  assert.match(
    cleanup.sql,
    /delete from public\.bookings as bookings/,
    "Cleanup darf nur booking-Zeilen entfernen."
  );
  assert.match(
    cleanup.sql,
    /using public\.booking_requests as requests/,
    "Cleanup muss den zugehoerigen booking_request-Status pruefen."
  );
  assert.match(
    cleanup.sql,
    /requests\.id = bookings\.booking_request_id/,
    "Cleanup muss booking und booking_request ueber die Request-ID verbinden."
  );
  assert.match(
    cleanup.sql,
    /requests\.status <> 'accepted'/,
    "Cleanup darf nur nicht-operative Request-Status entfernen."
  );
  assert.match(
    cleanup.sql,
    /\(p_horse_id is null or bookings\.horse_id = p_horse_id\)/,
    "Cleanup darf optional auf ein einzelnes Pferd begrenzt werden."
  );
  assert.ok(
    !/update public\./.test(cleanup.sql) &&
      !/insert into public\./.test(cleanup.sql) &&
      !/delete from public\.booking_requests/.test(cleanup.sql),
    "Cleanup darf keine weiteren Tabellen mutieren."
  );
  assert.ok(
    !/approvals|trial_requests|calendar_blocks|availability_rules|now\(/.test(cleanup.sql),
    "Cleanup darf keine weiteren Status-, Zeit- oder Beziehungsmodelle auswerten."
  );
});
