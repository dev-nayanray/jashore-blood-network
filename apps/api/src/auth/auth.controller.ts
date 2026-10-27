/**
 * AuthController — public auth endpoints + authenticated /me.
 *
 * All routes here are under /api/v1/auth (set via the global prefix in
 * main.ts and the @Controller('auth') decorator).
 *
 * Rate limiting: the OTP endpoints are rate-limited via @Throttle to
 * prevent OTP-sms cost abuse and credential stuffing.
 *
 * Cookie management: on successful OTP verify, the controller sets two
 * httpOnly cookies (access_token + refresh_token). On logout, both are
 * cleared. The refresh_token cookie is path-restricted to /api/v1/auth
 * so it is sent only to auth-refresh and auth-logout.
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { type AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  otpRequestSchema,
  otpVerifySchema,
  updateProfileSchema,
  type OtpRequestInput,
  type OtpVerifyInput,
  type UpdateProfileInput,
} from '@jbn/validation';
import {
  ACCESS_TOKEN_COOKIE_OPTIONS,
  COOKIE_NAMES,
  REFRESH_TOKEN_COOKIE_OPTIONS,
  type AuthMeResponse,
  type OtpRequestResponse,
  type OtpVerifyResponse,
} from './types';

// Rate limits — calibrated for the pilot per the architecture plan, Table 9.2
const OTP_REQUEST_THROTTLE = { default: { limit: 3, ttl: 60 * 60 * 1000 } }; // 3/hour/phone
const OTP_VERIFY_THROTTLE = { default: { limit: 10, ttl: 60 * 60 * 1000 } }; // 10/hour/IP

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/v1/auth/otp/request
   * Public. Rate-limited. Always returns 202 to prevent enumeration.
   */
  @Public()
  @Post('otp/request')
  @HttpCode(202)
  @Throttle(OTP_REQUEST_THROTTLE)
  @UsePipes(new ZodValidationPipe(otpRequestSchema))
  async requestOtp(@Body() _body: OtpRequestInput): Promise<OtpRequestResponse> {
    return this.authService.sendOtp(_body);
  }

  /**
   * POST /api/v1/auth/otp/verify
   * Public. Rate-limited. Sets httpOnly cookies on success.
   */
  @Public()
  @Post('otp/verify')
  @HttpCode(200)
  @Throttle(OTP_VERIFY_THROTTLE)
  @UsePipes(new ZodValidationPipe(otpVerifySchema))
  async verifyOtp(
    @Body() body: OtpVerifyInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OtpVerifyResponse> {
    const metadata = {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    };
    const { response, session } = await this.authService.verifyOtp(body, metadata);

    // Set httpOnly + Secure + SameSite=Lax cookies
    res.cookie(COOKIE_NAMES.accessToken, session.access_token, ACCESS_TOKEN_COOKIE_OPTIONS);
    res.cookie(COOKIE_NAMES.refreshToken, session.refresh_token, REFRESH_TOKEN_COOKIE_OPTIONS);

    return response;
  }

  /**
   * POST /api/v1/auth/refresh
   * Public (uses refresh-token cookie, not access token).
   * Returns a new access_token cookie on success.
   */
  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ status: 'ok' }> {
    const refreshToken = req.cookies?.[COOKIE_NAMES.refreshToken];
    if (!refreshToken) {
      // Use 401 via throwing — the global exception filter will format it.
      throw new Error('No refresh token');
    }
    const { session } = await this.authService.refreshSession(refreshToken);
    res.cookie(COOKIE_NAMES.accessToken, session.access_token, ACCESS_TOKEN_COOKIE_OPTIONS);
    res.cookie(COOKIE_NAMES.refreshToken, session.refresh_token, REFRESH_TOKEN_COOKIE_OPTIONS);
    return { status: 'ok' };
  }

  /**
   * POST /api/v1/auth/logout
   * Authenticated. Revokes the Supabase session and clears cookies.
   */
  @Post('logout')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const accessToken = req.cookies?.[COOKIE_NAMES.accessToken];
    if (accessToken) {
      await this.authService.logout(accessToken);
    }
    res.clearCookie(COOKIE_NAMES.accessToken, ACCESS_TOKEN_COOKIE_OPTIONS);
    res.clearCookie(COOKIE_NAMES.refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
  }

  /**
   * GET /api/v1/auth/me
   * Authenticated. Returns the current user's profile + roles.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: { id: string }): Promise<AuthMeResponse> {
    return this.authService.getMe(user.id);
  }
}
