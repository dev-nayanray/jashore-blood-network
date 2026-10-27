/**
 * Decorator: @Public()
 *
 * Marks a route or controller as public (no authentication required).
 * The JwtAuthGuard checks for this metadata; if present, it skips token
 * verification.
 *
 * Use sparingly. Most routes should be authenticated by default. The
 * current public routes are:
 *   - GET /health
 *   - POST /api/v1/auth/otp/request
 *   - POST /api/v1/auth/otp/verify
 *   - POST /api/v1/auth/refresh
 */

import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
