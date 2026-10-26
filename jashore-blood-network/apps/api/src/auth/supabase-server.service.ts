/**
 * Server-side Supabase client.
 *
 * CRITICAL SECURITY NOTES:
 *   - This client uses the SERVICE-ROLE key, which BYPASSES Row Level Security.
 *   - It is therefore NEVER imported by frontend code, NEVER shipped to the
 *     browser, and NEVER appears in any NEXT_PUBLIC_ environment variable.
 *   - It is used here ONLY for: sending OTPs, verifying OTPs, refreshing
 *     tokens, revoking sessions, and admin user lookups.
 *   - All other database reads/writes go through Prisma, where RLS is the
 *     backstop and NestJS guards are the primary enforcement.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SupabaseServerService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseServerService.name);
  private client!: SupabaseClient;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url = this.config.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!url || !serviceRoleKey) {
      this.logger.error(
        'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — Supabase client cannot be initialised',
      );
      throw new Error('Supabase server configuration is incomplete');
    }

    this.client = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    this.logger.log('Supabase server client initialised (service-role)');
  }

  /**
   * Returns the underlying Supabase client. Use sparingly — most operations
   * should go through well-named methods on this service so that audit
   * logging and rate limiting can be applied uniformly.
   */
  getClient(): SupabaseClient {
    return this.client;
  }

  /**
   * Send an OTP to the given phone number.
   * Returns true if the OTP was sent, false otherwise.
   * The caller is responsible for rate-limiting and for returning a generic
   * "202 Accepted" to the client regardless of the result, to prevent
   * account enumeration.
   */
  async sendOtp(phone: string): Promise<{ sent: boolean; error?: string }> {
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
   * On success, returns the session (access_token + refresh_token) and the
   * user. On failure, returns null.
   */
  async verifyOtp(
    phone: string,
    token: string,
  ): Promise<{
    session: { access_token: string; refresh_token: string; expires_in: number } | null;
    user: { id: string; phone?: string; email?: string } | null;
    error?: string;
  }> {
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
   * Verify an access token by calling Supabase Auth's getUser endpoint.
   * This is the OFFICIAL recommended approach for token verification in
   * server-side Supabase integrations — it checks both the JWT signature
   * AND whether the session is still valid (not revoked).
   *
   * Returns the user record on success, null on failure.
   */
  async verifyToken(
    accessToken: string,
  ): Promise<{ id: string; phone?: string; email?: string } | null> {
    // auth.getUser() verifies the JWT and fetches the user from the Auth service.
    // It rejects if the JWT is malformed, expired, or revoked.
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
   * Supabase JS v2's `signOut()` uses the client's current session, so we
   * first set the session from the access token, then sign out with the
   * `global` scope to revoke all sessions for this user (defensive).
   */
  async revokeSession(accessToken: string): Promise<{ success: boolean; error?: string }> {
    // Set the session on the service-role client so signOut knows which
    // user to revoke. We use a minimal refresh-token-less session because
    // we only have the access token at this point.
    try {
      const { error: setSessionError } = await this.client.auth.setSession({
        access_token: accessToken,
        refresh_token: '', // not available at logout; signOut only needs access_token
      });
      if (setSessionError) {
        // Even if setSession fails (e.g. token already expired), we still
        // attempt signOut — the user's cookies will be cleared regardless.
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
