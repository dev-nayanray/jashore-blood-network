/**
 * PublicService — read-only public data for the homepage and directories.
 *
 * Returns ONLY data that is safe for public/unauthenticated access:
 *   - Platform statistics (aggregate counts, no individual records)
 *   - Verified hospitals (verification_status = 'VERIFIED', non-deleted)
 *   - Supported upazilas (already public via LocationsController)
 *
 * SECURITY:
 *   - No PII returned (no phone, email, full names)
 *   - No unverified hospitals shown publicly
 *   - No cancelled/expired/fulfilled requests counted as active
 *   - No fabricated data — all counts from real DB queries
 */

import { Injectable } from '@nestjs/common';
import { PrismaClient } from '../lib/prisma';

export interface PublicStats {
  registeredDonors: number;
  verifiedDonors: number;
  activeBloodRequests: number;
  supportedUpazilas: number;
}

export interface PublicHospital {
  id: string;
  name: string;
  upazila: { id: string; name: string };
  address: string;
  phone: string | null;
  operatingHours: string | null;
  servicesOffered: string | null;
  verificationStatus: string;
}

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Get public platform statistics for the homepage.
   * All counts are real database queries — no fabricated data.
   */
  async getPublicStats(): Promise<PublicStats> {
    const [registeredDonors, verifiedDonors, activeBloodRequests, supportedUpazilas] =
      await Promise.all([
        this.prisma.donorProfile.count({
          where: { deletedAt: null, visibility: 'LISTED' as never },
        }),
        this.prisma.donorProfile.count({
          where: {
            deletedAt: null,
            visibility: 'LISTED' as never,
            verificationStatus: 'VERIFIED' as never,
          },
        }),
        this.prisma.bloodRequest.count({
          where: {
            deletedAt: null,
            status: { in: ['VERIFIED', 'SEARCHING', 'DONOR_RESPONDED', 'ARRANGED'] as never },
          },
        }),
        this.prisma.upazila.count(),
      ]);

    return { registeredDonors, verifiedDonors, activeBloodRequests, supportedUpazilas };
  }

  /**
   * List verified hospitals for the public directory.
   * Only VERIFIED + non-deleted hospitals are returned.
   * No private contact info of representatives is included.
   */
  async listHospitals(
    upazilaId?: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<{
    items: PublicHospital[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  }> {
    const where: Record<string, unknown> = {
      verificationStatus: 'VERIFIED' as never,
      deletedAt: null,
    };
    if (upazilaId) where.upazilaId = upazilaId;

    const [total, hospitals] = await Promise.all([
      this.prisma.hospital.count({ where }),
      this.prisma.hospital.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { name: 'asc' },
        include: {
          upazila: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      items: hospitals.map((h) => ({
        id: h.id,
        name: h.name,
        upazila: h.upazila
          ? { id: h.upazila.id, name: h.upazila.name }
          : { id: '', name: 'Unknown' },
        address: h.address,
        phone: h.phone,
        operatingHours: h.operatingHours,
        servicesOffered: h.servicesOffered,
        verificationStatus: h.verificationStatus,
      })),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
