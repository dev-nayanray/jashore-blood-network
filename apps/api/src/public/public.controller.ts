/**
 * PublicController — public-facing read-only endpoints.
 *
 * All routes are @Public() — no authentication required.
 * Rate-limited via the global ThrottlerGuard (60/min/IP default).
 *
 * Routes:
 *   GET /api/v1/public/stats — platform statistics for homepage
 *   GET /api/v1/public/hospitals — verified hospital directory
 */

import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { PublicService } from './public.service';

@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  /**
   * GET /api/v1/public/stats
   * Returns aggregate platform statistics. No individual records.
   */
  @Public()
  @Get('stats')
  async getStats() {
    return this.publicService.getPublicStats();
  }

  /**
   * GET /api/v1/public/hospitals
   * Returns verified hospitals for the public directory.
   * Optional ?upazilaId= filter.
   */
  @Public()
  @Get('hospitals')
  async listHospitals(
    @Query('upazilaId') upazilaId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.publicService.listHospitals(
      upazilaId,
      page ? Math.max(1, parseInt(page, 10) || 1) : 1,
      pageSize ? Math.min(50, Math.max(1, parseInt(pageSize, 10) || 20)) : 20,
    );
  }
}
