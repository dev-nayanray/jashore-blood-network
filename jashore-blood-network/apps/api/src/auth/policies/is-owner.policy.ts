/**
 * IsOwnerPolicy — allows the request only if the authenticated user is the
 * owner of the resource identified by the `:id` route param.
 *
 * This is the primary IDOR-prevention policy. Use it on any route that
 * operates on a single resource owned by a user (e.g. PATCH /users/:id,
 * DELETE /notifications/:id).
 *
 * Note: this policy only checks that the `:id` param matches the user's id.
 * For resources owned indirectly (e.g. /blood-requests/:id where the owner
 * is blood_requests.requester_id), write a custom policy that loads the
 * resource from the database and checks ownership.
 */

import { Injectable } from '@nestjs/common';
import type { Policy, PolicyArgs } from './policy.interface';

@Injectable()
export class IsOwnerPolicy implements Policy {
  canActivate({ user, context }: PolicyArgs): boolean {
    const request = context.switchToHttp().getRequest<{ params: { id?: string } }>();
    const resourceId = request.params?.id;
    if (!resourceId) {
      // No :id param — fail closed.
      return false;
    }
    return resourceId === user.id;
  }
}
