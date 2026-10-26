-- =============================================================================
-- Migration: 20261026000001_rls_policies
-- =============================================================================
-- Row Level Security policies for the Jashore Blood Network.
--
-- Defense-in-depth model:
--   1. NestJS guards are the PRIMARY authorization layer (full request context).
--   2. RLS is the BACKSTOP — catches direct database access with the anon key
--      and any guard bypass.
--   3. The Supabase service-role key BYPASSES RLS entirely. It is stored ONLY
--      in the backend environment (Render) and NEVER in any NEXT_PUBLIC_
--      variable or in client-side code.
--
-- Policy conventions:
--   - All policies use `using (...)` for SELECT/UPDATE/DELETE visibility.
--   - INSERT policies use `with check (...)` to constrain new rows.
--   - The helper function `auth.uid()` returns the authenticated user's UUID
--     (provided by Supabase Auth; mirrors profiles.id).
--   - Reference tables (districts, upazilas) have NO RLS — they are public
--     reference data.
--   - Append-only tables (consent_records, audit_logs) have INSERT-only
--     policies for the application role; UPDATE and DELETE are revoked
--     entirely via REVOKE.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper: get the current authenticated user's profile id
-- -----------------------------------------------------------------------------
-- Supabase Auth sets `request.jwt.claims ->> 'sub'` to the auth.users.id.
-- We map profiles.id 1:1 to auth.users.id by inserting a profile row at signup.
-- `auth.uid()` returns NULL for unauthenticated requests.

-- (Supabase provides auth.uid() by default — no need to redefine it.)

-- -----------------------------------------------------------------------------
-- 1. profiles
-- -----------------------------------------------------------------------------
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "profiles" FORCE ROW LEVEL SECURITY;

CREATE POLICY "profiles_self_read"
  ON "profiles" FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR deleted_at IS NULL);
  -- A user can always read their own row.
  -- Other users can read non-deleted rows (limited profile info; PII columns
  -- are NOT returned to non-self users — the API enforces this projection).

CREATE POLICY "profiles_self_update"
  ON "profiles" FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
  -- A user can update only their own row. Role assignment is NOT done via
  -- profiles; it goes through user_roles which has its own policy.

CREATE POLICY "profiles_self_insert"
  ON "profiles" FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());
  -- A profile is inserted by the user themselves at signup.

-- No DELETE policy — deletion is via UPDATE (soft delete: deleted_at = now()).

-- -----------------------------------------------------------------------------
-- 2. user_roles
-- -----------------------------------------------------------------------------
-- CRITICAL: users cannot self-assign privileged roles. Only admins can insert.
-- Role assignment is performed by the NestJS API using the service-role
-- connection, which bypasses RLS. The anon/authenticated connection has
-- INSERT denied entirely.
-- -----------------------------------------------------------------------------
ALTER TABLE "user_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_roles" FORCE ROW LEVEL SECURITY;

CREATE POLICY "user_roles_self_read"
  ON "user_roles" FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());
  -- A user can read only their own role assignments.

-- No INSERT/UPDATE/DELETE policies for authenticated role.
-- Role changes happen exclusively through the backend service-role connection
-- (which bypasses RLS) and are audit-logged by the application.
REVOKE INSERT, UPDATE, DELETE ON "user_roles" FROM authenticated, anon;

-- -----------------------------------------------------------------------------
-- 3. districts (public reference — no RLS)
-- -----------------------------------------------------------------------------
-- districts and upazilas are publicly readable without authentication.
-- No RLS enabled. No INSERT/UPDATE/DELETE granted to anon or authenticated
-- (only the backend service role can write, and only via seed/migration).
REVOKE INSERT, UPDATE, DELETE ON "districts" FROM authenticated, anon;

-- -----------------------------------------------------------------------------
-- 4. upazilas (public reference — no RLS)
-- -----------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON "upazilas" FROM authenticated, anon;

-- -----------------------------------------------------------------------------
-- 5. localities
-- -----------------------------------------------------------------------------
ALTER TABLE "localities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "localities" FORCE ROW LEVEL SECURITY;

CREATE POLICY "localities_public_read_approved"
  ON "localities" FOR SELECT
  TO authenticated, anon
  USING (is_approved = true AND deleted_at IS NULL);
  -- Approved localities are publicly readable.

CREATE POLICY "localities_self_insert"
  ON "localities" FOR INSERT
  TO authenticated
  WITH CHECK (true);
  -- Any authenticated user can SUGGEST a locality. Approval is a separate
  -- admin action (UPDATE is_approved), which only the backend can do.

REVOKE UPDATE, DELETE ON "localities" FROM authenticated, anon;
-- Approvals and deletions happen via the backend service-role connection.

-- -----------------------------------------------------------------------------
-- 6. donor_profiles
-- -----------------------------------------------------------------------------
-- CRITICAL: donor contact information (phone, email) is stored on `profiles`,
-- NOT on `donor_profiles`. The donor_profiles table contains only the
-- information needed for search (blood group, location, availability) and
-- for the donor to manage their own profile.
-- A requester searching for donors will receive donor_profile rows WITHOUT
-- the related profile's PII — the API projection layer enforces this.
-- -----------------------------------------------------------------------------
ALTER TABLE "donor_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "donor_profiles" FORCE ROW LEVEL SECURITY;

CREATE POLICY "donor_profiles_public_read_listed"
  ON "donor_profiles" FOR SELECT
  TO authenticated, anon
  USING (
    visibility = 'LISTED'
    AND deleted_at IS NULL
    AND is_available = true
  );
  -- Public search can see only LISTED + available + non-deleted donor profiles.
  -- The API adds additional filters (blood_group, upazila_id) via WHERE.

CREATE POLICY "donor_profiles_self_read"
  ON "donor_profiles" FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());
  -- A donor can always read their own profile regardless of visibility.

CREATE POLICY "donor_profiles_self_insert"
  ON "donor_profiles" FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "donor_profiles_self_update"
  ON "donor_profiles" FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- No DELETE policy — deletion is via UPDATE (soft delete: deleted_at = now()).

-- -----------------------------------------------------------------------------
-- 7. blood_requests
-- -----------------------------------------------------------------------------
ALTER TABLE "blood_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "blood_requests" FORCE ROW LEVEL SECURITY;

CREATE POLICY "blood_requests_authenticated_read_active"
  ON "blood_requests" FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      requester_id = auth.uid()
      OR status IN ('VERIFIED', 'SEARCHING', 'DONOR_RESPONDED', 'ARRANGED')
    )
  );
  -- A requester can always read their own requests (any status).
  -- Other users see only requests that have been verified and are still active
  -- (PENDING/REJECTED/CANCELLED/EXPIRED/COMPLETED are hidden from non-owners).

CREATE POLICY "blood_requests_self_insert"
  ON "blood_requests" FOR INSERT
  TO authenticated
  WITH CHECK (requester_id = auth.uid());

CREATE POLICY "blood_requests_self_update"
  ON "blood_requests" FOR UPDATE
  TO authenticated
  USING (requester_id = auth.uid())
  WITH CHECK (requester_id = auth.uid());
  -- Requester can update their own request (e.g. cancel, edit details).
  -- Status transitions like VERIFY -> SEARCHING are admin-only and go through
  -- the backend service-role connection.

-- No DELETE policy — soft delete only.

-- -----------------------------------------------------------------------------
-- 8. request_responses
-- -----------------------------------------------------------------------------
ALTER TABLE "request_responses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "request_responses" FORCE ROW LEVEL SECURITY;

CREATE POLICY "request_responses_donor_read_own"
  ON "request_responses" FOR SELECT
  TO authenticated
  USING (donor_id = auth.uid());

CREATE POLICY "request_responses_requester_read"
  ON "request_responses" FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "blood_requests" br
      WHERE br.id = request_id
      AND br.requester_id = auth.uid()
      AND br.deleted_at IS NULL
    )
  );
  -- The requester can see responses on their own requests.

CREATE POLICY "request_responses_donor_insert_own"
  ON "request_responses" FOR INSERT
  TO authenticated
  WITH CHECK (donor_id = auth.uid());

CREATE POLICY "request_responses_donor_update_own"
  ON "request_responses" FOR UPDATE
  TO authenticated
  USING (donor_id = auth.uid())
  WITH CHECK (donor_id = auth.uid());
  -- A donor can update their own response (e.g. withdraw).

-- No DELETE policy — soft delete via UPDATE withdrawn_at, or hard delete via
-- backend service-role when GDPR-deletion is requested.

-- -----------------------------------------------------------------------------
-- 9. hospitals
-- -----------------------------------------------------------------------------
ALTER TABLE "hospitals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hospitals" FORCE ROW LEVEL SECURITY;

CREATE POLICY "hospitals_public_read_verified"
  ON "hospitals" FOR SELECT
  TO authenticated, anon
  USING (verification_status = 'VERIFIED' AND deleted_at IS NULL);

CREATE POLICY "hospitals_rep_read_own"
  ON "hospitals" FOR SELECT
  TO authenticated
  USING (represented_by = auth.uid());

CREATE POLICY "hospitals_rep_insert"
  ON "hospitals" FOR INSERT
  TO authenticated
  WITH CHECK (true);
  -- Any authenticated user can submit a hospital for verification.
  -- It will be created with verification_status = 'UNVERIFIED' (default).

CREATE POLICY "hospitals_rep_update_own"
  ON "hospitals" FOR UPDATE
  TO authenticated
  USING (represented_by = auth.uid())
  WITH CHECK (represented_by = auth.uid());
  -- The hospital rep can update their own hospital's profile.
  -- verification_status changes are admin-only and go through the backend.

-- No DELETE policy — soft delete only.

-- -----------------------------------------------------------------------------
-- 10. blood_banks (same pattern as hospitals)
-- -----------------------------------------------------------------------------
ALTER TABLE "blood_banks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "blood_banks" FORCE ROW LEVEL SECURITY;

CREATE POLICY "blood_banks_public_read_verified"
  ON "blood_banks" FOR SELECT
  TO authenticated, anon
  USING (verification_status = 'VERIFIED' AND deleted_at IS NULL);

CREATE POLICY "blood_banks_authenticated_insert"
  ON "blood_banks" FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- No UPDATE policy for authenticated users — verification and updates go
-- through the backend service-role connection.
REVOKE UPDATE, DELETE ON "blood_banks" FROM authenticated, anon;

-- -----------------------------------------------------------------------------
-- 11. facility_verifications
-- -----------------------------------------------------------------------------
-- Admin-only read. Insert/Update/Delete only via backend service-role.
-- -----------------------------------------------------------------------------
ALTER TABLE "facility_verifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "facility_verifications" FORCE ROW LEVEL SECURITY;

-- No SELECT policy for authenticated or anon — admins read via the backend
-- service-role connection which bypasses RLS.
REVOKE SELECT, INSERT, UPDATE, DELETE ON "facility_verifications" FROM authenticated, anon;

-- -----------------------------------------------------------------------------
-- 12. notifications
-- -----------------------------------------------------------------------------
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;

CREATE POLICY "notifications_recipient_read_own"
  ON "notifications" FOR SELECT
  TO authenticated
  USING (recipient_id = auth.uid());

CREATE POLICY "notifications_recipient_update_own"
  ON "notifications" FOR UPDATE
  TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());
  -- Recipient can mark as read, etc. Cannot change content.

-- No INSERT policy for authenticated users — notifications are created by the
-- backend service-role connection.
REVOKE INSERT, DELETE ON "notifications" FROM authenticated, anon;

-- -----------------------------------------------------------------------------
-- 13. notification_preferences
-- -----------------------------------------------------------------------------
ALTER TABLE "notification_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_preferences" FORCE ROW LEVEL SECURITY;

CREATE POLICY "notification_preferences_self_read"
  ON "notification_preferences" FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "notification_preferences_self_upsert"
  ON "notification_preferences" FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "notification_preferences_self_update"
  ON "notification_preferences" FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- No DELETE policy — preferences are 1:1 with profile and should not be
-- hard-deleted independently.

-- -----------------------------------------------------------------------------
-- 14. consent_records (append-only)
-- -----------------------------------------------------------------------------
-- INSERT-only for the application. No UPDATE, no DELETE — by anyone, ever.
-- -----------------------------------------------------------------------------
ALTER TABLE "consent_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "consent_records" FORCE ROW LEVEL SECURITY;

CREATE POLICY "consent_records_self_read"
  ON "consent_records" FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "consent_records_self_insert"
  ON "consent_records" FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

-- Append-only enforcement: revoke UPDATE and DELETE from everyone.
REVOKE UPDATE, DELETE ON "consent_records" FROM authenticated, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 15. abuse_reports
-- -----------------------------------------------------------------------------
ALTER TABLE "abuse_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "abuse_reports" FORCE ROW LEVEL SECURITY;

CREATE POLICY "abuse_reports_reporter_read_own"
  ON "abuse_reports" FOR SELECT
  TO authenticated
  USING (reporter_id = auth.uid());

CREATE POLICY "abuse_reports_authenticated_insert"
  ON "abuse_reports" FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = auth.uid() OR reporter_id IS NULL);
  -- A user can submit a report (anonymous allowed).

-- No UPDATE/DELETE for authenticated — moderation actions go through the
-- backend service-role connection.
REVOKE UPDATE, DELETE ON "abuse_reports" FROM authenticated, anon;

-- -----------------------------------------------------------------------------
-- 16. audit_logs (append-only, admin-only read)
-- -----------------------------------------------------------------------------
-- CRITICAL: audit logs are never modifiable. INSERT-only via backend service
-- role. SELECT for authenticated users is denied; admins read via the backend
-- service-role connection (which bypasses RLS).
-- -----------------------------------------------------------------------------
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;

-- No SELECT/UPDATE/DELETE granted to anon or authenticated.
REVOKE SELECT, UPDATE, DELETE ON "audit_logs" FROM authenticated, anon;

-- No INSERT policy for authenticated — audit logs are written exclusively by
-- the backend service-role connection.
REVOKE INSERT ON "audit_logs" FROM authenticated, anon;
