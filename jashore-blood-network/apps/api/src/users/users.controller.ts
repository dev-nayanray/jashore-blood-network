/**
 * UsersController — own-profile endpoints.
 *
 * All routes here are authenticated (JwtAuthGuard is global). The :id param
 * is NOT used — operations are always on the current user, which prevents
 * IDOR by construction.
 *
 * Role management is NOT exposed here. It lives in AdminModule (Phase 7+)
 * behind the AssignRolePolicy.
 */

import { Body, Controller, Patch, UseGuards, UsePipes } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { updateProfileSchema, type UpdateProfileInput } from '@jbn/validation';
import type { AuthMeResponse } from '../auth/types';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * PATCH /api/v1/users/me
   * Update the current user's own profile. Phone and roles are NOT updatable.
   */
  @Patch('me')
  @UsePipes(new ZodValidationPipe(updateProfileSchema))
  async updateMe(
    @CurrentUser() user: { id: string },
    @Body() body: UpdateProfileInput,
  ): Promise<AuthMeResponse> {
    return this.usersService.updateMyProfile(user.id, body);
  }
}
