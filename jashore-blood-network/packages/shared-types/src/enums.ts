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
