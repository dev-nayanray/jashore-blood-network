/**
 * BloodRequestsService — blood request CRUD + status management.
 *
 * SECURITY MODEL:
 *   - All create operations derive `requesterId` from the authenticated
 *     user — NEVER from the request body.
 *   - Update/cancel operations load the request first, verify ownership
 *     (requesterId === userId) OR admin role, then apply the change.
 *   - Status transitions have role-based authorization:
 *       * Owner can: CANCEL (own requests only)
 *       * Moderator+ can: VERIFY, REJECT
 *       * SEARCHING is auto-set when a request is verified
 *       * COMPLETED requires a separate flow (Phase 6+ donor response)
 *   - Public listing returns only non-deleted, active-status requests.
 *     PENDING/REJECTED/CANCELLED/EXPIRED/COMPLETED are hidden from
 *     non-owners (only VERIFIED/SEARCHING/DONOR_RESPONDED/ARRANGED are public).
 *   - Public detail view returns the same projection as listing.
 *     Owner detail view includes additional fields (contactNote, notes).
 *
 * MEDICAL SAFETY:
 *   - The service NEVER marks a request as COMPLETED automatically.
 *   - A donor response does NOT fulfill a request.
 *   - Completion requires manual confirmation by the requester or admin.
 *   - Medical eligibility is determined by the blood bank, not this platform.
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { Prisma, type PrismaClient } from '../lib/prisma';
import { NotificationsService } from '../notifications/notifications.service';
import type {
  CreateBloodRequestInput,
  UpdateBloodRequestInput,
  UpdateRequestStatusInput,
  SearchBloodRequestsInput,
} from '@jbn/validation';
import type { Role } from '@jbn/shared-types';

// Status transitions allowed per role
const OWNER_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CANCELLED'],
  VERIFIED: ['CANCELLED'],
  SEARCHING: ['CANCELLED'],
  DONOR_RESPONDED: ['CANCELLED'],
  ARRANGED: ['CANCELLED', 'COMPLETED'],
};

const MODERATOR_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['VERIFIED', 'REJECTED', 'CANCELLED'],
  VERIFIED: ['REJECTED', 'CANCELLED'],
  SEARCHING: ['REJECTED', 'CANCELLED'],
  DONOR_RESPONDED: ['REJECTED', 'CANCELLED'],
  ARRANGED: ['REJECTED', 'CANCELLED', 'COMPLETED'],
};

// Statuses visible in public listing (non-owner)
const PUBLIC_VISIBLE_STATUSES = [
  'VERIFIED',
  'SEARCHING',
  'DONOR_RESPONDED',
  'ARRANGED',
];

export interface BloodRequestPublic {
  id: string;
  patientDisplayName: string | null;
  bloodGroup: string;
  bloodComponent: string | null;
  unitsRequested: number;
  upazila: { id: string; name: string };
  hospitalName: string | null;
  requiredBy: string;
  urgency: string;
  status: string;
  createdAt: string;
  // NOTE: no contactMethod, contactNote, notes, requesterId — private
}

export interface BloodRequestDetail extends BloodRequestPublic {
  contactMethod: string;
  contactNote: string | null;
  notes: string | null;
  expiresAt: string;
  updatedAt: string;
  isOwner: boolean;
}

export interface BloodRequestListResponse {
  items: BloodRequestPublic[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

@Injectable()
export class BloodRequestsService {
  private readonly logger = new Logger(BloodRequestsService.name);

  constructor(
    private readonly prisma: PrismaClient,
    @Optional() private readonly notificationsService?: NotificationsService,
  ) {}

  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------

  async createRequest(
    requesterId: string,
    input: CreateBloodRequestInput,
    metadata: { ipAddress?: string; userAgent?: string },
  ): Promise<BloodRequestDetail> {
    // Verify upazila exists
    const upazila = await this.prisma.upazila.findUnique({
      where: { id: input.upazilaId },
    });
    if (!upazila) {
      throw new BadRequestException({
        error: 'Invalid upazila',
        message: 'The selected upazila does not exist.',
      });
    }

    const requiredBy = new Date(input.requiredBy);
    const expiresAt = new Date(requiredBy.getTime() + 24 * 60 * 60 * 1000); // +24h

    const request = await this.prisma.bloodRequest.create({
      data: {
        requesterId, // derived from auth — NEVER from body
        patientDisplayName: input.patientDisplayName ?? null,
        bloodGroup: input.bloodGroup as never,
        bloodComponent: (input.bloodComponent ?? null) as never,
        unitsRequested: input.unitsRequested,
        upazilaId: input.upazilaId,
        hospitalId: input.hospitalId ?? null,
        hospitalName: input.hospitalName ?? null,
        requiredBy,
        urgency: input.urgency as never,
        contactMethod: input.contactMethod as never,
        contactNote: input.contactNote ?? null,
        notes: input.notes ?? null,
        expiresAt,
        status: 'PENDING' as never,
      },
      include: {
        upazila: { select: { id: true, name: true } },
      },
    });

    // Audit-log the creation
    await this.prisma.auditLog.create({
      data: {
        actorId: requesterId,
        action: 'BLOOD_REQUEST_CREATED',
        targetType: 'blood_request',
        targetId: request.id,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        metadata: {
          bloodGroup: input.bloodGroup,
          unitsRequested: input.unitsRequested,
          upazilaId: input.upazilaId,
          urgency: input.urgency,
        },
      },
    });

    return this.toDetail(request, true);
  }

  // -------------------------------------------------------------------------
  // List (public)
  // -------------------------------------------------------------------------

  async listRequests(
    input: SearchBloodRequestsInput,
    viewerId?: string,
  ): Promise<BloodRequestListResponse> {
    const where: Prisma.BloodRequestWhereInput = {
      deletedAt: null,
    };

    // Public viewers see only active statuses; the owner sees their own
    // requests in any status.
    if (input.status) {
      where.status = input.status as never;
    } else {
      where.OR = [
        { status: { in: PUBLIC_VISIBLE_STATUSES as never } },
        ...(viewerId ? [{ requesterId: viewerId }] : []),
      ];
    }

    if (input.bloodGroup) where.bloodGroup = input.bloodGroup as never;
    if (input.upazilaId) where.upazilaId = input.upazilaId;
    if (input.urgency) where.urgency = input.urgency as never;

    const [total, items] = await Promise.all([
      this.prisma.bloodRequest.count({ where }),
      this.prisma.bloodRequest.findMany({
        where,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        orderBy: [
          { urgency: 'desc' }, // URGENT first
          { createdAt: 'desc' },
        ],
        include: {
          upazila: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      items: items.map((r) => this.toPublic(r)),
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: Math.ceil(total / input.pageSize),
      hasMore: input.page * input.pageSize < total,
    };
  }

  // -------------------------------------------------------------------------
  // Detail
  // -------------------------------------------------------------------------

  async getRequest(id: string, viewerId?: string): Promise<BloodRequestDetail> {
    const request = await this.prisma.bloodRequest.findUnique({
      where: { id },
      include: {
        upazila: { select: { id: true, name: true } },
      },
    });

    if (!request || request.deletedAt !== null) {
      throw new NotFoundException({
        error: 'Request not found',
        message: 'This blood request does not exist or has been removed.',
      });
    }

    const isOwner = viewerId === request.requesterId;

    // Non-owners can only see public statuses
    if (!isOwner && !PUBLIC_VISIBLE_STATUSES.includes(request.status)) {
      throw new NotFoundException({
        error: 'Request not found',
        message: 'This blood request is not publicly visible.',
      });
    }

    return this.toDetail(request, isOwner);
  }

  // -------------------------------------------------------------------------
  // Update (owner only)
  // -------------------------------------------------------------------------

  async updateRequest(
    id: string,
    userId: string,
    userRoles: Role[],
    input: UpdateBloodRequestInput,
    metadata: { ipAddress?: string; userAgent?: string },
  ): Promise<BloodRequestDetail> {
    const request = await this.loadAndAuthorize(id, userId, userRoles);

    // Only allow updates on PENDING or VERIFIED requests
    if (!['PENDING', 'VERIFIED'].includes(request.status)) {
      throw new BadRequestException({
        error: 'Cannot update',
        message: 'This request can no longer be edited because of its status.',
      });
    }

    const updateData: Prisma.BloodRequestUpdateInput = {};
    if (input.patientDisplayName !== undefined)
      updateData.patientDisplayName = input.patientDisplayName;
    if (input.bloodGroup !== undefined) updateData.bloodGroup = input.bloodGroup as never;
    if (input.bloodComponent !== undefined)
      updateData.bloodComponent = (input.bloodComponent ?? null) as never;
    if (input.unitsRequested !== undefined) updateData.unitsRequested = input.unitsRequested;
    if (input.upazilaId !== undefined) {
      const upazila = await this.prisma.upazila.findUnique({
        where: { id: input.upazilaId },
      });
      if (!upazila) throw new BadRequestException({ error: 'Invalid upazila' });
      updateData.upazila = { connect: { id: input.upazilaId } };
    }
    if (input.hospitalId !== undefined)
      updateData.hospital =
        input.hospitalId === null ? { disconnect: true } : { connect: { id: input.hospitalId } };
    if (input.hospitalName !== undefined) updateData.hospitalName = input.hospitalName;
    if (input.requiredBy !== undefined) {
      const requiredBy = new Date(input.requiredBy);
      updateData.requiredBy = requiredBy;
      updateData.expiresAt = new Date(requiredBy.getTime() + 24 * 60 * 60 * 1000);
    }
    if (input.urgency !== undefined) updateData.urgency = input.urgency as never;
    if (input.contactMethod !== undefined) updateData.contactMethod = input.contactMethod as never;
    if (input.contactNote !== undefined) updateData.contactNote = input.contactNote;
    if (input.notes !== undefined) updateData.notes = input.notes;

    // CRITICAL: requesterId and status are NEVER in updateData
    const updated = await this.prisma.bloodRequest.update({
      where: { id },
      data: updateData,
      include: { upazila: { select: { id: true, name: true } } },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'BLOOD_REQUEST_UPDATED',
        targetType: 'blood_request',
        targetId: id,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        metadata: { changedFields: Object.keys(updateData) },
      },
    });

    return this.toDetail(updated, true);
  }

  // -------------------------------------------------------------------------
  // Status change (owner: cancel; moderator+: verify/reject)
  // -------------------------------------------------------------------------

  async changeStatus(
    id: string,
    userId: string,
    userRoles: Role[],
    input: UpdateRequestStatusInput,
    metadata: { ipAddress?: string; userAgent?: string },
  ): Promise<BloodRequestDetail> {
    const request = await this.loadAndAuthorize(id, userId, userRoles);
    const newStatus = input.status;
    const currentStatus = request.status;

    const isOwner = request.requesterId === userId;
    const isModeratorPlus = userRoles.some((r) =>
      ['MODERATOR', 'DISTRICT_ADMINISTRATOR', 'SUPER_ADMINISTRATOR'].includes(r),
    );

    // 1. Role-based authorization FIRST (before transition validity)
    // This ensures ForbiddenException is thrown when a user lacks the role,
    // even if the transition would also be invalid.
    if (['VERIFIED', 'REJECTED'].includes(newStatus) && !isModeratorPlus) {
      throw new ForbiddenException({
        error: 'Forbidden',
        message: 'Only moderators can verify or reject requests.',
      });
    }
    if (newStatus === 'CANCELLED' && !isOwner && !isModeratorPlus) {
      throw new ForbiddenException({
        error: 'Forbidden',
        message: 'Only the requester or a moderator can cancel this request.',
      });
    }
    if (newStatus === 'COMPLETED' && !isOwner && !isModeratorPlus) {
      throw new ForbiddenException({
        error: 'Forbidden',
        message: 'Only the requester or a moderator can mark a request as completed.',
      });
    }

    // 2. Transition validity (using the appropriate role's transition table)
    const allowedTransitions = isModeratorPlus
      ? MODERATOR_ALLOWED_TRANSITIONS[currentStatus] ?? []
      : OWNER_ALLOWED_TRANSITIONS[currentStatus] ?? [];

    if (!allowedTransitions.includes(newStatus)) {
      throw new BadRequestException({
        error: 'Invalid status transition',
        message: `Cannot change status from ${currentStatus} to ${newStatus}.`,
      });
    }

    const updateData: Prisma.BloodRequestUpdateInput = {
      status: newStatus as never,
    };

    // Set verifier/verifiedAt when verifying
    if (newStatus === 'VERIFIED') {
      updateData.verifier = { connect: { id: userId } };
      updateData.verifiedAt = new Date();
    }

    // Set cancelledAt/cancellationReason when cancelling
    if (newStatus === 'CANCELLED') {
      updateData.cancelledAt = new Date();
      updateData.cancellationReason = input.reason ?? null;
    }

    const updated = await this.prisma.bloodRequest.update({
      where: { id },
      data: updateData,
      include: { upazila: { select: { id: true, name: true } } },
    });

    // Audit-log the status change
    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'BLOOD_REQUEST_STATUS_CHANGED',
        targetType: 'blood_request',
        targetId: id,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        metadata: {
          from: currentStatus,
          to: newStatus,
          reason: input.reason,
        },
      },
    });

    // Auto-transition VERIFIED -> SEARCHING (the request is now publicly visible)
    // AND trigger donor matching notifications
    if (newStatus === 'VERIFIED') {
      const refreshed = await this.prisma.bloodRequest.update({
        where: { id },
        data: { status: 'SEARCHING' as never },
        include: { upazila: { select: { id: true, name: true } } },
      });

      // Trigger donor matching (async, non-blocking — failures are logged but don't block)
      if (this.notificationsService) {
        void this.notificationsService
          .notifyMatchingDonors(
            id,
            refreshed.bloodGroup as never,
            refreshed.upazilaId,
            refreshed.urgency,
            refreshed.patientDisplayName,
            refreshed.hospitalName,
          )
          .then((count) => {
            this.logger.log(`Notified ${count} donors for request ${id}`);
          })
          .catch((err) => {
            this.logger.error(
              `Donor matching failed for request ${id}: ${err instanceof Error ? err.message : String(err)}`,
            );
          });
      }

      return this.toDetail(refreshed, isOwner);
    }

    return this.toDetail(updated, isOwner);
  }

  // -------------------------------------------------------------------------
  // List own requests
  // -------------------------------------------------------------------------

  async listMyRequests(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<BloodRequestListResponse> {
    const where: Prisma.BloodRequestWhereInput = {
      requesterId: userId,
      deletedAt: null,
    };

    const [total, items] = await Promise.all([
      this.prisma.bloodRequest.count({ where }),
      this.prisma.bloodRequest.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { upazila: { select: { id: true, name: true } } },
      }),
    ]);

    return {
      items: items.map((r) => this.toPublic(r)),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      hasMore: page * pageSize < total,
    };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Load a request and verify the user is authorized to modify it.
   * Owner (requesterId === userId) OR moderator+ can access.
   * Throws NotFoundException if the request doesn't exist.
   * Throws ForbiddenException if the user is neither owner nor moderator+.
   */
  private async loadAndAuthorize(
    id: string,
    userId: string,
    userRoles: Role[],
  ) {
    const request = await this.prisma.bloodRequest.findUnique({
      where: { id },
    });

    if (!request || request.deletedAt !== null) {
      throw new NotFoundException({
        error: 'Request not found',
        message: 'This blood request does not exist or has been removed.',
      });
    }

    const isOwner = request.requesterId === userId;
    const isModeratorPlus = userRoles.some((r) =>
      ['MODERATOR', 'DISTRICT_ADMINISTRATOR', 'SUPER_ADMINISTRATOR'].includes(r),
    );

    if (!isOwner && !isModeratorPlus) {
      throw new ForbiddenException({
        error: 'Forbidden',
        message: 'You do not have permission to modify this request.',
      });
    }

    return request;
  }

  private toPublic(r: {
    id: string;
    patientDisplayName: string | null;
    bloodGroup: string;
    bloodComponent: string | null;
    unitsRequested: number;
    hospitalName: string | null;
    requiredBy: Date;
    urgency: string;
    status: string;
    createdAt: Date;
    upazila: { id: string; name: string } | null;
  }): BloodRequestPublic {
    return {
      id: r.id,
      patientDisplayName: r.patientDisplayName,
      bloodGroup: r.bloodGroup,
      bloodComponent: r.bloodComponent,
      unitsRequested: r.unitsRequested,
      upazila: r.upazila ?? { id: '', name: 'Unknown' },
      hospitalName: r.hospitalName,
      requiredBy: r.requiredBy.toISOString(),
      urgency: r.urgency,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    };
  }

  private toDetail(
    r: {
      id: string;
      patientDisplayName: string | null;
      bloodGroup: string;
      bloodComponent: string | null;
      unitsRequested: number;
      hospitalName: string | null;
      requiredBy: Date;
      urgency: string;
      status: string;
      createdAt: Date;
      updatedAt: Date;
      expiresAt: Date;
      contactMethod: string;
      contactNote: string | null;
      notes: string | null;
      upazila: { id: string; name: string } | null;
    },
    isOwner: boolean,
  ): BloodRequestDetail {
    return {
      ...this.toPublic(r),
      contactMethod: isOwner ? r.contactMethod : 'IN_APP',
      contactNote: isOwner ? r.contactNote : null,
      notes: isOwner ? r.notes : null,
      expiresAt: r.expiresAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      isOwner,
    };
  }
}
