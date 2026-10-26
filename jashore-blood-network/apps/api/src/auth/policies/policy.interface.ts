/**
 * Authorization policy interface.
 *
 * A policy is a class that implements `canActivate`. Policies are used by
 * the PoliciesGuard to enforce fine-grained authorization that goes beyond
 * simple role checks — e.g. "the user can update their own profile but not
 * anyone else's" (IDOR prevention), or "a moderator can hide a request
 * but not delete it".
 *
 * Usage in a controller:
 *   @Patch('users/:id')
 *   @UseGuards(JwtAuthGuard, PoliciesGuard)
 *   @Policy(IsOwnerPolicy)
 *   updateUser(...) { ... }
 *
 * The policy receives the AuthenticatedUser and the request params/body so
 * it can make ownership decisions.
 */

import type { ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '../types';

export interface PolicyArgs {
  user: AuthenticatedUser;
  context: ExecutionContext;
}

export interface Policy {
  canActivate(args: PolicyArgs): Promise<boolean> | boolean;
}

export type PolicyClass = new (...args: never[]) => Policy;
