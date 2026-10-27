/**
 * PoliciesGuard — instantiates and runs the @Policy(...) classes attached
 * to a route. All policies must return true; if any returns false or
 * throws, the request is rejected with 403.
 *
 * Policy classes are resolved via ModuleRef so they can inject dependencies
 * (e.g. PrismaClient) for database-backed ownership checks.
 *
 * This guard runs AFTER JwtAuthGuard, so request.authenticatedUser is
 * guaranteed to be present (unless the route is @Public(), in which case
 * this guard is skipped).
 */

import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ModuleRef } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { POLICIES_KEY } from '../policies/policy.decorator';
import { CURRENT_USER_KEY } from '../decorators/current-user.decorator';
import type { PolicyClass } from '../policies/policy.interface';
import type { AuthenticatedUser } from '../types';

@Injectable()
export class PoliciesGuard implements CanActivate {
  private readonly logger = new Logger(PoliciesGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly moduleRef: ModuleRef,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const policies = this.reflector.getAllAndOverride<PolicyClass[] | undefined>(POLICIES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!policies || policies.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      [CURRENT_USER_KEY]?: AuthenticatedUser;
    }>();
    const user = request[CURRENT_USER_KEY];
    if (!user) {
      throw new ForbiddenException({
        error: 'Forbidden',
        message: 'Authentication required.',
      });
    }

    for (const PolicyClass of policies) {
      const policy = this.moduleRef.get(PolicyClass, { strict: false });
      if (!policy) {
        // Policy not registered as a provider — fail closed.
        this.logger.error(`Policy ${PolicyClass.name} not registered in module`);
        throw new ForbiddenException({
          error: 'Forbidden',
          message: 'Authorization policy could not be evaluated.',
        });
      }
      const allowed = await policy.canActivate({ user, context });
      if (!allowed) {
        throw new ForbiddenException({
          error: 'Forbidden',
          message: 'You do not have permission to perform this action.',
        });
      }
    }
    return true;
  }
}
