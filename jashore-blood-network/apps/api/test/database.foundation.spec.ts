/**
 * Database foundation verification tests.
 *
 * These tests verify the database foundation WITHOUT requiring a running
 * Postgres. They check:
 *   1. The Prisma schema file parses and contains all 16 expected models
 *   2. The seed data contains the correct 8 Jashore upazilas
 *   3. The migration SQL files exist and contain the expected statements
 *   4. The RLS policy SQL covers all PII tables
 *   5. The JASHORE_UPAZILAS export from @jbn/shared-types matches the seed
 *
 * Integration tests against a real Postgres (with RLS, with the seed applied,
 * with anon/authenticated/service-role connections) will be added in Phase 4+
 * once we have a CI Supabase project to point at.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { JASHORE_UPAZILAS } from '@jbn/shared-types';

const PRISMA_DIR = join(__dirname, '..', 'prisma');
const SCHEMA_PATH = join(PRISMA_DIR, 'schema.prisma');
const INITIAL_MIGRATION_PATH = join(
  PRISMA_DIR,
  'migrations',
  '20261026000000_initial',
  'migration.sql',
);
const RLS_MIGRATION_PATH = join(
  PRISMA_DIR,
  'migrations',
  '20261026000001_rls_policies',
  'migration.sql',
);
const SEED_PATH = join(PRISMA_DIR, 'seeds', 'reference-data.ts');

const EXPECTED_MODELS = [
  'Profile',
  'UserRole',
  'District',
  'Upazila',
  'Locality',
  'DonorProfile',
  'BloodRequest',
  'RequestResponse',
  'Hospital',
  'BloodBank',
  'FacilityVerification',
  'Notification',
  'NotificationPreference',
  'ConsentRecord',
  'AbuseReport',
  'AuditLog',
] as const;

const EXPECTED_ENUMS = [
  'BloodGroup',
  'Role',
  'DonorVisibility',
  'ContactPreference',
  'RequestStatus',
  'ResponseStatus',
  'VerificationStatus',
  'FacilityType',
  'NotificationChannel',
  'NotificationType',
  'ConsentType',
  'ConsentAction',
  'AbuseReportStatus',
  'AbuseReportTargetType',
] as const;

const EXPECTED_TABLES_WITH_RLS = [
  'profiles',
  'user_roles',
  'localities',
  'donor_profiles',
  'blood_requests',
  'request_responses',
  'hospitals',
  'blood_banks',
  'facility_verifications',
  'notifications',
  'notification_preferences',
  'consent_records',
  'abuse_reports',
  'audit_logs',
] as const;

// Tables that should NOT have RLS (publicly readable reference data)
const EXPECTED_TABLES_WITHOUT_RLS = ['districts', 'upazilas'] as const;

describe('database foundation — schema', () => {
  const schema = readFileSync(SCHEMA_PATH, 'utf-8');

  it('schema file exists', () => {
    expect(existsSync(SCHEMA_PATH)).toBe(true);
  });

  it('schema declares all 16 expected models', () => {
    for (const model of EXPECTED_MODELS) {
      expect(schema).toContain(`model ${model} {`);
    }
  });

  it('schema declares all 14 expected enums', () => {
    for (const en of EXPECTED_ENUMS) {
      expect(schema).toContain(`enum ${en} {`);
    }
  });

  it('schema uses UUID primary keys for all models', () => {
    const uuidPks = schema.match(/@id @default\(dbgenerated\("gen_random_uuid\(\)"\)\) @db\.Uuid/g) ?? [];
    expect(uuidPks.length).toBeGreaterThanOrEqual(EXPECTED_MODELS.length);
  });

  it('BloodGroup enum has all 8 ISO blood groups', () => {
    const bloodGroupBlock = schema.match(/enum BloodGroup \{([^}]+)\}/)?.[1] ?? '';
    expect(bloodGroupBlock).toContain('A_POSITIVE');
    expect(bloodGroupBlock).toContain('A_NEGATIVE');
    expect(bloodGroupBlock).toContain('B_POSITIVE');
    expect(bloodGroupBlock).toContain('B_NEGATIVE');
    expect(bloodGroupBlock).toContain('AB_POSITIVE');
    expect(bloodGroupBlock).toContain('AB_NEGATIVE');
    expect(bloodGroupBlock).toContain('O_POSITIVE');
    expect(bloodGroupBlock).toContain('O_NEGATIVE');
  });

  it('Role enum has the 7 roles (no PUBLIC — that is implicit)', () => {
    const roleBlock = schema.match(/enum Role \{([^}]+)\}/)?.[1] ?? '';
    expect(roleBlock).toContain('REGISTERED_USER');
    expect(roleBlock).toContain('DONOR');
    expect(roleBlock).toContain('VOLUNTEER_COORDINATOR');
    expect(roleBlock).toContain('HOSPITAL_REPRESENTATIVE');
    expect(roleBlock).toContain('MODERATOR');
    expect(roleBlock).toContain('DISTRICT_ADMINISTRATOR');
    expect(roleBlock).toContain('SUPER_ADMINISTRATOR');
  });

  it('donor_profiles has the search index for blood-group + upazila + availability', () => {
    expect(schema).toContain('donor_profiles_search_idx');
    expect(schema).toContain('[bloodGroup, upazilaId, isAvailable, deletedAt]');
  });

  it('blood_requests has the donor-match index', () => {
    expect(schema).toContain('blood_requests_donor_match_idx');
  });

  it('request_responses has a unique constraint on (request_id, donor_id)', () => {
    expect(schema).toContain('request_responses_request_donor_unique');
  });

  it('audit_logs has actor and target indexes', () => {
    expect(schema).toContain('audit_logs_actor_idx');
    expect(schema).toContain('audit_logs_target_idx');
  });

  it('consent_records has no updatedAt field (append-only)', () => {
    const consentBlock = schema.match(/model ConsentRecord \{([\s\S]+?)\n\}/)?.[1] ?? '';
    expect(consentBlock).not.toMatch(/@updatedAt/);
  });

  it('audit_logs has no updatedAt field (append-only)', () => {
    const auditBlock = schema.match(/model AuditLog \{([\s\S]+?)\n\}/)?.[1] ?? '';
    expect(auditBlock).not.toMatch(/@updatedAt/);
  });

  it('schema configures the Supabase pooler URL via DATABASE_URL env', () => {
    expect(schema).toContain('url       = env("DATABASE_URL")');
    expect(schema).toContain('directUrl = env("DIRECT_URL")');
  });
});

describe('database foundation — initial migration', () => {
  const migration = readFileSync(INITIAL_MIGRATION_PATH, 'utf-8');

  it('migration file exists', () => {
    expect(existsSync(INITIAL_MIGRATION_PATH)).toBe(true);
  });

  it('migration creates all expected tables', () => {
    // Map each Prisma model name to its actual table name (via @@map).
    // All tables use snake_case plural; the mapping below mirrors the @@map
    // directives in schema.prisma.
    const modelToTable: Record<(typeof EXPECTED_MODELS)[number], string> = {
      Profile: 'profiles',
      UserRole: 'user_roles',
      District: 'districts',
      Upazila: 'upazilas',
      Locality: 'localities',
      DonorProfile: 'donor_profiles',
      BloodRequest: 'blood_requests',
      RequestResponse: 'request_responses',
      Hospital: 'hospitals',
      BloodBank: 'blood_banks',
      FacilityVerification: 'facility_verifications',
      Notification: 'notifications',
      NotificationPreference: 'notification_preferences',
      ConsentRecord: 'consent_records',
      AbuseReport: 'abuse_reports',
      AuditLog: 'audit_logs',
    };
    for (const model of EXPECTED_MODELS) {
      const table = modelToTable[model];
      expect(migration).toContain(`CREATE TABLE "${table}"`);
    }
  });

  it('migration creates all expected enum types', () => {
    for (const en of EXPECTED_ENUMS) {
      expect(migration).toContain(`CREATE TYPE "${en}" AS ENUM`);
    }
  });

  it('migration uses UUID primary keys with gen_random_uuid()', () => {
    expect(migration).toContain('DEFAULT gen_random_uuid()');
  });

  it('migration creates indexes for the search hot paths', () => {
    expect(migration).toContain('donor_profiles_search_idx');
    expect(migration).toContain('blood_requests_donor_match_idx');
    expect(migration).toContain('audit_logs_actor_idx');
  });
});

describe('database foundation — RLS policies', () => {
  const rls = readFileSync(RLS_MIGRATION_PATH, 'utf-8');

  it('RLS migration file exists', () => {
    expect(existsSync(RLS_MIGRATION_PATH)).toBe(true);
  });

  it('RLS is enabled and forced on every PII table', () => {
    for (const table of EXPECTED_TABLES_WITH_RLS) {
      expect(rls).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      expect(rls).toContain(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
    }
  });

  it('RLS is NOT enabled on public reference tables', () => {
    for (const table of EXPECTED_TABLES_WITHOUT_RLS) {
      expect(rls).not.toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
    }
  });

  it('user_roles has no INSERT/UPDATE/DELETE policy for authenticated users', () => {
    // CRITICAL: users cannot self-assign privileged roles.
    expect(rls).toContain('REVOKE INSERT, UPDATE, DELETE ON "user_roles" FROM authenticated, anon');
  });

  it('audit_logs has all DML revoked from anon and authenticated', () => {
    // CRITICAL: audit logs are never modifiable.
    expect(rls).toContain('REVOKE SELECT, UPDATE, DELETE ON "audit_logs" FROM authenticated, anon');
    expect(rls).toContain('REVOKE INSERT ON "audit_logs" FROM authenticated, anon');
  });

  it('consent_records is append-only (UPDATE and DELETE revoked)', () => {
    expect(rls).toContain('REVOKE UPDATE, DELETE ON "consent_records"');
  });

  it('donor_profiles public read policy requires LISTED + available + non-deleted', () => {
    expect(rls).toContain("donor_profiles_public_read_listed");
    expect(rls).toContain("visibility = 'LISTED'");
    expect(rls).toContain('is_available = true');
  });

  it('facility_verifications has all DML revoked from anon and authenticated', () => {
    expect(rls).toContain(
      'REVOKE SELECT, INSERT, UPDATE, DELETE ON "facility_verifications" FROM authenticated, anon',
    );
  });

  it('RLS migration warns that the service-role key bypasses RLS', () => {
    expect(rls).toContain('BYPASSES RLS');
    expect(rls).toContain('service-role');
  });
});

describe('database foundation — seed data', () => {
  const seed = readFileSync(SEED_PATH, 'utf-8');

  it('seed file exists', () => {
    expect(existsSync(SEED_PATH)).toBe(true);
  });

  it('seed inserts the Jashore district', () => {
    expect(seed).toContain("name: 'Jashore'");
    expect(seed).toContain("country: 'Bangladesh'");
  });

  it('seed inserts all 8 Jashore upazilas from the shared-types source of truth', () => {
    for (const upazila of JASHORE_UPAZILAS) {
      expect(seed).toContain(`'${upazila}'`);
    }
  });

  it('seed does NOT insert any donor, hospital, or user records', () => {
    expect(seed).not.toMatch(/donorProfile\.(create|upsert)/i);
    expect(seed).not.toMatch(/hospital\.(create|upsert)/i);
    expect(seed).not.toMatch(/bloodBank\.(create|upsert)/i);
    expect(seed).not.toMatch(/profile\.(create|upsert)/i);
    expect(seed).not.toMatch(/bloodRequest\.(create|upsert)/i);
  });

  it('seed is idempotent (uses upsert)', () => {
    expect(seed).toMatch(/prisma\.district\.upsert/);
    expect(seed).toMatch(/prisma\.upazila\.upsert/);
  });

  it('JASHORE_UPAZILAS in shared-types matches the expected 8 upazilas', () => {
    expect(JASHORE_UPAZILAS).toHaveLength(8);
    expect(JASHORE_UPAZILAS).toContain('Jashore Sadar');
    expect(JASHORE_UPAZILAS).toContain('Abhaynagar');
    expect(JASHORE_UPAZILAS).toContain('Bagherpara');
    expect(JASHORE_UPAZILAS).toContain('Chaugachha');
    expect(JASHORE_UPAZILAS).toContain('Jhikargachha');
    expect(JASHORE_UPAZILAS).toContain('Keshabpur');
    expect(JASHORE_UPAZILAS).toContain('Manirampur');
    expect(JASHORE_UPAZILAS).toContain('Sharsha');
  });
});
