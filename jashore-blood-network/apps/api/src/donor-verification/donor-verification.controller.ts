/**
 * DonorVerificationController — donor + admin endpoints.
 *
 * Donor endpoints (authenticated, own profile only):
 *   POST /api/v1/donor-verification/request — request verification
 *   GET  /api/v1/donor-verification/me — get own verification status
 *
 * Admin endpoints (moderator+ only):
 *   GET    /api/v1/donor-verification/pending — list pending reviews
 *   POST   /api/v1/donor-verification/:id/approve — approve
 *   POST   /api/v1/donor-verification/:id/reject — reject (with reason)
 *   POST   /api/v1/donor-verification/:id/suspend — suspend (with reason)
 *   POST   /api/v1/donor-verification/:id/reinstate — reinstate
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DonorVerificationService } from './donor-verification.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types';
import type { Role } from '@jbn/shared-types';

@Controller('donor-verification')
export class DonorVerificationController {
  constructor(private readonly service: DonorVerificationService) {}

  // --- Donor endpoints ---

  @Post('request')
  @HttpCode(200)
  async requestVerification(@CurrentUser() user: AuthenticatedUser) {
    return this.service.requestVerification(user.id);
  }

  @Get('me')
  async getMyStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getMyVerificationStatus(user.id);
  }

  // --- Admin endpoints ---

  @Get('pending')
  @Roles('MODERATOR', 'DISTRICT_ADMINISTRATOR', 'SUPER_ADMINISTRATOR')
  async listPending(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.listPendingReviews(
      page ? Math.max(1, parseInt(page, 10) || 1) : 1,
      pageSize ? Math.min(50, Math.max(1, parseInt(pageSize, 10) || 20)) : 20,
    );
  }

  @Post(':id/approve')
  @HttpCode(200)
  @Roles('MODERATOR', 'DISTRICT_ADMINISTRATOR', 'SUPER_ADMINISTRATOR')
  async approve(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body('reason') reason?: string,
  ) {
    return this.service.approveDonor(id, user.id, user.roles as Role[], reason);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @Roles('MODERATOR', 'DISTRICT_ADMINISTRATOR', 'SUPER_ADMINISTRATOR')
  async reject(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body('reason') reason: string,
  ) {
    return this.service.rejectDonor(id, user.id, user.roles as Role[], reason);
  }

  @Post(':id/suspend')
  @HttpCode(200)
  @Roles('MODERATOR', 'DISTRICT_ADMINISTRATOR', 'SUPER_ADMINISTRATOR')
  async suspend(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body('reason') reason: string,
  ) {
    return this.service.suspendDonor(id, user.id, user.roles as Role[], reason);
  }

  @Post(':id/reinstate')
  @HttpCode(200)
  @Roles('MODERATOR', 'DISTRICT_ADMINISTRATOR', 'SUPER_ADMINISTRATOR')
  async reinstate(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body('reason') reason?: string,
  ) {
    return this.service.reinstateDonor(id, user.id, user.roles as Role[], reason);
  }
}
