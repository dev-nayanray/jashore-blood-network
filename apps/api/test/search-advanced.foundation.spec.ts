/**
 * Advanced search foundation tests (Phase 12).
 *
 * Verifies smart ranking, verification filter, analytics recording,
 * and privacy controls on the improved search.
 */

import { describe, it, expect, vi } from 'vitest';
import { DonorsService } from '../src/donors/donors.service';
import type { PrismaClient } from '../src/lib/prisma';

function createMockPrisma(overrides: Record<string, Record<string, unknown>> = {}): PrismaClient {
  const donorProfile = {
    findUnique: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    count: vi.fn().mockResolvedValue(0),
    ...(overrides.donorProfile || {}),
  };
  const upazila = {
    findUnique: vi.fn().mockResolvedValue({ id: 'upazila-1', name: 'Jashore Sadar' }),
    ...(overrides.upazila || {}),
  };
  const locality = {
    findUnique: vi.fn().mockResolvedValue(null),
    ...(overrides.locality || {}),
  };
  const auditLog = {
    create: vi.fn().mockResolvedValue({}),
    ...(overrides.auditLog || {}),
  };
  const searchAnalytics = {
    create: vi.fn().mockResolvedValue({}),
    ...(overrides.searchAnalytics || {}),
  };
  return {
    donorProfile, upazila, locality, auditLog, searchAnalytics,
  } as unknown as PrismaClient;
}

describe('DonorsService — Phase 12 advanced search', () => {
  it('filters by verifiedOnly when set to true', async () => {
    const prisma = createMockPrisma();
    const service = new DonorsService(prisma);

    await service.searchDonors({
      verifiedOnly: true,
      page: 1,
      pageSize: 20,
    });

    const findManyCall = (prisma.donorProfile.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(findManyCall?.where?.verificationStatus).toBe('VERIFIED');
  });

  it('does NOT filter by verification status when verifiedOnly is not set', async () => {
    const prisma = createMockPrisma();
    const service = new DonorsService(prisma);

    await service.searchDonors({ page: 1, pageSize: 20 });

    const findManyCall = (prisma.donorProfile.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(findManyCall?.where).not.toHaveProperty('verificationStatus');
  });

  it('uses smart ranking: verified first, then availability freshness, then stable tie-breaker', async () => {
    const prisma = createMockPrisma();
    const service = new DonorsService(prisma);

    await service.searchDonors({ page: 1, pageSize: 20 });

    const findManyCall = (prisma.donorProfile.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    const orderBy = findManyCall?.orderBy;
    expect(orderBy).toBeDefined();
    expect(orderBy).toHaveLength(4);
    // 1. Verification status (verified first)
    expect(orderBy[0]).toEqual({ verificationStatus: 'asc' });
    // 2. Availability freshness (recent first)
    expect(orderBy[1]).toEqual({ availabilityConfirmedAt: 'desc' });
    // 3. Last donation (older first)
    expect(orderBy[2]).toEqual({ lastDonationAt: 'asc' });
    // 4. Stable tie-breaker (deterministic)
    expect(orderBy[3]).toEqual({ id: 'asc' });
  });

  it('records privacy-preserving search analytics (no user IDs, no IPs)', async () => {
    const prisma = createMockPrisma();
    const service = new DonorsService(prisma);

    await service.searchDonors({
      bloodGroup: 'O_POSITIVE' as never,
      upazilaId: 'upazila-1',
      page: 1,
      pageSize: 20,
    });

    // Wait for async analytics recording
    await new Promise((resolve) => setTimeout(resolve, 50));

    const analyticsCall = (prisma.searchAnalytics.create as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(analyticsCall).toBeDefined();
    expect(analyticsCall.data.bloodGroup).toBe('O_POSITIVE');
    expect(analyticsCall.data.upazilaId).toBe('upazila-1');
    expect(analyticsCall.data.page).toBe(1);
    // CRITICAL: no user IDs or IP addresses stored
    expect(analyticsCall.data).not.toHaveProperty('userId');
    expect(analyticsCall.data).not.toHaveProperty('ipAddress');
    expect(analyticsCall.data).not.toHaveProperty('profileId');
  });

  it('search analytics failure does NOT block search results', async () => {
    const prisma = createMockPrisma({
      searchAnalytics: {
        create: vi.fn().mockRejectedValue(new Error('DB connection failed')),
      },
    });
    const service = new DonorsService(prisma);

    // Search should succeed even if analytics fails
    const result = await service.searchDonors({ page: 1, pageSize: 20 });

    expect(result).toBeDefined();
    expect(result.items).toEqual([]);
  });

  it('includes isVerified flag in search results', async () => {
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
            verificationStatus: 'VERIFIED',
            profile: { fullName: 'Nayan Rahman' },
            upazila: { id: 'u1', name: 'Jashore Sadar' },
            locality: null,
          },
        ]),
      },
    });
    const service = new DonorsService(prisma);

    const result = await service.searchDonors({ page: 1, pageSize: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.isVerified).toBe(true);
  });

  it('does NOT include isVerified when donor is not verified', async () => {
    const prisma = createMockPrisma({
      donorProfile: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'd2',
            profileId: 'p2',
            bloodGroup: 'A_POSITIVE',
            lastDonationAt: null,
            availabilityConfirmedAt: new Date(),
            verificationStatus: 'UNVERIFIED',
            profile: { fullName: 'Karim Hossain' },
            upazila: { id: 'u1', name: 'Jashore Sadar' },
            locality: null,
          },
        ]),
      },
    });
    const service = new DonorsService(prisma);

    const result = await service.searchDonors({ page: 1, pageSize: 20 });

    expect(result.items[0]!.isVerified).toBe(false);
  });

  it('does NOT expose ranking score in search results', async () => {
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
            verificationStatus: 'VERIFIED',
            profile: { fullName: 'Test' },
            upazila: { id: 'u1', name: 'Jashore' },
            locality: null,
          },
        ]),
      },
    });
    const service = new DonorsService(prisma);

    const result = await service.searchDonors({ page: 1, pageSize: 20 });

    const item = result.items[0]!;
    // Ranking signals must NOT be exposed
    expect(item).not.toHaveProperty('rank');
    expect(item).not.toHaveProperty('score');
    expect(item).not.toHaveProperty('rankingReason');
  });

  it('search result does NOT include private fields', async () => {
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
            verificationStatus: 'VERIFIED',
            profile: { fullName: 'Test User' },
            upazila: { id: 'u1', name: 'Jashore' },
            locality: null,
          },
        ]),
      },
    });
    const service = new DonorsService(prisma);

    const result = await service.searchDonors({ page: 1, pageSize: 20 });

    const item = result.items[0]!;
    // No PII fields
    expect(item).not.toHaveProperty('phone');
    expect(item).not.toHaveProperty('email');
    expect(item).not.toHaveProperty('profileId');
    expect(item).not.toHaveProperty('contactPreference');
    expect(item).not.toHaveProperty('visibility');
    expect(item).not.toHaveProperty('fullAddress');
  });
});
