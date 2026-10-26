/**
 * Blood request validation schemas.
 *
 * Used by both the Next.js frontend and the NestJS backend for creating
 * and updating blood requests.
 *
 * SECURITY: the `requesterId` field is NEVER in these schemas — it is
 * derived from the authenticated user's identity on the server. The
 * ZodValidationPipe strips unknown fields, preventing mass-assignment.
 */

import { z } from 'zod';

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

const urgencyEnum = z.enum(['URGENT', 'NORMAL', 'FLEXIBLE']);
const bloodComponentEnum = z.enum([
  'WHOLE_BLOOD',
  'PLASMA',
  'PLATELETS',
  'RED_BLOOD_CELLS',
]);
const contactMethodEnum = z.enum(['PHONE', 'EMAIL', 'IN_APP']);

const requestStatusEnum = z.enum([
  'PENDING',
  'VERIFIED',
  'SEARCHING',
  'DONOR_RESPONDED',
  'ARRANGED',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
  'REJECTED',
]);

const isoDateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/**
 * POST /api/v1/blood-requests
 *
 * Creates a new blood request. The `requesterId` is derived from the
 * authenticated user — NEVER from the request body.
 */
export const createBloodRequestSchema = z.object({
  patientDisplayName: z
    .string()
    .min(2, 'Patient display name must be at least 2 characters')
    .max(120, 'Patient display name must be at most 120 characters')
    .optional(),
  bloodGroup: bloodGroupEnum,
  bloodComponent: bloodComponentEnum.optional(),
  unitsRequested: z
    .number()
    .int('Units must be a whole number')
    .min(1, 'At least 1 unit is required')
    .max(10, 'At most 10 units per request'),
  upazilaId: z.string().uuid('upazilaId must be a valid UUID'),
  hospitalId: z.string().uuid().nullable().optional(),
  hospitalName: z
    .string()
    .max(180, 'Hospital name must be at most 180 characters')
    .optional()
    .nullable(),
  requiredBy: z
    .string()
    .regex(isoDateTimeRegex, 'requiredBy must be an ISO 8601 datetime')
    .refine((val) => {
      const d = new Date(val);
      return d.getTime() > Date.now();
    }, 'requiredBy must be in the future'),
  urgency: urgencyEnum.default('NORMAL'),
  contactMethod: contactMethodEnum.default('IN_APP'),
  contactNote: z
    .string()
    .max(2000, 'Contact note must be at most 2000 characters')
    .optional(),
  notes: z
    .string()
    .max(5000, 'Notes must be at most 5000 characters')
    .optional(),
});

export type CreateBloodRequestInput = z.infer<typeof createBloodRequestSchema>;

/**
 * PATCH /api/v1/blood-requests/:id
 *
 * Updates a blood request. Only the owner (or an admin) can update.
 * Status changes go through a separate endpoint with authorization.
 *
 * CRITICAL: `requesterId` and `status` are NOT in this schema — they
 * cannot be changed via this endpoint. Status changes require
 * authorization and go through PATCH /blood-requests/:id/status.
 */
export const updateBloodRequestSchema = z.object({
  patientDisplayName: z
    .string()
    .min(2)
    .max(120)
    .optional(),
  bloodGroup: bloodGroupEnum.optional(),
  bloodComponent: bloodComponentEnum.optional().nullable(),
  unitsRequested: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional(),
  upazilaId: z.string().uuid().optional(),
  hospitalId: z.string().uuid().nullable().optional(),
  hospitalName: z
    .string()
    .max(180)
    .optional()
    .nullable(),
  requiredBy: z
    .string()
    .regex(isoDateTimeRegex)
    .refine((val) => new Date(val).getTime() > Date.now())
    .optional(),
  urgency: urgencyEnum.optional(),
  contactMethod: contactMethodEnum.optional(),
  contactNote: z.string().max(2000).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export type UpdateBloodRequestInput = z.infer<typeof updateBloodRequestSchema>;

/**
 * PATCH /api/v1/blood-requests/:id/status
 *
 * Changes the status of a blood request. Authorization is enforced by
 * the controller — only the owner can cancel; only moderators+ can
 * verify/reject; completion requires a separate flow (Phase 6+).
 */
export const updateRequestStatusSchema = z.object({
  status: requestStatusEnum,
  reason: z
    .string()
    .max(1000, 'Reason must be at most 1000 characters')
    .optional(),
});

export type UpdateRequestStatusInput = z.infer<typeof updateRequestStatusSchema>;

/**
 * GET /api/v1/blood-requests — query parameters.
 */
export const searchBloodRequestsSchema = z.object({
  bloodGroup: bloodGroupEnum.optional(),
  upazilaId: z.string().uuid().optional(),
  urgency: urgencyEnum.optional(),
  status: requestStatusEnum.optional(),
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

export type SearchBloodRequestsInput = z.infer<typeof searchBloodRequestsSchema>;
