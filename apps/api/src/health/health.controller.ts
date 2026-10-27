import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import type { HealthCheckResponse } from '@jbn/shared-types';

/**
 * Health check endpoint.
 *
 * Returns 200 OK with a JSON body when the service is alive and accepting
 * requests. Used by:
 *   - Render's health-check probe (every 30s)
 *   - Vercel's deployment smoke test
 *   - The frontend's "is the API up?" indicator
 *
 * Marked @Public() because the JwtAuthGuard is global in Phase 4.
 *
 * Phase 2 only reports process liveness. Phase 8+ will add sub-checks for
 * database connectivity, auth service, and notification queue.
 */

const START_TIME = Date.now();

@Controller('health')
export class HealthController {
  @Get()
  @Public()
  @Header('Content-Type', 'application/json')
  @Header('Cache-Control', 'no-store')
  check(): HealthCheckResponse {
    return {
      status: 'ok',
      service: 'jashore-blood-network-api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      uptime: Math.round((Date.now() - START_TIME) / 1000),
    };
  }
}
