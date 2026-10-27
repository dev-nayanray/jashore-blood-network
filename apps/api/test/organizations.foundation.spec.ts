/**
 * Organizations module foundation tests.
 *
 * Verifies registration, membership, verification workflow, cross-org
 * isolation, staff management, and coordination.
 */

import { describe, it, expect, vi } from 'vitest';
import { OrganizationsService } from '../src/organizations/organizations.service';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import type { PrismaClient } from '../src/lib/prisma';
import type { Role } from '@jbn/shared-types';

function createMockPrisma(overrides: Record<string, unknown> = {}): PrismaClient {
  return {
    upazila: { findUnique: vi.fn().mockResolvedValue({ id: 'u1', name: 'Jashore Sadar' }) },
    hospital: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
    organizationMember: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    organizationCoordination: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
    },
    organizationVerificationReview: {
      create: vi.fn().mockResolvedValue({}),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn().mockImplementation(async (fn) => fn({
      hospital: {
        create: vi.fn().mockResolvedValue({
          id: 'h1', name: 'Test Hospital', upazilaId: 'u1', address: 'Test Address',
          phone: null, email: null, website: null, operatingHours: null,
          servicesOffered: null, verificationStatus: 'DRAFT',
          verificationFeedback: null, verificationRequestedAt: null,
          verificationReviewedAt: null, suspendedAt: null, suspensionReason: null,
          createdAt: new Date(), representedBy: 'user-1',
        }),
      },
      organizationMember: { create: vi.fn().mockResolvedValue({}) },
    })),
    ...overrides,
  } as unknown as PrismaClient;
}

const USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const OTHER_USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const ADMIN_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const USER_ROLES: Role[] = ['REGISTERED_USER'];
const MODERATOR_ROLES: Role[] = ['REGISTERED_USER', 'MODERATOR'];

const MOCK_HOSPITAL = {
  id: 'h1',
  name: 'Test Hospital',
  upazilaId: 'u1',
  address: '123 Main St',
  phone: '+880123456789',
  email: 'info@test.com',
  website: 'https://test.com',
  operatingHours: '24/7',
  servicesOffered: 'Emergency',
  verificationStatus: 'DRAFT',
  verificationFeedback: null,
  verificationRequestedAt: null,
  verificationReviewedAt: null,
  suspendedAt: null,
  suspensionReason: null,
  deletedAt: null,
  createdAt: new Date(),
};

const MOCK_MEMBERSHIP = {
  id: 'm1',
  hospitalId: 'h1',
  profileId: USER_ID,
  role: 'OWNER',
  removedAt: null,
  hospital: { ...MOCK_HOSPITAL, upazila: { name: 'Jashore Sadar' } },
};

describe('OrganizationsService — registration', () => {
  it('creates a hospital + adds creator as OWNER in a transaction', async () => {
    const prisma = createMockPrisma();
    const service = new OrganizationsService(prisma);

    const result = await service.registerOrganization(USER_ID, {
      name: 'Test Hospital',
      upazilaId: 'u1',
      address: '123 Main St',
    });

    expect(result.name).toBe('Test Hospital');
    expect(result.verificationStatus).toBe('DRAFT');
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'ORGANIZATION_REGISTERED',
        }),
      }),
    );
  });

  it('throws BadRequestException for duplicate name in same upazila', async () => {
    const prisma = createMockPrisma({
      hospital: {
        findFirst: vi.fn().mockResolvedValue({ id: 'existing' }),
      },
    });
    const service = new OrganizationsService(prisma);

    await expect(
      service.registerOrganization(USER_ID, {
        name: 'Test Hospital',
        upazilaId: 'u1',
        address: '123 Main St',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('OrganizationsService — getMyOrganization (IDOR prevention)', () => {
  it('returns the organization for a member', async () => {
    const prisma = createMockPrisma({
      organizationMember: {
        findFirst: vi.fn().mockResolvedValue(MOCK_MEMBERSHIP),
      },
    });
    const service = new OrganizationsService(prisma);

    const result = await service.getMyOrganization(USER_ID);

    expect(result.id).toBe('h1');
    expect(result.name).toBe('Test Hospital');
  });

  it('throws ForbiddenException for non-members (cross-org isolation)', async () => {
    const prisma = createMockPrisma({
      organizationMember: { findFirst: vi.fn().mockResolvedValue(null) },
    });
    const service = new OrganizationsService(prisma);

    await expect(service.getMyOrganization(OTHER_USER_ID)).rejects.toThrow(ForbiddenException);
  });
});

describe('OrganizationsService — verification workflow', () => {
  it('allows submission from DRAFT status', async () => {
    const prisma = createMockPrisma({
      organizationMember: { findFirst: vi.fn().mockResolvedValue(MOCK_MEMBERSHIP) },
      hospital: { update: vi.fn().mockResolvedValue({ ...MOCK_HOSPITAL, verificationStatus: 'PENDING_REVIEW' }) },
    });
    const service = new OrganizationsService(prisma);

    const result = await service.submitForVerification(USER_ID);

    expect(result.verificationStatus).toBe('PENDING_REVIEW');
  });

  it('rejects submission from VERIFIED status', async () => {
    const prisma = createMockPrisma({
      organizationMember: {
        findFirst: vi.fn().mockResolvedValue({
          ...MOCK_MEMBERSHIP,
          hospital: { ...MOCK_HOSPITAL, verificationStatus: 'VERIFIED', upazila: { name: 'Jashore Sadar' } },
        }),
      },
    });
    const service = new OrganizationsService(prisma);

    await expect(service.submitForVerification(USER_ID)).rejects.toThrow(BadRequestException);
  });

  it('allows moderator to verify an organization', async () => {
    const prisma = createMockPrisma({
      hospital: {
        findUnique: vi.fn().mockResolvedValue({
          ...MOCK_HOSPITAL,
          verificationStatus: 'PENDING_REVIEW',
          upazila: { name: 'Jashore Sadar' },
        }),
        update: vi.fn().mockResolvedValue({ ...MOCK_HOSPITAL, verificationStatus: 'VERIFIED' }),
      },
    });
    const service = new OrganizationsService(prisma);

    const result = await service.reviewOrganization('h1', ADMIN_ID, MODERATOR_ROLES, 'VERIFIED', 'Approved');

    expect(result.verificationStatus).toBe('VERIFIED');
    expect(prisma.organizationVerificationReview.create).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('rejects non-moderator verification (ForbiddenException)', async () => {
    const prisma = createMockPrisma();
    const service = new OrganizationsService(prisma);

    await expect(
      service.reviewOrganization('h1', USER_ID, USER_ROLES, 'VERIFIED'),
    ).rejects.toThrow(ForbiddenException);
  });
});

describe('OrganizationsService — staff management', () => {
  it('only owners can add staff', async () => {
    const staffMembership = { ...MOCK_MEMBERSHIP, role: 'STAFF' };
    const prisma = createMockPrisma({
      organizationMember: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(staffMembership) // getOrgForUser — returns org for the STAFF user
          .mockResolvedValueOnce(null), // owner check — STAFF is not OWNER
      },
    });
    const service = new OrganizationsService(prisma);

    await expect(
      service.addStaff(USER_ID, OTHER_USER_ID),
    ).rejects.toThrow(ForbiddenException);
  });

  it('cannot add a user who is already a member', async () => {
    const prisma = createMockPrisma({
      organizationMember: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(MOCK_MEMBERSHIP) // getOrgForUser
          .mockResolvedValueOnce(MOCK_MEMBERSHIP) // owner check
          .mockResolvedValueOnce({ id: 'existing' }), // already member
      },
    });
    const service = new OrganizationsService(prisma);

    await expect(
      service.addStaff(USER_ID, OTHER_USER_ID),
    ).rejects.toThrow(BadRequestException);
  });

  it('cannot remove an OWNER', async () => {
    const prisma = createMockPrisma({
      organizationMember: {
        findFirst: vi.fn().mockResolvedValue(MOCK_MEMBERSHIP), // owner check
        findUnique: vi.fn().mockResolvedValue({
          id: 'm2',
          hospitalId: 'h1',
          role: 'OWNER',
          removedAt: null,
        }),
      },
    });
    const service = new OrganizationsService(prisma);

    await expect(
      service.removeStaff(USER_ID, 'm2'),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('OrganizationsService — coordination', () => {
  it('upserts coordination record for the org', async () => {
    const prisma = createMockPrisma({
      organizationMember: { findFirst: vi.fn().mockResolvedValue(MOCK_MEMBERSHIP) },
      organizationCoordination: {
        upsert: vi.fn().mockResolvedValue({
          id: 'c1',
          bloodRequestId: 'req-1',
          status: 'RESPONDED',
          note: 'We can help',
          updatedAt: new Date(),
        }),
      },
    });
    const service = new OrganizationsService(prisma);

    const result = await service.updateCoordination(USER_ID, 'req-1', 'RESPONDED', 'We can help');

    expect(result.status).toBe('RESPONDED');
    expect(prisma.organizationCoordination.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { hospitalId_bloodRequestId: { hospitalId: 'h1', bloodRequestId: 'req-1' } },
      }),
    );
  });

  it('non-member cannot access coordination (cross-org isolation)', async () => {
    const prisma = createMockPrisma({
      organizationMember: { findFirst: vi.fn().mockResolvedValue(null) },
    });
    const service = new OrganizationsService(prisma);

    await expect(
      service.updateCoordination(OTHER_USER_ID, 'req-1', 'RESPONDED'),
    ).rejects.toThrow(ForbiddenException);
  });
});
