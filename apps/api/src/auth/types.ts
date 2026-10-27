/**
 * Auth DTOs and types shared between controllers, services, and tests.
 *
 * All validation is done with Zod schemas in @jbn/validation — these
 * interfaces are for TypeScript ergonomics only.
 */

import type { Role } from '@jbn/shared-types' with { 'resolution-mode': 'import' };
import type { HealthStatus } from '@jbn/shared-types' with { 'resolution-mode': 'import' };

/**
 * The authenticated user object attached to the request by JwtAuthGuard.
 * Guards and policies downstream can rely on `id` being a valid UUID that
 * matches `profiles.id` (which mirrors `auth.users.id` in Supabase).
 */
export interface AuthenticatedUser {
  id: string;
  phone?: string;
  email?: string;
  roles: Role[];
}

/**
 * Response shape for /auth/me and /auth/otp/verify.
 * PII (phone, email) is included because the caller is the authenticated
 * user themselves. NEVER return this shape to other users.
 */
export interface AuthMeResponse {
  id: string;
  phone?: string;
  email?: string | null;
  fullName: string;
  isActive: boolean;
  roles: Role[];
}

/**
 * Response shape for /auth/otp/request.
 * Always 202 with this shape, regardless of whether the phone is registered,
 * to prevent account enumeration.
 */
export interface OtpRequestResponse {
  status: 'pending';
  message: string;
}

/**
 * Response shape for /auth/otp/verify on success.
 */
export interface OtpVerifyResponse {
  user: AuthMeResponse;
}

/**
 * Cookie names used for session management.
 * The access-token cookie is short-lived; the refresh-token cookie is
 * path-restricted to /api/v1/auth and is long-lived.
 */
export const COOKIE_NAMES = {
  accessToken: 'jbn_access_token',
  refreshToken: 'jbn_refresh_token',
} as const;

/**
 * Cookie options. The access-token cookie is readable by the backend only
 * (httpOnly), secure in production (Secure), and SameSite=Lax to allow
 * top-level navigation while preventing CSRF from cross-site forms.
 *
 * The refresh-token cookie is path-restricted to /api/v1/auth so that it
 * is sent ONLY to auth-refresh and auth-logout endpoints — not on every
 * request.
 */
export const ACCESS_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60, // 1 hour (matches Supabase access token lifetime)
};

export const REFRESH_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/v1/auth', // sent only to auth endpoints
  maxAge: 60 * 60 * 24 * 7, // 7 days
};

/**
 * Result of an auth operation. Used so the controller can build a uniform
 * response shape without leaking internal error details.
 */
export type AuthResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: AuthErrorReason };

export type AuthErrorReason =
  | 'invalid_credentials'
  | 'expired_token'
  | 'revoked_session'
  | 'rate_limited'
  | 'profile_not_found'
  | 'internal_error';

// Re-export for callers that want HealthStatus alongside auth types
export type { HealthStatus };
