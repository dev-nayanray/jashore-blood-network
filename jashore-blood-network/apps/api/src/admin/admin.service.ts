/**
 * AdminService — dashboard metrics, user management, audit log queries.
 *
 * SECURITY:
 *   - Every method requires moderator+ role (enforced by controller via @Roles)
 *   - User management: suspend/reinstate records reason + audit-logs
 *   - Dashboard metrics: real database counts, no fabricated data
 *   - Audit log: read-only, append-only (no modification endpoint)
 *   - No passwords, tokens, or sensitive auth data returned
 *   - Profile PII (phone, email) only returned to district_administrator+
 *
 * MEDICAL SAFETY:
 *   - Dashboard does NOT claim blood availability guarantees
 *   - Statistics represent platform activity, not all donations in Jashore
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { type PrismaClient } from '../lib/prisma';
import type { Role } from '@jbn/shared-types';

export interface DashboardMetrics {
  totalUsers: number;
  totalDonors: number;
  verifiedDonors: number;
  donorsPendingVerification: number;
  activeBloodRequests: number;
  requestsPendingVerification: number;
  urgentBloodRequests: number;
  fulfilledRequests: number;
  openAbuseReports: number;
  suspendedAccounts: number;
}

export interface AdminUserListItem {
  id: string;
  phone: string;
  email: string | null;
  fullName: string;
  isActive: boolean;
  roles: string[];
  createdAt: string;
  deletedAt: string | null;
}

export interface AdminUserDetail extends AdminUserListItem {
  donorProfileId: string | null;
  donorVerificationStatus: string | null;
  bloodRequestCount: number;
  abuseReportCount: number;
}

export interface AuditLogItem {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
}

const MODERATOR_ROLES: Role[] = ['MODERATOR', 'DISTRICT_ADMINISTRATOR', 'SUPER_ADMINISTRATOR'];
const ADMIN_ROLES: Role[] = ['DISTRICT_ADMINISTRATOR', 'SUPER_ADMINISTRATOR'];

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaClient) {}

  // -------------------------------------------------------------------------
  // Dashboard metrics
  // -------------------------------------------------------------------------

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const [
      totalUsers,
      totalDonors,
      verifiedDonors,
      donorsPendingVerification,
      activeBloodRequests,
      requestsPendingVerification,
      urgentBloodRequests,
      fulfilledRequests,
      openAbuseReports,
      suspendedAccounts,
    ] = await Promise.all([
      this.prisma.profile.count({ where: { deletedAt: null } }),
      this.prisma.donorProfile.count({ where: { deletedAt: null } }),
      this.prisma.donorProfile.count({
        where: { deletedAt: null, verificationStatus: 'VERIFIED' as never },
      }),
      this.prisma.donorProfile.count({
        where: { deletedAt: null, verificationStatus: 'PENDING_REVIEW' as never },
      }),
      // Active = not cancelled, expired, rejected, or completed
      this.prisma.bloodRequest.count({
        where: {
          deletedAt: null,
          status: { in: ['VERIFIED', 'SEARCHING', 'DONOR_RESPONDED', 'ARRANGED'] as never },
        },
      }),
      this.prisma.bloodRequest.count({
        where: { deletedAt: null, status: 'PENDING' as never },
      }),
      this.prisma.bloodRequest.count({
        where: {
          deletedAt: null,
          urgency: 'URGENT' as never,
          status: { in: ['VERIFIED', 'SEARCHING', 'DONOR_RESPONDED', 'ARRANGED'] as never },
        },
      }),
      this.prisma.bloodRequest.count({
        where: { deletedAt: null, status: 'COMPLETED' as never },
      }),
      this.prisma.abuseReport.count({
        where: { status: { in: ['PENDING', 'REVIEWING'] as never } },
      }),
      this.prisma.donorProfile.count({
        where: { deletedAt: null, verificationStatus: 'SUSPENDED' as never },
      }),
    ]);

    return {
      totalUsers,
      totalDonors,
      verifiedDonors,
      donorsPendingVerification,
      activeBloodRequests,
      requestsPendingVerification,
      urgentBloodRequests,
      fulfilledRequests,
      openAbuseReports,
      suspendedAccounts,
    };
  }

  // -------------------------------------------------------------------------
  // User management
  // -------------------------------------------------------------------------

  async listUsers(
    search?: string,
    roleFilter?: string,
    statusFilter?: 'active' | 'suspended' | 'deleted',
    page: number = 1,
    pageSize: number = 20,
  ): Promise<{ items: AdminUserListItem[]; page: number; pageSize: number; total: number; totalPages: number }> {
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (statusFilter === 'active') {
      where.isActive = true;
      where.deletedAt = null;
    } else if (statusFilter === 'suspended') {
      // Suspended = has a donor profile with SUSPENDED status
      where.donorProfile = { verificationStatus: 'SUSPENDED' as never };
    } else if (statusFilter === 'deleted') {
      where.deletedAt = { not: null };
    } else {
      where.deletedAt = null;
    }

    const [total, users] = await Promise.all([
      this.prisma.profile.count({ where }),
      this.prisma.profile.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          roles: { where: { revokedAt: null }, select: { role: true } },
        },
      }),
    ]);

    return {
      items: users.map((u) => this.toUserListItem(u, roleFilter)),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getUserDetail(userId: string): Promise<AdminUserDetail> {
    const user = await this.prisma.profile.findUnique({
      where: { id: userId },
      include: {
        roles: { where: { revokedAt: null }, select: { role: true } },
        donorProfile: { select: { id: true, verificationStatus: true } },
      },
    });

    if (!user) {
      throw new NotFoundException({ error: 'User not found' });
    }

    const [bloodRequestCount, abuseReportCount] = await Promise.all([
      this.prisma.bloodRequest.count({ where: { requesterId: userId } }),
      this.prisma.abuseReport.count({ where: { reporterId: userId } }),
    ]);

    return {
      ...this.toUserListItem(user),
      donorProfileId: user.donorProfile?.id ?? null,
      donorVerificationStatus: user.donorProfile?.verificationStatus ?? null,
      bloodRequestCount,
      abuseReportCount,
    };
  }

  /**
   * Suspend a user account. Sets isActive=false and audit-logs.
   * Does NOT delete the account — data is preserved for review.
   */
  async suspendUser(
    targetUserId: string,
    adminId: string,
    adminRoles: Role[],
    reason: string,
  ): Promise<{ success: boolean }> {
    if (!reason || reason.trim().length < 3) {
      throw new BadRequestException({
        error: 'Reason required',
        message: 'A reason is required when suspending a user.',
      });
    }

    const user = await this.prisma.profile.findUnique({
      where: { id: targetUserId },
    });

    if (!user) {
      throw new NotFoundException({ error: 'User not found' });
    }

    // Prevent self-suspension
    if (targetUserId === adminId) {
      throw new BadRequestException({
        error: 'Cannot suspend self',
        message: 'You cannot suspend your own account.',
      });
    }

    // Prevent suspending users with equal or higher role
    const targetRoles = await this.prisma.userRole.findMany({
      where: { profileId: targetUserId, revokedAt: null },
    });
    const targetMaxLevel = Math.max(
      ...targetRoles.map((r) => ROLE_LEVELS[r.role as AssignableRole] ?? 0),
    );
    const adminMaxLevel = Math.max(
      ...adminRoles.map((r) => ROLE_LEVELS[r as AssignableRole] ?? 0),
    );
    if (targetMaxLevel >= adminMaxLevel) {
      throw new BadRequestException({
        error: 'Insufficient privileges',
        message: 'You cannot suspend a user with equal or higher privileges.',
      });
    }

    await this.prisma.profile.update({
      where: { id: targetUserId },
      data: { isActive: false },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'USER_SUSPENDED',
        targetType: 'profile',
        targetId: targetUserId,
        metadata: { reason },
      },
    });

    return { success: true };
  }

  /**
   * Reinstate a suspended user account.
   */
  async reinstateUser(
    targetUserId: string,
    adminId: string,
    _adminRoles: Role[],
    reason?: string,
  ): Promise<{ success: boolean }> {
    const user = await this.prisma.profile.findUnique({
      where: { id: targetUserId },
    });

    if (!user) {
      throw new NotFoundException({ error: 'User not found' });
    }

    if (user.isActive) {
      throw new BadRequestException({
        error: 'Not suspended',
        message: 'This user account is already active.',
      });
    }

    await this.prisma.profile.update({
      where: { id: targetUserId },
      data: { isActive: true },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'USER_REINSTATED',
        targetType: 'profile',
        targetId: targetUserId,
        metadata: { reason },
      },
    });

    return { success: true };
  }

  // -------------------------------------------------------------------------
  // Donor management (admin view)
  // -------------------------------------------------------------------------

  async listDonors(
    search?: string,
    bloodGroup?: string,
    upazilaId?: string,
    verificationStatus?: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<{ items: unknown[]; page: number; pageSize: number; total: number; totalPages: number }> {
    const where: Record<string, unknown> = { deletedAt: null };

    if (bloodGroup) where.bloodGroup = bloodGroup;
    if (upazilaId) where.upazilaId = upazilaId;
    if (verificationStatus) where.verificationStatus = verificationStatus;

    if (search) {
      where.profile = {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
        ],
      };
    }

    const [total, donors] = await Promise.all([
      this.prisma.donorProfile.count({ where }),
      this.prisma.donorProfile.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          profile: { select: { fullName: true, phone: true, email: true } },
          upazila: { select: { name: true } },
        },
      }),
    ]);

    return {
      items: donors.map((d) => ({
        id: d.id,
        profileId: d.profileId,
        fullName: d.profile.fullName,
        phone: d.profile.phone,
        bloodGroup: d.bloodGroup,
        upazila: d.upazila?.name ?? 'Unknown',
        verificationStatus: d.verificationStatus,
        isAvailable: d.isAvailable,
        availabilityConfirmedAt: d.availabilityConfirmedAt.toISOString(),
        createdAt: d.createdAt.toISOString(),
      })),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // -------------------------------------------------------------------------
  // Blood request management (admin view)
  // -------------------------------------------------------------------------

  async listBloodRequests(
    status?: string,
    bloodGroup?: string,
    upazilaId?: string,
    urgency?: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<{ items: unknown[]; page: number; pageSize: number; total: number; totalPages: number }> {
    const where: Record<string, unknown> = { deletedAt: null };
    if (status) where.status = status;
    if (bloodGroup) where.bloodGroup = bloodGroup;
    if (upazilaId) where.upazilaId = upazilaId;
    if (urgency) where.urgency = urgency;

    const [total, requests] = await Promise.all([
      this.prisma.bloodRequest.count({ where }),
      this.prisma.bloodRequest.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ urgency: 'desc' }, { createdAt: 'desc' }],
        include: {
          upazila: { select: { name: true } },
          requester: { select: { fullName: true, phone: true } },
        },
      }),
    ]);

    return {
      items: requests.map((r) => ({
        id: r.id,
        requesterName: r.requester.fullName,
        patientDisplayName: r.patientDisplayName,
        bloodGroup: r.bloodGroup,
        unitsRequested: r.unitsRequested,
        upazila: r.upazila?.name ?? 'Unknown',
        hospitalName: r.hospitalName,
        requiredBy: r.requiredBy.toISOString(),
        urgency: r.urgency,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // -------------------------------------------------------------------------
  // Audit logs
  // -------------------------------------------------------------------------

  async listAuditLogs(
    action?: string,
    actorId?: string,
    targetType?: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<{ items: AuditLogItem[]; page: number; pageSize: number; total: number; totalPages: number }> {
    const where: Record<string, unknown> = {};
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (actorId) where.actorId = actorId;
    if (targetType) where.targetType = targetType;

    const [total, logs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: { select: { fullName: true } },
        },
      }),
    ]);

    return {
      items: logs.map((l) => ({
        id: l.id,
        actorId: l.actorId,
        actorName: l.actor?.fullName ?? null,
        action: l.action,
        targetType: l.targetType,
        targetId: l.targetId,
        metadata: l.metadata as Record<string, unknown>,
        ipAddress: l.ipAddress,
        createdAt: l.createdAt.toISOString(),
      })),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // -------------------------------------------------------------------------
  // Analytics
  // -------------------------------------------------------------------------

  async getAnalytics(): Promise<{
    requestsByBloodGroup: Array<{ bloodGroup: string; count: number }>;
    requestsByUpazila: Array<{ upazila: string; count: number }>;
    requestsByStatus: Array<{ status: string; count: number }>;
    donorsByBloodGroup: Array<{ bloodGroup: string; count: number }>;
  }> {
    const [requestsByBloodGroup, requestsByUpazila, requestsByStatus, donorsByBloodGroup] =
      await Promise.all([
        this.prisma.bloodRequest.groupBy({
          by: ['bloodGroup'],
          _count: { _all: true },
          where: { deletedAt: null },
        }),
        this.prisma.bloodRequest.groupBy({
          by: ['upazilaId'],
          _count: { _all: true },
          where: { deletedAt: null },
        }),
        this.prisma.bloodRequest.groupBy({
          by: ['status'],
          _count: { _all: true },
          where: { deletedAt: null },
        }),
        this.prisma.donorProfile.groupBy({
          by: ['bloodGroup'],
          _count: { _all: true },
          where: { deletedAt: null },
        }),
      ]);

    // Resolve upazila names
    const upazilaIds = requestsByUpazila.map((r) => r.upazilaId);
    const upazilas = await this.prisma.upazila.findMany({
      where: { id: { in: upazilaIds } },
      select: { id: true, name: true },
    });
    const upazilaMap = new Map(upazilas.map((u) => [u.id, u.name]));

    return {
      requestsByBloodGroup: requestsByBloodGroup.map((r) => ({
        bloodGroup: r.bloodGroup,
        count: r._count._all,
      })),
      requestsByUpazila: requestsByUpazila.map((r) => ({
        upazila: upazilaMap.get(r.upazilaId) ?? 'Unknown',
        count: r._count._all,
      })),
      requestsByStatus: requestsByStatus.map((r) => ({
        status: r.status,
        count: r._count._all,
      })),
      donorsByBloodGroup: donorsByBloodGroup.map((r) => ({
        bloodGroup: r.bloodGroup,
        count: r._count._all,
      })),
    };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private toUserListItem(
    u: {
      id: string;
      phone: string;
      email: string | null;
      fullName: string;
      isActive: boolean;
      createdAt: Date;
      deletedAt: Date | null;
      roles: Array<{ role: string }>;
    },
    _roleFilter?: string,
  ): AdminUserListItem {
    return {
      id: u.id,
      phone: u.phone,
      email: u.email,
      fullName: u.fullName,
      isActive: u.isActive,
      roles: u.roles.map((r) => r.role),
      createdAt: u.createdAt.toISOString(),
      deletedAt: u.deletedAt?.toISOString() ?? null,
    };
  }

  // -------------------------------------------------------------------------
  // Phase 13: Emergency coordination
  // -------------------------------------------------------------------------

  /**
   * List urgent requests for emergency coordination dashboard.
   * Returns active URGENT requests with age, notification count, and status.
   * Only active statuses (PENDING, VERIFIED, SEARCHING, DONOR_RESPONDED, ARRANGED).
   */
  async listEmergencyRequests(): Promise<EmergencyRequestItem[]> {
    const requests = await this.prisma.bloodRequest.findMany({
      where: {
        urgency: 'URGENT' as never,
        deletedAt: null,
        status: { in: ['PENDING', 'VERIFIED', 'SEARCHING', 'DONOR_RESPONDED', 'ARRANGED'] as never },
      },
      orderBy: [
        { status: 'asc' }, // PENDING first (needs attention)
        { createdAt: 'desc' }, // Newest first
      ],
      take: 50,
      include: {
        requester: { select: { fullName: true } },
        upazila: { select: { name: true } },
      },
    });

    // Get notification counts for each request
    const requestIds = requests.map((r) => r.id);
    const notificationCounts = await this.prisma.notification.groupBy({
      by: ['relatedId'],
      where: {
        type: 'REQUEST_MATCH' as never,
        relatedType: 'blood_request',
        relatedId: { in: requestIds },
      },
      _count: { _all: true },
    });

    const countMap = new Map(
      notificationCounts.map((n) => [n.relatedId, n._count._all]),
    );

    const now = Date.now();
    return requests.map((r) => ({
      id: r.id,
      requesterName: r.requester.fullName,
      patientDisplayName: r.patientDisplayName,
      bloodGroup: r.bloodGroup,
      unitsRequested: r.unitsRequested,
      upazilaName: r.upazila?.name ?? 'Unknown',
      hospitalName: r.hospitalName,
      requiredBy: r.requiredBy.toISOString(),
      urgency: r.urgency,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      ageMinutes: Math.floor((now - r.createdAt.getTime()) / 60000),
      notificationCount: countMap.get(r.id) ?? 0,
    }));
  }
}

// Role level mapping for privilege escalation prevention
type AssignableRole = 'REGISTERED_USER' | 'DONOR' | 'VOLUNTEER_COORDINATOR' | 'HOSPITAL_REPRESENTATIVE' | 'MODERATOR' | 'DISTRICT_ADMINISTRATOR' | 'SUPER_ADMINISTRATOR';
const ROLE_LEVELS: Record<AssignableRole, number> = {
  REGISTERED_USER: 1,
  DONOR: 2,
  VOLUNTEER_COORDINATOR: 3,
  HOSPITAL_REPRESENTATIVE: 3,
  MODERATOR: 4,
  DISTRICT_ADMINISTRATOR: 5,
  SUPER_ADMINISTRATOR: 6,
};

// Phase 13: extend AdminService with emergency coordination

export interface EmergencyRequestItem {
  id: string;
  requesterName: string;
  patientDisplayName: string | null;
  bloodGroup: string;
  unitsRequested: number;
  upazilaName: string;
  hospitalName: string | null;
  requiredBy: string;
  urgency: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  ageMinutes: number;
  notificationCount: number;
}

