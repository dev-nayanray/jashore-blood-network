/**
 * UsersService — own-profile management.
 *
 * CRITICAL: this service does NOT support role changes. Role assignment
 * is performed only by the admin role-assignment endpoint (Phase 7+) which
 * is gated by an AssignRolePolicy that enforces the role hierarchy.
 *
 * Phone is NOT updatable from this service — it is the identity anchor and
 * must be changed via Supabase Auth's phone-change flow.
 */

import { Injectable } from '@nestjs/common';
import { PrismaClient } from '../lib/prisma';
import type { AuthMeResponse } from '../auth/types';
import type { UpdateProfileInput } from '@jbn/validation';

@Injectable()
export class UsersService {
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
}
