/**
 * Notifications foundation tests.
 *
 * Verifies blood group compatibility, donor matching, idempotent
 * notification creation, preference management, and authorization.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  getCompatibleDonorGroups,
  getCompatibleRecipientGroups,
} from '../src/notifications/blood-group-compatibility';
import { NotificationsService } from '../src/notifications/notifications.service';
import type { PrismaClient } from '../src/lib/prisma';
import type { EmailProvider } from '../src/notifications/email/email-provider.interface';

// ---------------------------------------------------------------------------
// Blood group compatibility tests
// ---------------------------------------------------------------------------

describe('Blood group compatibility', () => {
  it('O- can donate to all 8 groups (universal donor)', () => {
    const recipients = getCompatibleRecipientGroups('O_NEGATIVE');
    expect(recipients).toHaveLength(8);
  });

  it('O+ recipients can receive from O+ and O- only', () => {
    const donors = getCompatibleDonorGroups('O_POSITIVE');
    expect(donors).toEqual(expect.arrayContaining(['O_POSITIVE', 'O_NEGATIVE']));
    expect(donors).toHaveLength(2);
  });

  it('AB+ can receive from all 8 groups (universal recipient)', () => {
    const donors = getCompatibleDonorGroups('AB_POSITIVE');
    expect(donors).toHaveLength(8);
  });

  it('A- recipients can receive from A- and O- only', () => {
    const donors = getCompatibleDonorGroups('A_NEGATIVE');
    expect(donors).toEqual(expect.arrayContaining(['A_NEGATIVE', 'O_NEGATIVE']));
    expect(donors).toHaveLength(2);
  });

  it('B+ recipients can receive from B+, B-, O+, O-', () => {
    const donors = getCompatibleDonorGroups('B_POSITIVE');
    expect(donors).toHaveLength(4);
    expect(donors).toEqual(
      expect.arrayContaining(['B_POSITIVE', 'B_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE']),
    );
  });
});

// ---------------------------------------------------------------------------
// NotificationsService tests
// ---------------------------------------------------------------------------

function createMockPrisma(overrides: Record<string, unknown> = {}): PrismaClient {
  return {
    notification: {
      create: vi.fn().mockResolvedValue({ id: 'notif-1' }),
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
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
    },
    profile: {
      findUnique: vi.fn().mockResolvedValue({ email: 'test@test.com' }),
    },
    ...overrides,
  } as unknown as PrismaClient;
}

const mockEmailProvider: EmailProvider = {
  send: vi.fn().mockResolvedValue({ success: true, providerMessageId: 'test-id' }),
};

const mockConfig = { get: vi.fn().mockReturnValue('noreply@test.com') };

describe('NotificationsService — donor matching', () => {
  it('finds eligible donors and creates notifications', async () => {
    const prisma = createMockPrisma({
      donorProfile: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'donor-1',
            profileId: 'profile-1',
            bloodGroup: 'O_POSITIVE',
            upazilaId: 'upazila-1',
            profile: {
              id: 'profile-1',
              notificationPreferences: {
                emailEnabled: false,
                quietHoursStart: null,
                quietHoursEnd: null,
              },
            },
          },
        ]),
      },
    });
    const service = new NotificationsService(
      prisma,
      mockEmailProvider,
      mockConfig as never,
    );

    const count = await service.notifyMatchingDonors(
      'req-1',
      'O_POSITIVE' as never,
      'upazila-1',
      'NORMAL',
      'Patient X',
      'Jashore General',
    );

    expect(count).toBe(1);
    expect(prisma.notification.create).toHaveBeenCalled();
  });

  it('does not create duplicate notifications (idempotency)', async () => {
    const { Prisma } = await import('../src/lib/prisma');
    const prisma = createMockPrisma({
      donorProfile: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'donor-1',
            profileId: 'profile-1',
            bloodGroup: 'O_POSITIVE',
            upazilaId: 'upazila-1',
            profile: {
              id: 'profile-1',
              notificationPreferences: null,
            },
          },
        ]),
      },
      notification: {
        create: vi.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('unique constraint', {
            code: 'P2002',
            clientVersion: '5.22.0',
          }),
        ),
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    });
    const service = new NotificationsService(
      prisma,
      mockEmailProvider,
      mockConfig as never,
    );

    const count = await service.notifyMatchingDonors(
      'req-1',
      'O_POSITIVE' as never,
      'upazila-1',
      'NORMAL',
      null,
      null,
    );

    // Idempotent — the duplicate is silently skipped
    expect(count).toBe(0);
  });

  it('filters out donors in quiet hours', async () => {
    // Set current hour to 23 (11pm) and quiet hours 22-6
    const originalDate = global.Date;
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-26T23:00:00Z'));

    const prisma = createMockPrisma({
      donorProfile: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'donor-1',
            profileId: 'profile-1',
            bloodGroup: 'O_POSITIVE',
            upazilaId: 'upazila-1',
            profile: {
              id: 'profile-1',
              notificationPreferences: {
                emailEnabled: false,
                quietHoursStart: 22,
                quietHoursEnd: 6,
              },
            },
          },
        ]),
      },
    });
    const service = new NotificationsService(
      prisma,
      mockEmailProvider,
      mockConfig as never,
    );

    const count = await service.notifyMatchingDonors(
      'req-1',
      'O_POSITIVE' as never,
      'upazila-1',
      'NORMAL',
      null,
      null,
    );

    expect(count).toBe(0); // donor in quiet hours — not notified
    vi.useRealTimers();
  });
});

describe('NotificationsService — list + read', () => {
  it('lists only the authenticated user\'s notifications', async () => {
    const prisma = createMockPrisma({
      notification: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'n1',
            type: 'REQUEST_MATCH',
            channel: 'IN_APP',
            title: 'Test',
            body: 'Body',
            isRead: false,
            readAt: null,
            relatedType: 'blood_request',
            relatedId: 'req-1',
            createdAt: new Date(),
          },
        ]),
      },
    });
    const service = new NotificationsService(
      prisma,
      mockEmailProvider,
      mockConfig as never,
    );

    const result = await service.listNotifications('user-1', 1, 20);

    expect(result.items).toHaveLength(1);
    expect(result.unreadCount).toBe(1);
    // Verify the where clause includes recipientId
    const findManyCall = (prisma.notification.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(findManyCall?.where?.recipientId).toBe('user-1');
  });

  it('markAsRead is scoped to the authenticated user (IDOR prevention)', async () => {
    const prisma = createMockPrisma({
      notification: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    });
    const service = new NotificationsService(
      prisma,
      mockEmailProvider,
      mockConfig as never,
    );

    await service.markAsRead('user-1', 'notif-1');

    const updateCall = (prisma.notification.updateMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(updateCall?.where?.recipientId).toBe('user-1');
    expect(updateCall?.where?.id).toBe('notif-1');
  });

  it('markAllAsRead is scoped to the authenticated user', async () => {
    const prisma = createMockPrisma({
      notification: {
        updateMany: vi.fn().mockResolvedValue({ count: 5 }),
      },
    });
    const service = new NotificationsService(
      prisma,
      mockEmailProvider,
      mockConfig as never,
    );

    const result = await service.markAllAsRead('user-1');

    expect(result.updated).toBe(5);
    const updateCall = (prisma.notification.updateMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(updateCall?.where?.recipientId).toBe('user-1');
  });
});

describe('NotificationsService — preferences', () => {
  it('returns defaults when no preferences exist', async () => {
    const prisma = createMockPrisma();
    const service = new NotificationsService(
      prisma,
      mockEmailProvider,
      mockConfig as never,
    );

    const prefs = await service.getPreferences('user-1');

    expect(prefs.bloodRequestAlertsEnabled).toBe(true);
    expect(prefs.inAppEnabled).toBe(true);
    expect(prefs.maxAlertsPerDay).toBe(10);
  });

  it('upserts preferences with the authenticated user\'s ID', async () => {
    const prisma = createMockPrisma({
      notificationPreference: {
        upsert: vi.fn().mockResolvedValue({
          inAppEnabled: true,
          emailEnabled: true,
          smsEnabled: false,
          bloodRequestAlertsEnabled: false,
          preferredBloodGroups: ['O_POSITIVE'],
          quietHoursStart: 22,
          quietHoursEnd: 6,
          maxAlertsPerDay: 5,
        }),
      },
    });
    const service = new NotificationsService(
      prisma,
      mockEmailProvider,
      mockConfig as never,
    );

    const prefs = await service.updatePreferences('user-1', {
      bloodRequestAlertsEnabled: false,
      maxAlertsPerDay: 5,
    });

    expect(prefs.bloodRequestAlertsEnabled).toBe(false);
    expect(prefs.maxAlertsPerDay).toBe(5);
    const upsertCall = (prisma.notificationPreference.upsert as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(upsertCall?.where?.profileId).toBe('user-1');
  });
});
