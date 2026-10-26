/**
 * Decorator: @CurrentUser()
 *
 * Extracts the authenticated user from the request. Returns undefined if
 * the route is @Public() and the request is unauthenticated.
 *
 * Usage:
 *   @Get('me')
 *   @UseGuards(JwtAuthGuard)
 *   getMe(@CurrentUser() user: AuthenticatedUser) { ... }
 */

import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '../types';

export const CURRENT_USER_KEY = 'authenticatedUser';

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{
      [CURRENT_USER_KEY]?: AuthenticatedUser;
    }>();
    const user = request[CURRENT_USER_KEY];
    if (!user) {
      return undefined;
    }
    return data ? user[data] : user;
  },
);
