/**
 * DonorsController — donor profile CRUD + public search.
 *
 * Routes:
 *   GET    /api/v1/donors          — public search (no auth, rate-limited)
 *   GET    /api/v1/donors/me       — get own donor profile (auth required)
 *   POST   /api/v1/donors/me       — create own donor profile (auth required)
 *   PATCH  /api/v1/donors/me       — update own donor profile (auth required)
 *
 * SECURITY:
 *   - Search is @Public() but rate-limited (60/min/IP via global ThrottlerGuard).
 *   - /donors/me routes are authenticated via global JwtAuthGuard.
 *   - There is NO /donors/:id route — IDOR is prevented by construction.
 *   - The ZodValidationPipe strips unknown fields, preventing mass-assignment.
 *   - The service scopes all writes to `where: { profileId: userId }`,
 *     so even a crafted request cannot update another user's profile.
 */

import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Req,
  UsePipes,
  HttpCode,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { DonorsService } from './donors.service';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  createDonorProfileSchema,
  updateDonorProfileSchema,
  searchDonorsSchema,
  type CreateDonorProfileInput,
  type UpdateDonorProfileInput,
  type SearchDonorsInput,
} from '@jbn/validation';
import type {
  DonorSearchResponse,
  OwnDonorProfile,
} from './donors.service';

// Search rate limit: 60 requests per minute per IP (matches the global
// default, but we make it explicit here for documentation).
const SEARCH_THROTTLE = { default: { limit: 60, ttl: 60_000 } };

@Controller('donors')
export class DonorsController {
  constructor(private readonly donorsService: DonorsService) {}

  /**
   * GET /api/v1/donors
   * Public donor search. Returns a PII-stripped, paginated list.
   */
  @Public()
  @Get()
  @Throttle(SEARCH_THROTTLE)
  async search(
    @Query(new ZodValidationPipe(searchDonorsSchema)) query: SearchDonorsInput,
  ): Promise<DonorSearchResponse> {
    return this.donorsService.searchDonors(query);
  }

  /**
   * GET /api/v1/donors/me
   * Get the authenticated user's own donor profile.
   */
  @Get('me')
  async getMe(@CurrentUser() user: { id: string }): Promise<OwnDonorProfile> {
    return this.donorsService.getMyProfile(user.id);
  }

  /**
   * POST /api/v1/donors/me
   * Create the authenticated user's own donor profile.
   * Fails with 409 Conflict if a profile already exists.
   */
  @Post('me')
  @HttpCode(201)
  @UsePipes(new ZodValidationPipe(createDonorProfileSchema))
  async createMe(
    @CurrentUser() user: { id: string },
    @Body() body: CreateDonorProfileInput,
    @Req() req: Request,
  ): Promise<OwnDonorProfile> {
    return this.donorsService.createMyProfile(user.id, body, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
  }

  /**
   * PATCH /api/v1/donors/me
   * Update the authenticated user's own donor profile.
   *
   * CRITICAL: this route has NO :id param. The service scopes the update
   * to `where: { profileId: userId }`, so a user can ONLY update their own
   * profile. IDOR is prevented by construction.
   */
  @Patch('me')
  @UsePipes(new ZodValidationPipe(updateDonorProfileSchema))
  async updateMe(
    @CurrentUser() user: { id: string },
    @Body() body: UpdateDonorProfileInput,
    @Req() req: Request,
  ): Promise<OwnDonorProfile> {
    return this.donorsService.updateMyProfile(user.id, body, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
  }
}
