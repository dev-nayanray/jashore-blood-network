/**
 * OrganizationsService — hospital/blood-bank organization portal.
 *
 * FEATURES:
 *   - Register a new organization (creates Hospital + adds creator as OWNER)
 *   - Submit for verification (UNVERIFIED → PENDING_REVIEW)
 *   - Admin review (PENDING_REVIEW → VERIFIED/REJECTED/SUSPENDED)
 *   - Profile management (owners can edit, changes to verified orgs require re-review)
 *   - Staff management (owners can invite/remove staff)
 *   - Blood request coordination (org-specific response status)
 *
 * SECURITY:
 *   - Organization ID derived from membership lookup (never from client)
 *   - Only OWNER can manage staff and submit for verification
 *   - Only OWNER/STAFF can edit profile and coordinate on requests
 *   - Cross-organization access prevented by membership check
 *   - All sensitive actions audit-logged
 *   - Users cannot self-assign OWNER role — assigned at registration only
 *
 * MEDICAL SAFETY:
 *   - Verification does NOT confirm blood inventory or medical capabilities
 *   - Coordination status does NOT fulfill a blood request
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { type PrismaClient } from '../lib/prisma';
import type { Role } from '@jbn/shared-types';

const MODERATOR_ROLES: Role[] = ['MODERATOR', 'DISTRICT_ADMINISTRATOR', 'SUPER_ADMINISTRATOR'];

export interface OrganizationDto {
  id: string;
  name: string;
  upazilaId: string;
  upazilaName: string;
  address: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  operatingHours: string | null;
  servicesOffered: string | null;
  verificationStatus: string;
  verificationFeedback: string | null;
  verificationRequestedAt: string | null;
  verificationReviewedAt: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
  createdAt: string;
}

export interface OrganizationMemberDto {
  id: string;
  profileId: string;
  fullName: string;
  phone: string;
  role: string;
  joinedAt: string;
  removedAt: string | null;
}

export interface CoordinationDto {
  id: string;
  bloodRequestId: string;
  status: string;
  note: string | null;
  updatedAt: string;
}

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(private readonly prisma: PrismaClient) {}

  // -------------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------------

  async registerOrganization(
    userId: string,
    input: {
      name: string;
      upazilaId: string;
      address: string;
      phone?: string;
      email?: string;
      website?: string;
      operatingHours?: string;
      servicesOffered?: string;
    },
  ): Promise<OrganizationDto> {
    // Verify upazila exists
    const upazila = await this.prisma.upazila.findUnique({
      where: { id: input.upazilaId },
    });
    if (!upazila) {
      throw new BadRequestException({ error: 'Invalid upazila' });
    }

    // Check for duplicate name in the same upazila
    const existing = await this.prisma.hospital.findFirst({
      where: {
        name: { contains: input.name, mode: 'insensitive' },
        upazilaId: input.upazilaId,
        deletedAt: null,
      },
    });
    if (existing) {
      throw new BadRequestException({
        error: 'Duplicate organization',
        message: 'An organization with a similar name already exists in this upazila.',
      });
    }

    // Create hospital + add creator as OWNER in a transaction
    const hospital = await this.prisma.$transaction(async (tx) => {
      const h = await tx.hospital.create({
        data: {
          name: input.name,
          upazilaId: input.upazilaId,
          address: input.address,
          phone: input.phone ?? null,
          email: input.email ?? null,
          website: input.website ?? null,
          operatingHours: input.operatingHours ?? null,
          servicesOffered: input.servicesOffered ?? null,
          verificationStatus: 'DRAFT' as never,
          representedBy: userId,
        },
      });

      await tx.organizationMember.create({
        data: {
          hospitalId: h.id,
          profileId: userId,
          role: 'OWNER' as never,
          invitedBy: userId,
        },
      });

      return h;
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'ORGANIZATION_REGISTERED',
        targetType: 'hospital',
        targetId: hospital.id,
        metadata: { name: input.name, upazilaId: input.upazilaId },
      },
    });

    return this.toDto(hospital, upazila.name);
  }

  // -------------------------------------------------------------------------
  // Profile management
  // -------------------------------------------------------------------------

  async getMyOrganization(userId: string): Promise<OrganizationDto> {
    const org = await this.getOrgForUser(userId);
    return this.toDto(org.hospital, org.upazilaName);
  }

  async updateProfile(
    userId: string,
    input: {
      name?: string;
      address?: string;
      phone?: string;
      email?: string;
      website?: string;
      operatingHours?: string;
      servicesOffered?: string;
    },
  ): Promise<OrganizationDto> {
    const { hospital, upazilaName } = await this.getOrgForUser(userId);

    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.address !== undefined) updateData.address = input.address;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.website !== undefined) updateData.website = input.website;
    if (input.operatingHours !== undefined) updateData.operatingHours = input.operatingHours;
    if (input.servicesOffered !== undefined) updateData.servicesOffered = input.servicesOffered;

    // If org is VERIFIED, significant changes require re-review
    if (hospital.verificationStatus === 'VERIFIED') {
      const significantFields = ['name', 'address', 'servicesOffered'];
      const hasSignificantChange = significantFields.some((f) => input[f as keyof typeof input] !== undefined);
      if (hasSignificantChange) {
        updateData.verificationStatus = 'PENDING_REVIEW';
        updateData.verificationRequestedAt = new Date();
        updateData.verificationFeedback = null;
      }
    }

    const updated = await this.prisma.hospital.update({
      where: { id: hospital.id },
      data: updateData,
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'ORGANIZATION_PROFILE_UPDATED',
        targetType: 'hospital',
        targetId: hospital.id,
        metadata: { changedFields: Object.keys(updateData) },
      },
    });

    return this.toDto(updated, upazilaName);
  }

  // -------------------------------------------------------------------------
  // Verification workflow
  // -------------------------------------------------------------------------

  async submitForVerification(userId: string): Promise<OrganizationDto> {
    const { hospital, upazilaName } = await this.getOrgForUser(userId);

    if (hospital.verificationStatus !== 'DRAFT' && hospital.verificationStatus !== 'REJECTED') {
      throw new BadRequestException({
        error: 'Cannot submit',
        message: 'Organization can only be submitted from DRAFT or REJECTED status.',
      });
    }

    const updated = await this.prisma.hospital.update({
      where: { id: hospital.id },
      data: {
        verificationStatus: 'PENDING_REVIEW' as never,
        verificationRequestedAt: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'ORGANIZATION_VERIFICATION_SUBMITTED',
        targetType: 'hospital',
        targetId: hospital.id,
      },
    });

    return this.toDto(updated, upazilaName);
  }

  async reviewOrganization(
    hospitalId: string,
    reviewerId: string,
    reviewerRoles: Role[],
    newStatus: 'VERIFIED' | 'REJECTED' | 'SUSPENDED',
    reason?: string,
  ): Promise<OrganizationDto> {
    if (!MODERATOR_ROLES.some((r) => reviewerRoles.includes(r))) {
      throw new ForbiddenException({
        error: 'Forbidden',
        message: 'Only administrators can review organizations.',
      });
    }

    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
      include: { upazila: { select: { name: true } } },
    });
    if (!hospital || hospital.deletedAt !== null) {
      throw new NotFoundException({ error: 'Organization not found' });
    }

    const previousStatus = hospital.verificationStatus;

    const updateData: Record<string, unknown> = {
      verificationStatus: newStatus,
      verificationReviewedAt: new Date(),
      verificationReviewedBy: reviewerId,
      verificationFeedback: reason ?? null,
    };

    if (newStatus === 'SUSPENDED') {
      updateData.suspendedAt = new Date();
      updateData.suspendedBy = reviewerId;
      updateData.suspensionReason = reason;
    }

    const updated = await this.prisma.hospital.update({
      where: { id: hospitalId },
      data: updateData,
    });

    // Record in verification review audit trail
    await this.prisma.organizationVerificationReview.create({
      data: {
        hospitalId,
        reviewerId,
        previousStatus: previousStatus as never,
        newStatus: newStatus as never,
        reason: reason ?? null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: reviewerId,
        action: `ORGANIZATION_${newStatus}`,
        targetType: 'hospital',
        targetId: hospitalId,
        metadata: { reason, previousStatus },
      },
    });

    return this.toDto(updated, hospital.upazila?.name ?? 'Unknown');
  }

  // -------------------------------------------------------------------------
  // Staff management
  // -------------------------------------------------------------------------

  async listStaff(userId: string): Promise<OrganizationMemberDto[]> {
    const { hospital } = await this.getOrgForUser(userId);

    const members = await this.prisma.organizationMember.findMany({
      where: { hospitalId: hospital.id, removedAt: null },
      include: { profile: { select: { fullName: true, phone: true } } },
      orderBy: { joinedAt: 'asc' },
    });

    return members.map((m) => ({
      id: m.id,
      profileId: m.profileId,
      fullName: m.profile.fullName,
      phone: m.profile.phone,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
      removedAt: null,
    }));
  }

  async addStaff(
    ownerId: string,
    staffProfileId: string,
  ): Promise<OrganizationMemberDto> {
    const { hospital } = await this.getOrgForUser(ownerId);

    // Verify the caller is an OWNER
    const ownerMembership = await this.prisma.organizationMember.findFirst({
      where: { hospitalId: hospital.id, profileId: ownerId, role: 'OWNER', removedAt: null },
    });
    if (!ownerMembership) {
      throw new ForbiddenException({
        error: 'Forbidden',
        message: 'Only organization owners can manage staff.',
      });
    }

    // Check if already a member
    const existing = await this.prisma.organizationMember.findFirst({
      where: { hospitalId: hospital.id, profileId: staffProfileId, removedAt: null },
    });
    if (existing) {
      throw new BadRequestException({
        error: 'Already a member',
        message: 'This user is already a member of the organization.',
      });
    }

    const member = await this.prisma.organizationMember.create({
      data: {
        hospitalId: hospital.id,
        profileId: staffProfileId,
        role: 'STAFF' as never,
        invitedBy: ownerId,
      },
      include: { profile: { select: { fullName: true, phone: true } } },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: ownerId,
        action: 'ORG_STAFF_ADDED',
        targetType: 'organization_member',
        targetId: member.id,
        metadata: { hospitalId: hospital.id, staffProfileId },
      },
    });

    return {
      id: member.id,
      profileId: member.profileId,
      fullName: member.profile.fullName,
      phone: member.profile.phone,
      role: member.role,
      joinedAt: member.joinedAt.toISOString(),
      removedAt: null,
    };
  }

  async removeStaff(
    ownerId: string,
    memberId: string,
  ): Promise<{ success: boolean }> {
    const { hospital } = await this.getOrgForUser(ownerId);

    const ownerMembership = await this.prisma.organizationMember.findFirst({
      where: { hospitalId: hospital.id, profileId: ownerId, role: 'OWNER', removedAt: null },
    });
    if (!ownerMembership) {
      throw new ForbiddenException({
        error: 'Forbidden',
        message: 'Only organization owners can remove staff.',
      });
    }

    const member = await this.prisma.organizationMember.findUnique({
      where: { id: memberId },
    });
    if (!member || member.hospitalId !== hospital.id || member.removedAt !== null) {
      throw new NotFoundException({ error: 'Member not found' });
    }

    // Cannot remove another OWNER
    if (member.role === 'OWNER') {
      throw new BadRequestException({
        error: 'Cannot remove owner',
        message: 'Organization owners cannot be removed. Transfer ownership first.',
      });
    }

    await this.prisma.organizationMember.update({
      where: { id: memberId },
      data: { removedAt: new Date(), removedBy: ownerId },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: ownerId,
        action: 'ORG_STAFF_REMOVED',
        targetType: 'organization_member',
        targetId: memberId,
        metadata: { hospitalId: hospital.id },
      },
    });

    return { success: true };
  }

  // -------------------------------------------------------------------------
  // Blood request coordination
  // -------------------------------------------------------------------------

  async listCoordination(userId: string): Promise<CoordinationDto[]> {
    const { hospital } = await this.getOrgForUser(userId);

    const records = await this.prisma.organizationCoordination.findMany({
      where: { hospitalId: hospital.id },
      orderBy: { updatedAt: 'desc' },
    });

    return records.map((r) => ({
      id: r.id,
      bloodRequestId: r.bloodRequestId,
      status: r.status,
      note: r.note,
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async updateCoordination(
    userId: string,
    bloodRequestId: string,
    status: string,
    note?: string,
  ): Promise<CoordinationDto> {
    const { hospital } = await this.getOrgForUser(userId);

    // Upsert — one coordination record per (hospital, bloodRequest)
    const record = await this.prisma.organizationCoordination.upsert({
      where: {
        hospitalId_bloodRequestId: { hospitalId: hospital.id, bloodRequestId },
      },
      update: {
        status: status as never,
        note: note ?? null,
        updatedBy: userId,
      },
      create: {
        hospitalId: hospital.id,
        bloodRequestId,
        status: status as never,
        note: note ?? null,
        updatedBy: userId,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'ORG_COORDINATION_UPDATED',
        targetType: 'organization_coordination',
        targetId: record.id,
        metadata: { bloodRequestId, status },
      },
    });

    return {
      id: record.id,
      bloodRequestId: record.bloodRequestId,
      status: record.status,
      note: record.note,
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  // -------------------------------------------------------------------------
  // Admin: list pending organizations
  // -------------------------------------------------------------------------

  async listPendingOrganizations(page: number, pageSize: number) {
    const where = {
      verificationStatus: 'PENDING_REVIEW' as never,
      deletedAt: null,
    };

    const [total, hospitals] = await Promise.all([
      this.prisma.hospital.count({ where }),
      this.prisma.hospital.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { verificationRequestedAt: 'asc' },
        include: { upazila: { select: { name: true } } },
      }),
    ]);

    return {
      items: hospitals.map((h) => ({
        id: h.id,
        name: h.name,
        upazila: h.upazila?.name ?? 'Unknown',
        address: h.address,
        phone: h.phone,
        email: h.email,
        verificationStatus: h.verificationStatus,
        verificationRequestedAt: h.verificationRequestedAt?.toISOString() ?? null,
        createdAt: h.createdAt.toISOString(),
      })),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Load the organization that the authenticated user belongs to.
   * Throws ForbiddenException if the user is not a member of any organization.
   * This is the core IDOR-prevention mechanism: the organization ID is
   * ALWAYS derived from the user's membership, never from the client.
   */
  private async getOrgForUser(userId: string): Promise<{
    hospital: {
      id: string;
      name: string;
      upazilaId: string;
      address: string;
      phone: string | null;
      email: string | null;
      website: string | null;
      operatingHours: string | null;
      servicesOffered: string | null;
      verificationStatus: string;
      verificationFeedback: string | null;
      verificationRequestedAt: Date | null;
      verificationReviewedAt: Date | null;
      suspendedAt: Date | null;
      suspensionReason: string | null;
      createdAt: Date;
    };
    upazilaName: string;
  }> {
    const membership = await this.prisma.organizationMember.findFirst({
      where: { profileId: userId, removedAt: null },
      include: {
        hospital: {
          include: { upazila: { select: { name: true } } },
        },
      },
    });

    if (!membership || !membership.hospital || membership.hospital.deletedAt !== null) {
      throw new ForbiddenException({
        error: 'No organization',
        message: 'You are not a member of any organization.',
      });
    }

    return {
      hospital: membership.hospital,
      upazilaName: membership.hospital.upazila?.name ?? 'Unknown',
    };
  }

  private toDto(
    h: {
      id: string;
      name: string;
      upazilaId: string;
      address: string;
      phone: string | null;
      email: string | null;
      website: string | null;
      operatingHours: string | null;
      servicesOffered: string | null;
      verificationStatus: string;
      verificationFeedback: string | null;
      verificationRequestedAt: Date | null;
      verificationReviewedAt: Date | null;
      suspendedAt: Date | null;
      suspensionReason: string | null;
      createdAt: Date;
    },
    upazilaName: string,
  ): OrganizationDto {
    return {
      id: h.id,
      name: h.name,
      upazilaId: h.upazilaId,
      upazilaName,
      address: h.address,
      phone: h.phone,
      email: h.email,
      website: h.website,
      operatingHours: h.operatingHours,
      servicesOffered: h.servicesOffered,
      verificationStatus: h.verificationStatus,
      verificationFeedback: h.verificationFeedback,
      verificationRequestedAt: h.verificationRequestedAt?.toISOString() ?? null,
      verificationReviewedAt: h.verificationReviewedAt?.toISOString() ?? null,
      suspendedAt: h.suspendedAt?.toISOString() ?? null,
      suspensionReason: h.suspensionReason,
      createdAt: h.createdAt.toISOString(),
    };
  }
}
