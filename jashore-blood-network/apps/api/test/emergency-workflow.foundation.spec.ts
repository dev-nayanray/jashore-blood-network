/**
 * Emergency workflow foundation tests (Phase 13).
 *
 * Verifies notification cancellation, emergency coordination endpoint,
 * and integration with the blood request lifecycle.
 */

import { describe, it, expect, vi } from 'vitest';
import { NotificationsService } from '../src/notifications/notifications.service';
import { AdminService } from '../src/admin/admin.service';
import type { PrismaClient } from '../src/lib/prisma';
import type { EmailProvider } from '../src/notifications/email/email-provider.interface';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

function createMockNotificationPrisma(overrides: Record<string, Record<string, unknown>> = {}): PrismaClient {
  return {
    notification: {
      create: vi.fn().mockResolvedValue({ id: 'n1' }),
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    notificationPreference: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({}),
    },
    notificationDeliveryAttempt: {
      create: vi.fn().mockResolvedValue({}),
    },
    donorProfile: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    profile: {
      findUnique: vi.fn().mockResolvedValue({ email: 'test@test.com' }),
    },
    bloodRequest: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    abuseReport: { count: vi.fn().mockResolvedValue(0) },
    upazila: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn().mockResolvedValue(null) },
    userRole: { findMany: vi.fn().mockResolvedValue([]) },
    auditLog: { create: vi.fn().mockResolvedValue({}), count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
    hospital: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
    ...overrides,
  } as unknown as PrismaClient;
}

const mockEmailProvider: EmailProvider = {
  send: vi.fn().mockResolvedValue({ success: true }),
};
const mockConfig = { get: vi.fn().mockReturnValue('noreply@test.com') };

// ---------------------------------------------------------------------------
// NotificationsService — cancelPendingNotifications
// ---------------------------------------------------------------------------

describe('NotificationsService — cancelPendingNotifications', () => {
  it('marks all unread REQUEST_MATCH notifications for the request as read', async () => {
    const prisma = createMockNotificationPrisma({
      notification: {
        updateMany: vi.fn().mockResolvedValue({ count: 5 }),
        create: vi.fn().mockResolvedValue({}),
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
        groupBy: vi.fn().mockResolvedValue([]),
      },
    });
    const service = new NotificationsService(prisma, mockEmailProvider, mockConfig as never);

    const result = await service.cancelPendingNotifications('req-1', 'Request cancelled');

    expect(result.cancelled).toBe(5);
    const updateCall = (prisma.notification.updateMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(updateCall.where.type).toBe('REQUEST_MATCH');
    expect(updateCall.where.relatedId).toBe('req-1');
    expect(updateCall.where.isRead).toBe(false);
    expect(updateCall.data.isRead).toBe(true);
    expect(updateCall.data.readAt).toBeInstanceOf(Date);
  });

  it('returns 0 when no pending notifications exist', async () => {
    const prisma = createMockNotificationPrisma({
      notification: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue({}),
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
        groupBy: vi.fn().mockResolvedValue([]),
      },
    });
    const service = new NotificationsService(prisma, mockEmailProvider, mockConfig as never);

    const result = await service.cancelPendingNotifications('req-1', 'Request completed');

    expect(result.cancelled).toBe(0);
  });

  it('stores cancellation reason in metadata', async () => {
    const prisma = createMockNotificationPrisma({
      notification: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn().mockResolvedValue({}),
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
        groupBy: vi.fn().mockResolvedValue([]),
      },
    });
    const service = new NotificationsService(prisma, mockEmailProvider, mockConfig as never);

    await service.cancelPendingNotifications('req-1', 'Request expired');

    const updateCall = (prisma.notification.updateMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(updateCall.data.metadata).toHaveProperty('cancelledReason');
    expect((updateCall.data.metadata as { cancelledReason: string }).cancelledReason).toBe('Request expired');
  });
});

// ---------------------------------------------------------------------------
// AdminService — listEmergencyRequests
// ---------------------------------------------------------------------------

describe('AdminService — listEmergencyRequests', () => {
  it('returns only URGENT requests with active statuses', async () => {
    const prisma = createMockNotificationPrisma({
      bloodRequest: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'r1',
            requesterId: 'u1',
            patientDisplayName: 'Patient A',
            bloodGroup: 'O_POSITIVE',
            bloodComponent: null,
            unitsRequested: 2,
            upazilaId: 'u1',
            hospitalId: null,
            hospitalName: 'Jashore General',
            requiredBy: new Date('2026-12-01'),
            urgency: 'URGENT',
            contactMethod: 'IN_APP',
            contactNote: null,
            notes: null,
            status: 'SEARCHING',
            expiresAt: new Date('2026-12-02'),
            verificationNote: null,
            verifiedBy: null,
            verifiedAt: null,
            cancelledAt: null,
            cancellationReason: null,
            createdAt: new Date('2026-10-26T09:00:00Z'),
            updatedAt: new Date('2026-10-26T09:05:00Z'),
            deletedAt: null,
            requester: { fullName: 'Test User' },
            upazila: { name: 'Jashore Sadar' },
          },
        ]),
        count: vi.fn().mockResolvedValue(0),
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      notification: {
        groupBy: vi.fn().mockResolvedValue([
          { relatedId: 'r1', _count: { _all: 7 } },
        ]),
        create: vi.fn().mockResolvedValue({}),
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    });
    const service = new AdminService(prisma);

    const result = await service.listEmergencyRequests();

    expect(result).toHaveLength(1);
    expect(result[0]!.urgency).toBe('URGENT');
    expect(result[0]!.notificationCount).toBe(7);
    expect(result[0]!.ageMinutes).toBeGreaterThanOrEqual(0);

    // Verify the query filters by urgency = URGENT and active statuses
    const findManyCall = (prisma.bloodRequest.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(findManyCall.where.urgency).toBe('URGENT');
    const activeStatuses = findManyCall.where.status.in;
    expect(activeStatuses).not.toContain('CANCELLED');
    expect(activeStatuses).not.toContain('EXPIRED');
    expect(activeStatuses).not.toContain('COMPLETED');
    expect(activeStatuses).not.toContain('REJECTED');
  });

  it('returns empty array when no urgent active requests exist', async () => {
    const prisma = createMockNotificationPrisma({
      bloodRequest: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
        groupBy: vi.fn().mockResolvedValue([]),
      },
    });
    const service = new AdminService(prisma);

    const result = await service.listEmergencyRequests();

    expect(result).toEqual([]);
  });

  it('includes ageMinutes calculated from createdAt', async () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const prisma = createMockNotificationPrisma({
      bloodRequest: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'r1',
            requesterId: 'u1',
            patientDisplayName: null,
            bloodGroup: 'A_POSITIVE',
            bloodComponent: null,
            unitsRequested: 1,
            upazilaId: 'u1',
            hospitalId: null,
            hospitalName: null,
            requiredBy: new Date(),
            urgency: 'URGENT',
            contactMethod: 'IN_APP',
            contactNote: null,
            notes: null,
            status: 'PENDING',
            expiresAt: new Date(),
            verificationNote: null,
            verifiedBy: null,
            verifiedAt: null,
            cancelledAt: null,
            cancellationReason: null,
            createdAt: fiveMinutesAgo,
            updatedAt: fiveMinutesAgo,
            deletedAt: null,
            requester: { fullName: 'User' },
            upazila: { name: 'Sadar' },
          },
        ]),
        count: vi.fn().mockResolvedValue(0),
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      notification: {
        groupBy: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({}),
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    });
    const service = new AdminService(prisma);

    const result = await service.listEmergencyRequests();

    expect(result[0]!.ageMinutes).toBeGreaterThanOrEqual(4);
    expect(result[0]!.ageMinutes).toBeLessThan(10);
  });

  it('sorts PENDING requests first (needs verification)', async () => {
    const prisma = createMockNotificationPrisma({
      bloodRequest: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
        groupBy: vi.fn().mockResolvedValue([]),
      },
    });
    const service = new AdminService(prisma);

    await service.listEmergencyRequests();

    const findManyCall = (prisma.bloodRequest.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(findManyCall.orderBy[0]).toEqual({ status: 'asc' }); // PENDING sorts first
    expect(findManyCall.orderBy[1]).toEqual({ createdAt: 'desc' });
  });
});
