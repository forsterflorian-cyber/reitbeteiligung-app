import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import pg from "pg";

const { Client } = pg;

const EXIT_CODES = {
  liveSmokeFailed: 40,
  missingPrerequisite: 10,
  ok: 0,
  preflightFailed: 20,
  pushFailed: 30
};

const PREVIEW_ROW_LIMIT = 10;
const rootDir = process.cwd();
const cliArgs = new Set(process.argv.slice(2));
const dryRunOnly = cliArgs.has("--dry-run-only");
const liveSmokeOnly = cliArgs.has("--live-smoke-only");
const preflightOnly = cliArgs.has("--preflight-only");
const pushMigrations = cliArgs.has("--push");
const requireLiveSmoke = cliArgs.has("--require-live-smoke");

loadEnvFile(path.join(rootDir, ".env.local"));
loadEnvFile(path.join(rootDir, ".env"));

const supabaseCli = findSupabaseCli(rootDir);

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n[fail] ${message}`);
  process.exitCode = process.exitCode || 1;
});

async function main() {
  if (!supabaseCli) {
    process.exitCode = EXIT_CODES.missingPrerequisite;
    throw new Error("Supabase CLI wurde im Repo nicht gefunden.");
  }

  printSection("Remote-Migrationsstand");
  const migrationList = runCli(["migration", "list"]);
  process.stdout.write(migrationList.stdout);

  printSection("Dry-Run fuer db push");
  const dryRun = runCli(["db", "push", "--dry-run"]);
  process.stdout.write(dryRun.stdout);

  if (dryRunOnly) {
    console.log("\n[pass] Nur Dry-Run ausgefuehrt.");
    process.exitCode = EXIT_CODES.ok;
    return;
  }

  const dbConfig = getLinkedDbConfig();
  const preflightResult = await runPreflight(dbConfig);

  if (preflightResult.blockers.length > 0) {
    process.exitCode = EXIT_CODES.preflightFailed;
    throw new Error("Preflight hat blocker gefunden. Migration wird nicht ausgefuehrt.");
  }

  if (preflightOnly) {
    console.log("\n[pass] Preflight abgeschlossen. Keine blocker gefunden.");
    process.exitCode = EXIT_CODES.ok;
    return;
  }

  if (liveSmokeOnly) {
    const liveSmokeDbConfig = getLinkedDbConfig();

    try {
      await runLiveSmoke(liveSmokeDbConfig);
      console.log("\n[pass] Live-Smoke erfolgreich abgeschlossen.");
      process.exitCode = EXIT_CODES.ok;
      return;
    } catch (error) {
      process.exitCode = EXIT_CODES.liveSmokeFailed;
      throw error;
    }
  }

  if (!pushMigrations) {
    console.log("\n[pass] Dry-Run und Preflight abgeschlossen. Kein Push angefordert.");
    process.exitCode = EXIT_CODES.ok;
    return;
  }

  printSection("Migration push");
  try {
    const pushResult = runCli(["db", "push"]);
    process.stdout.write(pushResult.stdout);
  } catch (error) {
    process.exitCode = EXIT_CODES.pushFailed;
    throw error;
  }

  printSection("Remote-Migrationsstand nach Push");
  const migrationListAfterPush = runCli(["migration", "list"]);
  process.stdout.write(migrationListAfterPush.stdout);

  try {
    const liveSmokeDbConfig = getLinkedDbConfig();
    await runLiveSmoke(liveSmokeDbConfig);
    console.log("\n[pass] Staging-Verifikation erfolgreich abgeschlossen.");
    process.exitCode = EXIT_CODES.ok;
  } catch (error) {
    process.exitCode = EXIT_CODES.liveSmokeFailed;

    if (requireLiveSmoke) {
      throw error;
    }

    console.error(`\n[warn] Live-Smoke fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const fileContent = fs.readFileSync(filePath, "utf8");

  for (const rawLine of fileContent.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function printSection(title) {
  console.log(`\n== ${title} ==`);
}

function findSupabaseCli(baseDir) {
  const candidates = process.platform === "win32"
    ? [
        path.join(baseDir, "node_modules", "supabase", "bin", "supabase.exe"),
        path.join(baseDir, "node_modules", ".bin", "supabase.cmd")
      ]
    : [
        path.join(baseDir, "node_modules", "supabase", "bin", "supabase"),
        path.join(baseDir, "node_modules", ".bin", "supabase")
      ];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function runCli(args, options = {}) {
  const result = spawnSync(supabaseCli, args, {
    cwd: rootDir,
    encoding: "utf8"
  });

  if (result.status !== 0 && !options.allowFailure) {
    const errorOutput = sanitizeSecrets([result.stdout, result.stderr].filter(Boolean).join("\n"));
    throw new Error(errorOutput || `Supabase CLI fehlgeschlagen: ${args.join(" ")}`);
  }

  return {
    ...result,
    rawStderr: result.stderr ?? "",
    rawStdout: result.stdout ?? "",
    stderr: sanitizeSecrets(result.stderr ?? ""),
    stdout: sanitizeSecrets(result.stdout ?? "")
  };
}

function sanitizeSecrets(text) {
  return text
    .replace(/(PGPASSWORD=")([^"]+)(")/gu, "$1***$3")
    .replace(/(export PGPASSWORD=")([^"]+)(")/gu, "$1***$3");
}

function getLinkedDbConfig() {
  const dumpDryRun = runCli(["db", "dump", "--data-only", "--dry-run", "--linked", "--schema", "public"]);
  const env = Object.fromEntries(
    [...dumpDryRun.rawStdout.matchAll(/export (PGHOST|PGPORT|PGUSER|PGPASSWORD|PGDATABASE)="([^"]+)"/gu)].map((match) => [match[1], match[2]])
  );

  if (!env.PGHOST || !env.PGPORT || !env.PGUSER || !env.PGPASSWORD || !env.PGDATABASE) {
    process.exitCode = EXIT_CODES.missingPrerequisite;
    throw new Error("Die Linked-DB-Verbindungsdaten konnten aus dem Supabase-Dry-Run nicht gelesen werden.");
  }

  return {
    database: env.PGDATABASE,
    host: env.PGHOST,
    password: env.PGPASSWORD,
    port: Number.parseInt(env.PGPORT, 10),
    user: env.PGUSER
  };
}

function createDbClient(dbConfig) {
  return new Client({
    database: dbConfig.database,
    host: dbConfig.host,
    password: dbConfig.password,
    port: dbConfig.port,
    ssl: {
      rejectUnauthorized: false
    },
    user: dbConfig.user
  });
}

async function runPreflight(dbConfig) {
  printSection("Preflight gegen Staging-Daten");
  const client = createDbClient(dbConfig);
  await client.connect();

  try {
    await client.query("set role postgres");
    const checks = await Promise.all([
      runCheck(client, {
        blocker: true,
        description: "Ueberlappende bestehende bookings blockieren den Exclusion-Constraint.",
        label: "overlapping_bookings",
        sql: `
          select
            left_booking.id as left_booking_id,
            right_booking.id as right_booking_id,
            left_booking.horse_id,
            left_booking.start_at as left_start_at,
            left_booking.end_at as left_end_at,
            right_booking.start_at as right_start_at,
            right_booking.end_at as right_end_at
          from public.bookings as left_booking
          join public.bookings as right_booking
            on left_booking.horse_id = right_booking.horse_id
           and left_booking.id < right_booking.id
           and tstzrange(left_booking.start_at, left_booking.end_at, '[)')
               && tstzrange(right_booking.start_at, right_booking.end_at, '[)')
          order by left_booking.horse_id, left_booking.start_at
        `
      }),
      runCheck(client, {
        blocker: true,
        description: "booking_requests_status_check muss den Historisierungsstatus rescheduled erlauben.",
        label: "booking_request_status_constraint_legacy",
        sql: `
          select
            constraints.conname,
            pg_get_constraintdef(constraints.oid, true) as definition
          from pg_constraint as constraints
          where constraints.conrelid = 'public.booking_requests'::regclass
            and constraints.conname = 'booking_requests_status_check'
            and pg_get_constraintdef(constraints.oid, true) not like '%rescheduled%'
        `
      }),
      runCheck(client, {
        blocker: true,
        description: "Der Legacy-Unique-Constraint auf slot_id+rider_id blockiert canceled/rescheduled Historie fachlich falsch.",
        label: "booking_request_slot_rider_legacy_unique",
        sql: `
          select
            constraints.conname,
            pg_get_constraintdef(constraints.oid, true) as definition
          from pg_constraint as constraints
          where constraints.conrelid = 'public.booking_requests'::regclass
            and constraints.conname = 'booking_requests_slot_id_rider_id_key'
        `
      }),
      runCheck(client, {
        blocker: true,
        description: "Mehrere aktive requested/accepted Requests pro Slot+Rider wuerden den neuen partiellen Unique-Index blockieren.",
        label: "duplicate_active_booking_requests_per_slot_rider",
        sql: `
          select
            booking_requests.horse_id,
            booking_requests.rider_id,
            booking_requests.slot_id,
            count(*) as active_request_count
          from public.booking_requests
          where booking_requests.status in ('requested', 'accepted')
          group by booking_requests.horse_id, booking_requests.rider_id, booking_requests.slot_id
          having count(*) > 1
          order by active_request_count desc, booking_requests.horse_id, booking_requests.rider_id, booking_requests.slot_id
        `
      }),
      runCheck(client, {
        blocker: true,
        description: "Approved approvals ohne completed trial brechen den Lifecycle als Source of Truth.",
        label: "approved_without_completed_trial",
        sql: `
          with latest_trial as (
            select distinct on (trial_requests.horse_id, trial_requests.rider_id)
              trial_requests.horse_id,
              trial_requests.rider_id,
              trial_requests.status,
              trial_requests.created_at
            from public.trial_requests
            order by trial_requests.horse_id, trial_requests.rider_id, trial_requests.created_at desc
          )
          select
            approvals.horse_id,
            approvals.rider_id,
            approvals.status as approval_status,
            latest_trial.status as latest_trial_status,
            latest_trial.created_at as latest_trial_created_at
          from public.approvals
          left join latest_trial
            on latest_trial.horse_id = approvals.horse_id
           and latest_trial.rider_id = approvals.rider_id
          where approvals.status = 'approved'
            and coalesce(latest_trial.status, 'missing') <> 'completed'
          order by approvals.horse_id, approvals.rider_id
        `
      }),
      runCheck(client, {
        blocker: true,
        description: "Conversation owner_id muss dem aktuellen horse.owner_id entsprechen, sonst kippt die neue Zugriffssicht.",
        label: "conversation_owner_mismatch",
        sql: `
          select
            conversations.id as conversation_id,
            conversations.horse_id,
            conversations.owner_id as conversation_owner_id,
            horses.owner_id as horse_owner_id,
            conversations.rider_id
          from public.conversations
          join public.horses
            on horses.id = conversations.horse_id
          where conversations.owner_id <> horses.owner_id
          order by conversations.created_at desc
        `
      }),
      runCheck(client, {
        blocker: false,
        description: "Mehrere offene/abgeschlossene Trial-Datensaetze pro horse+rider machen den Altbestand mehrdeutig.",
        label: "multiple_visible_trials_per_relationship",
        sql: `
          select
            trial_requests.horse_id,
            trial_requests.rider_id,
            count(*) as visible_trial_count
          from public.trial_requests
          where trial_requests.status in ('requested', 'accepted', 'completed')
          group by trial_requests.horse_id, trial_requests.rider_id
          having count(*) > 1
          order by visible_trial_count desc, trial_requests.horse_id, trial_requests.rider_id
        `
      }),
      runCheck(client, {
        blocker: false,
        description: "Diese Conversations werden nach den neuen RLS-Regeln unsichtbar und sollten bewusst akzeptiert sein.",
        label: "conversations_hidden_by_new_rls",
        sql: `
          with latest_trial as (
            select distinct on (trial_requests.horse_id, trial_requests.rider_id)
              trial_requests.horse_id,
              trial_requests.rider_id,
              trial_requests.status,
              trial_requests.created_at
            from public.trial_requests
            order by trial_requests.horse_id, trial_requests.rider_id, trial_requests.created_at desc
          )
          select
            conversations.id as conversation_id,
            conversations.horse_id,
            conversations.rider_id,
            conversations.owner_id,
            approvals.status as approval_status,
            latest_trial.status as latest_trial_status,
            latest_trial.created_at as latest_trial_created_at
          from public.conversations
          left join public.approvals
            on approvals.horse_id = conversations.horse_id
           and approvals.rider_id = conversations.rider_id
          left join latest_trial
            on latest_trial.horse_id = conversations.horse_id
           and latest_trial.rider_id = conversations.rider_id
          where not (
            approvals.status = 'approved'
            or (
              coalesce(approvals.status, '') <> 'revoked'
              and latest_trial.status in ('requested', 'accepted', 'completed')
            )
          )
          order by conversations.created_at desc
        `
      })
    ]);

    const blockers = checks.filter((check) => check.blocker && check.rowCount > 0);
    const warnings = checks.filter((check) => !check.blocker && check.rowCount > 0);

    for (const check of checks) {
      const status = check.rowCount === 0 ? "[pass]" : check.blocker ? "[fail]" : "[warn]";
      console.log(`${status} ${check.label}: ${check.rowCount}`);
      console.log(`       ${check.description}`);

      if (check.rowCount > 0) {
        printRows(check.rows);
      }
    }

    return { blockers, warnings };
  } finally {
    await client.end();
  }
}

async function runCheck(client, definition) {
  const result = await client.query(definition.sql);

  return {
    blocker: definition.blocker,
    description: definition.description,
    label: definition.label,
    rowCount: result.rowCount ?? 0,
    rows: result.rows.slice(0, PREVIEW_ROW_LIMIT)
  };
}

function printRows(rows) {
  for (const row of rows) {
    console.log(`       ${JSON.stringify(row)}`);
  }
}

async function runLiveSmoke(dbConfig) {
  printSection("Live-Smoke nach Migration");
  const db = createDbClient(dbConfig);
  await db.connect();

  const namespace = `cv1${Date.now().toString(36)}${randomUUID().slice(0, 4)}`.toLowerCase();
  const ownerEmail = `${namespace}-owner@example.com`;
  const riderEmail = `${namespace}-rider@example.com`;
  const secondRiderEmail = `${namespace}-rider2@example.com`;
  let ownerId = null;
  let riderId = null;
  let secondRiderId = null;
  let horseId = null;

  try {
    await db.query("set role postgres");
    ownerId = randomUUID();
    riderId = randomUUID();
    secondRiderId = randomUUID();
    horseId = randomUUID();

    await insertAuthUser(db, ownerId, ownerEmail);
    await insertAuthUser(db, riderId, riderEmail);
    await insertAuthUser(db, secondRiderId, secondRiderEmail);
    await db.query(
      "insert into public.profiles (id, role, is_premium) values ($1, 'owner', false), ($2, 'rider', false), ($3, 'rider', false)",
      [ownerId, riderId, secondRiderId]
    );
    await db.query(
      "insert into public.horses (id, owner_id, title, plz, description, active) values ($1, $2, $3, $4, $5, true)",
      [horseId, ownerId, `Smoke ${namespace}`, "10115", "Calendar V1 staging smoke"]
    );

    const trialRequestId = randomUUID();
    const conversationId = randomUUID();
    await db.query(
      `
        insert into public.trial_requests (id, horse_id, rider_id, status, message)
        values ($1, $2, $3, 'completed', 'Smoke trial');
      `,
      [trialRequestId, horseId, riderId]
    );
    await db.query(
      `
        insert into public.conversations (id, horse_id, rider_id, owner_id)
        values ($1, $2, $3, $4);
      `,
      [conversationId, horseId, riderId, ownerId]
    );
    await db.query(
      `
        insert into public.messages (conversation_id, sender_id, content)
        values ($1, $2, 'Smoke hello');
      `,
      [conversationId, ownerId]
    );
    await db.query(
      `
        insert into public.approvals (horse_id, rider_id, status)
        values ($1, $2, 'approved')
        on conflict (horse_id, rider_id) do update set status = excluded.status;
      `,
      [horseId, riderId]
    );
    await db.query(
      `
        insert into public.approvals (horse_id, rider_id, status)
        values ($1, $2, 'approved')
        on conflict (horse_id, rider_id) do update set status = excluded.status;
      `,
      [horseId, secondRiderId]
    );

    const directRule = await createOperationalRule(db, horseId, "2026-03-20T09:00:00.000Z", "2026-03-20T12:00:00.000Z");
    const directBookingRequestId = await queryAsUser(db, riderId, async (client) => {
      const result = await client.query(
        "select public.direct_book_operational_slot($1, $2, $3, $4) as request_id",
        [horseId, directRule.ruleId, "2026-03-20T10:00:00.000Z", "2026-03-20T11:00:00.000Z"]
      );
      return result.rows[0]?.request_id ?? null;
    });

    if (!directBookingRequestId) {
      throw new Error("Direktbuchung hat keine booking_request_id geliefert.");
    }

    const createdBooking = await db.query(
      "select id from public.bookings where booking_request_id = $1",
      [directBookingRequestId]
    );

    if ((createdBooking.rowCount ?? 0) !== 1) {
      throw new Error("Direktbuchung hat keinen Booking-Datensatz erzeugt.");
    }

    await expectQueryError(
      () =>
        queryAsUser(db, riderId, (client) =>
          client.query("select public.direct_book_operational_slot($1, $2, $3, $4)", [
            horseId,
            directRule.ruleId,
            "2026-03-20T10:00:00.000Z",
            "2026-03-20T11:00:00.000Z"
          ])
        ),
      "TIME_UNAVAILABLE",
      "Direktbuchungskonflikt"
    );

    const ownerRule = await createOperationalRule(db, horseId, "2026-03-20T13:00:00.000Z", "2026-03-20T16:00:00.000Z");
    const requestA = randomUUID();
    const requestB = randomUUID();
    await db.query(
      `
        insert into public.booking_requests (
          id,
          availability_rule_id,
          horse_id,
          rider_id,
          slot_id,
          status,
          requested_start_at,
          requested_end_at,
          recurrence_rrule
        )
        values
          ($1, $2, $3, $4, $5, 'requested', $6, $7, null),
          ($8, $2, $3, $11, $5, 'requested', $9, $10, null)
      `,
      [
        requestA,
        ownerRule.ruleId,
        horseId,
        riderId,
        ownerRule.slotId,
        "2026-03-20T13:00:00.000Z",
        "2026-03-20T14:00:00.000Z",
        requestB,
        "2026-03-20T13:30:00.000Z",
        "2026-03-20T14:30:00.000Z",
        secondRiderId
      ]
    );

    await queryAsUser(db, ownerId, (client) => client.query("select public.accept_booking_request($1)", [requestA]));
    await expectQueryError(
      () => queryAsUser(db, ownerId, (client) => client.query("select public.accept_booking_request($1)", [requestB])),
      "TIME_UNAVAILABLE",
      "Owner-Accept Konflikt"
    );

    const ownerAcceptBookings = await db.query(
      "select booking_request_id from public.bookings where booking_request_id = any($1::uuid[]) order by booking_request_id",
      [[requestA, requestB]]
    );

    if ((ownerAcceptBookings.rowCount ?? 0) !== 1 || ownerAcceptBookings.rows[0]?.booking_request_id !== requestA) {
      throw new Error("Owner-Accept hat keine eindeutige Einzelbuchung hinterlassen.");
    }

    const visibleConversation = await queryAsUser(db, riderId, (client) =>
      client.query("select id from public.conversations where id = $1", [conversationId])
    );

    if ((visibleConversation.rowCount ?? 0) !== 1) {
      throw new Error("Aktive Beziehung sieht bestehende Conversation nicht.");
    }

    await db.query(
      `
        insert into public.approvals (horse_id, rider_id, status)
        values ($1, $2, 'revoked')
        on conflict (horse_id, rider_id) do update set status = excluded.status;
      `,
      [horseId, riderId]
    );

    const hiddenConversation = await queryAsUser(db, riderId, (client) =>
      client.query("select id from public.conversations where id = $1", [conversationId])
    );

    if ((hiddenConversation.rowCount ?? 0) !== 0) {
      throw new Error("Alte Chat-URL bleibt nach revoked sichtbar.");
    }

    const revokedRule = await createOperationalRule(db, horseId, "2026-03-20T17:00:00.000Z", "2026-03-20T18:00:00.000Z");
    await expectQueryError(
      () =>
        queryAsUser(db, riderId, (client) =>
          client.query("select public.direct_book_operational_slot($1, $2, $3, $4)", [
            horseId,
            revokedRule.ruleId,
            "2026-03-20T17:00:00.000Z",
            "2026-03-20T17:30:00.000Z"
          ])
        ),
      "NOT_APPROVED",
      "Revoked sperrt operative Rechte"
    );

    console.log("[pass] Live-Smoke: Direktbuchung, Konflikte, revoked und Chat-Sperre sind live bestaetigt.");
  } finally {
    if (horseId) {
      await db.query("delete from public.horses where id = $1", [horseId]);
    }

    if (ownerId) {
      await db.query("delete from auth.users where id = $1", [ownerId]);
    }

    if (riderId) {
      await db.query("delete from auth.users where id = $1", [riderId]);
    }

    if (secondRiderId) {
      await db.query("delete from auth.users where id = $1", [secondRiderId]);
    }

    await db.end();
  }
}

async function insertAuthUser(client, userId, email) {
  await client.query(
    `
      insert into auth.users (
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at
      )
      values (
        $1,
        'authenticated',
        'authenticated',
        $2,
        '',
        timezone('utc'::text, now()),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{}'::jsonb,
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
      )
    `,
    [userId, email]
  );
}

async function createOperationalRule(client, horseId, startAt, endAt) {
  const slotId = randomUUID();
  const ruleId = randomUUID();

  await client.query(
    `
      insert into public.availability_slots (id, horse_id, start_at, end_at, active)
      values ($1, $2, $3, $4, true);
    `,
    [slotId, horseId, startAt, endAt]
  );
  await client.query(
    `
      insert into public.availability_rules (id, horse_id, slot_id, start_at, end_at, active, is_trial_slot)
      values ($1, $2, $3, $4, $5, true, false);
    `,
    [ruleId, horseId, slotId, startAt, endAt]
  );

  return { ruleId, slotId };
}

async function queryAsUser(client, userId, callback) {
  await client.query("begin");

  try {
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    await client.query("select set_config('request.jwt.claim.role', 'authenticated', true)");
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function expectQueryError(run, expectedMessage, label) {
  try {
    await run();
    throw new Error(`UNEXPECTED_SUCCESS:${label}:${expectedMessage}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.startsWith("UNEXPECTED_SUCCESS:")) {
      throw new Error(`${label} haette mit ${expectedMessage} scheitern muessen.`);
    }

    if (!message.includes(expectedMessage)) {
      throw new Error(`${label} meldete ${message} statt ${expectedMessage}.`);
    }
  }
}
