/**
 * Admin analytics tests (Phase 16).
 *
 * Tests detailed analytics calculations, CSV export with formula
 * injection protection, and date-range/upazila filtering.
 */

import { describe, it, expect, vi } from 'vitest';
import { AdminService } from '../src/admin/admin.service';
import type { PrismaClient } from '../src/lib/prisma';

function createMockPrisma(overrides: Record<string, unknown> = {}): PrismaClient {
  const base: Record<string, unknown> = {
    profile: { count: vi.fn().mockResolvedValue(0), findUnique: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]), update: vi.fn().mockResolvedValue({}) },
    donorProfile: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]), groupBy: vi.fn().mockResolvedValue([]) },
    bloodRequest: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]), groupBy: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null), findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}), update: vi.fn().mockResolvedValue({}) },
    abuseReport: { count: vi.fn().mockResolvedValue(0) },
    auditLog: { create: vi.fn().mockResolvedValue({}), count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
    upazila: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn().mockResolvedValue(null), count: vi.fn().mockResolvedValue(0) },
    userRole: { findMany: vi.fn().mockResolvedValue([]) },
    hospital: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
    notificationDeliveryAttempt: { count: vi.fn().mockResolvedValue(0) },
    notification: { groupBy: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    organizationMember: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
  };
  return { ...base, ...overrides } as unknown as PrismaClient;
}

describe('AdminService — getDetailedAnalytics', () => {
  it('returns analytics with correct shape from real DB queries', async () => {
    const prisma = createMockPrisma({
      donorProfile: {
        count: vi.fn().mockResolvedValue(10),
        findMany: vi.fn().mockResolvedValue([]),
        groupBy: vi.fn().mockResolvedValue([
          { upazilaId: 'u1', _count: { _all: 5 } },
          { upazilaId: 'u2', _count: { _all: 5 } },
        ]),
      },
      bloodRequest: {
        count: vi.fn().mockResolvedValue(3),
        findMany: vi.fn().mockResolvedValue([]),
        groupBy: vi.fn().mockResolvedValue([
          { status: 'SEARCHING', _count: { _all: 2 } },
          { status: 'COMPLETED', _count: { _all: 1 } },
        ]),
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      },
      upazila: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'u1', name: 'Jashore Sadar' },
          { id: 'u2', name: 'Abhaynagar' },
        ]),
        findUnique: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(8),
      },
      notificationDeliveryAttempt: {
        count: vi.fn().mockResolvedValueOnce(50).mockResolvedValueOnce(5), // sent, then failed
      },
      hospital: { count: vi.fn().mockResolvedValue(2), findMany: vi.fn().mockResolvedValue([]) },
    });
    const service = new AdminService(prisma);

    const result = await service.getDetailedAnalytics();

    expect(result.donorDistributionByUpazila).toHaveLength(2);
    expect(result.donorDistributionByUpazila[0]!.upazila).toBe('Jashore Sadar');
    expect(result.donorDistributionByUpazila[0]!.donorCount).toBe(5);
    expect(result.requestsByStatus).toHaveLength(2);
    expect(result.notifications.sentCount).toBe(50);
    expect(result.notifications.failedCount).toBe(5);
    expect(result.notifications.successRate).toBeCloseTo(50 / 55);
    expect(result.organizations.verifiedHospitals).toBe(2);
  });

  it('handles empty datasets gracefully (no crashes, null/zero values)', async () => {
    const prisma = createMockPrisma();
    const service = new AdminService(prisma);

    const result = await service.getDetailedAnalytics();

    expect(result.donorDistributionByUpazila).toEqual([]);
    expect(result.requestsByStatus).toEqual([]);
    expect(result.lifecycle.avgVerificationHours).toBeNull();
    expect(result.lifecycle.avgFulfillmentHours).toBeNull();
    expect(result.lifecycle.verifiedCount).toBe(0);
    expect(result.lifecycle.completedCount).toBe(0);
    expect(result.notifications.successRate).toBeNull();
    expect(result.recentActivity.registrationsLast7Days).toBe(0);
  });

  it('calculates avg verification hours from verifiedAt timestamps', async () => {
    const created = new Date('2026-10-26T10:00:00Z');
    const verified = new Date('2026-10-26T12:00:00Z'); // 2 hours later
    const prisma = createMockPrisma({
      bloodRequest: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([
          { createdAt: created, verifiedAt: verified, updatedAt: verified },
        ]),
        groupBy: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      },
    });
    const service = new AdminService(prisma);

    const result = await service.getDetailedAnalytics();

    expect(result.lifecycle.avgVerificationHours).toBe(2);
    expect(result.lifecycle.verifiedCount).toBe(1);
  });

  it('calculates avg fulfillment hours from createdAt to updatedAt', async () => {
    const created = new Date('2026-10-26T10:00:00Z');
    const updated = new Date('2026-10-26T22:00:00Z'); // 12 hours later
    const prisma = createMockPrisma({
      bloodRequest: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn()
          .mockResolvedValueOnce([]) // verifiedRequests
          .mockResolvedValueOnce([{ createdAt: created, updatedAt: updated }]), // completedRequests
        groupBy: vi.fn().mockResolvedValue([
          { status: 'COMPLETED', _count: { _all: 1 } },
        ]),
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      },
    });
    const service = new AdminService(prisma);

    const result = await service.getDetailedAnalytics();

    expect(result.lifecycle.avgFulfillmentHours).toBe(12);
    expect(result.lifecycle.completedCount).toBe(1);
  });

  it('filters by date range when provided', async () => {
    const prisma = createMockPrisma();
    const service = new AdminService(prisma);

    const start = new Date('2026-10-01');
    const end = new Date('2026-10-31');
    await service.getDetailedAnalytics(start, end);

    // Verify groupBy calls include date filter in where clause
    const groupByCalls = (prisma.bloodRequest.groupBy as ReturnType<typeof vi.fn>).mock.calls;
    for (const call of groupByCalls) {
      const where = call[0]?.where;
      if (where && where.createdAt) {
        expect(where.createdAt.gte).toEqual(start);
        expect(where.createdAt.lte).toEqual(end);
      }
    }
  });

  it('filters by upazila when provided', async () => {
    const prisma = createMockPrisma();
    const service = new AdminService(prisma);

    await service.getDetailedAnalytics(undefined, undefined, 'upazila-123');

    const groupByCalls = (prisma.bloodRequest.groupBy as ReturnType<typeof vi.fn>).mock.calls;
    for (const call of groupByCalls) {
      expect(call[0]?.where?.upazilaId).toBe('upazila-123');
    }
  });
});

describe('AdminService — exportRequestsCsv', () => {
  it('generates CSV with headers and data rows', async () => {
    const prisma = createMockPrisma({
      bloodRequest: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'req-1',
            bloodGroup: 'O_POSITIVE',
            unitsRequested: 2,
            hospitalName: 'Jashore General',
            urgency: 'URGENT',
            status: 'SEARCHING',
            requiredBy: new Date('2026-12-01'),
            createdAt: new Date('2026-10-26'),
            updatedAt: new Date('2026-10-26'),
            upazila: { name: 'Jashore Sadar' },
          },
        ]),
        count: vi.fn().mockResolvedValue(0),
        groupBy: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      },
    });
    const service = new AdminService(prisma);

    const csv = await service.exportRequestsCsv();

    expect(csv).toContain('Request ID');
    expect(csv).toContain('Blood Group');
    expect(csv).toContain('req-1');
    expect(csv).toContain('O_POSITIVE');
    expect(csv).toContain('Jashore Sadar');
    expect(csv).toContain('SEARCHING');
  });

  it('protects against CSV formula injection (prefixes = + - @ with single quote)', async () => {
    const prisma = createMockPrisma({
      bloodRequest: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: '=cmd|test',
            bloodGroup: 'O_POSITIVE',
            unitsRequested: 1,
            hospitalName: '@inject',
            urgency: 'NORMAL',
            status: 'PENDING',
            requiredBy: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            upazila: { name: '-malicious' },
          },
        ]),
        count: vi.fn().mockResolvedValue(0),
        groupBy: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      },
    });
    const service = new AdminService(prisma);

    const csv = await service.exportRequestsCsv();

    // Formula-injecting values should be prefixed with single quote
    expect(csv).toContain("'=cmd|test");
    expect(csv).toContain("'@inject");
    expect(csv).toContain("'-malicious");
    // Original dangerous values should NOT appear unescaped
    expect(csv).not.toMatch(/^=cmd/m);
    expect(csv).not.toMatch(/[^']@inject/);
  });

  it('does NOT include phone, email, or patient PII in CSV', async () => {
    const prisma = createMockPrisma({
      bloodRequest: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'req-1',
            bloodGroup: 'O_POSITIVE',
            unitsRequested: 1,
            hospitalName: 'Test Hospital',
            urgency: 'NORMAL',
            status: 'SEARCHING',
            requiredBy: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            upazila: { name: 'Sadar' },
          },
        ]),
        count: vi.fn().mockResolvedValue(0),
        groupBy: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      },
    });
    const service = new AdminService(prisma);

    const csv = await service.exportRequestsCsv();

    // Headers should NOT include PII fields
    expect(csv).not.toContain('Phone');
    expect(csv).not.toContain('Email');
    expect(csv).not.toContain('Patient Name');
    expect(csv).not.toContain('Contact');
  });

  it('returns only headers when no requests exist', async () => {
    const prisma = createMockPrisma({
      bloodRequest: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        groupBy: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      },
    });
    const service = new AdminService(prisma);

    const csv = await service.exportRequestsCsv();

    const lines = csv.split('\n');
    expect(lines).toHaveLength(1); // Only headers
    expect(lines[0]).toContain('Request ID');
  });
});
