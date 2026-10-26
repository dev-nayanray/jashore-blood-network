/**
 * OrganizationsController — organization portal endpoints.
 *
 * Routes:
 *   POST   /api/v1/organizations/register — register a new organization
 *   GET    /api/v1/organizations/me — get own organization
 *   PATCH  /api/v1/organizations/me — update organization profile
 *   POST   /api/v1/organizations/me/submit — submit for verification
 *   GET    /api/v1/organizations/me/staff — list staff
 *   POST   /api/v1/organizations/me/staff — add staff
 *   DELETE /api/v1/organizations/me/staff/:id — remove staff
 *   GET    /api/v1/organizations/me/coordination — list coordination records
 *   PATCH  /api/v1/organizations/me/coordination/:bloodRequestId — update coordination
 *
 * Admin routes (moderator+):
 *   GET    /api/v1/organizations/pending — list pending verification
 *   POST   /api/v1/organizations/:id/verify — approve
 *   POST   /api/v1/organizations/:id/reject — reject
 *   POST   /api/v1/organizations/:id/suspend — suspend
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types';
import type { Role } from '@jbn/shared-types';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly service: OrganizationsService) {}

  // --- Organization member endpoints ---

  @Post('register')
  @HttpCode(201)
  async register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: {
      name: string;
      upazilaId: string;
      address: string;
      phone?: string;
      email?: string;
      website?: string;
      operatingHours?: string;
      servicesOffered?: string;
    },
  ) {
    return this.service.registerOrganization(user.id, body);
  }

  @Get('me')
  async getMyOrganization(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getMyOrganization(user.id);
  }

  @Patch('me')
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: {
      name?: string;
      address?: string;
      phone?: string;
      email?: string;
      website?: string;
      operatingHours?: string;
      servicesOffered?: string;
    },
  ) {
    return this.service.updateProfile(user.id, body);
  }

  @Post('me/submit')
  @HttpCode(200)
  async submitForVerification(@CurrentUser() user: AuthenticatedUser) {
    return this.service.submitForVerification(user.id);
  }

  @Get('me/staff')
  async listStaff(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listStaff(user.id);
  }

  @Post('me/staff')
  @HttpCode(201)
  async addStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Body('profileId') profileId: string,
  ) {
    return this.service.addStaff(user.id, profileId);
  }

  @Delete('me/staff/:memberId')
  @HttpCode(200)
  async removeStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Param('memberId') memberId: string,
  ) {
    return this.service.removeStaff(user.id, memberId);
  }

  @Get('me/coordination')
  async listCoordination(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listCoordination(user.id);
  }

  @Patch('me/coordination/:bloodRequestId')
  async updateCoordination(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bloodRequestId') bloodRequestId: string,
    @Body() body: { status: string; note?: string },
  ) {
    return this.service.updateCoordination(user.id, bloodRequestId, body.status, body.note);
  }

  // --- Admin endpoints ---

  @Get('pending')
  @Roles('MODERATOR', 'DISTRICT_ADMINISTRATOR', 'SUPER_ADMINISTRATOR')
  async listPending(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.listPendingOrganizations(
      page ? Math.max(1, parseInt(page, 10) || 1) : 1,
      pageSize ? Math.min(50, Math.max(1, parseInt(pageSize, 10) || 20)) : 20,
    );
  }

  @Post(':id/verify')
  @HttpCode(200)
  @Roles('MODERATOR', 'DISTRICT_ADMINISTRATOR', 'SUPER_ADMINISTRATOR')
  async verify(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body('reason') reason?: string,
  ) {
    return this.service.reviewOrganization(id, user.id, user.roles as Role[], 'VERIFIED', reason);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @Roles('MODERATOR', 'DISTRICT_ADMINISTRATOR', 'SUPER_ADMINISTRATOR')
  async reject(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body('reason') reason: string,
  ) {
    return this.service.reviewOrganization(id, user.id, user.roles as Role[], 'REJECTED', reason);
  }

  @Post(':id/suspend')
  @HttpCode(200)
  @Roles('MODERATOR', 'DISTRICT_ADMINISTRATOR', 'SUPER_ADMINISTRATOR')
  async suspend(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body('reason') reason: string,
  ) {
    return this.service.reviewOrganization(id, user.id, user.roles as Role[], 'SUSPENDED', reason);
  }
}
