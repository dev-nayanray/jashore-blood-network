/**
 * Admin module foundation tests.
 *
 * Verifies dashboard metrics, user management authorization,
 * role-based access control, and audit-log creation.
 */

import { describe, it, expect, vi } from 'vitest';
import { AdminService } from '../src/admin/admin.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import type { PrismaClient } from '../src/lib/prisma';
import type { Role } from '@jbn/shared-types';

function createMockPrisma(overrides: Record<string, unknown> = {}): PrismaClient {
  return {
    profile: {
      count: vi.fn().mockResolvedValue(0),
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    donorProfile: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    bloodRequest: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    abuseReport: {
      count: vi.fn().mockResolvedValue(0),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
    userRole: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    upazila: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    ...overrides,
  } as unknown as PrismaClient;
}

const USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ADMIN_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const USER_ROLES: Role[] = ['REGISTERED_USER'];
const MODERATOR_ROLES: Role[] = ['REGISTERED_USER', 'MODERATOR'];
const DISTRICT_ADMIN_ROLES: Role[] = ['REGISTERED_USER', 'DISTRICT_ADMINISTRATOR'];

describe('AdminService — dashboard metrics', () => {
  it('returns real counts from the database (no fabricated data)', async () => {
    const prisma = createMockPrisma({
      profile: { count: vi.fn().mockResolvedValue(42) },
      donorProfile: {
        count: vi.fn().mockResolvedValue(15),
        findMany: vi.fn().mockResolvedValue([]),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      bloodRequest: {
        count: vi.fn().mockResolvedValue(7),
        findMany: vi.fn().mockResolvedValue([]),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      abuseReport: { count: vi.fn().mockResolvedValue(3) },
    });
    const service = new AdminService(prisma);

    const metrics = await service.getDashboardMetrics();

    expect(metrics.totalUsers).toBe(42);
    expect(metrics.totalDonors).toBe(15);
    expect(metrics.activeBloodRequests).toBe(7);
    expect(metrics.openAbuseReports).toBe(3);
  });

  it('does NOT count cancelled/expired/fulfilled as active requests', async () => {
    const prisma = createMockPrisma();
    const service = new AdminService(prisma);

    await service.getDashboardMetrics();

    // Verify bloodRequest.count was called with status filter excluding inactive statuses
    const countCalls = (prisma.bloodRequest.count as ReturnType<typeof vi.fn>).mock.calls;
    const activeCall = countCalls.find(
      (call: unknown[]) => (call[0] as { where?: { status?: { in: unknown[] } } })?.where?.status?.in,
    );
    expect(activeCall).toBeDefined();
    const activeStatuses = (activeCall![0] as { where: { status: { in: string[] } } }).where.status.in;
    expect(activeStatuses).not.toContain('CANCELLED');
    expect(activeStatuses).not.toContain('EXPIRED');
    expect(activeStatuses).not.toContain('COMPLETED');
    expect(activeStatuses).not.toContain('REJECTED');
  });
});

describe('AdminService — user suspension', () => {
  it('throws NotFoundException for non-existent user', async () => {
    const prisma = createMockPrisma();
    const service = new AdminService(prisma);

    await expect(
      service.suspendUser('nonexistent', ADMIN_ID, DISTRICT_ADMIN_ROLES, 'Spam'),
    ).rejects.toThrow(NotFoundException);
  });

  it('prevents self-suspension', async () => {
    const prisma = createMockPrisma({
      profile: { findUnique: vi.fn().mockResolvedValue({ id: ADMIN_ID }) },
    });
    const service = new AdminService(prisma);

    await expect(
      service.suspendUser(ADMIN_ID, ADMIN_ID, DISTRICT_ADMIN_ROLES, 'Test'),
    ).rejects.toThrow(BadRequestException);
  });

  it('requires a reason of at least 3 characters', async () => {
    const prisma = createMockPrisma();
    const service = new AdminService(prisma);

    await expect(
      service.suspendUser(USER_ID, ADMIN_ID, DISTRICT_ADMIN_ROLES, 'ab'),
    ).rejects.toThrow(BadRequestException);
  });

  it('prevents suspending users with equal or higher privileges', async () => {
    const prisma = createMockPrisma({
      profile: { findUnique: vi.fn().mockResolvedValue({ id: USER_ID }) },
      userRole: {
        findMany: vi.fn().mockResolvedValue([
          { role: 'DISTRICT_ADMINISTRATOR', revokedAt: null },
        ]),
      },
    });
    const service = new AdminService(prisma);

    // District admin (level 5) trying to suspend another district admin (level 5)
    await expect(
      service.suspendUser(USER_ID, ADMIN_ID, DISTRICT_ADMIN_ROLES, 'Test reason'),
    ).rejects.toThrow(BadRequestException);
  });

  it('suspends a lower-privilege user and audit-logs the action', async () => {
    const prisma = createMockPrisma({
      profile: {
        findUnique: vi.fn().mockResolvedValue({ id: USER_ID }),
        update: vi.fn().mockResolvedValue({}),
      },
      userRole: {
        findMany: vi.fn().mockResolvedValue([
          { role: 'REGISTERED_USER', revokedAt: null },
        ]),
      },
    });
    const service = new AdminService(prisma);

    const result = await service.suspendUser(USER_ID, ADMIN_ID, DISTRICT_ADMIN_ROLES, 'Spam activity');

    expect(result.success).toBe(true);
    expect(prisma.profile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: USER_ID },
        data: { isActive: false },
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: ADMIN_ID,
          action: 'USER_SUSPENDED',
          targetId: USER_ID,
        }),
      }),
    );
  });
});

describe('AdminService — user reinstatement', () => {
  it('throws NotFoundException for non-existent user', async () => {
    const prisma = createMockPrisma();
    const service = new AdminService(prisma);

    await expect(
      service.reinstateUser('nonexistent', ADMIN_ID, DISTRICT_ADMIN_ROLES),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException if user is already active', async () => {
    const prisma = createMockPrisma({
      profile: { findUnique: vi.fn().mockResolvedValue({ id: USER_ID, isActive: true }) },
    });
    const service = new AdminService(prisma);

    await expect(
      service.reinstateUser(USER_ID, ADMIN_ID, DISTRICT_ADMIN_ROLES),
    ).rejects.toThrow(BadRequestException);
  });

  it('reinstates a suspended user and audit-logs', async () => {
    const prisma = createMockPrisma({
      profile: {
        findUnique: vi.fn().mockResolvedValue({ id: USER_ID, isActive: false }),
        update: vi.fn().mockResolvedValue({}),
      },
    });
    const service = new AdminService(prisma);

    const result = await service.reinstateUser(USER_ID, ADMIN_ID, DISTRICT_ADMIN_ROLES, 'Resolved');

    expect(result.success).toBe(true);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'USER_REINSTATED',
        }),
      }),
    );
  });
});

describe('AdminService — audit logs', () => {
  it('returns audit logs with actor names', async () => {
    const prisma = createMockPrisma({
      auditLog: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'log-1',
            actorId: ADMIN_ID,
            actor: { fullName: 'Admin User' },
            action: 'USER_SUSPENDED',
            targetType: 'profile',
            targetId: USER_ID,
            metadata: { reason: 'Spam' },
            ipAddress: '127.0.0.1',
            createdAt: new Date(),
          },
        ]),
      },
    });
    const service = new AdminService(prisma);

    const result = await service.listAuditLogs();

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.actorName).toBe('Admin User');
    expect(result.items[0]!.action).toBe('USER_SUSPENDED');
  });

  it('filters by action, actorId, and targetType', async () => {
    const prisma = createMockPrisma();
    const service = new AdminService(prisma);

    await service.listAuditLogs('SUSPENDED', ADMIN_ID, 'profile');

    const findManyCall = (prisma.auditLog.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(findManyCall?.where?.action?.contains).toBe('SUSPENDED');
    expect(findManyCall?.where?.actorId).toBe(ADMIN_ID);
    expect(findManyCall?.where?.targetType).toBe('profile');
  });
});

describe('AdminService — analytics', () => {
  it('returns aggregated data (no individual records)', async () => {
    const prisma = createMockPrisma({
      bloodRequest: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
        groupBy: vi.fn().mockResolvedValue([
          { bloodGroup: 'O_POSITIVE', _count: { _all: 5 } },
          { bloodGroup: 'A_POSITIVE', _count: { _all: 3 } },
        ]),
      },
      donorProfile: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
        groupBy: vi.fn().mockResolvedValue([
          { bloodGroup: 'O_POSITIVE', _count: { _all: 10 } },
        ]),
      },
      upazila: { findMany: vi.fn().mockResolvedValue([]) },
    });
    const service = new AdminService(prisma);

    const analytics = await service.getAnalytics();

    expect(analytics.requestsByBloodGroup).toHaveLength(2);
    expect(analytics.requestsByBloodGroup[0]!.bloodGroup).toBe('O_POSITIVE');
    expect(analytics.requestsByBloodGroup[0]!.count).toBe(5);
    expect(analytics.donorsByBloodGroup[0]!.count).toBe(10);
  });
});
