/**
 * UsersService — own-profile management + account deactivation.
 *
 * CRITICAL: this service does NOT support role changes. Role assignment
 * is performed only by the admin role-assignment endpoint (Phase 7+) which
 * is gated by an AssignRolePolicy that enforces the role hierarchy.
 *
 * Phone is NOT updatable from this service — it is the identity anchor and
 * must be changed via Supabase Auth's phone-change flow.
 *
 * Account deactivation (Phase 15):
 *   - Soft-deletes the profile (sets deletedAt = now(), isActive = false)
 *   - Revokes all active roles
 *   - Cancels active blood requests
 *   - Hides donor profile (visibility = HIDDEN, isAvailable = false)
 *   - Removes organization memberships
 *   - Preserves audit logs and consent records (legal retention)
 *   - NOT instant deletion — audit trail and legal records retained
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '../lib/prisma';
import type { AuthMeResponse } from '../auth/types';
import type { UpdateProfileInput } from '@jbn/validation';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Update the authenticated user's own profile.
   * Phone and roles are NOT updatable from this method.
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
    const activeRoles = profile.roles
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

  /**
   * Deactivate the authenticated user's account.
   *
   * This is a SOFT DELETE — the profile row is preserved with deletedAt set.
   * The user's data is not erased immediately:
   *   - Audit logs are preserved (legal/operational retention)
   *   - Consent records are preserved (legal record of consent)
   *   - Blood request history is preserved (anonymized after 1 year per retention policy)
   *   - Notification history is retained for 30 days then purged
   *
   * Actions taken:
   *   1. Set profile.isActive = false, deletedAt = now()
   *   2. Revoke all active roles (set revokedAt = now())
   *   3. Cancel active blood requests (status = CANCELLED)
   *   4. Hide donor profile (visibility = HIDDEN, isAvailable = false)
   *   5. Remove organization memberships (set removedAt = now())
   *   6. Audit-log the deactivation
   *
   * The user's session is invalidated by JwtAuthGuard (which checks isActive
   * and deletedAt on every request).
   *
   * @param userId The authenticated user's profile ID
   * @param reason Optional user-provided reason for deactivation
   * @returns Confirmation object
   */
  async deactivateAccount(
    userId: string,
    reason?: string,
  ): Promise<{ success: boolean; message: string }> {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
      include: {
        roles: { where: { revokedAt: null } },
        donorProfile: true,
      },
    });

    if (!profile || profile.deletedAt !== null) {
      throw new NotFoundException({ error: 'Profile not found' });
    }

    if (!profile.isActive) {
      throw new BadRequestException({
        error: 'Already deactivated',
        message: 'This account is already deactivated.',
      });
    }

    // Execute deactivation in a transaction for consistency
    await this.prisma.$transaction(async (tx) => {
      // 1. Soft-delete the profile
      await tx.profile.update({
        where: { id: userId },
        data: {
          isActive: false,
          deletedAt: new Date(),
        },
      });

      // 2. Revoke all active roles
      if (profile.roles.length > 0) {
        await tx.userRole.updateMany({
          where: { profileId: userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      // 3. Cancel active blood requests
      await tx.bloodRequest.updateMany({
        where: {
          requesterId: userId,
          status: { in: ['PENDING', 'VERIFIED', 'SEARCHING', 'DONOR_RESPONDED', 'ARRANGED'] as never },
        },
        data: {
          status: 'CANCELLED' as never,
          cancelledAt: new Date(),
          cancellationReason: 'Account deactivated by user',
        },
      });

      // 4. Hide donor profile if it exists
      if (profile.donorProfile) {
        await tx.donorProfile.update({
          where: { profileId: userId },
          data: {
            visibility: 'HIDDEN' as never,
            isAvailable: false,
          },
        });
      }

      // 5. Remove organization memberships
      await tx.organizationMember.updateMany({
        where: { profileId: userId, removedAt: null },
        data: { removedAt: new Date() },
      });

      // 6. Audit-log the deactivation
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'ACCOUNT_DEACTIVATED',
          targetType: 'profile',
          targetId: userId,
          metadata: { reason: reason ?? 'User-initiated deactivation' },
        },
      });
    });

    this.logger.log(`Account ${userId} deactivated by user`);

    return {
      success: true,
      message:
        'Your account has been deactivated. Your data will be retained per our retention policy. You will be signed out shortly.',
    };
  }
}
