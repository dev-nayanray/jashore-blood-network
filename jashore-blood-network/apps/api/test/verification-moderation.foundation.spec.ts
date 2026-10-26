/**
 * Donor verification + moderation foundation tests.
 */

import { describe, it, expect, vi } from 'vitest';
import { DonorVerificationService } from '../src/donor-verification/donor-verification.service';
import { ModerationService } from '../src/moderation/moderation.service';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import type { PrismaClient } from '../src/lib/prisma';
import type { Role } from '@jbn/shared-types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

function createMockPrisma(overrides: Record<string, unknown> = {}): PrismaClient {
  return {
    donorProfile: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
    donorVerificationReview: {
      create: vi.fn().mockResolvedValue({}),
    },
    abuseReport: {
      create: vi.fn().mockResolvedValue({}),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn().mockResolvedValue({}),
    },
    suspiciousActivityFlag: {
      create: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
    ...overrides,
  } as unknown as PrismaClient;
}

const USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const MODERATOR_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const USER_ROLES: Role[] = ['REGISTERED_USER'];
const MODERATOR_ROLES: Role[] = ['REGISTERED_USER', 'MODERATOR'];

const UNVERIFIED_DONOR = {
  id: 'donor-1',
  profileId: USER_ID,
  bloodGroup: 'O_POSITIVE',
  upazilaId: 'upazila-1',
  verificationStatus: 'UNVERIFIED',
  verificationRequestedAt: null,
  verificationReviewedAt: null,
  verificationReviewedBy: null,
  verificationFeedback: null,
  suspendedAt: null,
  suspendedBy: null,
  suspensionReason: null,
  deletedAt: null,
  createdAt: new Date(),
};

const PENDING_DONOR = {
  ...UNVERIFIED_DONOR,
  verificationStatus: 'PENDING_REVIEW',
  verificationRequestedAt: new Date(),
};

// ---------------------------------------------------------------------------
// DonorVerificationService tests
// ---------------------------------------------------------------------------

describe('DonorVerificationService', () => {
  it('allows donor to request verification from UNVERIFIED status', async () => {
    const prisma = createMockPrisma({
      donorProfile: {
        findUnique: vi.fn().mockResolvedValue(UNVERIFIED_DONOR),
        update: vi.fn().mockResolvedValue({ ...UNVERIFIED_DONOR, verificationStatus: 'PENDING_REVIEW' }),
      },
    });
    const service = new DonorVerificationService(prisma);

    const result = await service.requestVerification(USER_ID);

    expect(result.verificationStatus).toBe('PENDING_REVIEW');
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'DONOR_VERIFICATION_REQUESTED',
        }),
      }),
    );
  });

  it('rejects verification request when already PENDING_REVIEW', async () => {
    const prisma = createMockPrisma({
      donorProfile: { findUnique: vi.fn().mockResolvedValue(PENDING_DONOR) },
    });
    const service = new DonorVerificationService(prisma);

    await expect(service.requestVerification(USER_ID)).rejects.toThrow(BadRequestException);
  });

  it('rejects verification request when SUSPENDED', async () => {
    const prisma = createMockPrisma({
      donorProfile: {
        findUnique: vi.fn().mockResolvedValue({ ...UNVERIFIED_DONOR, verificationStatus: 'SUSPENDED' }),
      },
    });
    const service = new DonorVerificationService(prisma);

    await expect(service.requestVerification(USER_ID)).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when no donor profile exists', async () => {
    const prisma = createMockPrisma();
    const service = new DonorVerificationService(prisma);

    await expect(service.requestVerification(USER_ID)).rejects.toThrow(NotFoundException);
  });

  it('allows moderator to approve a PENDING_REVIEW donor', async () => {
    const prisma = createMockPrisma({
      donorProfile: {
        findUnique: vi.fn().mockResolvedValue(PENDING_DONOR),
        update: vi.fn().mockResolvedValue({ ...PENDING_DONOR, verificationStatus: 'VERIFIED' }),
      },
    });
    const service = new DonorVerificationService(prisma);

    const result = await service.approveDonor('donor-1', MODERATOR_ID, MODERATOR_ROLES);

    expect(result.verificationStatus).toBe('VERIFIED');
    expect(prisma.donorVerificationReview.create).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('rejects approval from non-moderator (ForbiddenException)', async () => {
    const prisma = createMockPrisma();
    const service = new DonorVerificationService(prisma);

    await expect(
      service.approveDonor('donor-1', USER_ID, USER_ROLES),
    ).rejects.toThrow(ForbiddenException);
  });

  it('requires a reason when rejecting', async () => {
    const prisma = createMockPrisma();
    const service = new DonorVerificationService(prisma);

    await expect(
      service.rejectDonor('donor-1', MODERATOR_ID, MODERATOR_ROLES, ''),
    ).rejects.toThrow(BadRequestException);
  });

  it('requires a reason when suspending', async () => {
    const prisma = createMockPrisma();
    const service = new DonorVerificationService(prisma);

    await expect(
      service.suspendDonor('donor-1', MODERATOR_ID, MODERATOR_ROLES, ''),
    ).rejects.toThrow(BadRequestException);
  });

  it('suspends donor and hides from search (visibility=HIDDEN, isAvailable=false)', async () => {
    const prisma = createMockPrisma({
      donorProfile: {
        findUnique: vi.fn().mockResolvedValue(PENDING_DONOR),
        update: vi.fn().mockResolvedValue({
          ...PENDING_DONOR,
          verificationStatus: 'SUSPENDED',
          suspendedAt: new Date(),
          visibility: 'HIDDEN',
          isAvailable: false,
        }),
      },
    });
    const service = new DonorVerificationService(prisma);

    const result = await service.suspendDonor('donor-1', MODERATOR_ID, MODERATOR_ROLES, 'Fraud suspected');

    expect(result.verificationStatus).toBe('SUSPENDED');
    expect(result.suspendedAt).not.toBeNull();

    const updateCall = (prisma.donorProfile.update as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(updateCall.data.visibility).toBe('HIDDEN');
    expect(updateCall.data.isAvailable).toBe(false);
  });

  it('cannot approve a donor that is not PENDING_REVIEW', async () => {
    const prisma = createMockPrisma({
      donorProfile: { findUnique: vi.fn().mockResolvedValue(UNVERIFIED_DONOR) },
    });
    const service = new DonorVerificationService(prisma);

    await expect(
      service.approveDonor('donor-1', MODERATOR_ID, MODERATOR_ROLES),
    ).rejects.toThrow(BadRequestException);
  });
});

// ---------------------------------------------------------------------------
// ModerationService tests
// ---------------------------------------------------------------------------

describe('ModerationService', () => {
  it('submits a report and audit-logs it', async () => {
    const prisma = createMockPrisma({
      abuseReport: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: 'report-1',
          targetType: 'BLOOD_REQUEST',
          targetId: 'req-1',
          reason: 'Fake request',
          description: 'Seems suspicious',
          status: 'PENDING',
          createdAt: new Date(),
          reviewedAt: null,
        }),
      },
    });
    const service = new ModerationService(prisma);

    const result = await service.submitReport(
      USER_ID,
      'BLOOD_REQUEST',
      'req-1',
      'Fake request',
      'Seems suspicious',
    );

    expect(result.status).toBe('PENDING');
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('prevents duplicate reports within 24 hours', async () => {
    const prisma = createMockPrisma({
      abuseReport: {
        findFirst: vi.fn().mockResolvedValue({ id: 'existing-report' }), // duplicate found
      },
    });
    const service = new ModerationService(prisma);

    await expect(
      service.submitReport(USER_ID, 'BLOOD_REQUEST', 'req-1', 'Fake request'),
    ).rejects.toThrow(BadRequestException);
  });

  it('requires a reason of at least 3 characters', async () => {
    const prisma = createMockPrisma();
    const service = new ModerationService(prisma);

    await expect(
      service.submitReport(USER_ID, 'BLOOD_REQUEST', 'req-1', 'ab'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects non-moderator access to the review queue', async () => {
    const prisma = createMockPrisma();
    const service = new ModerationService(prisma);

    await expect(
      service.listPendingReports(USER_ROLES, 1, 20),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows moderator to resolve a report with a review note', async () => {
    const prisma = createMockPrisma({
      abuseReport: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'report-1',
          status: 'PENDING',
          reporterId: USER_ID,
          targetType: 'BLOOD_REQUEST',
          targetId: 'req-1',
          reason: 'Fake',
          description: null,
          createdAt: new Date(),
          reviewedBy: null,
          reviewedAt: null,
          reviewNote: null,
        }),
        update: vi.fn().mockResolvedValue({
          id: 'report-1',
          status: 'ACTIONED',
          reporterId: USER_ID,
          targetType: 'BLOOD_REQUEST',
          targetId: 'req-1',
          reason: 'Fake',
          description: null,
          createdAt: new Date(),
          reviewedBy: MODERATOR_ID,
          reviewedAt: new Date(),
          reviewNote: 'Removed the fake request',
        }),
      },
    });
    const service = new ModerationService(prisma);

    const result = await service.reviewReport(
      'report-1',
      MODERATOR_ID,
      MODERATOR_ROLES,
      'ACTIONED',
      'Removed the fake request',
    );

    expect(result.status).toBe('ACTIONED');
    expect(result.reviewNote).toBe('Removed the fake request');
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('requires a review note when resolving', async () => {
    const prisma = createMockPrisma();
    const service = new ModerationService(prisma);

    await expect(
      service.reviewReport('report-1', MODERATOR_ID, MODERATOR_ROLES, 'ACTIONED', ''),
    ).rejects.toThrow(BadRequestException);
  });

  it('reporter can list only their own reports', async () => {
    const prisma = createMockPrisma({
      abuseReport: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
    });
    const service = new ModerationService(prisma);

    await service.listMyReports(USER_ID, 1, 20);

    const findManyCall = (prisma.abuseReport.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(findManyCall?.where?.reporterId).toBe(USER_ID);
  });

  it('flagSuspiciousActivity creates a flag for admin review', async () => {
    const prisma = createMockPrisma();
    const service = new ModerationService(prisma);

    await service.flagSuspiciousActivity(
      'DUPLICATE_REQUEST',
      'profile',
      USER_ID,
      'Possible duplicate',
      { duplicateOf: 'req-1' },
    );

    expect(prisma.suspiciousActivityFlag.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'DUPLICATE_REQUEST',
          subjectType: 'profile',
          subjectId: USER_ID,
          description: 'Possible duplicate',
        }),
      }),
    );
  });
});
