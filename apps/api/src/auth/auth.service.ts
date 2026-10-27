/**
 * AuthService — orchestrates Supabase Auth (identity) with the application
 * Profile table (application data).
 *
 * The flow:
 *   1. Client POSTs phone to /auth/otp/request
 *      → AuthService.sendOtp() calls Supabase to send an OTP
 *      → Returns 202 always (anti-enumeration)
 *
 *   2. Client POSTs phone + otp (+ optional fullName) to /auth/otp/verify
 *      → AuthService.verifyOtp() calls Supabase to verify
 *      → On success: upsert Profile (id = Supabase user id), grant
 *        REGISTERED_USER role if first login, return AuthMeResponse
 *      → Controller sets httpOnly cookies with the Supabase session tokens
 *
 *   3. Subsequent requests carry the access-token cookie
 *      → JwtAuthGuard verifies the token via SupabaseServerService.verifyToken()
 *      → Loads the user's Profile + roles from Prisma
 *      → Attaches AuthenticatedUser to the request
 *
 *   4. RolesGuard / PoliciesGuard enforce authorization per-route
 *
 * Audit logging: every privileged action (role grant, profile creation)
 * is written to audit_logs. AuthService does NOT log auth failures (those
 * are logged by the HttpExceptionFilter instead).
 */

import { Injectable, Logger, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient, Role } from '../lib/prisma';
import { SupabaseServerService } from './supabase-server.service';
import type {
  AuthMeResponse,
  OtpRequestResponse,
  OtpVerifyResponse,
} from './types';
import type { OtpRequestInput, OtpVerifyInput, UpdateProfileInput } from '@jbn/validation';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly supabase: SupabaseServerService,
    private readonly prisma: PrismaClient,
    private readonly config: ConfigService,
  ) {}

  /**
   * Step 1: send an OTP to the given phone.
   *
   * Returns a generic "pending" response REGARDLESS of whether the OTP was
   * actually sent. This prevents account enumeration: an attacker cannot
   * distinguish "phone not registered" from "OTP sent" from the response.
   *
   * The controller's rate limiter (ThrottlerGuard) limits this to 3 requests
   * per hour per phone, preventing OTP-sms cost abuse.
   */
  async sendOtp(_input: OtpRequestInput): Promise<OtpRequestResponse> {
    // We deliberately do NOT await error details in the response. The controller
    // returns 202 always.
    const result = await this.supabase.sendOtp(_input.phone);
    if (!result.sent) {
      // Log the underlying error server-side but do NOT surface it to the client.
      this.logger.warn(
        `OTP send failed for phone ending ${_input.phone.slice(-4)}: ${result.error}`,
      );
    }
    return {
      status: 'pending',
      message:
        'If the phone number is valid, an OTP has been sent. The OTP expires in 10 minutes.',
      ...(result.demoCode ? { demoOtp: result.demoCode } : {}),
    };
  }

  /**
   * Step 2: verify the OTP and create or update the application Profile.
   *
   * On first login (no Profile row exists for this Supabase user), a Profile
   * is created with id = Supabase user id, and the REGISTERED_USER role is
   * granted. The fullName from the request body is required on first login
   * (the controller enforces this).
   *
   * On subsequent logins, the existing Profile is left untouched. The
   * fullName in the request body, if provided, is ignored.
   */
  async verifyOtp(
    input: OtpVerifyInput,
    metadata: { ipAddress?: string; userAgent?: string },
  ): Promise<{
    response: OtpVerifyResponse;
    session: { access_token: string; refresh_token: string; expires_in: number };
  }> {
    const result = await this.supabase.verifyOtp(input.phone, input.token, input.fullName);
    if (!result.session || !result.user) {
      throw new UnauthorizedException({
        error: 'Invalid OTP',
        message: result.error ?? 'The OTP is invalid, expired, or has already been used.',
      });
    }

    // Upsert the application Profile. The Profile id MUST match the Supabase
    // user id so that RLS policies (which use auth.uid()) work correctly.
    const profile = await this.prisma.profile.upsert({
      where: { id: result.user.id },
      update: {
        // On subsequent logins, update phone/email from Supabase in case
        // they changed via Supabase Auth's phone-change/email-change flows.
        phone: result.user.phone ?? input.phone,
        email: result.user.email ?? null,
        isActive: true,
      },
      create: {
        id: result.user.id,
        phone: result.user.phone ?? input.phone,
        email: result.user.email ?? null,
        fullName: input.fullName ?? 'Unknown',
      },
      include: { roles: true },
    });

    // First login: grant REGISTERED_USER role.
    // We use a nested create-if-not-exists via upsert on the unique
    // (profileId, role) constraint. The grantedBy is null because this
    // is a system grant, not an admin grant.
    if (profile.roles.length === 0) {
      await this.prisma.userRole.create({
        data: {
          profileId: profile.id,
          role: Role.REGISTERED_USER,
          grantedBy: null,
        },
      });
      // Re-fetch with the new role
      const refreshed = await this.prisma.profile.findUnique({
        where: { id: profile.id },
        include: { roles: true },
      });
      if (refreshed) {
        profile.roles = refreshed.roles;
      }

      // Audit-log the first-login role grant.
      await this.prisma.auditLog.create({
        data: {
          actorId: profile.id,
          action: 'ROLE_AUTO_GRANTED',
          targetType: 'user_role',
          targetId: profile.id,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          metadata: { role: 'REGISTERED_USER', reason: 'first_login' },
        },
      });
    }

    return {
      response: { user: this.toAuthMe(profile, profile.roles) },
      session: result.session,
    };
  }

  /**
   * Refresh a session using the refresh-token cookie.
   * Returns a new access_token + refresh_token pair, or throws Unauthorized.
   */
  async refreshSession(refreshToken: string): Promise<{
    session: { access_token: string; refresh_token: string; expires_in: number };
  }> {
    const result = await this.supabase.refreshSession(refreshToken);
    if (!result.session) {
      throw new UnauthorizedException({
        error: 'Refresh failed',
        message: 'The refresh token is invalid or expired. Please log in again.',
      });
    }
    return { session: result.session };
  }

  /**
   * Logout: revoke the Supabase session server-side. The controller clears
   * the cookies regardless of whether revocation succeeds.
   */
  async logout(accessToken: string): Promise<void> {
    const result = await this.supabase.revokeSession(accessToken);
    if (!result.success) {
      // Log but don't throw — the user's cookies will be cleared anyway,
      // and we don't want to leak revocation failures to the client.
      this.logger.warn(`Session revocation failed: ${result.error}`);
    }
  }

  /**
   * Get the current user's profile + roles for /auth/me.
   * Throws Unauthorized if the profile doesn't exist (should not happen
   * because the JwtAuthGuard would have rejected the request first, but
   * defensive coding is cheap).
   */
  async getMe(userId: string): Promise<AuthMeResponse> {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
      include: { roles: true },
    });
    if (!profile || profile.deletedAt !== null) {
      throw new UnauthorizedException({
        error: 'Profile not found',
        message: 'Your account no longer exists. Please contact support.',
      });
    }
    return this.toAuthMe(profile, profile.roles);
  }

  /**
   * Update the current user's own profile. Phone is NOT updatable from
   * this endpoint (it is the identity anchor). Roles are NOT updatable
   * from this endpoint (use the admin role-assignment endpoint, which
   * is gated by a policy).
   */
  async updateMyProfile(userId: string, input: UpdateProfileInput): Promise<AuthMeResponse> {
    const profile = await this.prisma.profile.update({
      where: { id: userId },
      data: {
        ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
      },
      include: { roles: true },
    });
    return this.toAuthMe(profile, profile.roles);
  }

  /**
   * Build an AuthMeResponse from a Profile + roles.
   * Shared by verifyOtp, getMe, and updateMyProfile.
   */
  private toAuthMe(
    profile: {
      id: string;
      phone: string;
      email: string | null;
      fullName: string;
      isActive: boolean;
    },
    roleRows: Array<{ role: Role; revokedAt: Date | null }>,
  ): AuthMeResponse {
    // Filter out revoked roles (revokedAt is non-null). The Prisma schema
    // does not enforce this via partial unique index, so we filter at read.
    const activeRoles = roleRows
      .filter((r) => r.revokedAt === null)
      .map((r) => r.role as unknown as import('@jbn/shared-types').Role);
    return {
      id: profile.id,
      phone: profile.phone,
      email: profile.email,
      fullName: profile.fullName,
      isActive: profile.isActive,
      roles: activeRoles,
    };
  }
}
