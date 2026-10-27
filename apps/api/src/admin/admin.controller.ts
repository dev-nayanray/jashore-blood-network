/**
 * AdminController — admin dashboard, user management, audit logs, analytics.
 *
 * ALL endpoints require MODERATOR+ role (enforced via @Roles at class level).
 * Some endpoints (suspend/reinstate user) require DISTRICT_ADMINISTRATOR+.
 *
 * SECURITY:
 *   - Identity derived from JWT (never from body)
 *   - Role checks via @Roles decorator + RolesGuard
 *   - No passwords, tokens, or auth secrets returned
 *   - All sensitive actions audit-logged
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
import { AdminService } from './admin.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types';
import type { Role } from '@jbn/shared-types';

@Controller('admin')
@Roles('MODERATOR', 'DISTRICT_ADMINISTRATOR', 'SUPER_ADMINISTRATOR')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // --- Dashboard ---

  @Get('dashboard')
  async getDashboard() {
    return this.adminService.getDashboardMetrics();
  }

  // --- Analytics ---

  @Get('analytics')
  async getAnalytics() {
    return this.adminService.getAnalytics();
  }

  // --- Phase 16: Detailed analytics ---

  @Get('analytics/detailed')
  async getDetailedAnalytics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('upazilaId') upazilaId?: string,
  ) {
    return this.adminService.getDetailedAnalytics(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
      upazilaId,
    );
  }

  @Get('analytics/export')
  async exportRequestsCsv(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('upazilaId') upazilaId?: string,
  ) {
    const csv = await this.adminService.exportRequestsCsv(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
      upazilaId,
    );
    return { csv };
  }

  // --- Phase 13: Emergency coordination ---

  @Get('emergency')
  async listEmergencyRequests() {
    return this.adminService.listEmergencyRequests();
  }

  // --- User management ---

  @Get('users')
  async listUsers(
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.adminService.listUsers(
      search,
      role,
      status as 'active' | 'suspended' | 'deleted' | undefined,
      page ? Math.max(1, parseInt(page, 10) || 1) : 1,
      pageSize ? Math.min(50, Math.max(1, parseInt(pageSize, 10) || 20)) : 20,
    );
  }

  @Get('users/:id')
  async getUserDetail(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Post('users/:id/suspend')
  @HttpCode(200)
  @Roles('DISTRICT_ADMINISTRATOR', 'SUPER_ADMINISTRATOR')
  async suspendUser(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body('reason') reason: string,
  ) {
    return this.adminService.suspendUser(id, admin.id, admin.roles as Role[], reason);
  }

  @Post('users/:id/reinstate')
  @HttpCode(200)
  @Roles('DISTRICT_ADMINISTRATOR', 'SUPER_ADMINISTRATOR')
  async reinstateUser(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body('reason') reason?: string,
  ) {
    return this.adminService.reinstateUser(id, admin.id, admin.roles as Role[], reason);
  }

  // --- Donor management ---

  @Get('donors')
  async listDonors(
    @Query('search') search?: string,
    @Query('bloodGroup') bloodGroup?: string,
    @Query('upazilaId') upazilaId?: string,
    @Query('verificationStatus') verificationStatus?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.adminService.listDonors(
      search,
      bloodGroup,
      upazilaId,
      verificationStatus,
      page ? Math.max(1, parseInt(page, 10) || 1) : 1,
      pageSize ? Math.min(50, Math.max(1, parseInt(pageSize, 10) || 20)) : 20,
    );
  }

  // --- Blood request management ---

  @Get('blood-requests')
  async listBloodRequests(
    @Query('status') status?: string,
    @Query('bloodGroup') bloodGroup?: string,
    @Query('upazilaId') upazilaId?: string,
    @Query('urgency') urgency?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.adminService.listBloodRequests(
      status,
      bloodGroup,
      upazilaId,
      urgency,
      page ? Math.max(1, parseInt(page, 10) || 1) : 1,
      pageSize ? Math.min(50, Math.max(1, parseInt(pageSize, 10) || 20)) : 20,
    );
  }

  // --- Audit logs ---

  @Get('audit-logs')
  async listAuditLogs(
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('targetType') targetType?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.adminService.listAuditLogs(
      action,
      actorId,
      targetType,
      page ? Math.max(1, parseInt(page, 10) || 1) : 1,
      pageSize ? Math.min(50, Math.max(1, parseInt(pageSize, 10) || 20)) : 20,
    );
  }
}
