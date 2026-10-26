/**
 * BloodRequestsController — blood request CRUD + status management.
 *
 * Routes:
 *   GET    /api/v1/blood-requests          — public list (with filters)
 *   GET    /api/v1/blood-requests/mine     — own requests (auth required)
 *   GET    /api/v1/blood-requests/:id      — public detail (auth optional)
 *   POST   /api/v1/blood-requests          — create (auth required)
 *   PATCH  /api/v1/blood-requests/:id      — update (owner/moderator+)
 *   PATCH  /api/v1/blood-requests/:id/status — change status (owner: cancel; mod+: verify/reject)
 *
 * SECURITY:
 *   - requesterId is derived from the authenticated user, NEVER from body.
 *   - Update/status-change operations verify ownership OR moderator+ role.
 *   - Public detail hides contactNote/notes for non-owners.
 *   - Rate-limited via global ThrottlerGuard (60/min default).
 *   - Create is limited to 5/day/user via @Throttle (anti-spam).
 */

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UsePipes,
  HttpCode,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { BloodRequestsService } from './blood-requests.service';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  createBloodRequestSchema,
  updateBloodRequestSchema,
  updateRequestStatusSchema,
  searchBloodRequestsSchema,
  type CreateBloodRequestInput,
  type UpdateBloodRequestInput,
  type UpdateRequestStatusInput,
  type SearchBloodRequestsInput,
} from '@jbn/validation';
import type { AuthenticatedUser } from '../auth/types';
import type {
  BloodRequestDetail,
  BloodRequestListResponse,
} from './blood-requests.service';

// Create rate limit: 5 requests per day per user (anti-spam)
const CREATE_THROTTLE = { default: { limit: 5, ttl: 24 * 60 * 60 * 1000 } };

@Controller('blood-requests')
export class BloodRequestsController {
  constructor(private readonly bloodRequestsService: BloodRequestsService) {}

  /**
   * GET /api/v1/blood-requests
   * Public listing with filters. Returns only active-status requests
   * (plus the viewer's own requests in any status if authenticated).
   */
  @Public()
  @Get()
  @UsePipes(new ZodValidationPipe(searchBloodRequestsSchema))
  async list(
    @Query() query: SearchBloodRequestsInput,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ): Promise<BloodRequestListResponse> {
    return this.bloodRequestsService.listRequests(query, user?.id);
  }

  /**
   * GET /api/v1/blood-requests/mine
   * Authenticated user's own requests in all statuses.
   */
  @Get('mine')
  async listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<BloodRequestListResponse> {
    return this.bloodRequestsService.listMyRequests(
      user.id,
      page ? Math.max(1, parseInt(page, 10) || 1) : 1,
      pageSize ? Math.min(50, Math.max(1, parseInt(pageSize, 10) || 20)) : 20,
    );
  }

  /**
   * GET /api/v1/blood-requests/:id
   * Public detail. Hides contactNote/notes for non-owners.
   */
  @Public()
  @Get(':id')
  async getOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ): Promise<BloodRequestDetail> {
    return this.bloodRequestsService.getRequest(id, user?.id);
  }

  /**
   * POST /api/v1/blood-requests
   * Create a new blood request. requesterId derived from auth.
   */
  @Post()
  @HttpCode(201)
  @Throttle(CREATE_THROTTLE)
  @UsePipes(new ZodValidationPipe(createBloodRequestSchema))
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateBloodRequestInput,
    @Req() req: Request,
  ): Promise<BloodRequestDetail> {
    return this.bloodRequestsService.createRequest(user.id, body, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
  }

  /**
   * PATCH /api/v1/blood-requests/:id
   * Update request fields (owner or moderator+).
   * status and requesterId CANNOT be changed via this endpoint.
   */
  @Patch(':id')
  @UsePipes(new ZodValidationPipe(updateBloodRequestSchema))
  async update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateBloodRequestInput,
    @Req() req: Request,
  ): Promise<BloodRequestDetail> {
    return this.bloodRequestsService.updateRequest(id, user.id, user.roles, body, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
  }

  /**
   * PATCH /api/v1/blood-requests/:id/status
   * Change status with authorization:
   *   - Owner: can CANCEL
   *   - Moderator+: can VERIFY, REJECT, CANCEL
   *   - COMPLETED requires owner or moderator+ on ARRANGED requests
   */
  @Patch(':id/status')
  @UsePipes(new ZodValidationPipe(updateRequestStatusSchema))
  async changeStatus(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateRequestStatusInput,
    @Req() req: Request,
  ): Promise<BloodRequestDetail> {
    return this.bloodRequestsService.changeStatus(id, user.id, user.roles, body, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
  }
}
