/**
 * Server-side auth gateway.
 *
 * Two mutually exclusive modes, chosen at boot:
 *
 *   supabase — SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY point at a real
 *   Supabase project. This client uses the SERVICE-ROLE key (bypasses RLS),
 *   so it is NEVER imported by frontend code and NEVER shipped to the
 *   browser. OTPs are sent/verified by Supabase Auth (requires an SMS
 *   provider on the Supabase project).
 *
 *   local — no usable Supabase config (missing or placeholder). OTPs are
 *   issued/verified by LocalAuthService (stored hashed in otp_codes) and
 *   sessions are self-signed JWTs. 100% free, no external provider. The
 *   OTP is returned to the client for demo delivery.
 *
 * Callers (AuthService, JwtAuthGuard) use the same method signatures in
 * both modes and never need to know which one is active.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalAuthService } from './local-auth.service';
import { PrismaClient } from '../lib/prisma';

export type AuthMode = 'supabase' | 'local';

@Injectable()
export class SupabaseServerService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseServerService.name);
  private client!: SupabaseClient;
  private mode: AuthMode = 'local';

  constructor(
    private readonly config: ConfigService,
    private readonly localAuth: LocalAuthService,
    private readonly prisma: PrismaClient,
  ) {}

  onModuleInit() {
    const forced = this.config.get<string>('AUTH_MODE');
    const url = this.config.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    const usable =
      !!url &&
      !!serviceRoleKey &&
      !url.includes('placeholder') &&
      !serviceRoleKey.includes('placeholder');

    this.mode = forced === 'supabase' && usable ? 'supabase' : forced === 'local' ? 'local' : usable ? 'supabase' : 'local';

    if (this.mode === 'local') {
      if (forced === 'supabase') {
        this.logger.error(
          'AUTH_MODE=supabase was requested but SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are missing or placeholder — falling back to local auth mode.',
        );
      } else {
        this.logger.warn('Supabase is not configured — using built-in local auth (free demo OTP mode).');
      }
      return;
    }

    this.client = createClient(url!, serviceRoleKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
    this.logger.log('Supabase server client initialised (service-role)');
  }

  /** Which auth backend is active. */
  getMode(): AuthMode {
    return this.mode;
  }

  /**
   * Send an OTP to the given phone number.
   * In local mode the generated code is returned as `demoCode` so the
   * caller can surface it to the user (demo delivery).
   */
  async sendOtp(phone: string): Promise<{ sent: boolean; demoCode?: string; error?: string }> {
    if (this.mode === 'local') {
      const demoCode = await this.localAuth.issueOtp(phone);
      return { sent: true, demoCode };
    }
    const { error } = await this.client.auth.signInWithOtp({
      phone,
      options: { shouldCreateUser: true },
    });
    if (error) {
      return { sent: false, error: error.message };
    }
    return { sent: true };
  }

  /**
   * Verify an OTP for a phone number.
   * On success, returns the session + user; on failure, user is null.
   */
  async verifyOtp(
    phone: string,
    token: string,
    fullName?: string,
  ): Promise<{
    session: { access_token: string; refresh_token: string; expires_in: number } | null;
    user: { id: string; phone?: string; email?: string } | null;
    error?: string;
  }> {
    if (this.mode === 'local') {
      try {
        const profileId = await this.localAuth.verifyOtp(phone, token, fullName);
        const profile = await this.prisma.profile.findUnique({ where: { id: profileId } });
        return {
          session: this.localAuth.mintSession(profileId, phone),
          user: { id: profileId, phone, email: profile?.email ?? undefined },
        };
      } catch (err) {
        return {
          session: null,
          user: null,
          error: err instanceof Error ? err.message : 'verification failed',
        };
      }
    }
    const { data, error } = await this.client.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });
    if (error || !data.session || !data.user) {
      return { session: null, user: null, error: error?.message ?? 'verification failed' };
    }
    return {
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in ?? 3600,
      },
      user: {
        id: data.user.id,
        phone: data.user.phone ?? undefined,
        email: data.user.email ?? undefined,
      },
    };
  }

  /**
   * Verify an access token.
   * supabase mode: calls Supabase Auth's getUser endpoint (checks signature
   * AND session revocation). local mode: verifies our own HS256 JWT.
   */
  async verifyToken(
    accessToken: string,
  ): Promise<{ id: string; phone?: string; email?: string } | null> {
    if (this.mode === 'local') {
      const profileId = this.localAuth.verifyAccessToken(accessToken);
      if (!profileId) return null;
      const profile = await this.prisma.profile.findUnique({ where: { id: profileId } });
      if (!profile || !profile.isActive || profile.deletedAt) return null;
      return { id: profile.id, phone: profile.phone, email: profile.email ?? undefined };
    }
    const {
      data: { user },
      error,
    } = await this.client.auth.getUser(accessToken);
    if (error || !user) {
      return null;
    }
    return {
      id: user.id,
      phone: user.phone ?? undefined,
      email: user.email ?? undefined,
    };
  }

  /**
   * Refresh a session using a refresh token. Returns the new session or null.
   */
  async refreshSession(
    refreshToken: string,
  ): Promise<{
    session: { access_token: string; refresh_token: string; expires_in: number } | null;
    error?: string;
  }> {
    if (this.mode === 'local') {
      const session = this.localAuth.rotateRefreshToken(refreshToken);
      if (!session) return { session: null, error: 'refresh failed' };
      return { session };
    }
    const { data, error } = await this.client.auth.refreshSession({
      refresh_token: refreshToken,
    });
    if (error || !data.session) {
      return { session: null, error: error?.message ?? 'refresh failed' };
    }
    return {
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in ?? 3600,
      },
    };
  }

  /**
   * Sign out a user by revoking their session server-side.
   * local mode: stateless tokens — revocation is the cookie clear done by
   * the controller, so this is a no-op success.
   */
  async revokeSession(_accessToken: string): Promise<{ success: boolean; error?: string }> {
    if (this.mode === 'local') {
      return { success: true };
    }
    try {
      const { error: setSessionError } = await this.client.auth.setSession({
        access_token: _accessToken,
        refresh_token: '',
      });
      if (setSessionError) {
        this.logger.warn?.(`setSession failed during logout: ${setSessionError.message}`);
      }
      const { error } = await this.client.auth.signOut({ scope: 'global' });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'unknown error',
      };
    }
  }
}
