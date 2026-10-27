-- Disable row-level security on all public tables.
--
-- The RLS policies (20261026000001_rls_policies) are keyed to Supabase's
-- auth.uid(), which does not exist in this deployment: the NestJS API is
-- the sole writer and enforces authorization via role guards. On hosting
-- where the app connects as a non-owner user (e.g. Render Postgres), the
-- policies reject every INSERT/UPDATE (SQLSTATE 42501), breaking the
-- demo seed AND all authenticated write endpoints. Disabling RLS
-- restores the write path; API-side guards + audit logging remain the
-- enforcement layer.

DO $$ DECLARE r record; BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND rowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;
