/**
 * LocalAuthService — built-in, zero-cost OTP authentication.
 *
 * Used when Supabase Auth is not configured (AUTH_MODE=local, or
 * SUPABASE_URL is missing/placeholder). Everything runs inside this API:
 *
 *   - OTP codes are generated here, stored HASHED (sha256 + pepper) in the
 *     otp_codes table, single-use, expiring after 10 minutes.
 *   - Sessions are self-signed JWTs (HS256) — the same shape Supabase
 *     issues (sub / phone / exp), so JwtAuthGuard and the cookie flow work
 *     unchanged.
 *   - Profiles are created on first verify (id = random UUID), exactly like
 *     the Supabase flow creates a Profile row on first login.
 *
 * This makes the platform fully usable for demos and pilots without any
 * paid SMS provider. The OTP is returned to the caller (demo delivery) —
 * always surfaced as "demoOtp" so the frontend can display it clearly.
 * When RESEND_API_KEY (or a real Supabase project) is configured later,
 * AUTH_MODE=supabase switches back to the hardened flow with no code
 * changes anywhere else.
 */

import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '../lib/prisma';

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes, matches the UI copy
const OTP_MAX_ATTEMPTS = 5;
const ACCESS_TOKEN_TTL_SEC = 60 * 60; // 1 hour
const REFRESH_TOKEN_TTL_SEC = 60 * 60 * 24 * 30; // 30 days

export interface LocalSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

@Injectable()
export class LocalAuthService {
  private readonly logger = new Logger(LocalAuthService.name);
  private readonly pepper: string;
  private readonly jwtSecret: string;

  constructor(
    private readonly prisma: PrismaClient,
    config: ConfigService,
  ) {
    // The JWT secret must be stable across restarts, otherwise every
    // issued session dies on the next deploy. SUPABASE_JWT_SECRET is the
    // natural place (it is the token-signing secret in supabase mode too);
    // a derived fallback keeps local dev frictionless.
    const configured = config.get<string>('SUPABASE_JWT_SECRET');
    this.jwtSecret = configured && !configured.includes('placeholder')
      ? configured
      : createHash('sha256')
          .update(`jbn-local-auth:${configured ?? 'unconfigured'}`)
          .digest('hex');
    this.pepper = createHash('sha256').update(`jbn-otp:${this.jwtSecret}`).digest('hex');
    this.logger.warn('Local auth mode ACTIVE — OTPs are self-issued and returned to the client (demo delivery). Set AUTH_MODE=supabase with a real Supabase project for production.');
  }

  private hashCode(phone: string, code: string): string {
    return createHash('sha256').update(`${phone}:${code}:${this.pepper}`).digest('hex');
  }

  /**
   * Issue a new OTP for the phone. Deletes previous unconsumed codes for
   * that phone (only the newest code is ever valid) and returns the code
   * in plaintext for demo delivery.
   */
  async issueOtp(phone: string): Promise<string> {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.otpCode.deleteMany({ where: { phone, consumedAt: null } });
    await this.prisma.otpCode.create({
      data: {
        phone,
        codeHash: this.hashCode(phone, code),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });
    return code;
  }

  /**
   * Verify an OTP and return the matching Profile id, creating the Profile
   * on first login (mirrors the Supabase shouldCreateUser behaviour).
   * Throws Error with a client-safe message on failure.
   */
  async verifyOtp(phone: string, code: string, fullName?: string): Promise<string> {
    const row = await this.prisma.otpCode.findFirst({
      where: { phone, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) {
      throw new Error('The OTP is invalid, expired, or has already been used.');
    }
    if (row.expiresAt.getTime() < Date.now()) {
      throw new Error('The OTP is invalid, expired, or has already been used.');
    }
    if (row.attempts >= OTP_MAX_ATTEMPTS) {
      throw new Error('Too many incorrect attempts. Request a new code.');
    }
    if (row.codeHash !== this.hashCode(phone, code)) {
      await this.prisma.otpCode.update({
        where: { id: row.id },
        data: { attempts: { increment: 1 } },
      });
      throw new Error('The OTP is invalid, expired, or has already been used.');
    }
    await this.prisma.otpCode.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    });

    const profile = await this.prisma.profile.upsert({
      where: { phone },
      update: { isActive: true },
      create: {
        id: randomUUID(),
        phone,
        fullName: fullName ?? 'Unknown',
      },
    });
    return profile.id;
  }

  mintSession(profileId: string, phone: string): LocalSession {
    const now = Math.floor(Date.now() / 1000);
    const access_token = jwt.sign(
      { sub: profileId, phone, typ: 'access' },
      this.jwtSecret,
      { expiresIn: ACCESS_TOKEN_TTL_SEC, algorithm: 'HS256' },
    );
    const refresh_token = jwt.sign(
      { sub: profileId, phone, typ: 'refresh', jti: randomBytes(12).toString('hex') },
      this.jwtSecret,
      { expiresIn: REFRESH_TOKEN_TTL_SEC, algorithm: 'HS256' },
    );
    return { access_token, refresh_token, expires_in: ACCESS_TOKEN_TTL_SEC };
  }

  /**
   * Verify an access token. Returns the profile id, or null when the token
   * is malformed/expired/not ours.
   */
  verifyAccessToken(token: string): string | null {
    try {
      const payload = jwt.verify(token, this.jwtSecret, { algorithms: ['HS256'] }) as {
        sub?: string;
        typ?: string;
      };
      if (!payload.sub || payload.typ !== 'access') return null;
      return payload.sub;
    } catch {
      return null;
    }
  }

  /**
   * Rotate a refresh token into a fresh session. Returns null when the
   * refresh token is invalid.
   */
  rotateRefreshToken(refreshToken: string): LocalSession | null {
    try {
      const payload = jwt.verify(refreshToken, this.jwtSecret, {
        algorithms: ['HS256'],
      }) as { sub?: string; phone?: string; typ?: string };
      if (!payload.sub || payload.typ !== 'refresh' || !payload.phone) return null;
      return this.mintSession(payload.sub, payload.phone);
    } catch {
      return null;
    }
  }
}
