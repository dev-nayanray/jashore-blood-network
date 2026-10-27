-- Supabase compatibility shim for vanilla PostgreSQL (e.g. Render Postgres).
-- The RLS migration (20261026000001_rls_policies) references Supabase's
-- `authenticated`/`anon` roles and `auth.uid()` function. On Supabase these
-- exist natively; on a vanilla Postgres they must be created before
-- `prisma migrate deploy` runs. Idempotent: safe to run on every build.
-- The application connects as the database owner, which bypasses RLS,
-- so policies remain inert but valid.

DO $$ BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULL::uuid
$$;
