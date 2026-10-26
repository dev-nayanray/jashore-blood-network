/**
 * RolesGuard — enforces @Roles(...) decorator.
 *
 * If the route has @Roles() metadata, the user must have at least one of
 * the listed roles (active, non-revoked). If the route has NO @Roles()
 * metadata, this guard is a no-op (any authenticated user passes).
 *
 * This guard runs AFTER JwtAuthGuard, so request.authenticatedUser is
 * guaranteed to be present (unless the route is @Public(), in which case
 * the guard is skipped entirely — see canActivate below).
 *
 * CRITICAL: roles are loaded from the database by JwtAuthGuard, NOT from
 * the JWT claims. This means role changes take effect on the next request,
 * not after the JWT expires. We deliberately do NOT trust role values
 * submitted by the browser or stored in the JWT.
 */

import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { CURRENT_USER_KEY } from '../decorators/current-user.decorator';
import type { AuthenticatedUser } from '../types';
import type { AssignableRole } from '@jbn/shared-types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Skip public routes — JwtAuthGuard already allowed them through.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<AssignableRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      // No @Roles() metadata — any authenticated user passes.
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      [CURRENT_USER_KEY]?: AuthenticatedUser;
    }>();
    const user = request[CURRENT_USER_KEY];
    if (!user) {
      // Should never happen (JwtAuthGuard would have rejected first), but
      // defensive coding is cheap.
      throw new ForbiddenException({
        error: 'Forbidden',
        message: 'You do not have permission to access this resource.',
      });
    }

    const hasRole = requiredRoles.some((required) =>
      user.roles.includes(required as unknown as AuthenticatedUser['roles'][number]),
    );
    if (!hasRole) {
      throw new ForbiddenException({
        error: 'Insufficient role',
        message: 'You do not have the required role to access this resource.',
      });
    }
    return true;
  }
}
