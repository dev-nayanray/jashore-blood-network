/**
 * DonorVerificationService — admin-controlled donor verification workflow.
 *
 * VERIFICATION STATUSES:
 *   UNVERIFIED → PENDING_REVIEW → VERIFIED
 *                           ↘ REJECTED → (can re-request) → PENDING_REVIEW
 *   Any status → SUSPENDED (admin action for safety/fraud concerns)
 *   SUSPENDED → UNVERIFIED (reinstatement by admin)
 *
 * SECURITY:
 *   - Only the donor can REQUEST verification (on their own profile)
 *   - Only moderators+ can REVIEW (approve/reject/suspend/reinstate)
 *   - All transitions are audit-logged via DonorVerificationReview table
 *   - The service NEVER claims medical eligibility — verification is
 *     identity/profile verification only, distinct from medical screening
 *
 * MEDICAL SAFETY:
 *   - A VERIFIED donor is NOT medically eligible or blood-compatible.
 *   - Verification only means an admin reviewed the profile information.
 *   - Medical eligibility is determined by the blood bank at donation time.
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaClient } from '../lib/prisma';
import type { Role } from '@jbn/shared-types';

export type DonorVerificationStatus =
  | 'UNVERIFIED'
  | 'PENDING_REVIEW'
  | 'VERIFIED'
  | 'REJECTED'
  | 'SUSPENDED';

export interface DonorVerificationInfo {
  verificationStatus: DonorVerificationStatus;
  verificationRequestedAt: string | null;
  verificationReviewedAt: string | null;
  verificationFeedback: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
}

export interface AdminDonorVerificationItem {
  donorProfileId: string;
  profileId: string;
  fullName: string;
  phone: string;
  bloodGroup: string;
  upazilaName: string;
  verificationStatus: DonorVerificationStatus;
  verificationRequestedAt: string | null;
  createdAt: string;
}

const MODERATOR_ROLES: Role[] = ['MODERATOR', 'DISTRICT_ADMINISTRATOR', 'SUPER_ADMINISTRATOR'];

@Injectable()
export class DonorVerificationService {
  private readonly logger = new Logger(DonorVerificationService.name);

  constructor(private readonly prisma: PrismaClient) {}

  // -------------------------------------------------------------------------
  // Donor-facing: request verification + view own status
  // -------------------------------------------------------------------------

  /**
   * Donor requests verification of their profile.
   * Only allowed from UNVERIFIED or REJECTED status.
   */
  async requestVerification(userId: string): Promise<DonorVerificationInfo> {
    const donor = await this.prisma.donorProfile.findUnique({
      where: { profileId: userId },
    });

    if (!donor || donor.deletedAt !== null) {
      throw new NotFoundException({
        error: 'Donor profile not found',
        message: 'You do not have a donor profile.',
      });
    }

    if (donor.verificationStatus === 'SUSPENDED') {
      throw new BadRequestException({
        error: 'Cannot request verification',
        message: 'Your profile is suspended. Contact support.',
      });
    }

    if (donor.verificationStatus === 'PENDING_REVIEW') {
      throw new BadRequestException({
        error: 'Already pending',
        message: 'Your verification is already under review.',
      });
    }

    if (donor.verificationStatus === 'VERIFIED') {
      throw new BadRequestException({
        error: 'Already verified',
        message: 'Your profile is already verified.',
      });
    }

    const updated = await this.prisma.donorProfile.update({
      where: { profileId: userId },
      data: {
        verificationStatus: 'PENDING_REVIEW' as never,
        verificationRequestedAt: new Date(),
        verificationReviewedAt: null,
        verificationReviewedBy: null,
        verificationFeedback: null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'DONOR_VERIFICATION_REQUESTED',
        targetType: 'donor_profile',
        targetId: donor.id,
        metadata: { previousStatus: donor.verificationStatus },
      },
    });

    return this.toInfo(updated);
  }

  /**
   * Get the donor's own verification status.
   */
  async getMyVerificationStatus(userId: string): Promise<DonorVerificationInfo> {
    const donor = await this.prisma.donorProfile.findUnique({
      where: { profileId: userId },
    });

    if (!donor || donor.deletedAt !== null) {
      throw new NotFoundException({
        error: 'Donor profile not found',
        message: 'You do not have a donor profile.',
      });
    }

    return this.toInfo(donor);
  }

  // -------------------------------------------------------------------------
  // Admin-facing: review queue + approve/reject/suspend/reinstate
  // -------------------------------------------------------------------------

  /**
   * List donors pending verification review.
   * Moderator+ only.
   */
  async listPendingReviews(page: number, pageSize: number) {
    const where = {
      verificationStatus: 'PENDING_REVIEW' as never,
      deletedAt: null,
    };

    const [total, donors] = await Promise.all([
      this.prisma.donorProfile.count({ where }),
      this.prisma.donorProfile.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { verificationRequestedAt: 'asc' }, // oldest first
        include: {
          profile: { select: { fullName: true, phone: true } },
          upazila: { select: { name: true } },
        },
      }),
    ]);

    return {
      items: donors.map((d) => this.toAdminItem(d)),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Approve a donor's verification.
   * Moderator+ only. Records the review in the audit trail.
   */
  async approveDonor(
    donorProfileId: string,
    reviewerId: string,
    reviewerRoles: Role[],
    reason?: string,
  ): Promise<DonorVerificationInfo> {
    return this.transitionStatus(
      donorProfileId,
      reviewerId,
      reviewerRoles,
      'VERIFIED',
      reason,
    );
  }

  /**
   * Reject a donor's verification.
   * Moderator+ only. Donor can re-request after fixing issues.
   */
  async rejectDonor(
    donorProfileId: string,
    reviewerId: string,
    reviewerRoles: Role[],
    reason: string,
  ): Promise<DonorVerificationInfo> {
    if (!reason || reason.trim().length < 3) {
      throw new BadRequestException({
        error: 'Reason required',
        message: 'A reason is required when rejecting a verification.',
      });
    }
    return this.transitionStatus(
      donorProfileId,
      reviewerId,
      reviewerRoles,
      'REJECTED',
      reason,
    );
  }

  /**
   * Suspend a donor profile for safety/fraud concerns.
   * Moderator+ only. Suspended donors are hidden from search.
   */
  async suspendDonor(
    donorProfileId: string,
    reviewerId: string,
    reviewerRoles: Role[],
    reason: string,
  ): Promise<DonorVerificationInfo> {
    if (!reason || reason.trim().length < 3) {
      throw new BadRequestException({
        error: 'Reason required',
        message: 'A reason is required when suspending a donor.',
      });
    }

    const donor = await this.loadDonor(donorProfileId);
    const previousStatus = donor.verificationStatus as DonorVerificationStatus;

    const updated = await this.prisma.donorProfile.update({
      where: { id: donorProfileId },
      data: {
        verificationStatus: 'SUSPENDED' as never,
        suspendedAt: new Date(),
        suspendedBy: reviewerId,
        suspensionReason: reason,
        // Also hide from search
        visibility: 'HIDDEN' as never,
        isAvailable: false,
      },
    });

    await this.recordReview(donorProfileId, reviewerId, previousStatus, 'SUSPENDED', reason);
    await this.prisma.auditLog.create({
      data: {
        actorId: reviewerId,
        action: 'DONOR_SUSPENDED',
        targetType: 'donor_profile',
        targetId: donorProfileId,
        metadata: { reason, previousStatus },
      },
    });

    return this.toInfo(updated);
  }

  /**
   * Reinstate a suspended donor.
   * Moderator+ only. Returns to UNVERIFIED status.
   */
  async reinstateDonor(
    donorProfileId: string,
    reviewerId: string,
    reviewerRoles: Role[],
    reason?: string,
  ): Promise<DonorVerificationInfo> {
    const donor = await this.loadDonor(donorProfileId);
    if (donor.verificationStatus !== 'SUSPENDED') {
      throw new BadRequestException({
        error: 'Not suspended',
        message: 'This donor profile is not suspended.',
      });
    }

    const updated = await this.prisma.donorProfile.update({
      where: { id: donorProfileId },
      data: {
        verificationStatus: 'UNVERIFIED' as never,
        suspendedAt: null,
        suspendedBy: null,
        suspensionReason: null,
        visibility: 'LISTED' as never,
        isAvailable: true,
      },
    });

    await this.recordReview(donorProfileId, reviewerId, 'SUSPENDED', 'UNVERIFIED', reason);
    await this.prisma.auditLog.create({
      data: {
        actorId: reviewerId,
        action: 'DONOR_REINSTATED',
        targetType: 'donor_profile',
        targetId: donorProfileId,
        metadata: { reason },
      },
    });

    return this.toInfo(updated);
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async transitionStatus(
    donorProfileId: string,
    reviewerId: string,
    reviewerRoles: Role[],
    newStatus: DonorVerificationStatus,
    reason?: string,
  ): Promise<DonorVerificationInfo> {
    this.requireModerator(reviewerRoles);

    const donor = await this.loadDonor(donorProfileId);
    const previousStatus = donor.verificationStatus as DonorVerificationStatus;

    // Validate transition
    if (donor.verificationStatus !== 'PENDING_REVIEW') {
      throw new BadRequestException({
        error: 'Not pending review',
        message: `Cannot ${newStatus.toLowerCase()} a donor that is not pending review.`,
      });
    }

    const updated = await this.prisma.donorProfile.update({
      where: { id: donorProfileId },
      data: {
        verificationStatus: newStatus as never,
        verificationReviewedAt: new Date(),
        verificationReviewedBy: reviewerId,
        verificationFeedback: reason ?? null,
      },
    });

    await this.recordReview(donorProfileId, reviewerId, previousStatus, newStatus, reason);
    await this.prisma.auditLog.create({
      data: {
        actorId: reviewerId,
        action: `DONOR_VERIFICATION_${newStatus}`,
        targetType: 'donor_profile',
        targetId: donorProfileId,
        metadata: { reason, previousStatus, newStatus },
      },
    });

    return this.toInfo(updated);
  }

  private async loadDonor(donorProfileId: string) {
    const donor = await this.prisma.donorProfile.findUnique({
      where: { id: donorProfileId },
    });
    if (!donor || donor.deletedAt !== null) {
      throw new NotFoundException({
        error: 'Donor not found',
        message: 'This donor profile does not exist.',
      });
    }
    return donor;
  }

  private requireModerator(roles: Role[]) {
    if (!roles.some((r) => MODERATOR_ROLES.includes(r))) {
      throw new ForbiddenException({
        error: 'Forbidden',
        message: 'Only moderators and administrators can perform this action.',
      });
    }
  }

  private async recordReview(
    donorProfileId: string,
    reviewerId: string,
    previousStatus: DonorVerificationStatus,
    newStatus: DonorVerificationStatus,
    reason?: string,
  ) {
    await this.prisma.donorVerificationReview.create({
      data: {
        donorProfileId,
        reviewerId,
        previousStatus: previousStatus as never,
        newStatus: newStatus as never,
        reason: reason ?? null,
      },
    });
  }

  private toInfo(d: {
    verificationStatus: string;
    verificationRequestedAt: Date | null;
    verificationReviewedAt: Date | null;
    verificationFeedback: string | null;
    suspendedAt: Date | null;
    suspensionReason: string | null;
  }): DonorVerificationInfo {
    return {
      verificationStatus: d.verificationStatus as DonorVerificationStatus,
      verificationRequestedAt: d.verificationRequestedAt?.toISOString() ?? null,
      verificationReviewedAt: d.verificationReviewedAt?.toISOString() ?? null,
      verificationFeedback: d.verificationFeedback,
      suspendedAt: d.suspendedAt?.toISOString() ?? null,
      suspensionReason: d.suspensionReason,
    };
  }

  private toAdminItem(d: {
    id: string;
    profileId: string;
    bloodGroup: string;
    verificationStatus: string;
    verificationRequestedAt: Date | null;
    createdAt: Date;
    profile: { fullName: string; phone: string };
    upazila: { name: string } | null;
  }): AdminDonorVerificationItem {
    return {
      donorProfileId: d.id,
      profileId: d.profileId,
      fullName: d.profile.fullName,
      phone: d.profile.phone,
      bloodGroup: d.bloodGroup,
      upazilaName: d.upazila?.name ?? 'Unknown',
      verificationStatus: d.verificationStatus as DonorVerificationStatus,
      verificationRequestedAt: d.verificationRequestedAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
    };
  }
}
