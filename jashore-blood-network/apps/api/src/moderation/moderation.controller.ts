/**
 * ModerationController — abuse report endpoints.
 *
 * User endpoints (authenticated):
 *   POST /api/v1/moderation/reports — submit a report
 *   GET  /api/v1/moderation/reports/mine — list own reports
 *
 * Admin endpoints (moderator+ only):
 *   GET  /api/v1/moderation/reports/queue — review queue
 *   POST /api/v1/moderation/reports/:id/review — resolve a report
 *   GET  /api/v1/moderation/suspicious — suspicious activity flags
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ModerationService } from './moderation.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types';
import type { Role } from '@jbn/shared-types';

// Rate limit: 5 reports per hour per user (anti-spam)
const SUBMIT_THROTTLE = { default: { limit: 5, ttl: 60 * 60 * 1000 } };

@Controller('moderation')
export class ModerationController {
  constructor(private readonly service: ModerationService) {}

  // --- User endpoints ---

  @Post('reports')
  @HttpCode(201)
  @Throttle(SUBMIT_THROTTLE)
  async submitReport(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { targetType: string; targetId: string; reason: string; description?: string },
  ) {
    return this.service.submitReport(
      user.id,
      body.targetType,
      body.targetId,
      body.reason,
      body.description,
    );
  }

  @Get('reports/mine')
  async listMyReports(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.listMyReports(
      user.id,
      page ? Math.max(1, parseInt(page, 10) || 1) : 1,
      pageSize ? Math.min(50, Math.max(1, parseInt(pageSize, 10) || 20)) : 20,
    );
  }

  // --- Admin endpoints ---

  @Get('reports/queue')
  @Roles('MODERATOR', 'DISTRICT_ADMINISTRATOR', 'SUPER_ADMINISTRATOR')
  async listQueue(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ) {
    return this.service.listPendingReports(
      user.roles as Role[],
      page ? Math.max(1, parseInt(page, 10) || 1) : 1,
      pageSize ? Math.min(50, Math.max(1, parseInt(pageSize, 10) || 20)) : 20,
      status as never,
    );
  }

  @Post('reports/:id/review')
  @HttpCode(200)
  @Roles('MODERATOR', 'DISTRICT_ADMINISTRATOR', 'SUPER_ADMINISTRATOR')
  async reviewReport(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { status: string; reviewNote: string },
  ) {
    return this.service.reviewReport(
      id,
      user.id,
      user.roles as Role[],
      body.status as never,
      body.reviewNote,
    );
  }

  @Get('suspicious')
  @Roles('MODERATOR', 'DISTRICT_ADMINISTRATOR', 'SUPER_ADMINISTRATOR')
  async listSuspicious(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.listSuspiciousFlags(
      user.roles as Role[],
      page ? Math.max(1, parseInt(page, 10) || 1) : 1,
      pageSize ? Math.min(50, Math.max(1, parseInt(pageSize, 10) || 20)) : 20,
    );
  }
}
