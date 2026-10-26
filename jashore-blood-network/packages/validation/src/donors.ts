/**
 * Donor validation schemas.
 *
 * Used by both the Next.js frontend (client-side form validation) and the
 * NestJS backend (server-side request validation via ZodValidationPipe).
 *
 * CRITICAL: these schemas enforce the field whitelist. The backend
 * ZodValidationPipe is configured with `forbidNonWhitelisted: true`, so
 * any field not in these schemas will be REJECTED on the server. This
 * prevents mass-assignment of privileged fields (e.g. `visibility`,
 * `isAvailable` cannot be set via fields the user shouldn't control).
 *
 * NOTE on `isAvailable`: the create schema does NOT include `isAvailable`
 * because it defaults to `true` in the database. The update schema DOES
 * include it because changing availability is an explicit user action.
 */

import { z } from 'zod';

// Re-use the E.164 phone regex from auth.ts for consistency, though
// donor profiles don't store phone (it lives on `profiles`).
const bloodGroupEnum = z.enum([
  'A_POSITIVE',
  'A_NEGATIVE',
  'B_POSITIVE',
  'B_NEGATIVE',
  'AB_POSITIVE',
  'AB_NEGATIVE',
  'O_POSITIVE',
  'O_NEGATIVE',
]);

const visibilityEnum = z.enum(['LISTED', 'UNLISTED', 'HIDDEN']);

const contactPreferenceEnum = z.enum([
  'IN_APP_ONLY',
  'IN_APP_AND_PHONE',
  'IN_APP_AND_EMAIL',
]);

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

/**
 * POST /api/v1/donors/me
 *
 * Creates the authenticated user's donor profile. The profile is 1:1 with
 * the user's `profiles` row, so this endpoint will fail if a donor profile
 * already exists (use PATCH instead).
 */
export const createDonorProfileSchema = z.object({
  bloodGroup: bloodGroupEnum,
  upazilaId: z.string().uuid('upazilaId must be a valid UUID'),
  localityId: z.string().uuid().nullable().optional(),
  lastDonationAt: z
    .string()
    .regex(isoDateRegex, 'lastDonationAt must be an ISO date (YYYY-MM-DD)')
    .optional()
    .nullable(),
  contactPreference: contactPreferenceEnum.default('IN_APP_ONLY'),
  visibility: visibilityEnum.default('LISTED'),
  // isAvailable is NOT settable on create — defaults to true in DB
  // availabilityConfirmedAt is NOT settable — set to now() by the service
});

export type CreateDonorProfileInput = z.infer<typeof createDonorProfileSchema>;

/**
 * PATCH /api/v1/donors/me
 *
 * Updates the authenticated user's donor profile. All fields are optional.
 *
 * CRITICAL: this schema deliberately EXCLUDES `profileId` (the FK to
 * profiles) to prevent a user from moving their donor profile to another
 * account. The service ignores any attempt to change `profileId`.
 *
 * `availabilityConfirmedAt` is NOT directly settable — it is updated
 * automatically when `isAvailable` is set to `true` (the user is
 * reconfirming availability).
 */
export const updateDonorProfileSchema = z.object({
  bloodGroup: bloodGroupEnum.optional(),
  upazilaId: z.string().uuid().optional(),
  localityId: z.string().uuid().nullable().optional(),
  lastDonationAt: z
    .string()
    .regex(isoDateRegex)
    .optional()
    .nullable(),
  contactPreference: contactPreferenceEnum.optional(),
  visibility: visibilityEnum.optional(),
  isAvailable: z.boolean().optional(),
});

export type UpdateDonorProfileInput = z.infer<typeof updateDonorProfileSchema>;

/**
 * GET /api/v1/donors — query parameters.
 *
 * All filters are optional. Pagination is cursor-free offset-based for
 * MVP simplicity; a cursor-based pagination can be added later if needed.
 */
export const searchDonorsSchema = z.object({
  bloodGroup: bloodGroupEnum.optional(),
  districtId: z.string().uuid().optional(),
  upazilaId: z.string().uuid().optional(),
  localityId: z.string().uuid().optional(),
  recentlyAvailable: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  page: z
    .string()
    .optional()
    .default('1')
    .transform((v) => Math.max(1, parseInt(v, 10) || 1)),
  pageSize: z
    .string()
    .optional()
    .default('20')
    .transform((v) => Math.min(50, Math.max(1, parseInt(v, 10) || 20))),
});

export type SearchDonorsInput = z.infer<typeof searchDonorsSchema>;
