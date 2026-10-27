/**
 * Public module foundation tests.
 *
 * Verifies that public endpoints return only safe, non-private data
 * and that hospital listings respect verification status.
 */

import { describe, it, expect, vi } from 'vitest';
import { PublicService } from '../src/public/public.service';
import type { PrismaClient } from '../src/lib/prisma';

function createMockPrisma(overrides: Record<string, unknown> = {}): PrismaClient {
  return {
    donorProfile: {
      count: vi.fn().mockResolvedValue(0),
    },
    bloodRequest: {
      count: vi.fn().mockResolvedValue(0),
    },
    upazila: {
      count: vi.fn().mockResolvedValue(8),
      findMany: vi.fn().mockResolvedValue([]),
    },
    hospital: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
    ...overrides,
  } as unknown as PrismaClient;
}

describe('PublicService — stats', () => {
  it('returns real counts from the database (no fabricated data)', async () => {
    const prisma = createMockPrisma({
      donorProfile: {
        count: vi.fn()
          .mockResolvedValueOnce(42) // registeredDonors
          .mockResolvedValueOnce(15), // verifiedDonors
      },
      bloodRequest: { count: vi.fn().mockResolvedValue(7) },
      upazila: { count: vi.fn().mockResolvedValue(8), findMany: vi.fn().mockResolvedValue([]) },
    });
    const service = new PublicService(prisma);

    const stats = await service.getPublicStats();

    expect(stats.registeredDonors).toBe(42);
    expect(stats.verifiedDonors).toBe(15);
    expect(stats.activeBloodRequests).toBe(7);
    expect(stats.supportedUpazilas).toBe(8);
  });

  it('does NOT count cancelled/expired/fulfilled requests as active', async () => {
    const prisma = createMockPrisma();
    const service = new PublicService(prisma);

    await service.getPublicStats();

    const bloodRequestCountCall = (prisma.bloodRequest.count as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    const activeStatuses = bloodRequestCountCall?.where?.status?.in;
    expect(activeStatuses).not.toContain('CANCELLED');
    expect(activeStatuses).not.toContain('EXPIRED');
    expect(activeStatuses).not.toContain('COMPLETED');
    expect(activeStatuses).not.toContain('REJECTED');
  });

  it('only counts LISTED donors (not hidden/unlisted)', async () => {
    const prisma = createMockPrisma();
    const service = new PublicService(prisma);

    await service.getPublicStats();

    const donorCountCalls = (prisma.donorProfile.count as ReturnType<typeof vi.fn>).mock.calls;
    // Both calls should filter by visibility: LISTED
    for (const call of donorCountCalls) {
      expect(call[0]?.where?.visibility).toBe('LISTED');
    }
  });
});

describe('PublicService — hospitals', () => {
  it('only returns VERIFIED hospitals (not unverified/rejected)', async () => {
    const prisma = createMockPrisma({
      hospital: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
    });
    const service = new PublicService(prisma);

    await service.listHospitals();

    const findManyCall = (prisma.hospital.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(findManyCall?.where?.verificationStatus).toBe('VERIFIED');
    expect(findManyCall?.where?.deletedAt).toBeNull();
  });

  it('does NOT include representative contact info in the response', async () => {
    const prisma = createMockPrisma({
      hospital: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'h1',
            name: 'Jashore General Hospital',
            address: 'Main Road, Jashore',
            phone: '+880123456789',
            operatingHours: '24/7',
            servicesOffered: 'Emergency, Surgery',
            verificationStatus: 'VERIFIED',
            upazila: { id: 'u1', name: 'Jashore Sadar' },
            // NOTE: representedBy should NOT be in the response
            representedBy: 'some-user-id',
          },
        ]),
      },
    });
    const service = new PublicService(prisma);

    const result = await service.listHospitals();

    expect(result.items).toHaveLength(1);
    const hospital = result.items[0]!;
    expect(hospital.name).toBe('Jashore General Hospital');
    expect(hospital.phone).toBe('+880123456789'); // public phone is OK
    // The response should NOT include representative info
    expect(hospital).not.toHaveProperty('representedBy');
    expect(hospital).not.toHaveProperty('representative');
  });

  it('filters by upazilaId when provided', async () => {
    const prisma = createMockPrisma();
    const service = new PublicService(prisma);

    await service.listHospitals('upazila-1');

    const findManyCall = (prisma.hospital.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(findManyCall?.where?.upazilaId).toBe('upazila-1');
  });

  it('returns empty items when no verified hospitals exist', async () => {
    const prisma = createMockPrisma({
      hospital: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
    });
    const service = new PublicService(prisma);

    const result = await service.listHospitals();

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });

  it('paginates correctly', async () => {
    const prisma = createMockPrisma({
      hospital: {
        count: vi.fn().mockResolvedValue(25),
        findMany: vi.fn().mockResolvedValue([]),
      },
    });
    const service = new PublicService(prisma);

    const result = await service.listHospitals(undefined, 2, 20);

    expect(result.page).toBe(2);
    expect(result.totalPages).toBe(2);
    expect(result.total).toBe(25);
  });
});
