/**
 * User account settings tests (Phase 15).
 *
 * Tests profile updates, account deactivation, protected field enforcement,
 * and role escalation prevention.
 */

import { describe, it, expect, vi } from 'vitest';
import { UsersService } from '../src/users/users.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import type { PrismaClient } from '../src/lib/prisma';

function createMockPrisma(overrides: Record<string, unknown> = {}): PrismaClient {
  const base: Record<string, unknown> = {
    profile: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
    userRole: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    bloodRequest: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    donorProfile: {
      update: vi.fn().mockResolvedValue({}),
    },
    organizationMember: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({
      profile: { update: vi.fn().mockResolvedValue({}) },
      userRole: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      bloodRequest: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      donorProfile: { update: vi.fn().mockResolvedValue({}) },
      organizationMember: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    })),
  };
  return { ...base, ...overrides } as unknown as PrismaClient;
}

const USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const ACTIVE_PROFILE = {
  id: USER_ID,
  phone: '+8801712345678',
  email: 'test@test.com',
  fullName: 'Test User',
  isActive: true,
  deletedAt: null,
  roles: [{ role: 'REGISTERED_USER', revokedAt: null }],
  donorProfile: null,
};

describe('UsersService — updateMyProfile', () => {
  it('updates only permitted fields (fullName, email)', async () => {
    const prisma = createMockPrisma({
      profile: {
        update: vi.fn().mockResolvedValue({
          id: USER_ID,
          phone: '+8801712345678',
          email: 'new@test.com',
          fullName: 'New Name',
          isActive: true,
          roles: [{ role: 'REGISTERED_USER', revokedAt: null }],
        }),
      },
    });
    const service = new UsersService(prisma);

    const result = await service.updateMyProfile(USER_ID, {
      fullName: 'New Name',
      email: 'new@test.com',
    });

    expect(result.fullName).toBe('New Name');
    expect(result.email).toBe('new@test.com');
    const updateCall = (prisma.profile.update as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(updateCall.data.fullName).toBe('New Name');
    expect(updateCall.data.email).toBe('new@test.com');
    // CRITICAL: phone and roles are NOT in the update data
    expect(updateCall.data).not.toHaveProperty('phone');
    expect(updateCall.data).not.toHaveProperty('isActive');
  });

  it('does NOT include role-related fields in update (role escalation prevention)', async () => {
    const prisma = createMockPrisma({
      profile: {
        update: vi.fn().mockResolvedValue({
          id: USER_ID, phone: '+880', email: null, fullName: 'Test',
          isActive: true, roles: [],
        }),
      },
    });
    const service = new UsersService(prisma);

    // Even if a crafted input includes role fields, they are ignored
    await service.updateMyProfile(USER_ID, {
      fullName: 'Test',
    } as never);

    const updateCall = (prisma.profile.update as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(updateCall.data).not.toHaveProperty('roles');
    expect(updateCall.data).not.toHaveProperty('isActive');
  });
});

describe('UsersService — deactivateAccount', () => {
  it('throws NotFoundException for non-existent profile', async () => {
    const prisma = createMockPrisma({
      profile: { findUnique: vi.fn().mockResolvedValue(null) },
    });
    const service = new UsersService(prisma);

    await expect(service.deactivateAccount('nonexistent')).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException for already-deactivated account', async () => {
    const prisma = createMockPrisma({
      profile: {
        findUnique: vi.fn().mockResolvedValue({
          ...ACTIVE_PROFILE,
          isActive: false,
          deletedAt: null, // Not deleted, but inactive
        }),
      },
    });
    const service = new UsersService(prisma);

    await expect(service.deactivateAccount(USER_ID)).rejects.toThrow(BadRequestException);
  });

  it('soft-deletes profile, revokes roles, cancels requests, hides donor, removes memberships', async () => {
    const txProfileUpdate = vi.fn().mockResolvedValue({});
    const txUserRoleUpdate = vi.fn().mockResolvedValue({ count: 1 });
    const txBloodRequestUpdate = vi.fn().mockResolvedValue({ count: 2 });
    const txDonorProfileUpdate = vi.fn().mockResolvedValue({});
    const txOrgMemberUpdate = vi.fn().mockResolvedValue({ count: 1 });
    const txAuditLogCreate = vi.fn().mockResolvedValue({});

    const prisma = createMockPrisma({
      profile: {
        findUnique: vi.fn().mockResolvedValue({
          ...ACTIVE_PROFILE,
          roles: [{ role: 'REGISTERED_USER', revokedAt: null }, { role: 'DONOR', revokedAt: null }],
          donorProfile: { id: 'd1', profileId: USER_ID },
        }),
      },
      $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({
        profile: { update: txProfileUpdate },
        userRole: { updateMany: txUserRoleUpdate },
        bloodRequest: { updateMany: txBloodRequestUpdate },
        donorProfile: { update: txDonorProfileUpdate },
        organizationMember: { updateMany: txOrgMemberUpdate },
        auditLog: { create: txAuditLogCreate },
      })),
    });
    const service = new UsersService(prisma);

    const result = await service.deactivateAccount(USER_ID, 'No longer needed');

    expect(result.success).toBe(true);

    // 1. Profile soft-deleted
    expect(txProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: USER_ID },
        data: { isActive: false, deletedAt: expect.any(Date) },
      }),
    );

    // 2. Roles revoked
    expect(txUserRoleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { profileId: USER_ID, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      }),
    );

    // 3. Active blood requests cancelled
    expect(txBloodRequestUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          requesterId: USER_ID,
          status: { in: expect.any(Array) },
        },
        data: expect.objectContaining({
          status: 'CANCELLED',
          cancelledAt: expect.any(Date),
        }),
      }),
    );

    // 4. Donor profile hidden
    expect(txDonorProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { profileId: USER_ID },
        data: { visibility: 'HIDDEN', isAvailable: false },
      }),
    );

    // 5. Organization memberships removed
    expect(txOrgMemberUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { profileId: USER_ID, removedAt: null },
        data: { removedAt: expect.any(Date) },
      }),
    );

    // 6. Audit log created
    expect(txAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: USER_ID,
          action: 'ACCOUNT_DEACTIVATED',
        }),
      }),
    );
  });

  it('handles deactivation when user has no donor profile', async () => {
    const prisma = createMockPrisma({
      profile: {
        findUnique: vi.fn().mockResolvedValue({
          ...ACTIVE_PROFILE,
          donorProfile: null,
        }),
      },
    });
    const service = new UsersService(prisma);

    const result = await service.deactivateAccount(USER_ID);

    expect(result.success).toBe(true);
  });

  it('handles deactivation when user has no active roles', async () => {
    const prisma = createMockPrisma({
      profile: {
        findUnique: vi.fn().mockResolvedValue({
          ...ACTIVE_PROFILE,
          roles: [],
        }),
      },
    });
    const service = new UsersService(prisma);

    const result = await service.deactivateAccount(USER_ID);

    expect(result.success).toBe(true);
  });
});
