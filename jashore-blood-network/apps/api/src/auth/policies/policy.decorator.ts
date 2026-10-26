/**
 * Decorator: @Policy(...policies)
 *
 * Attaches one or more policy classes to a route. The PoliciesGuard
 * instantiates each policy and calls canActivate. All policies must pass.
 *
 * Usage:
 *   @Patch('users/:id')
 *   @UseGuards(JwtAuthGuard, PoliciesGuard)
 *   @Policy(IsOwnerPolicy)
 *   updateUser(...) { ... }
 *
 * The policy class is registered as a provider in AuthModule so that the
 * PoliciesGuard can resolve it via ModuleRef.
 */

import { SetMetadata } from '@nestjs/common';
import type { PolicyClass } from './policy.interface';

export const POLICIES_KEY = 'policies';

export const Policy = (...policies: PolicyClass[]) => SetMetadata(POLICIES_KEY, policies);
