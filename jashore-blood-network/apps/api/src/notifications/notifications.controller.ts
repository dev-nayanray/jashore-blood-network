/**
 * NotificationsController — user-facing notification endpoints.
 *
 * Routes:
 *   GET    /api/v1/notifications              — list (paginated, own only)
 *   GET    /api/v1/notifications/unread-count — unread count
 *   POST   /api/v1/notifications/:id/read    — mark one as read
 *   POST   /api/v1/notifications/mark-all-read — mark all as read
 *   GET    /api/v1/notifications/preferences — get own preferences
 *   PATCH  /api/v1/notifications/preferences — update own preferences
 *
 * All routes are authenticated (global JwtAuthGuard). All operations
 * are scoped to the authenticated user — IDOR is prevented by construction.
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UsePipes,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { z } from 'zod';

// Rate limit for mark-all-read to prevent abuse
const MARK_ALL_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

const updatePreferencesSchema = z.object({
  inAppEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  bloodRequestAlertsEnabled: z.boolean().optional(),
  preferredBloodGroups: z
    .array(
      z.enum([
        'A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE',
        'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE',
      ]),
    )
    .max(8)
    .optional(),
  quietHoursStart: z.number().int().min(0).max(23).nullable().optional(),
  quietHoursEnd: z.number().int().min(0).max(23).nullable().optional(),
  maxAlertsPerDay: z.number().int().min(0).max(50).optional(),
});

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(
    @CurrentUser() user: { id: string },
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.notificationsService.listNotifications(
      user.id,
      page ? Math.max(1, parseInt(page, 10) || 1) : 1,
      pageSize ? Math.min(50, Math.max(1, parseInt(pageSize, 10) || 20)) : 20,
    );
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: { id: string }) {
    return this.notificationsService.getUnreadCount(user.id);
  }

  @Post(':id/read')
  @HttpCode(204)
  async markRead(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    await this.notificationsService.markAsRead(user.id, id);
  }

  @Post('mark-all-read')
  @HttpCode(200)
  @Throttle(MARK_ALL_THROTTLE)
  async markAllRead(@CurrentUser() user: { id: string }) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Get('preferences')
  async getPreferences(@CurrentUser() user: { id: string }) {
    return this.notificationsService.getPreferences(user.id);
  }

  @Patch('preferences')
  @UsePipes(new ZodValidationPipe(updatePreferencesSchema))
  async updatePreferences(
    @CurrentUser() user: { id: string },
    @Body() body: z.infer<typeof updatePreferencesSchema>,
  ) {
    return this.notificationsService.updatePreferences(user.id, body);
  }
}
