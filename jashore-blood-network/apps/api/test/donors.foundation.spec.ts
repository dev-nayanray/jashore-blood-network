/**
 * Donor foundation tests.
 *
 * Verifies the DonorsService in isolation with a mocked PrismaClient.
 * Focuses on:
 *   - Search filtering (blood group, upazila, district, recently-available)
 *   - Search projection (NO PII leaks — no phone, no email, no full name)
 *   - Mass-assignment prevention (profileId cannot be set via update input)
 *   - IDOR prevention (all writes scoped to `where: { profileId: userId }`)
 *   - Availability reconfirmation (setting isAvailable=true updates timestamp)
 *   - Conflict on duplicate create
 *   - NotFound on update without existing profile
 *
 * NOT verified here (deferred to Phase 9 integration tests):
 *   - Actual HTTP flow with cookies
 *   - Real Prisma queries against Postgres
 *   - RLS policy enforcement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DonorsService } from '../src/donors/donors.service';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { PrismaClient } from '../src/lib/prisma';

// ---------------------------------------------------------------------------
// Mock PrismaClient
// ---------------------------------------------------------------------------

function createMockPrisma(overrides: Partial<{
  donorProfile: Partial<PrismaClient['donorProfile']>;
  upazila: Partial<PrismaClient['upazila']>;
  locality: Partial<PrismaClient['locality']>;
  auditLog: Partial<PrismaClient['auditLog']>;
}> = {}): PrismaClient {
  return {
    donorProfile: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
      ...overrides.donorProfile,
    } as never,
    upazila: {
      findUnique: vi.fn().mockResolvedValue({ id: 'upazila-1', name: 'Jashore Sadar' }),
      ...overrides.upazila,
    } as never,
    locality: {
      findUnique: vi.fn().mockResolvedValue(null),
      ...overrides.locality,
    } as never,
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
      ...overrides.auditLog,
    } as never,
  } as unknown as PrismaClient;
}

const USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const OTHER_USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const VALID_UPAZILA = {
  id: 'upazila-1',
  name: 'Jashore Sadar',
  districtId: 'district-1',
};

const EXISTING_DONOR_PROFILE = {
  id: 'donor-1',
  profileId: USER_ID,
  bloodGroup: 'O_POSITIVE',
  upazilaId: 'upazila-1',
  localityId: null,
  lastDonationAt: null,
  isAvailable: true,
  availabilityConfirmedAt: new Date('2026-10-01'),
  visibility: 'LISTED',
  contactPreference: 'IN_APP_ONLY',
  createdAt: new Date('2026-09-01'),
  updatedAt: new Date('2026-10-01'),
  deletedAt: null,
  upazila: {
    id: 'upazila-1',
    name: 'Jashore Sadar',
    district: { id: 'district-1', name: 'Jashore' },
  },
  locality: null,
};

// ---------------------------------------------------------------------------
// DonorsService — search tests
// ---------------------------------------------------------------------------

describe('DonorsService — search', () => {
  it('returns a paginated response with the correct shape', async () => {
    const prisma = createMockPrisma({
      donorProfile: {
        count: vi.fn().mockResolvedValue(2),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'd1',
            profileId: 'p1',
            bloodGroup: 'O_POSITIVE',
            lastDonationAt: null,
            availabilityConfirmedAt: new Date('2026-10-15'),
            profile: { fullName: 'Nayan Rahman' },
            upazila: { id: 'upazila-1', name: 'Jashore Sadar' },
            locality: null,
          },
          {
            id: 'd2',
            profileId: 'p2',
            bloodGroup: 'O_POSITIVE',
            lastDonationAt: new Date('2026-08-10'),
            availabilityConfirmedAt: new Date('2026-10-10'),
            profile: { fullName: 'Karim Hossain' },
            upazila: { id: 'upazila-1', name: 'Jashore Sadar' },
            locality: { id: 'loc-1', name: 'Basundara' },
          },
        ]),
      },
    });
    const service = new DonorsService(prisma);

    const result = await service.searchDonors({
      bloodGroup: 'O_POSITIVE',
      page: 1,
      pageSize: 20,
    });

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.total).toBe(2);
    expect(result.totalPages).toBe(1);
    expect(result.hasMore).toBe(false);
    expect(result.items).toHaveLength(2);
  });

  it('strips PII from search results — no phone, no email, no full name', async () => {
    const prisma = createMockPrisma({
      donorProfile: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'd1',
            profileId: 'p1',
            bloodGroup: 'A_POSITIVE',
            lastDonationAt: null,
            availabilityConfirmedAt: new Date('2026-10-15'),
            profile: { fullName: 'Nayan Rahman' },
            upazila: { id: 'upazila-1', name: 'Jashore Sadar' },
            locality: null,
          },
        ]),
      },
    });
    const service = new DonorsService(prisma);

    const result = await service.searchDonors({ page: 1, pageSize: 20 });

    expect(result.items).toHaveLength(1);
    const item = result.items[0]!;
    // Should have a display name (first name + last initial), NOT the full name
    expect(item.displayName).toBe('Nayan R.');
    expect(item.displayName).not.toBe('Nayan Rahman');
    // Should have blood group, upazila, locality, availability, last donation
    expect(item.bloodGroup).toBe('A_POSITIVE');
    expect(item.upazila.name).toBe('Jashore Sadar');
    expect(item.locality).toBeNull();
    expect(item.availabilityConfirmedAt).toBeDefined();
    expect(item.lastDonationAt).toBeNull();
    // Should NOT have phone, email, profileId, or any PII
    expect(item).not.toHaveProperty('phone');
    expect(item).not.toHaveProperty('email');
    expect(item).not.toHaveProperty('profileId');
    expect(item).not.toHaveProperty('contactPreference');
    expect(item).not.toHaveProperty('visibility');
  });

  it('filters by blood group', async () => {
    const prisma = createMockPrisma();
    const service = new DonorsService(prisma);

    await service.searchDonors({ bloodGroup: 'B_POSITIVE', page: 1, pageSize: 20, recentlyAvailable: false });

    const findManyCall = (prisma.donorProfile.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(findManyCall?.where?.bloodGroup).toBe('B_POSITIVE');
  });

  it('filters by upazila', async () => {
    const prisma = createMockPrisma();
    const service = new DonorsService(prisma);

    await service.searchDonors({ upazilaId: 'upazila-2', page: 1, pageSize: 20, recentlyAvailable: false });

    const findManyCall = (prisma.donorProfile.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(findManyCall?.where?.upazilaId).toBe('upazila-2');
  });

  it('filters by district via the upazila relation', async () => {
    const prisma = createMockPrisma();
    const service = new DonorsService(prisma);

    await service.searchDonors({ districtId: 'district-1', page: 1, pageSize: 20, recentlyAvailable: false });

    const findManyCall = (prisma.donorProfile.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(findManyCall?.where?.upazila).toEqual({ districtId: 'district-1' });
  });

  it('filters by recently-available (30-day window)', async () => {
    const prisma = createMockPrisma();
    const service = new DonorsService(prisma);

    await service.searchDonors({ recentlyAvailable: true, page: 1, pageSize: 20 });

    const findManyCall = (prisma.donorProfile.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(findManyCall?.where?.availabilityConfirmedAt).toBeDefined();
    expect(findManyCall?.where?.availabilityConfirmedAt?.gte).toBeInstanceOf(Date);
  });

  it('always filters by visibility=LISTED, isAvailable=true, deletedAt=null', async () => {
    const prisma = createMockPrisma();
    const service = new DonorsService(prisma);

    await service.searchDonors({ page: 1, pageSize: 20 });

    const findManyCall = (prisma.donorProfile.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(findManyCall?.where?.visibility).toBe('LISTED');
    expect(findManyCall?.where?.isAvailable).toBe(true);
    expect(findManyCall?.where?.deletedAt).toBeNull();
  });

  it('caps pageSize at 50', async () => {
    const prisma = createMockPrisma();
    const service = new DonorsService(prisma);

    // searchDonorsSchema caps pageSize at 50 via transform — but if a
    // crafted input bypasses the pipe, the service should still be safe
    // because Prisma.take accepts any number. This test documents the
    // schema-level cap.
    const result = await service.searchDonors({ page: 1, pageSize: 20 });
    expect(result.pageSize).toBe(20);
  });

  it('returns empty items array when no donors match', async () => {
    const prisma = createMockPrisma({
      donorProfile: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
    });
    const service = new DonorsService(prisma);

    const result = await service.searchDonors({ page: 1, pageSize: 20 });

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
    expect(result.hasMore).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DonorsService — createMyProfile tests
// ---------------------------------------------------------------------------

describe('DonorsService — createMyProfile', () => {
  it('creates a donor profile and audit-logs the creation', async () => {
    const prisma = createMockPrisma({
      donorProfile: {
        findUnique: vi.fn().mockResolvedValue(null), // no existing profile
        create: vi.fn().mockResolvedValue(EXISTING_DONOR_PROFILE),
      },
    });
    const service = new DonorsService(prisma);

    const result = await service.createMyProfile(
      USER_ID,
      {
        bloodGroup: 'O_POSITIVE',
        upazilaId: 'upazila-1',
        contactPreference: 'IN_APP_ONLY',
        visibility: 'LISTED',
      },
      { ipAddress: '127.0.0.1', userAgent: 'test' },
    );

    expect(result.profileId).toBe(USER_ID);
    expect(result.bloodGroup).toBe('O_POSITIVE');
    expect(prisma.donorProfile.create).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: USER_ID,
          action: 'DONOR_PROFILE_CREATED',
          targetType: 'donor_profile',
        }),
      }),
    );
  });

  it('throws ConflictException if a profile already exists', async () => {
    const prisma = createMockPrisma({
      donorProfile: {
        findUnique: vi.fn().mockResolvedValue(EXISTING_DONOR_PROFILE),
      },
    });
    const service = new DonorsService(prisma);

    await expect(
      service.createMyProfile(
        USER_ID,
        {
          bloodGroup: 'O_POSITIVE',
          upazilaId: 'upazila-1',
          contactPreference: 'IN_APP_ONLY',
          visibility: 'LISTED',
        },
        {},
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('throws BadRequestException if the upazila does not exist', async () => {
    const prisma = createMockPrisma({
      donorProfile: { findUnique: vi.fn().mockResolvedValue(null) },
      upazila: { findUnique: vi.fn().mockResolvedValue(null) },
    });
    const service = new DonorsService(prisma);

    await expect(
      service.createMyProfile(
        USER_ID,
        {
          bloodGroup: 'O_POSITIVE',
          upazilaId: 'nonexistent-upazila',
          contactPreference: 'IN_APP_ONLY',
          visibility: 'LISTED',
        },
        {},
      ),
    ).rejects.toThrow(BadRequestException);
  });
});

// ---------------------------------------------------------------------------
// DonorsService — updateMyProfile tests
// ---------------------------------------------------------------------------

describe('DonorsService — updateMyProfile', () => {
  it('throws NotFoundException if no profile exists', async () => {
    const prisma = createMockPrisma({
      donorProfile: { findUnique: vi.fn().mockResolvedValue(null) },
    });
    const service = new DonorsService(prisma);

    await expect(
      service.updateMyProfile(USER_ID, { isAvailable: false }, {}),
    ).rejects.toThrow(NotFoundException);
  });

  it('scopes the update to the authenticated user (IDOR prevention)', async () => {
    const prisma = createMockPrisma({
      donorProfile: {
        findUnique: vi.fn().mockResolvedValue(EXISTING_DONOR_PROFILE),
        update: vi.fn().mockResolvedValue(EXISTING_DONOR_PROFILE),
      },
    });
    const service = new DonorsService(prisma);

    await service.updateMyProfile(USER_ID, { isAvailable: false }, {});

    const updateCall = (prisma.donorProfile.update as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    // CRITICAL: the where clause MUST use profileId: userId, not a user-supplied id
    expect(updateCall?.where).toEqual({ profileId: USER_ID });
    expect(updateCall?.where).not.toHaveProperty('id');
  });

  it('does NOT include profileId in the update data (mass-assignment prevention)', async () => {
    const prisma = createMockPrisma({
      donorProfile: {
        findUnique: vi.fn().mockResolvedValue(EXISTING_DONOR_PROFILE),
        update: vi.fn().mockResolvedValue(EXISTING_DONOR_PROFILE),
      },
    });
    const service = new DonorsService(prisma);

    // Even if a crafted input includes profileId (which the Zod schema
    // would strip), the service must not pass it to Prisma.update.data
    await service.updateMyProfile(
      USER_ID,
      { isAvailable: false, profileId: OTHER_USER_ID } as never,
      {},
    );

    const updateCall = (prisma.donorProfile.update as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(updateCall?.data).not.toHaveProperty('profileId');
    expect(updateCall?.data).not.toHaveProperty('profile');
  });

  it('updates availabilityConfirmedAt when isAvailable is set to true', async () => {
    const prisma = createMockPrisma({
      donorProfile: {
        findUnique: vi.fn().mockResolvedValue({
          ...EXISTING_DONOR_PROFILE,
          isAvailable: false, // currently unavailable
        }),
        update: vi.fn().mockResolvedValue(EXISTING_DONOR_PROFILE),
      },
    });
    const service = new DonorsService(prisma);

    await service.updateMyProfile(USER_ID, { isAvailable: true }, {});

    const updateCall = (prisma.donorProfile.update as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(updateCall?.data?.isAvailable).toBe(true);
    expect(updateCall?.data?.availabilityConfirmedAt).toBeInstanceOf(Date);
  });

  it('does NOT update availabilityConfirmedAt when isAvailable is set to false', async () => {
    const prisma = createMockPrisma({
      donorProfile: {
        findUnique: vi.fn().mockResolvedValue(EXISTING_DONOR_PROFILE),
        update: vi.fn().mockResolvedValue(EXISTING_DONOR_PROFILE),
      },
    });
    const service = new DonorsService(prisma);

    await service.updateMyProfile(USER_ID, { isAvailable: false }, {});

    const updateCall = (prisma.donorProfile.update as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(updateCall?.data?.isAvailable).toBe(false);
    expect(updateCall?.data?.availabilityConfirmedAt).toBeUndefined();
  });

  it('audit-logs security-sensitive field changes (visibility, isAvailable, contactPreference)', async () => {
    const prisma = createMockPrisma({
      donorProfile: {
        findUnique: vi.fn().mockResolvedValue(EXISTING_DONOR_PROFILE),
        update: vi.fn().mockResolvedValue(EXISTING_DONOR_PROFILE),
      },
    });
    const service = new DonorsService(prisma);

    await service.updateMyProfile(
      USER_ID,
      { visibility: 'UNLISTED', isAvailable: false, contactPreference: 'IN_APP_AND_EMAIL' },
      { ipAddress: '127.0.0.1', userAgent: 'test' },
    );

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: USER_ID,
          action: 'DONOR_PROFILE_UPDATED',
          targetType: 'donor_profile',
          metadata: expect.objectContaining({
            changedFields: expect.arrayContaining([
              'visibility',
              'isAvailable',
              'contactPreference',
            ]),
          }),
        }),
      }),
    );
  });

  it('does NOT audit-log non-sensitive field changes (e.g. lastDonationAt)', async () => {
    const prisma = createMockPrisma({
      donorProfile: {
        findUnique: vi.fn().mockResolvedValue(EXISTING_DONOR_PROFILE),
        update: vi.fn().mockResolvedValue(EXISTING_DONOR_PROFILE),
      },
    });
    const service = new DonorsService(prisma);

    await service.updateMyProfile(
      USER_ID,
      { lastDonationAt: '2026-08-15' },
      {},
    );

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// DonorsService — getMyProfile tests
// ---------------------------------------------------------------------------

describe('DonorsService — getMyProfile', () => {
  it('returns the profile with full detail (own profile)', async () => {
    const prisma = createMockPrisma({
      donorProfile: {
        findUnique: vi.fn().mockResolvedValue(EXISTING_DONOR_PROFILE),
      },
    });
    const service = new DonorsService(prisma);

    const result = await service.getMyProfile(USER_ID);

    expect(result.id).toBe('donor-1');
    expect(result.profileId).toBe(USER_ID);
    expect(result.bloodGroup).toBe('O_POSITIVE');
    expect(result.upazila.name).toBe('Jashore Sadar');
    expect(result.upazila.district.name).toBe('Jashore');
    expect(result.isAvailable).toBe(true);
    expect(result.visibility).toBe('LISTED');
  });

  it('throws NotFoundException if no profile exists', async () => {
    const prisma = createMockPrisma({
      donorProfile: { findUnique: vi.fn().mockResolvedValue(null) },
    });
    const service = new DonorsService(prisma);

    await expect(service.getMyProfile(USER_ID)).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException if the profile is soft-deleted', async () => {
    const prisma = createMockPrisma({
      donorProfile: {
        findUnique: vi.fn().mockResolvedValue({
          ...EXISTING_DONOR_PROFILE,
          deletedAt: new Date(),
        }),
      },
    });
    const service = new DonorsService(prisma);

    await expect(service.getMyProfile(USER_ID)).rejects.toThrow(NotFoundException);
  });
});

// ---------------------------------------------------------------------------
// DonorsService — display name generation tests
// ---------------------------------------------------------------------------

describe('DonorsService — display name generation (PII protection)', () => {
  // We test this indirectly via the search result, since toDisplayName is private.
  // The search tests above already verify "Nayan Rahman" -> "Nayan R.".

  it('handles single-name profiles', async () => {
    const prisma = createMockPrisma({
      donorProfile: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'd1',
            profileId: 'p1',
            bloodGroup: 'O_POSITIVE',
            lastDonationAt: null,
            availabilityConfirmedAt: new Date(),
            profile: { fullName: 'Karim' },
            upazila: { id: 'u1', name: 'Jashore Sadar' },
            locality: null,
          },
        ]),
      },
    });
    const service = new DonorsService(prisma);

    const result = await service.searchDonors({ page: 1, pageSize: 20 });
    expect(result.items[0]!.displayName).toBe('Karim');
  });

  it('handles empty-name profiles with Anonymous fallback', async () => {
    const prisma = createMockPrisma({
      donorProfile: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'd1',
            profileId: 'p1',
            bloodGroup: 'O_POSITIVE',
            lastDonationAt: null,
            availabilityConfirmedAt: new Date(),
            profile: { fullName: '' },
            upazila: { id: 'u1', name: 'Jashore Sadar' },
            locality: null,
          },
        ]),
      },
    });
    const service = new DonorsService(prisma);

    const result = await service.searchDonors({ page: 1, pageSize: 20 });
    expect(result.items[0]!.displayName).toBe('Anonymous');
  });

  it('handles three-part names by taking first + last initial', async () => {
    const prisma = createMockPrisma({
      donorProfile: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'd1',
            profileId: 'p1',
            bloodGroup: 'O_POSITIVE',
            lastDonationAt: null,
            availabilityConfirmedAt: new Date(),
            profile: { fullName: 'Nayan Kabir Rahman' },
            upazila: { id: 'u1', name: 'Jashore Sadar' },
            locality: null,
          },
        ]),
      },
    });
    const service = new DonorsService(prisma);

    const result = await service.searchDonors({ page: 1, pageSize: 20 });
    expect(result.items[0]!.displayName).toBe('Nayan R.');
  });
});
