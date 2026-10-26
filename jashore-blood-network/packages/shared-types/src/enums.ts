/**
 * Foundational enums shared across the web and api apps.
 *
 * Phase 2: only the most basic enum is defined. Domain enums (blood group,
 * request status, response status, role) will be added in Phase 3 when the
 * Prisma schema lands, and they will be kept in sync with the database via
 * code generation or manual review.
 */

/**
 * The eight upazilas of Jashore District, Bangladesh.
 *
 * These names must be verified against authoritative Bangladesh Local
 * Government sources before production deployment.
 *
 * Reference: Bangladesh Bureau of Statistics, Jashore District statistics.
 *
 * The array is `Object.freeze`d at module load so accidental runtime
 * mutation is rejected in dev/test. The `as const` assertion additionally
 * makes it a readonly tuple at the type level.
 */
export const JASHORE_UPAZILAS = Object.freeze([
  'Jashore Sadar',
  'Abhaynagar',
  'Bagherpara',
  'Chaugachha',
  'Jhikargachha',
  'Keshabpur',
  'Manirampur',
  'Sharsha',
] as const);

export type JashoreUpazila = (typeof JASHORE_UPAZILAS)[number];

/**
 * The eight user roles.
 *
 * `PUBLIC_VISITOR` is implicit (anyone without an account) and is NOT
 * stored in the `user_roles` table — it is not in the Role enum used by
 * the database. This shared type includes it for frontend UI completeness
 * (e.g. showing role badges on a public profile).
 *
 * The other seven roles MUST match the `Role` enum in
 * `apps/api/prisma/schema.prisma` exactly. A unit test in
 * `apps/api/test/database.foundation.spec.ts` verifies this.
 *
 * CRITICAL: users cannot self-assign any role other than REGISTERED_USER
 * (which is granted automatically on first login). All other roles are
 * assigned by an authorized administrator via the backend service-role
 * connection and are audit-logged.
 */
export const ROLES = Object.freeze([
  'PUBLIC_VISITOR',
  'REGISTERED_USER',
  'DONOR',
  'VOLUNTEER_COORDINATOR',
  'HOSPITAL_REPRESENTATIVE',
  'MODERATOR',
  'DISTRICT_ADMINISTRATOR',
  'SUPER_ADMINISTRATOR',
] as const);

export type Role = (typeof ROLES)[number];

/**
 * Roles that can be granted to a user. Excludes PUBLIC_VISITOR (which is
 * not a stored role).
 */
export const ASSIGNABLE_ROLES = Object.freeze([
  'REGISTERED_USER',
  'DONOR',
  'VOLUNTEER_COORDINATOR',
  'HOSPITAL_REPRESENTATIVE',
  'MODERATOR',
  'DISTRICT_ADMINISTRATOR',
  'SUPER_ADMINISTRATOR',
] as const);

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/**
 * Role hierarchy. A role with a higher number cannot be assigned by a user
 * whose highest role has a lower number. Used by the role-assignment policy
 * to prevent privilege escalation.
 *
 * Example: a DISTRICT_ADMINISTRATOR (level 5) can grant MODERATOR (level 4)
 * but not SUPER_ADMINISTRATOR (level 6).
 */
export const ROLE_LEVEL: Readonly<Record<AssignableRole, number>> = Object.freeze({
  REGISTERED_USER: 1,
  DONOR: 2,
  VOLUNTEER_COORDINATOR: 3,
  HOSPITAL_REPRESENTATIVE: 3,
  MODERATOR: 4,
  DISTRICT_ADMINISTRATOR: 5,
  SUPER_ADMINISTRATOR: 6,
});

/**
 * Result of a health check probe.
 */
export type HealthStatus = 'ok' | 'degraded' | 'down';

/**
 * Standard API response envelope for the health endpoint.
 */
export interface HealthCheckResponse {
  status: HealthStatus;
  service: string;
  version: string;
  timestamp: string;
  uptime: number;
  checks?: Record<string, HealthStatus>;
}
