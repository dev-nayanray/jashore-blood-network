/**
 * JwtAuthGuard — verifies the Supabase access token on every request.
 *
 * Behaviour:
 *   1. If the route is @Public(), skip verification. request.authenticatedUser
 *      is undefined.
 *   2. Otherwise, extract the access token from the cookie (preferred) or
 *      the Authorization: Bearer header (for non-browser clients).
 *   3. Verify the token via SupabaseServerService.verifyToken(), which calls
 *      Supabase Auth's getUser endpoint. This checks both the JWT signature
 *      AND whether the session is still valid (not revoked).
 *   4. On success: load the user's Profile + roles from Prisma, attach
 *      AuthenticatedUser to the request.
 *   5. On failure: reject with 401 Unauthorized.
 *
 * This guard is registered GLOBALLY (see AuthModule), so every route is
 * authenticated by default. Routes that should be public MUST use @Public().
 *
 * IMPORTANT: this guard does NOT enforce authorization — it only verifies
 * identity. Use @Roles() + RolesGuard, or @Policy() + PoliciesGuard, for
 * authorization.
 */

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaClient } from '../../lib/prisma';
import { SupabaseServerService } from '../supabase-server.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { CURRENT_USER_KEY } from '../decorators/current-user.decorator';
import type { AuthenticatedUser } from '../types';
import type { Role } from '@jbn/shared-types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseServerService,
    private readonly prisma: PrismaClient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Check if the route is @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      cookies?: Record<string, string>;
      headers: { authorization?: string };
    }>();

    // 2. Extract the access token from cookie or Authorization header
    const accessToken =
      request.cookies?.['jbn_access_token'] ??
      this.extractBearerToken(request.headers.authorization);

    if (!accessToken) {
      throw new UnauthorizedException({
        error: 'Authentication required',
        message: 'An access token is required to access this resource.',
      });
    }

    // 3. Verify the token via Supabase
    const supabaseUser = await this.supabase.verifyToken(accessToken);
    if (!supabaseUser) {
      throw new UnauthorizedException({
        error: 'Invalid or expired token',
        message: 'Your session has expired. Please log in again.',
      });
    }

    // 4. Load the application Profile + active roles
    const profile = await this.prisma.profile.findUnique({
      where: { id: supabaseUser.id },
      include: { roles: true },
    });
    if (!profile || profile.deletedAt !== null || !profile.isActive) {
      throw new UnauthorizedException({
        error: 'Account not available',
        message: 'Your account is not active. Please contact support.',
      });
    }

    // 5. Attach AuthenticatedUser to the request
    const activeRoles: Role[] = profile.roles
      .filter((r) => r.revokedAt === null)
      .map((r) => r.role as unknown as Role);
    const authenticatedUser: AuthenticatedUser = {
      id: profile.id,
      phone: profile.phone,
      email: profile.email ?? undefined,
      roles: activeRoles,
    };
    (request as Record<string, unknown>)[CURRENT_USER_KEY] = authenticatedUser;

    return true;
  }

  private extractBearerToken(header: string | undefined): string | undefined {
    if (!header) return undefined;
    const match = /^Bearer\s+(.+)$/i.exec(header);
    return match?.[1];
  }
}
