# Migration Guide

> **Phase 3 — Database Foundation.** How to apply database migrations, manage
> connection pooling, and separate development from production.

## Prisma Setup

The Prisma schema lives at `apps/api/prisma/schema.prisma`. The generated
client lives at `apps/api/src/generated/prisma/` (gitignored — regenerated on
every install).

### Environment variables

```bash
# In apps/api/.env (gitignored) or your shell environment:
DATABASE_URL="postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres"
```

| Variable | Used by | Port | Purpose |
|---|---|---|---|
| `DATABASE_URL` | Prisma Client (runtime) | 6543 (pooler) | Connection-pooled queries from NestJS |
| `DIRECT_URL` | Prisma Migrate CLI | 5432 (direct) | Schema migrations (cannot run through pooler) |

### Why two URLs?

Supabase provides two Postgres endpoints:

1. **Pooler (port 6543)** — PgBouncer-backed, multiplexes many app connections
   over a small pool of database connections. Used by the NestJS app at
   runtime. Must use `?pgbouncer=true&connection_limit=1` to play nicely with
   PgBouncer's transaction mode.
2. **Direct (port 5432)** — Bypasses the pooler. Used by `prisma migrate`
   because migrations need a session-level connection (PgBouncer's
   transaction mode breaks `CREATE INDEX CONCURRENTLY` and other advisory
   operations).

If you accidentally point `prisma migrate` at the pooler URL, you will see
errors like `prepared statement "s1" already exists` or
`cannot insert multiple commands into a prepared statement`.

## Migration Workflow

### Development: create a new migration

When you change the Prisma schema, generate a new migration:

```bash
cd apps/api
pnpm prisma:migrate:dev --name descriptive_name
```

This will:
1. Compare the schema to the dev database
2. Create a new migration directory `prisma/migrations/<timestamp>_<name>/`
3. Generate `migration.sql` with the SQL diff
4. Apply the migration to the dev database
5. Regenerate the Prisma client

**Review the generated `migration.sql` before committing.** Prisma sometimes
generates destructive SQL (e.g. dropping and recreating a column when a
rename would suffice). If you see a destructive change, edit the migration
manually to use a non-destructive ALTER, then re-run `prisma migrate dev`
to update the migration snapshot.

### Production: apply migrations

Migrations are applied by a CI job (or manually by an operator) — never by
the deploy pipeline of either the frontend or the backend.

```bash
# In CI (with the migration role key in DIRECT_URL):
cd apps/api
pnpm prisma:migrate:deploy
```

`migrate deploy` is idempotent: it checks the `_prisma_migrations` table and
applies only pending migrations. It will never run a migration that has
already been applied.

### Check migration status

```bash
cd apps/api
pnpm prisma:migrate:status
```

This shows which migrations have been applied to the database referenced by
`DATABASE_URL` (use `DIRECT_URL` to check the direct connection).

### Reset the dev database (DESTRUCTIVE)

```bash
cd apps/api
pnpm exec prisma migrate reset --schema=prisma/schema.prisma
```

⚠️ **`migrate reset` drops all data and re-applies all migrations.** Never
run this against the production database. The CLI will refuse to run against
a database it cannot classify as a development database, but you should also
double-check the `DATABASE_URL` before running.

## RLS Policies

RLS policies are not managed by Prisma. They live in a separate migration
directory: `prisma/migrations/20261026000001_rls_policies/migration.sql`.

When you add a new table that requires RLS:

1. Add the table to `schema.prisma`
2. Generate the schema migration with `prisma migrate dev`
3. Create a new migration directory for the RLS policies (e.g.
   `prisma/migrations/<timestamp>_<table>_rls/migration.sql`)
4. Write the `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and `CREATE POLICY`
   statements in that file
5. Apply with `prisma migrate deploy`

The RLS migration in this repo (`20261026000001_rls_policies`) covers all 14
PII tables. See `docs/DATABASE_SCHEMA.md` for the policy matrix.

## Seed Data

The seed script at `prisma/seeds/reference-data.ts` inserts ONLY legitimate
reference data: Bangladesh (country), Jashore (district), and the 8 upazilas
of Jashore. It is idempotent (uses `upsert`).

### Run the seed

```bash
cd apps/api
pnpm prisma:seed
```

This connects via `DIRECT_URL` (not the pooler) because seeding needs a
session-level connection for transactional upserts.

### Seed policy

The seed does NOT insert:
- Any donor records
- Any hospital records
- Any blood bank records
- Any blood request records
- Any user accounts / profiles

If demo data is needed for a stakeholder presentation, it lives in a
separate, labelled, never-deployed seed file (to be created in Phase 10).

## Environment Separation

| Environment | Supabase project | Purpose |
|---|---|---|
| Local dev | `jbn-dev` (or local Postgres) | Developer's machine |
| Preview | `jbn-dev` (shared) | Vercel/Render preview deploys |
| Production | `jbn-prod` | Live pilot |

Each Supabase project has its own:
- Database (with its own migrations applied)
- Auth service (separate user pool)
- Storage (separate buckets)
- API keys (separate anon and service-role keys)

**Never point a production deployment at the dev database.** The
`DATABASE_URL` for production is configured in the Render dashboard, not in
any committed file. The `.env.example` file uses placeholder values only.

## Connection Pooling Notes

- **PgBouncer transaction mode** is the Supabase default. It works with
  Prisma Client as long as you use `?pgbouncer=true&connection_limit=1` in
  the URL.
- **Prepared statements** are disabled by Prisma when `pgbouncer=true` is
  detected (Prisma 5+). If you see prepared-statement errors, ensure you are
  on Prisma 5.10 or later.
- **Connection limit** — Supabase free tier allows ~60 direct connections
  and ~200 pooler connections. The Render free tier runs a single backend
  instance, so `connection_limit=1` is sufficient. If you scale to multiple
  backend instances, increase the total carefully and rely on the pooler.
- **Idle timeout** — Supabase's pooler closes idle connections after 60s.
  Prisma reconnects automatically. No action needed.

## Backup and Recovery

- **Supabase managed backups** — Daily snapshots, 7-day retention on the
  free tier. Restored via the Supabase dashboard.
- **Quarterly restore test** — Once per quarter, restore the latest backup
  into a sandbox Supabase project and run the test suite against it. If
  restore fails or takes > 1 hour, file an incident.
- **No manual backups to disk** — The backend never runs `pg_dump`. All
  backups are Supabase-managed. This avoids the risk of unencrypted dumps
  on developer machines.

## Destructive Change Policy

Destructive schema changes (dropping columns, dropping tables, changing
column types incompatibly) require explicit approval:

1. The PR description must call out the destructive change in the Risk
   section.
2. The PR must include a data-migration plan (how to preserve existing data
   or whether data loss is acceptable).
3. The PR must be reviewed by both an engineer and the security owner.
4. The migration must be applied to the dev database first and the test
   suite must pass.
5. The migration must be applied to the production database during a
   scheduled maintenance window, not during a regular deploy.

## Troubleshooting

### `prepared statement "s1" already exists`

You are running `prisma migrate` against the pooler URL. Use `DIRECT_URL`
(port 5432) for migrations. Check that `DIRECT_URL` is set in your
environment and that the Prisma schema's `directUrl` references it.

### `cannot insert multiple commands into a prepared statement`

Same cause and fix as above.

### `relation "TableName" does not exist`

The migration has not been applied. Run `pnpm prisma:migrate:deploy` with
`DIRECT_URL` pointing at the database.

### `permission denied for table "TableName"`

You are connecting with the anon key, which has limited permissions. The
backend must use the service-role key for write operations. Check that
`SUPABASE_SERVICE_ROLE_KEY` is set in the backend environment.

### `new row violates row-level security policy`

The authenticated user is trying to do something RLS does not allow. Either:
1. The action should be allowed and the RLS policy is wrong — fix the policy
   in a new migration.
2. The action should NOT be allowed and the application code is wrong —
   fix the application code to use the service-role connection (for admin
   actions) or to refuse the action.

Never "fix" this by disabling RLS.
