/**
 * Blood requests foundation tests.
 *
 * Verifies the BloodRequestsService in isolation with mocked PrismaClient.
 * Focuses on:
 *   - Create: derives requesterId from auth (never from body)
 *   - List: public visibility filter (only active statuses for non-owners)
 *   - Detail: hides contactNote/notes for non-owners
 *   - Update: IDOR prevention (only owner/moderator+ can update)
 *   - Status transitions: owner can cancel; moderator+ can verify/reject
 *   - Status transitions: invalid transitions rejected
 *   - Mass-assignment prevention: status/requesterId not in update data
 *
 * NOT verified here (deferred to Phase 9 integration tests):
 *   - Actual HTTP flow with cookies
 *   - Real Prisma queries against Postgres
 *   - Rate-limit enforcement
 */

import { describe, it, expect, vi } from 'vitest';
import { BloodRequestsService } from '../src/blood-requests/blood-requests.service';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import type { PrismaClient } from '../src/lib/prisma';
import type { Role } from '@jbn/shared-types';

// ---------------------------------------------------------------------------
// Mock PrismaClient
// ---------------------------------------------------------------------------

function createMockPrisma(overrides: Partial<{
  bloodRequest: Partial<PrismaClient['bloodRequest']>;
  upazila: Partial<PrismaClient['upazila']>;
  auditLog: Partial<PrismaClient['auditLog']>;
}> = {}): PrismaClient {
  return {
    bloodRequest: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null), // no duplicate
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
      ...overrides.bloodRequest,
    } as never,
    upazila: {
      findUnique: vi.fn().mockResolvedValue({ id: 'upazila-1', name: 'Jashore Sadar' }),
      ...overrides.upazila,
    } as never,
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
      ...overrides.auditLog,
    } as never,
  } as unknown as PrismaClient;
}

const USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const OTHER_USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const MODERATOR_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

const USER_ROLES: Role[] = ['REGISTERED_USER'];
const MODERATOR_ROLES: Role[] = ['REGISTERED_USER', 'MODERATOR'];

const VALID_UPAZILA = { id: 'upazila-1', name: 'Jashore Sadar' };

const EXISTING_REQUEST = {
  id: 'req-1',
  requesterId: USER_ID,
  patientDisplayName: 'Patient X',
  bloodGroup: 'O_POSITIVE',
  bloodComponent: 'WHOLE_BLOOD',
  unitsRequested: 2,
  upazilaId: 'upazila-1',
  hospitalId: null,
  hospitalName: 'Jashore General Hospital',
  requiredBy: new Date('2026-12-01T10:00:00Z'),
  urgency: 'URGENT',
  contactMethod: 'IN_APP',
  contactNote: 'Please call before coming',
  notes: 'Patient is stable',
  status: 'PENDING',
  expiresAt: new Date('2026-12-02T10:00:00Z'),
  verifiedBy: null,
  verifiedAt: null,
  cancelledAt: null,
  cancellationReason: null,
  createdAt: new Date('2026-10-26'),
  updatedAt: new Date('2026-10-26'),
  deletedAt: null,
  upazila: VALID_UPAZILA,
};

// ---------------------------------------------------------------------------
// Create tests
// ---------------------------------------------------------------------------

describe('BloodRequestsService — create', () => {
  it('creates a request with requesterId derived from auth (never from body)', async () => {
    const prisma = createMockPrisma({
      bloodRequest: { create: vi.fn().mockResolvedValue(EXISTING_REQUEST) },
    });
    const service = new BloodRequestsService(prisma);

    const result = await service.createRequest(
      USER_ID,
      {
        bloodGroup: 'O_POSITIVE',
        unitsRequested: 2,
        upazilaId: 'upazila-1',
        requiredBy: '2026-12-01T10:00:00Z',
        urgency: 'URGENT',
        contactMethod: 'IN_APP',
      },
      { ipAddress: '127.0.0.1', userAgent: 'test' },
    );

    const createCall = (prisma.bloodRequest.create as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(createCall.data.requesterId).toBe(USER_ID);
    expect(result.isOwner).toBe(true);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: USER_ID,
          action: 'BLOOD_REQUEST_CREATED',
        }),
      }),
    );
  });

  it('throws BadRequestException if upazila does not exist', async () => {
    const prisma = createMockPrisma({
      upazila: { findUnique: vi.fn().mockResolvedValue(null) },
    });
    const service = new BloodRequestsService(prisma);

    await expect(
      service.createRequest(
        USER_ID,
        {
          bloodGroup: 'O_POSITIVE',
          unitsRequested: 1,
          upazilaId: 'nonexistent',
          requiredBy: '2026-12-01T10:00:00Z',
          urgency: 'NORMAL',
          contactMethod: 'IN_APP',
        },
        {},
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('sets expiresAt to requiredBy + 24 hours', async () => {
    const prisma = createMockPrisma({
      bloodRequest: { create: vi.fn().mockResolvedValue(EXISTING_REQUEST) },
    });
    const service = new BloodRequestsService(prisma);

    await service.createRequest(
      USER_ID,
      {
        bloodGroup: 'A_POSITIVE',
        unitsRequested: 1,
        upazilaId: 'upazila-1',
        requiredBy: '2026-12-01T10:00:00Z',
        urgency: 'NORMAL',
        contactMethod: 'IN_APP',
      },
      {},
    );

    const createCall = (prisma.bloodRequest.create as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    const expiresAt = createCall.data.expiresAt as Date;
    const requiredBy = createCall.data.requiredBy as Date;
    expect(expiresAt.getTime() - requiredBy.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});

// ---------------------------------------------------------------------------
// List tests
// ---------------------------------------------------------------------------

describe('BloodRequestsService — list', () => {
  it('returns paginated response with correct shape', async () => {
    const prisma = createMockPrisma({
      bloodRequest: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([EXISTING_REQUEST]),
      },
    });
    const service = new BloodRequestsService(prisma);

    const result = await service.listRequests({ page: 1, pageSize: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.hasMore).toBe(false);
  });

  it('filters by blood group', async () => {
    const prisma = createMockPrisma();
    const service = new BloodRequestsService(prisma);

    await service.listRequests({ bloodGroup: 'B_POSITIVE', page: 1, pageSize: 20 });

    const findManyCall = (prisma.bloodRequest.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(findManyCall?.where?.bloodGroup).toBe('B_POSITIVE');
  });

  it('filters by upazila', async () => {
    const prisma = createMockPrisma();
    const service = new BloodRequestsService(prisma);

    await service.listRequests({ upazilaId: 'upazila-2', page: 1, pageSize: 20 });

    const findManyCall = (prisma.bloodRequest.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(findManyCall?.where?.upazilaId).toBe('upazila-2');
  });

  it('filters by urgency', async () => {
    const prisma = createMockPrisma();
    const service = new BloodRequestsService(prisma);

    await service.listRequests({ urgency: 'URGENT', page: 1, pageSize: 20 });

    const findManyCall = (prisma.bloodRequest.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(findManyCall?.where?.urgency).toBe('URGENT');
  });

  it('filters by status', async () => {
    const prisma = createMockPrisma();
    const service = new BloodRequestsService(prisma);

    await service.listRequests({ status: 'SEARCHING', page: 1, pageSize: 20 });

    const findManyCall = (prisma.bloodRequest.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(findManyCall?.where?.status).toBe('SEARCHING');
  });

  it('non-owner viewer sees only public statuses (VERIFIED/SEARCHING/DONOR_RESPONDED/ARRANGED)', async () => {
    const prisma = createMockPrisma();
    const service = new BloodRequestsService(prisma);

    await service.listRequests({ page: 1, pageSize: 20 }); // no viewerId

    const findManyCall = (prisma.bloodRequest.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(findManyCall?.where?.OR).toBeDefined();
    // The OR clause should include the public statuses filter
    const orClause = findManyCall?.where?.OR as Array<Record<string, unknown>>;
    expect(orClause[0]).toEqual({
      status: { in: ['VERIFIED', 'SEARCHING', 'DONOR_RESPONDED', 'ARRANGED'] },
    });
  });
});

// ---------------------------------------------------------------------------
// Detail tests
// ---------------------------------------------------------------------------

describe('BloodRequestsService — getRequest', () => {
  it('returns detail with isOwner=true for the requester', async () => {
    const prisma = createMockPrisma({
      bloodRequest: {
        findUnique: vi.fn().mockResolvedValue({ ...EXISTING_REQUEST, status: 'SEARCHING' }),
      },
    });
    const service = new BloodRequestsService(prisma);

    const result = await service.getRequest('req-1', USER_ID);

    expect(result.isOwner).toBe(true);
    expect(result.contactNote).toBe('Please call before coming');
    expect(result.notes).toBe('Patient is stable');
  });

  it('hides contactNote and notes for non-owners', async () => {
    const prisma = createMockPrisma({
      bloodRequest: {
        findUnique: vi.fn().mockResolvedValue({ ...EXISTING_REQUEST, status: 'SEARCHING' }),
      },
    });
    const service = new BloodRequestsService(prisma);

    const result = await service.getRequest('req-1', OTHER_USER_ID);

    expect(result.isOwner).toBe(false);
    expect(result.contactNote).toBeNull();
    expect(result.notes).toBeNull();
    expect(result.contactMethod).toBe('IN_APP'); // hidden
  });

  it('throws NotFoundException for non-existent request', async () => {
    const prisma = createMockPrisma({
      bloodRequest: { findUnique: vi.fn().mockResolvedValue(null) },
    });
    const service = new BloodRequestsService(prisma);

    await expect(service.getRequest('nonexistent', USER_ID)).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when non-owner tries to view a PENDING request', async () => {
    const prisma = createMockPrisma({
      bloodRequest: {
        findUnique: vi.fn().mockResolvedValue(EXISTING_REQUEST), // status: PENDING
      },
    });
    const service = new BloodRequestsService(prisma);

    await expect(service.getRequest('req-1', OTHER_USER_ID)).rejects.toThrow(NotFoundException);
  });
});

// ---------------------------------------------------------------------------
// Update tests (IDOR prevention)
// ---------------------------------------------------------------------------

describe('BloodRequestsService — update', () => {
  it('throws NotFoundException for non-existent request', async () => {
    const prisma = createMockPrisma({
      bloodRequest: { findUnique: vi.fn().mockResolvedValue(null) },
    });
    const service = new BloodRequestsService(prisma);

    await expect(
      service.updateRequest('nonexistent', USER_ID, USER_ROLES, { unitsRequested: 3 }, {}),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when non-owner non-moderator tries to update', async () => {
    const prisma = createMockPrisma({
      bloodRequest: { findUnique: vi.fn().mockResolvedValue(EXISTING_REQUEST) },
    });
    const service = new BloodRequestsService(prisma);

    await expect(
      service.updateRequest('req-1', OTHER_USER_ID, USER_ROLES, { unitsRequested: 3 }, {}),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows owner to update their own request', async () => {
    const prisma = createMockPrisma({
      bloodRequest: {
        findUnique: vi.fn().mockResolvedValue(EXISTING_REQUEST),
        update: vi.fn().mockResolvedValue(EXISTING_REQUEST),
      },
    });
    const service = new BloodRequestsService(prisma);

    const result = await service.updateRequest(
      'req-1',
      USER_ID,
      USER_ROLES,
      { unitsRequested: 3 },
      {},
    );

    expect(result.isOwner).toBe(true);
    expect(prisma.bloodRequest.update).toHaveBeenCalled();
  });

  it('does NOT include requesterId or status in update data (mass-assignment prevention)', async () => {
    const prisma = createMockPrisma({
      bloodRequest: {
        findUnique: vi.fn().mockResolvedValue(EXISTING_REQUEST),
        update: vi.fn().mockResolvedValue(EXISTING_REQUEST),
      },
    });
    const service = new BloodRequestsService(prisma);

    await service.updateRequest(
      'req-1',
      USER_ID,
      USER_ROLES,
      { unitsRequested: 3, requesterId: OTHER_USER_ID, status: 'COMPLETED' } as never,
      {},
    );

    const updateCall = (prisma.bloodRequest.update as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(updateCall.data).not.toHaveProperty('requesterId');
    expect(updateCall.data).not.toHaveProperty('status');
  });

  it('throws BadRequestException when trying to update a non-PENDING/VERIFIED request', async () => {
    const prisma = createMockPrisma({
      bloodRequest: {
        findUnique: vi.fn().mockResolvedValue({ ...EXISTING_REQUEST, status: 'COMPLETED' }),
      },
    });
    const service = new BloodRequestsService(prisma);

    await expect(
      service.updateRequest('req-1', USER_ID, USER_ROLES, { unitsRequested: 3 }, {}),
    ).rejects.toThrow(BadRequestException);
  });
});

// ---------------------------------------------------------------------------
// Status change tests
// ---------------------------------------------------------------------------

describe('BloodRequestsService — changeStatus', () => {
  it('allows owner to cancel their own PENDING request', async () => {
    const prisma = createMockPrisma({
      bloodRequest: {
        findUnique: vi.fn().mockResolvedValue(EXISTING_REQUEST),
        update: vi.fn().mockResolvedValue({ ...EXISTING_REQUEST, status: 'CANCELLED', cancelledAt: new Date() }),
      },
    });
    const service = new BloodRequestsService(prisma);

    const result = await service.changeStatus(
      'req-1',
      USER_ID,
      USER_ROLES,
      { status: 'CANCELLED', reason: 'No longer needed' },
      {},
    );

    expect(result.status).toBe('CANCELLED');
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('rejects owner trying to VERIFY (moderator-only action)', async () => {
    const prisma = createMockPrisma({
      bloodRequest: { findUnique: vi.fn().mockResolvedValue(EXISTING_REQUEST) },
    });
    const service = new BloodRequestsService(prisma);

    await expect(
      service.changeStatus('req-1', USER_ID, USER_ROLES, { status: 'VERIFIED' }, {}),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows moderator to VERIFY a PENDING request (auto-transitions to SEARCHING)', async () => {
    const prisma = createMockPrisma({
      bloodRequest: {
        findUnique: vi.fn().mockResolvedValue(EXISTING_REQUEST),
        update: vi.fn()
          .mockResolvedValueOnce({ ...EXISTING_REQUEST, status: 'VERIFIED' })
          .mockResolvedValueOnce({ ...EXISTING_REQUEST, status: 'SEARCHING' }),
      },
    });
    const service = new BloodRequestsService(prisma);

    const result = await service.changeStatus(
      'req-1',
      MODERATOR_ID,
      MODERATOR_ROLES,
      { status: 'VERIFIED' },
      {},
    );

    // After verification, the request auto-transitions to SEARCHING
    expect(result.status).toBe('SEARCHING');
  });

  it('rejects invalid status transition (e.g. PENDING -> COMPLETED)', async () => {
    const prisma = createMockPrisma({
      bloodRequest: { findUnique: vi.fn().mockResolvedValue(EXISTING_REQUEST) },
    });
    const service = new BloodRequestsService(prisma);

    await expect(
      service.changeStatus('req-1', USER_ID, USER_ROLES, { status: 'COMPLETED' }, {}),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects non-owner non-moderator trying to cancel someone else\'s request', async () => {
    const prisma = createMockPrisma({
      bloodRequest: { findUnique: vi.fn().mockResolvedValue(EXISTING_REQUEST) },
    });
    const service = new BloodRequestsService(prisma);

    await expect(
      service.changeStatus('req-1', OTHER_USER_ID, USER_ROLES, { status: 'CANCELLED' }, {}),
    ).rejects.toThrow(ForbiddenException);
  });
});

// ---------------------------------------------------------------------------
// List own requests tests
// ---------------------------------------------------------------------------

describe('BloodRequestsService — listMyRequests', () => {
  it('returns only the authenticated user\'s requests', async () => {
    const prisma = createMockPrisma({
      bloodRequest: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([EXISTING_REQUEST]),
      },
    });
    const service = new BloodRequestsService(prisma);

    const result = await service.listMyRequests(USER_ID, 1, 20);

    const findManyCall = (prisma.bloodRequest.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(findManyCall?.where?.requesterId).toBe(USER_ID);
    expect(result.items).toHaveLength(1);
  });
});
