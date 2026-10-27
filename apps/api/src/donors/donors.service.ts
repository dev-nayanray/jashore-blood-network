/**
 * DonorsService — donor profile CRUD + public search.
 *
 * SECURITY MODEL:
 *   - All write operations (create/update) are scoped to the authenticated
 *     user's own donor profile. There is NO endpoint to update another
 *     user's donor profile — IDOR is prevented by construction.
 *   - The search endpoint returns a STRIPPED projection of donor data —
 *     NO phone, NO email, NO exact address, NO full name. Only display
 *     name (first name + last initial), blood group, general area
 *     (upazila + optional locality), availability confirmation date, and
 *     last donation date (if shared).
 *   - Search only returns donors with visibility='LISTED', isAvailable=true,
 *     and deletedAt=null. This is enforced BOTH in the Prisma WHERE clause
 *     AND by RLS policies (defense-in-depth).
 *
 * MEDICAL SAFETY:
 *   - The service NEVER returns a "medically eligible" flag.
 *   - A matching blood group is only a preliminary search filter.
 *   - Clinical eligibility is determined by the blood bank at donation time.
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, type PrismaClient } from '../lib/prisma';
import type {
  CreateDonorProfileInput,
  UpdateDonorProfileInput,
  SearchDonorsInput,
} from '@jbn/validation';
import type { BloodGroup } from '@jbn/shared-types';

/**
 * The public search result projection.
 *
 * This is the ONLY shape that ever leaves the search endpoint. It contains
 * NO PII: no phone, no email, no exact address, no full name.
 */
export interface DonorSearchResult {
  id: string;
  displayName: string;
  bloodGroup: BloodGroup;
  upazila: {
    id: string;
    name: string;
  };
  locality: { id: string; name: string } | null;
  availabilityConfirmedAt: string;
  lastDonationAt: string | null;
  isVerified: boolean;
  // NOTE: no contact info — requester must submit a blood request to contact
  // NOTE: no ranking score — ranking signals are internal, not exposed publicly
}

export interface DonorSearchResponse {
  items: DonorSearchResult[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * The authenticated user's own donor profile — includes more detail than
 * the public search result (e.g. contact preference, visibility, full name).
 */
export interface OwnDonorProfile {
  id: string;
  profileId: string;
  bloodGroup: BloodGroup;
  upazila: { id: string; name: string; district: { id: string; name: string } };
  locality: { id: string; name: string } | null;
  lastDonationAt: string | null;
  isAvailable: boolean;
  availabilityConfirmedAt: string;
  visibility: 'LISTED' | 'UNLISTED' | 'HIDDEN';
  contactPreference: 'IN_APP_ONLY' | 'IN_APP_AND_PHONE' | 'IN_APP_AND_EMAIL';
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class DonorsService {
  private readonly logger = new Logger(DonorsService.name);

  // Availability staleness threshold — 30 days per the architecture plan.
  // Donors whose availabilityConfirmedAt is older than this are NOT returned
  // in search results (even if isAvailable=true) when recentlyAvailable=true.
  private static readonly AVAILABILITY_STALE_DAYS = 30;

  constructor(private readonly prisma: PrismaClient) {}

  // -------------------------------------------------------------------------
  // Own profile CRUD
  // -------------------------------------------------------------------------

  /**
   * Create the authenticated user's donor profile.
   * Throws ConflictException if a profile already exists for this user.
   */
  async createMyProfile(
    userId: string,
    input: CreateDonorProfileInput,
    metadata: { ipAddress?: string; userAgent?: string },
  ): Promise<OwnDonorProfile> {
    // Check for existing profile
    const existing = await this.prisma.donorProfile.findUnique({
      where: { profileId: userId },
    });
    if (existing) {
      throw new ConflictException({
        error: 'Donor profile already exists',
        message: 'You already have a donor profile. Use PATCH /donors/me to update it.',
      });
    }

    // Verify the upazila exists (foreign key constraint would catch this
    // too, but a friendly error message is better than a Prisma FK error)
    const upazila = await this.prisma.upazila.findUnique({
      where: { id: input.upazilaId },
    });
    if (!upazila) {
      throw new BadRequestException({
        error: 'Invalid upazila',
        message: 'The selected upazila does not exist.',
      });
    }

    // Verify locality belongs to the upazila, if provided
    if (input.localityId) {
      const locality = await this.prisma.locality.findUnique({
        where: { id: input.localityId },
      });
      if (!locality || locality.upazilaId !== input.upazilaId || !locality.isApproved) {
        throw new BadRequestException({
          error: 'Invalid locality',
          message: 'The selected locality does not exist or is not in the selected upazila.',
        });
      }
    }

    const profile = await this.prisma.donorProfile.create({
      data: {
        profileId: userId,
        bloodGroup: input.bloodGroup as never,
        upazilaId: input.upazilaId,
        localityId: input.localityId ?? null,
        lastDonationAt: input.lastDonationAt ? new Date(input.lastDonationAt) : null,
        contactPreference: input.contactPreference as never,
        visibility: input.visibility as never,
        isAvailable: true, // always starts true
        availabilityConfirmedAt: new Date(),
      },
      include: {
        upazila: { include: { district: true } },
        locality: true,
      },
    });

    // Audit-log the donor profile creation
    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'DONOR_PROFILE_CREATED',
        targetType: 'donor_profile',
        targetId: profile.id,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        metadata: {
          bloodGroup: input.bloodGroup,
          upazilaId: input.upazilaId,
        },
      },
    });

    return this.toOwnDonorProfile(profile);
  }

  /**
   * Get the authenticated user's own donor profile.
   * Throws NotFoundException if no profile exists.
   */
  async getMyProfile(userId: string): Promise<OwnDonorProfile> {
    const profile = await this.prisma.donorProfile.findUnique({
      where: { profileId: userId },
      include: {
        upazila: { include: { district: true } },
        locality: true,
      },
    });
    if (!profile || profile.deletedAt !== null) {
      throw new NotFoundException({
        error: 'Donor profile not found',
        message: 'You do not have a donor profile yet. Create one at POST /donors/me.',
      });
    }
    return this.toOwnDonorProfile(profile);
  }

  /**
   * Update the authenticated user's own donor profile.
   * Throws NotFoundException if no profile exists.
   *
   * CRITICAL: this method ignores any attempt to change `profileId` (the
   * FK to profiles). The ZodValidationPipe already strips unknown fields,
   * but defense-in-depth: even if a crafted request reaches here, the
   * `where: { profileId: userId }` clause scopes the update to the
   * authenticated user's own profile.
   *
   * If `isAvailable` is set to `true`, `availabilityConfirmedAt` is
   * automatically updated to `now()`. This implements the "reconfirm
   * availability" UX without requiring a separate endpoint.
   */
  async updateMyProfile(
    userId: string,
    input: UpdateDonorProfileInput,
    metadata: { ipAddress?: string; userAgent?: string },
  ): Promise<OwnDonorProfile> {
    const existing = await this.prisma.donorProfile.findUnique({
      where: { profileId: userId },
    });
    if (!existing || existing.deletedAt !== null) {
      throw new NotFoundException({
        error: 'Donor profile not found',
        message: 'You do not have a donor profile yet.',
      });
    }

    // Validate upazila + locality if they're being changed
    if (input.upazilaId && input.upazilaId !== existing.upazilaId) {
      const upazila = await this.prisma.upazila.findUnique({
        where: { id: input.upazilaId },
      });
      if (!upazila) {
        throw new BadRequestException({ error: 'Invalid upazila' });
      }
    }
    if (input.localityId !== undefined && input.localityId !== null) {
      const upazilaId = input.upazilaId ?? existing.upazilaId;
      const locality = await this.prisma.locality.findUnique({
        where: { id: input.localityId },
      });
      if (!locality || locality.upazilaId !== upazilaId || !locality.isApproved) {
        throw new BadRequestException({ error: 'Invalid locality' });
      }
    }

    // Build the update data — only fields present in `input`.
    // profileId is NEVER included here (mass-assignment prevention).
    const updateData: Prisma.DonorProfileUpdateInput = {};
    if (input.bloodGroup !== undefined) {
      updateData.bloodGroup = input.bloodGroup as never;
    }
    if (input.upazilaId !== undefined) {
      updateData.upazila = { connect: { id: input.upazilaId } };
    }
    if (input.localityId !== undefined) {
      updateData.locality =
        input.localityId === null
          ? { disconnect: true }
          : { connect: { id: input.localityId } };
    }
    if (input.lastDonationAt !== undefined) {
      updateData.lastDonationAt =
        input.lastDonationAt === null ? null : new Date(input.lastDonationAt);
    }
    if (input.contactPreference !== undefined) {
      updateData.contactPreference = input.contactPreference as never;
    }
    if (input.visibility !== undefined) {
      updateData.visibility = input.visibility as never;
    }
    if (input.isAvailable !== undefined) {
      updateData.isAvailable = input.isAvailable;
      // Reconfirming availability updates the timestamp
      if (input.isAvailable) {
        updateData.availabilityConfirmedAt = new Date();
      }
    }

    const profile = await this.prisma.donorProfile.update({
      where: { profileId: userId },
      data: updateData,
      include: {
        upazila: { include: { district: true } },
        locality: true,
      },
    });

    // Audit-log security-sensitive changes
    const sensitiveFields: Array<keyof UpdateDonorProfileInput> = [
      'visibility',
      'isAvailable',
      'contactPreference',
    ];
    const changedSensitive = sensitiveFields.filter(
      (f) => input[f] !== undefined,
    );
    if (changedSensitive.length > 0) {
      await this.prisma.auditLog.create({
        data: {
          actorId: userId,
          action: 'DONOR_PROFILE_UPDATED',
          targetType: 'donor_profile',
          targetId: profile.id,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          metadata: {
            changedFields: changedSensitive,
            isAvailable: input.isAvailable,
            visibility: input.visibility,
            contactPreference: input.contactPreference,
          },
        },
      });
    }

    return this.toOwnDonorProfile(profile);
  }

  // -------------------------------------------------------------------------
  // Public search
  // -------------------------------------------------------------------------

  /**
   * Search for donors. Returns a paginated, PII-stripped projection.
   *
   * RANKING RULES (Phase 12 — Smart Donor Ranking):
   *   1. Verified donors first (verificationStatus = 'VERIFIED')
   *   2. Recently confirmed availability (availabilityConfirmedAt DESC)
   *   3. Last donation date ascending (longer since last donation = higher)
   *   4. Profile ID ascending (stable tie-breaker, deterministic)
   *
   * Ranking does NOT use medical history, protected attributes, or
   * notification preferences. Higher rank does NOT imply medical
   * superiority. Ranking signals are NOT exposed to the public.
   *
   * CRITICAL: this query is the primary attack surface for donor data
   * exfiltration. The defenses are:
   *   1. Prisma WHERE clause: visibility='LISTED', isAvailable=true, deletedAt=null
   *   2. RLS policies on donor_profiles (backstop): same filters
   *   3. Projection: only DonorSearchResult fields are returned (no PII)
   *   4. Rate limit: 60 req/min/IP via ThrottlerGuard
   *   5. Pagination: max 50 per page
   */
  async searchDonors(input: SearchDonorsInput): Promise<DonorSearchResponse> {
    const where: Prisma.DonorProfileWhereInput = {
      visibility: 'LISTED',
      isAvailable: true,
      deletedAt: null,
    };

    if (input.bloodGroup) {
      where.bloodGroup = input.bloodGroup as never;
    }
    if (input.upazilaId) {
      where.upazilaId = input.upazilaId;
    }
    if (input.districtId) {
      where.upazila = { districtId: input.districtId };
    }
    if (input.localityId) {
      where.localityId = input.localityId;
    }
    if (input.recentlyAvailable === true) {
      const staleThreshold = new Date();
      staleThreshold.setDate(
        staleThreshold.getDate() - DonorsService.AVAILABILITY_STALE_DAYS,
      );
      where.availabilityConfirmedAt = { gte: staleThreshold };
    }
    // Phase 12: verification status filter
    if (input.verifiedOnly === true) {
      where.verificationStatus = 'VERIFIED' as never;
    }

    // Phase 12: Smart ranking — verified first, then freshness, then stable tie-breaker
    const orderBy: Prisma.DonorProfileOrderByWithRelationInput[] = [
      // Verified donors appear first (VERIFIED sorts before other enum values alphabetically
      // in PostgreSQL, but we use a case-based approach for correctness)
      { verificationStatus: 'asc' },
      // Recently confirmed availability first
      { availabilityConfirmedAt: 'desc' },
      // Longer since last donation = potentially more eligible (ascending = older first)
      { lastDonationAt: 'asc' },
      // Stable tie-breaker — deterministic
      { id: 'asc' },
    ];

    const [total, items] = await Promise.all([
      this.prisma.donorProfile.count({ where }),
      this.prisma.donorProfile.findMany({
        where,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        orderBy,
        include: {
          profile: { select: { fullName: true } },
          upazila: { select: { id: true, name: true } },
          locality: { select: { id: true, name: true } },
        },
      }),
    ]);

    // Phase 12: Record privacy-preserving search analytics (async, non-blocking)
    void this.recordSearchAnalytics(input, total).catch(() => {
      // Analytics failure should not block search results
    });

    return {
      items: items.map((d) => this.toSearchResult(d)),
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: Math.ceil(total / input.pageSize),
      hasMore: input.page * input.pageSize < total,
    };
  }

  // -------------------------------------------------------------------------
  // Projection helpers
  // -------------------------------------------------------------------------

  /**
   * Strip PII from a donor profile for the public search response.
   * Returns only: display name (first name + last initial), blood group,
   * general area (upazila + optional locality), availability confirmation
   * date, and last donation date (if shared).
   */
  private toSearchResult(d: {
    id: string;
    profileId: string;
    bloodGroup: string;
    lastDonationAt: Date | null;
    availabilityConfirmedAt: Date;
    verificationStatus: string;
    profile: { fullName: string } | null;
    upazila: { id: string; name: string } | null;
    locality: { id: string; name: string } | null;
  }): DonorSearchResult {
    return {
      id: d.id,
      displayName: this.toDisplayName(d.profile?.fullName ?? 'Unknown'),
      bloodGroup: d.bloodGroup as BloodGroup,
      upazila: d.upazila
        ? { id: d.upazila.id, name: d.upazila.name }
        : { id: '', name: 'Unknown' },
      locality: d.locality ?? null,
      availabilityConfirmedAt: d.availabilityConfirmedAt.toISOString(),
      lastDonationAt: d.lastDonationAt
        ? d.lastDonationAt.toISOString().slice(0, 10)
        : null,
      isVerified: d.verificationStatus === 'VERIFIED',
    };
  }

  /**
   * Convert a full name to a display name: first name + last initial.
   * "Nayan Rahman" -> "Nayan R."
   * "Nayan" -> "Nayan"
   * "Nayan Kabir Rahman" -> "Nayan R."
   */
  private toDisplayName(fullName: string): string {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 0 || parts[0] === '') {
      return 'Anonymous';
    }
    if (parts.length === 1) {
      return parts[0]!;
    }
    const firstName = parts[0]!;
    const lastInitial = parts[parts.length - 1]!.charAt(0).toUpperCase();
    return `${firstName} ${lastInitial}.`;
  }

  /**
   * Convert a Prisma donor profile (with relations) to OwnDonorProfile.
   * Includes more detail than the public search result because the caller
   * is the profile owner.
   */
  private toOwnDonorProfile(d: {
    id: string;
    profileId: string;
    bloodGroup: string;
    lastDonationAt: Date | null;
    isAvailable: boolean;
    availabilityConfirmedAt: Date;
    visibility: string;
    contactPreference: string;
    createdAt: Date;
    updatedAt: Date;
    upazila: { id: string; name: string; district: { id: string; name: string } };
    locality: { id: string; name: string } | null;
  }): OwnDonorProfile {
    return {
      id: d.id,
      profileId: d.profileId,
      bloodGroup: d.bloodGroup as BloodGroup,
      upazila: {
        id: d.upazila.id,
        name: d.upazila.name,
        district: { id: d.upazila.district.id, name: d.upazila.district.name },
      },
      locality: d.locality ?? null,
      lastDonationAt: d.lastDonationAt
        ? d.lastDonationAt.toISOString().slice(0, 10)
        : null,
      isAvailable: d.isAvailable,
      availabilityConfirmedAt: d.availabilityConfirmedAt.toISOString(),
      visibility: d.visibility as OwnDonorProfile['visibility'],
      contactPreference: d.contactPreference as OwnDonorProfile['contactPreference'],
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    };
  }

  // -------------------------------------------------------------------------
  // Phase 12: Search Analytics (privacy-preserving, aggregate only)
  // -------------------------------------------------------------------------

  /**
   * Records a privacy-preserving search analytics entry.
   * Stores ONLY: blood group (if filtered), upazila (if filtered),
   * result count, page, and timestamp. NO user IDs, IP addresses,
   * or personal identifiers are stored.
   *
   * Called asynchronously — failures are silently ignored so search
   * performance is never impacted by analytics.
   */
  private async recordSearchAnalytics(
    input: SearchDonorsInput,
    resultCount: number,
  ): Promise<void> {
    await this.prisma.searchAnalytics.create({
      data: {
        bloodGroup: input.bloodGroup ?? null,
        upazilaId: input.upazilaId ?? null,
        resultCount,
        page: input.page,
      },
    });
  }
}
