/**
 * Auth validation schemas.
 *
 * Used by both the Next.js frontend (client-side form validation) and the
 * NestJS backend (server-side request validation via ZodValidationPipe).
 */

import { z } from 'zod';

/**
 * E.164 phone number validation.
 * Format: +<country code><number>, total length 6-15 digits.
 * For Bangladesh: +8801XXXXXXXXX (13 chars total).
 */
const e164PhoneRegex = /^\+[1-9]\d{5,14}$/;

/**
 * OTP token. Supabase generates 6-digit OTPs by default.
 */
const otpRegex = /^\d{6}$/;

/**
 * Full name. Allows letters (any script), spaces, hyphens, apostrophes,
 * and dots. 2-120 characters. Disallows digits and most punctuation to
 * reduce abuse surface.
 */
const fullNameRegex = /^[\p{L}\p{M}\s'.-]{2,120}$/u;

/**
 * Request body for POST /api/v1/auth/otp/request.
 */
export const otpRequestSchema = z.object({
  phone: z
    .string()
    .regex(e164PhoneRegex, 'Phone must be in E.164 format (e.g. +8801712345678)'),
});

export type OtpRequestInput = z.infer<typeof otpRequestSchema>;

/**
 * Request body for POST /api/v1/auth/otp/verify.
 * `fullName` is optional — required only on first login (when no Profile
 * row exists yet for this Supabase user).
 */
export const otpVerifySchema = z.object({
  phone: z
    .string()
    .regex(e164PhoneRegex, 'Phone must be in E.164 format'),
  token: z
    .string()
    .regex(otpRegex, 'OTP must be a 6-digit code'),
  fullName: z
    .string()
    .regex(fullNameRegex, 'Full name contains invalid characters')
    .optional(),
});

export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;

/**
 * Request body for PATCH /api/v1/users/me.
 * All fields optional. Phone is NOT updatable from this endpoint (it is the
 * identity anchor and must be changed via Supabase Auth's phone-change flow).
 */
export const updateProfileSchema = z.object({
  fullName: z
    .string()
    .regex(fullNameRegex, 'Full name contains invalid characters')
    .optional(),
  email: z
    .string()
    .email('Email must be a valid email address')
    .max(255)
    .optional()
    .nullable(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
