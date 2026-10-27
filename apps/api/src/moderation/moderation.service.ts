/**
 * ModerationService — abuse report CRUD + admin review queue.
 *
 * SECURITY:
 *   - Any authenticated user can submit a report (reporterId from auth)
 *   - Only moderators+ can view the queue, review, and resolve reports
 *   - Reporters can see only their OWN reports (not other users' reports)
 *   - Reporters cannot see private moderation notes (reviewNote)
 *   - The reported user never sees who reported them
 *   - Duplicate report prevention: one report per (reporter, target) per 24h
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

export type AbuseReportStatus = 'PENDING' | 'REVIEWING' | 'ACTIONED' | 'DISMISSED';

export interface AbuseReportDto {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  description: string | null;
  status: AbuseReportStatus;
  createdAt: string;
  reviewedAt: string | null;
  // NOTE: reviewNote is NOT included — it's private (admin-only)
}

export interface AdminAbuseReportDto extends AbuseReportDto {
  reporterId: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
}

const MODERATOR_ROLES: Role[] = ['MODERATOR', 'DISTRICT_ADMINISTRATOR', 'SUPER_ADMINISTRATOR'];

// Duplicate report prevention window: 24 hours
const DUPLICATE_WINDOW_HOURS = 24;

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(private readonly prisma: PrismaClient) {}

  // -------------------------------------------------------------------------
  // Report submission (any authenticated user)
  // -------------------------------------------------------------------------

  async submitReport(
    reporterId: string,
    targetType: string,
    targetId: string,
    reason: string,
    description?: string,
  ): Promise<AbuseReportDto> {
    if (!reason || reason.trim().length < 3) {
      throw new BadRequestException({
        error: 'Reason required',
        message: 'Please provide a reason for your report (at least 3 characters).',
      });
    }

    // Duplicate prevention: check if this reporter already reported this target recently
    const since = new Date();
    since.setHours(since.getHours() - DUPLICATE_WINDOW_HOURS);

    const existing = await this.prisma.abuseReport.findFirst({
      where: {
        reporterId,
        targetType: targetType as never,
        targetId,
        createdAt: { gte: since },
      },
    });

    if (existing) {
      throw new BadRequestException({
        error: 'Duplicate report',
        message: 'You have already reported this recently. Please wait before reporting again.',
      });
    }

    const report = await this.prisma.abuseReport.create({
      data: {
        reporterId,
        targetType: targetType as never,
        targetId,
        reason,
        description: description ?? null,
        status: 'PENDING' as never,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: reporterId,
        action: 'ABUSE_REPORT_SUBMITTED',
        targetType: 'abuse_report',
        targetId: report.id,
        metadata: { reportTargetType: targetType, reportTargetId: targetId },
      },
    });

    return this.toDto(report);
  }

  /**
   * List the authenticated user's own reports.
   * Reporters see only their own reports — not other users'.
   */
  async listMyReports(reporterId: string, page: number, pageSize: number) {
    const where = { reporterId };
    const [total, items] = await Promise.all([
      this.prisma.abuseReport.count({ where }),
      this.prisma.abuseReport.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      items: items.map(this.toDto),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // -------------------------------------------------------------------------
  // Admin review queue
  // -------------------------------------------------------------------------

  async listPendingReports(
    reviewerRoles: Role[],
    page: number,
    pageSize: number,
    statusFilter?: AbuseReportStatus,
  ) {
    this.requireModerator(reviewerRoles);

    const where = {
      ...(statusFilter ? { status: statusFilter as never } : { status: { in: ['PENDING', 'REVIEWING'] as never } }),
    };

    const [total, items] = await Promise.all([
      this.prisma.abuseReport.count({ where }),
      this.prisma.abuseReport.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return {
      items: items.map(this.toAdminDto),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async reviewReport(
    reportId: string,
    reviewerId: string,
    reviewerRoles: Role[],
    newStatus: AbuseReportStatus,
    reviewNote: string,
  ): Promise<AdminAbuseReportDto> {
    this.requireModerator(reviewerRoles);

    if (!reviewNote || reviewNote.trim().length < 3) {
      throw new BadRequestException({
        error: 'Review note required',
        message: 'A review note is required when resolving a report.',
      });
    }

    const report = await this.prisma.abuseReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException({ error: 'Report not found' });
    }

    const updated = await this.prisma.abuseReport.update({
      where: { id: reportId },
      data: {
        status: newStatus as never,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNote,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: reviewerId,
        action: 'ABUSE_REPORT_RESOLVED',
        targetType: 'abuse_report',
        targetId: reportId,
        metadata: { status: newStatus, previousStatus: report.status },
      },
    });

    return this.toAdminDto(updated);
  }

  // -------------------------------------------------------------------------
  // Suspicious activity flags (system-generated, admin-resolved)
  // -------------------------------------------------------------------------

  async flagSuspiciousActivity(
    type: string,
    subjectType: string,
    subjectId: string,
    description: string,
    metadata?: Record<string, unknown>,
  ) {
    return this.prisma.suspiciousActivityFlag.create({
      data: {
        type: type as never,
        subjectType,
        subjectId,
        description,
        metadata: (metadata ?? {}) as never,
      },
    });
  }

  async listSuspiciousFlags(reviewerRoles: Role[], page: number, pageSize: number) {
    this.requireModerator(reviewerRoles);

    const where = { isResolved: false };
    const [total, items] = await Promise.all([
      this.prisma.suspiciousActivityFlag.count({ where }),
      this.prisma.suspiciousActivityFlag.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      items: items.map((f) => ({
        id: f.id,
        type: f.type,
        subjectType: f.subjectType,
        subjectId: f.subjectId,
        description: f.description,
        metadata: f.metadata,
        createdAt: f.createdAt.toISOString(),
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

  private requireModerator(roles: Role[]) {
    if (!roles.some((r) => MODERATOR_ROLES.includes(r))) {
      throw new ForbiddenException({
        error: 'Forbidden',
        message: 'Only moderators and administrators can access the review queue.',
      });
    }
  }

  private toDto(r: {
    id: string;
    targetType: string;
    targetId: string;
    reason: string;
    description: string | null;
    status: string;
    createdAt: Date;
    reviewedAt: Date | null;
  }): AbuseReportDto {
    return {
      id: r.id,
      targetType: r.targetType,
      targetId: r.targetId,
      reason: r.reason,
      description: r.description,
      status: r.status as AbuseReportStatus,
      createdAt: r.createdAt.toISOString(),
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
    };
  }

  private toAdminDto(r: {
    id: string;
    reporterId: string | null;
    targetType: string;
    targetId: string;
    reason: string;
    description: string | null;
    status: string;
    createdAt: Date;
    reviewedBy: string | null;
    reviewedAt: Date | null;
    reviewNote: string | null;
  }): AdminAbuseReportDto {
    return {
      ...this.toDto(r),
      reporterId: r.reporterId,
      reviewedBy: r.reviewedBy,
      reviewNote: r.reviewNote,
    };
  }
}
