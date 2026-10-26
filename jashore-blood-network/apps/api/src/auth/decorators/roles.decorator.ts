/**
 * Decorator: @Roles(...roles)
 *
 * Marks a route as requiring one of the given roles. The RolesGuard checks
 * for this metadata; if present and the user does not have any of the
 * listed roles (active, non-revoked), the request is rejected with 403.
 *
 * Usage:
 *   @Get('admin/users')
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles('MODERATOR', 'DISTRICT_ADMINISTRATOR')
 *   listUsers() { ... }
 *
 * If @Roles() is NOT applied, the RolesGuard is a no-op (any authenticated
 * user passes). This is intentional — authorization is opt-in per route,
 * and the default is "any authenticated user". Routes that need role-based
 * access control must opt in explicitly.
 *
 * The role values here are the shared-types Role strings ('MODERATOR',
 * 'DISTRICT_ADMINISTRATOR', etc.), not the Prisma-generated Role enum.
 * They map 1:1; the guard normalises the comparison.
 */

import { SetMetadata } from '@nestjs/common';
import type { AssignableRole } from '@jbn/shared-types';

export const ROLES_KEY = 'requiredRoles';

export const Roles = (...roles: AssignableRole[]) => SetMetadata(ROLES_KEY, roles);
