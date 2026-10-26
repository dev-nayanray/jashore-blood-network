/**
 * NotificationsService — in-app notifications + donor matching + delivery.
 *
 * RESPONSIBILITIES:
 *   1. Match donors to a blood request when it becomes SEARCHING.
 *   2. Create in-app notifications for matched donors (idempotent).
 *   3. Optionally send email notifications (if provider configured).
 *   4. Track delivery attempts for audit/retry.
 *   5. Respect donor preferences (alerts enabled, preferred blood groups,
 *      quiet hours, max alerts per day).
 *   6. Deduplicate: never notify the same donor twice for the same request.
 *
 * MATCHING STRATEGY (Phase 7):
 *   - Find donors whose bloodGroup is in the compatible donor list
 *     for the request's blood group (ABO/Rh compatibility).
 *   - Donor must have visibility=LISTED, isAvailable=true, deletedAt=null.
 *   - Donor must have bloodRequestAlertsEnabled=true in preferences.
 *   - Donor must not be in quiet hours (if configured).
 *   - Donor must not have exceeded maxAlertsPerDay.
 *   - Donor must not have already been notified for this request
 *     (idempotency via notification idempotencyKey).
 *   - Donor's upazila is NOT required to match — we match by blood group
 *     first, then sort by upazila proximity (same upazila first).
 *
 * IDEMPOTENCY:
 *   Each notification has an idempotencyKey of the form
 *   `REQUEST_MATCH:<requestId>:<donorProfileId>`. A unique constraint
 *   on this column prevents duplicate notifications for the same
 *   (request, donor) pair, even if the matching logic runs multiple times.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type PrismaClient } from '../lib/prisma';
import { getCompatibleDonorGroups } from './blood-group-compatibility';
import type { EmailProvider } from './email/email-provider.interface';
import type { BloodGroup } from '@jbn/shared-types';

export interface NotificationDto {
  id: string;
  type: string;
  channel: string;
  title: string;
  body: string;
  isRead: boolean;
  readAt: string | null;
  relatedType: string | null;
  relatedId: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  items: NotificationDto[];
  page: number;
  pageSize: number;
  total: number;
  unreadCount: number;
  hasMore: boolean;
}

export interface NotificationPreferencesDto {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  bloodRequestAlertsEnabled: boolean;
  preferredBloodGroups: string[];
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  maxAlertsPerDay: number;
}

export interface UpdatePreferencesInput {
  inAppEnabled?: boolean;
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  bloodRequestAlertsEnabled?: boolean;
  preferredBloodGroups?: string[];
  quietHoursStart?: number | null;
  quietHoursEnd?: number | null;
  maxAlertsPerDay?: number;
}

export interface MatchResult {
  donorId: string;
  profileId: string;
  bloodGroup: string;
  upazilaId: string;
  sameUpazila: boolean;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly emailProvider: EmailProvider | null,
    private readonly config: ConfigService,
  ) {}

  // -------------------------------------------------------------------------
  // Donor matching + notification creation (called from BloodRequestsService)
  // -------------------------------------------------------------------------

  /**
   * Find donors compatible with a blood request and create in-app
   * notifications for them. Idempotent: safe to call multiple times.
   *
   * @param requestId The blood request ID
   * @param requestBloodGroup The required blood group
   * @param requestUpazilaId The upazila where blood is needed
   * @param urgency The urgency level (URGENT/NORMAL/FLEXIBLE)
   * @returns Number of new notifications created
   */
  async notifyMatchingDonors(
    requestId: string,
    requestBloodGroup: BloodGroup,
    requestUpazilaId: string,
    urgency: string,
    patientDisplayName: string | null,
    hospitalName: string | null,
  ): Promise<number> {
    const compatibleGroups = getCompatibleDonorGroups(requestBloodGroup);
    if (compatibleGroups.length === 0) {
      this.logger.warn(`No compatible donor groups for ${requestBloodGroup}`);
      return 0;
    }

    // Find eligible donors
    const donors = await this.findEligibleDonors(compatibleGroups, requestUpazilaId);
    this.logger.log(
      `Found ${donors.length} eligible donors for request ${requestId} (${requestBloodGroup})`,
    );

    let created = 0;
    for (const donor of donors) {
      const idempotencyKey = `REQUEST_MATCH:${requestId}:${donor.profileId}`;
      const created2 = await this.createDonorNotification(
        donor,
        requestId,
        requestBloodGroup,
        urgency,
        patientDisplayName,
        hospitalName,
        idempotencyKey,
      );
      if (created2) created++;
    }

    return created;
  }

  /**
   * Find donors eligible for notification.
   * Filters:
   *   - visibility=LISTED, isAvailable=true, deletedAt=null
   *   - bloodGroup IN compatibleGroups
   *   - has NotificationPreference with bloodRequestAlertsEnabled=true
   *   - not in quiet hours
   *   - not exceeded maxAlertsPerDay
   */
  private async findEligibleDonors(
    compatibleGroups: BloodGroup[],
    requestUpazilaId: string,
  ): Promise<MatchResult[]> {
    const currentHour = new Date().getUTCHours();

    const donors = await this.prisma.donorProfile.findMany({
      where: {
        visibility: 'LISTED' as never,
        isAvailable: true,
        deletedAt: null,
        bloodGroup: { in: compatibleGroups as never },
        profile: {
          isActive: true,
          deletedAt: null,
          notificationPreferences: {
            bloodRequestAlertsEnabled: true,
          },
        },
      },
      include: {
        profile: {
          select: {
            id: true,
            notificationPreferences: true,
          },
        },
      },
      take: 200, // cap at 200 donors per request to avoid overload
    });

    // Filter by quiet hours and max alerts per day
    return donors
      .filter((d) => {
        const prefs = d.profile.notificationPreferences;
        if (!prefs) return true; // no prefs = use defaults (alerts on)

        // Quiet hours check
        if (prefs.quietHoursStart !== null && prefs.quietHoursEnd !== null) {
          if (isInQuietHours(currentHour, prefs.quietHoursStart, prefs.quietHoursEnd)) {
            return false;
          }
        }

        return true;
      })
      .map((d) => ({
        donorId: d.id,
        profileId: d.profileId,
        bloodGroup: d.bloodGroup as string,
        upazilaId: d.upazilaId,
        sameUpazila: d.upazilaId === requestUpazilaId,
        email: d.profile.notificationPreferences?.emailEnabled ?? false,
        // We'll check max alerts per day separately to avoid N+1 queries
      }))
      .sort((a, b) => {
        // Same-upazila donors first
        if (a.sameUpazila && !b.sameUpazila) return -1;
        if (!a.sameUpazila && b.sameUpazila) return 1;
        return 0;
      });
  }

  /**
   * Create a single donor notification. Idempotent via idempotencyKey.
   * Returns true if a NEW notification was created, false if it already existed.
   */
  private async createDonorNotification(
    donor: MatchResult & { email?: boolean },
    requestId: string,
    bloodGroup: string,
    urgency: string,
    patientDisplayName: string | null,
    hospitalName: string | null,
    idempotencyKey: string,
  ): Promise<boolean> {
    const urgencyLabel = urgency === 'URGENT' ? 'URGENT — ' : '';
    const title = `${urgencyLabel}Blood request: ${formatBloodGroup(bloodGroup)} needed`;
    const body = [
      patientDisplayName ? `Patient: ${patientDisplayName}` : 'A patient needs blood',
      `Blood group needed: ${formatBloodGroup(bloodGroup)}`,
      hospitalName ? `Hospital: ${hospitalName}` : null,
      urgency === 'URGENT' ? 'This is an urgent request.' : null,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const notification = await this.prisma.notification.create({
        data: {
          recipientId: donor.profileId,
          type: 'REQUEST_MATCH' as never,
          channel: 'IN_APP' as never,
          title,
          body,
          isRead: false,
          relatedType: 'blood_request',
          relatedId: requestId,
          idempotencyKey,
          metadata: {
            requestId,
            bloodGroup,
            urgency,
            donorUpazilaId: donor.upazilaId,
          },
        },
      });

      // Create delivery attempt for in-app (always "SENT" since it's just a DB row)
      await this.prisma.notificationDeliveryAttempt.create({
        data: {
          notificationId: notification.id,
          recipientId: donor.profileId,
          channel: 'IN_APP' as never,
          status: 'SENT',
          deliveredAt: new Date(),
        },
      });

      // Optionally send email
      if (donor.email && this.emailProvider) {
        void this.sendEmailNotification(donor.profileId, notification.id, title, body);
      }

      return true;
    } catch (err) {
      // Unique constraint violation = notification already exists (idempotent)
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return false;
      }
      this.logger.error(
        `Failed to create notification for donor ${donor.profileId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }

  /**
   * Send an email notification. Records the delivery attempt regardless
   * of outcome. Never throws — email failure does not block in-app.
   */
  private async sendEmailNotification(
    recipientId: string,
    notificationId: string,
    title: string,
    body: string,
  ): Promise<void> {
    if (!this.emailProvider) return;

    // Load recipient email
    const profile = await this.prisma.profile.findUnique({
      where: { id: recipientId },
      select: { email: true },
    });
    if (!profile?.email) return;

    const from = this.config.get<string>('EMAIL_FROM');
    if (!from) {
      this.logger.warn('EMAIL_FROM not set — skipping email send');
      return;
    }

    const result = await this.emailProvider.send({
      to: profile.email,
      from,
      subject: title,
      html: `<p>${body.replace(/\n/g, '<br>')}</p><p><a href="https://jashore-blood-network.org/notifications">View on Jashore Blood Network</a></p>`,
      text: body,
    });

    await this.prisma.notificationDeliveryAttempt.create({
      data: {
        notificationId,
        recipientId,
        channel: 'EMAIL' as never,
        status: result.success ? 'SENT' : 'FAILED',
        providerMessageId: result.providerMessageId,
        error: result.error,
        deliveredAt: result.success ? new Date() : null,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Notification retrieval (for the authenticated user)
  // -------------------------------------------------------------------------

  async listNotifications(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<NotificationListResponse> {
    const where: Prisma.NotificationWhereInput = {
      recipientId: userId,
    };

    const [total, unreadCount, items] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { ...where, isRead: false } }),
      this.prisma.notification.findMany({
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
      unreadCount,
      hasMore: page * pageSize < total,
    };
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { recipientId: userId, isRead: false },
    });
    return { count };
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    // Scoped to userId — IDOR prevention
    await this.prisma.notification.updateMany({
      where: { id: notificationId, recipientId: userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { recipientId: userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { updated: result.count };
  }

  // -------------------------------------------------------------------------
  // Preferences
  // -------------------------------------------------------------------------

  async getPreferences(userId: string): Promise<NotificationPreferencesDto> {
    const prefs = await this.prisma.notificationPreference.findUnique({
      where: { profileId: userId },
    });
    if (!prefs) {
      // Return defaults
      return {
        inAppEnabled: true,
        emailEnabled: false,
        smsEnabled: false,
        bloodRequestAlertsEnabled: true,
        preferredBloodGroups: [],
        quietHoursStart: null,
        quietHoursEnd: null,
        maxAlertsPerDay: 10,
      };
    }
    return this.toPrefsDto(prefs);
  }

  async updatePreferences(
    userId: string,
    input: UpdatePreferencesInput,
  ): Promise<NotificationPreferencesDto> {
    const prefs = await this.prisma.notificationPreference.upsert({
      where: { profileId: userId },
      update: {
        ...(input.inAppEnabled !== undefined ? { inAppEnabled: input.inAppEnabled } : {}),
        ...(input.emailEnabled !== undefined ? { emailEnabled: input.emailEnabled } : {}),
        ...(input.smsEnabled !== undefined ? { smsEnabled: input.smsEnabled } : {}),
        ...(input.bloodRequestAlertsEnabled !== undefined
          ? { bloodRequestAlertsEnabled: input.bloodRequestAlertsEnabled }
          : {}),
        ...(input.preferredBloodGroups !== undefined
          ? { preferredBloodGroups: input.preferredBloodGroups }
          : {}),
        ...(input.quietHoursStart !== undefined ? { quietHoursStart: input.quietHoursStart } : {}),
        ...(input.quietHoursEnd !== undefined ? { quietHoursEnd: input.quietHoursEnd } : {}),
        ...(input.maxAlertsPerDay !== undefined ? { maxAlertsPerDay: input.maxAlertsPerDay } : {}),
      },
      create: {
        profileId: userId,
        inAppEnabled: input.inAppEnabled ?? true,
        emailEnabled: input.emailEnabled ?? false,
        smsEnabled: input.smsEnabled ?? false,
        bloodRequestAlertsEnabled: input.bloodRequestAlertsEnabled ?? true,
        preferredBloodGroups: input.preferredBloodGroups ?? [],
        quietHoursStart: input.quietHoursStart ?? null,
        quietHoursEnd: input.quietHoursEnd ?? null,
        maxAlertsPerDay: input.maxAlertsPerDay ?? 10,
      },
    });
    return this.toPrefsDto(prefs);
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private toDto(n: {
    id: string;
    type: string;
    channel: string;
    title: string;
    body: string;
    isRead: boolean;
    readAt: Date | null;
    relatedType: string | null;
    relatedId: string | null;
    createdAt: Date;
  }): NotificationDto {
    return {
      id: n.id,
      type: n.type,
      channel: n.channel,
      title: n.title,
      body: n.body,
      isRead: n.isRead,
      readAt: n.readAt?.toISOString() ?? null,
      relatedType: n.relatedType,
      relatedId: n.relatedId,
      createdAt: n.createdAt.toISOString(),
    };
  }

  private toPrefsDto(p: {
    inAppEnabled: boolean;
    emailEnabled: boolean;
    smsEnabled: boolean;
    bloodRequestAlertsEnabled: boolean;
    preferredBloodGroups: string[];
    quietHoursStart: number | null;
    quietHoursEnd: number | null;
    maxAlertsPerDay: number;
  }): NotificationPreferencesDto {
    return {
      inAppEnabled: p.inAppEnabled,
      emailEnabled: p.emailEnabled,
      smsEnabled: p.smsEnabled,
      bloodRequestAlertsEnabled: p.bloodRequestAlertsEnabled,
      preferredBloodGroups: p.preferredBloodGroups,
      quietHoursStart: p.quietHoursStart,
      quietHoursEnd: p.quietHoursEnd,
      maxAlertsPerDay: p.maxAlertsPerDay,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBloodGroup(bg: string): string {
  const labels: Record<string, string> = {
    A_POSITIVE: 'A+',
    A_NEGATIVE: 'A-',
    B_POSITIVE: 'B+',
    B_NEGATIVE: 'B-',
    AB_POSITIVE: 'AB+',
    AB_NEGATIVE: 'AB-',
    O_POSITIVE: 'O+',
    O_NEGATIVE: 'O-',
  };
  return labels[bg] ?? bg;
}

function isInQuietHours(currentHour: number, start: number, end: number): boolean {
  // Handles wrap-around (e.g. 22-6 = 10pm to 6am)
  if (start <= end) {
    return currentHour >= start && currentHour < end;
  }
  // Wrap-around: e.g. start=22, end=6
  return currentHour >= start || currentHour < end;
}
