/**
 * Auth foundation tests.
 *
 * These tests verify the auth GUARDS and POLICIES in isolation, with mocked
 * dependencies. They do NOT verify the full HTTP flow (that requires a
 * running NestJS app + Supabase + Postgres, which is Phase 9+ integration
 * testing territory).
 *
 * What is verified here:
 *   1. JwtAuthGuard rejects unauthenticated requests to protected routes
 *   2. JwtAuthGuard allows @Public() routes without a token
 *   3. JwtAuthGuard rejects invalid/expired tokens (Supabase verify returns null)
 *   4. JwtAuthGuard rejects requests for deleted/inactive profiles
 *   5. JwtAuthGuard attaches AuthenticatedUser with the correct roles
 *   6. RolesGuard rejects users without the required role (role escalation prevention)
 *   7. RolesGuard allows users with the required role
 *   8. RolesGuard skips @Public() routes
 *   9. IsOwnerPolicy allows the owner; rejects non-owners (IDOR prevention)
 *  10. IsOwnerPolicy fails closed when no :id param is present
 *
 * What is NOT verified here (deferred to Phase 9+ integration tests):
 *   - Actual Supabase OTP send/verify
 *   - Actual cookie setting/clearing
 *   - Actual rate-limit enforcement
 *   - End-to-end HTTP flow
 */

import { describe, it, expect, vi } from 'vitest';
import { type Reflector } from '@nestjs/core';
import { type ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { IsOwnerPolicy } from '../src/auth/policies/is-owner.policy';
import { IS_PUBLIC_KEY } from '../src/auth/decorators/public.decorator';
import { ROLES_KEY } from '../src/auth/decorators/roles.decorator';
import { CURRENT_USER_KEY } from '../src/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../src/auth/types';
import type { Role } from '@jbn/shared-types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

function createMockSupabase(verifyResult: { id: string; phone?: string; email?: string } | null) {
  return {
    verifyToken: vi.fn().mockResolvedValue(verifyResult),
    sendOtp: vi.fn().mockResolvedValue({ sent: true }),
    verifyOtp: vi.fn(),
    refreshSession: vi.fn(),
    revokeSession: vi.fn(),
    getClient: vi.fn(),
  };
}

function createMockPrisma(profile: unknown) {
  return {
    profile: {
      findUnique: vi.fn().mockResolvedValue(profile),
    },
  };
}

function createMockExecutionContext(overrides: Partial<{
  cookies: Record<string, string>;
  headers: { authorization?: string };
  handler: () => void;
  class: unknown;
  params: Record<string, string>;
}> = {}): ExecutionContext {
  const handler = overrides.handler ?? (() => {});
  const cls = overrides.class ?? class MockClass {};
  // Create the request object ONCE so mutations (e.g. attaching
  // authenticatedUser) persist across multiple getRequest() calls.
  const request = {
    cookies: overrides.cookies ?? {},
    headers: overrides.headers ?? {},
    params: overrides.params ?? {},
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
      getNext: () => undefined,
    }),
    getHandler: () => handler,
    getClass: () => cls as never,
    getArgs: () => [],
    getArgByIndex: () => undefined,
    getType: () => 'http',
    switchToRpc: () => ({}) as never,
    switchToWs: () => ({}) as never,
  } as unknown as ExecutionContext;
}

// A reflector that returns the metadata we want for each test
function createMockReflector(metadata: Record<string, unknown>) {
  return {
    getAllAndOverride: vi.fn().mockImplementation((key: string) => metadata[key]),
  } as unknown as Reflector;
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const USER_A: AuthenticatedUser = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  phone: '+8801711111111',
  roles: ['REGISTERED_USER' as Role],
};

const USER_B: AuthenticatedUser = {
  id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  phone: '+8801722222222',
  roles: ['REGISTERED_USER' as Role, 'DONOR' as Role],
};

const MODERATOR_USER: AuthenticatedUser = {
  id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  phone: '+8801733333333',
  roles: ['REGISTERED_USER' as Role, 'MODERATOR' as Role],
};

const ACTIVE_PROFILE = {
  id: USER_A.id,
  phone: USER_A.phone,
  email: null,
  fullName: 'Test User',
  isActive: true,
  deletedAt: null,
  roles: [{ role: 'REGISTERED_USER', revokedAt: null }],
};

// ---------------------------------------------------------------------------
// JwtAuthGuard tests
// ---------------------------------------------------------------------------

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  it('rejects unauthenticated requests to protected routes with 401', async () => {
    const supabase = createMockSupabase(null);
    const prisma = createMockPrisma(null);
    const reflector = createMockReflector({}); // no IS_PUBLIC_KEY
    guard = new JwtAuthGuard(reflector, supabase as never, prisma as never);

    const ctx = createMockExecutionContext({ cookies: {} });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    expect(supabase.verifyToken).not.toHaveBeenCalled();
  });

  it('allows @Public() routes without a token', async () => {
    const supabase = createMockSupabase(null);
    const prisma = createMockPrisma(null);
    const reflector = createMockReflector({ [IS_PUBLIC_KEY]: true });
    guard = new JwtAuthGuard(reflector, supabase as never, prisma as never);

    const ctx = createMockExecutionContext({ cookies: {} });
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(supabase.verifyToken).not.toHaveBeenCalled();
  });

  it('rejects invalid/expired tokens (Supabase verify returns null)', async () => {
    const supabase = createMockSupabase(null);
    const prisma = createMockPrisma(null);
    const reflector = createMockReflector({});
    guard = new JwtAuthGuard(reflector, supabase as never, prisma as never);

    const ctx = createMockExecutionContext({
      cookies: { jbn_access_token: 'invalid-or-expired-token' },
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    expect(supabase.verifyToken).toHaveBeenCalledWith('invalid-or-expired-token');
  });

  it('rejects requests when the Profile is deleted (soft-deleted)', async () => {
    const supabase = createMockSupabase({ id: USER_A.id, phone: USER_A.phone });
    const prisma = createMockPrisma({ ...ACTIVE_PROFILE, deletedAt: new Date() });
    const reflector = createMockReflector({});
    guard = new JwtAuthGuard(reflector, supabase as never, prisma as never);

    const ctx = createMockExecutionContext({
      cookies: { jbn_access_token: 'valid-token' },
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects requests when the Profile is inactive', async () => {
    const supabase = createMockSupabase({ id: USER_A.id, phone: USER_A.phone });
    const prisma = createMockPrisma({ ...ACTIVE_PROFILE, isActive: false });
    const reflector = createMockReflector({});
    guard = new JwtAuthGuard(reflector, supabase as never, prisma as never);

    const ctx = createMockExecutionContext({
      cookies: { jbn_access_token: 'valid-token' },
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('attaches AuthenticatedUser with the correct roles on success', async () => {
    const supabase = createMockSupabase({ id: USER_A.id, phone: USER_A.phone });
    const profileWithRoles = {
      ...ACTIVE_PROFILE,
      roles: [
        { role: 'REGISTERED_USER', revokedAt: null },
        { role: 'DONOR', revokedAt: null },
      ],
    };
    const prisma = createMockPrisma(profileWithRoles);
    const reflector = createMockReflector({});
    guard = new JwtAuthGuard(reflector, supabase as never, prisma as never);

    const ctx = createMockExecutionContext({
      cookies: { jbn_access_token: 'valid-token' },
    });

    expect(await guard.canActivate(ctx)).toBe(true);
    const request = ctx.switchToHttp().getRequest() as { [k: string]: unknown };
    const attached = request[CURRENT_USER_KEY] as AuthenticatedUser;
    expect(attached.id).toBe(USER_A.id);
    expect(attached.roles).toContain('REGISTERED_USER');
    expect(attached.roles).toContain('DONOR');
  });

  it('filters out revoked roles when attaching AuthenticatedUser', async () => {
    const supabase = createMockSupabase({ id: USER_A.id, phone: USER_A.phone });
    const profileWithRevokedRole = {
      ...ACTIVE_PROFILE,
      roles: [
        { role: 'REGISTERED_USER', revokedAt: null },
        { role: 'MODERATOR', revokedAt: new Date() }, // revoked — must NOT appear
      ],
    };
    const prisma = createMockPrisma(profileWithRevokedRole);
    const reflector = createMockReflector({});
    guard = new JwtAuthGuard(reflector, supabase as never, prisma as never);

    const ctx = createMockExecutionContext({
      cookies: { jbn_access_token: 'valid-token' },
    });

    await guard.canActivate(ctx);
    const request = ctx.switchToHttp().getRequest() as { [k: string]: unknown };
    const attached = request[CURRENT_USER_KEY] as AuthenticatedUser;
    expect(attached.roles).toContain('REGISTERED_USER');
    expect(attached.roles).not.toContain('MODERATOR');
  });

  it('accepts a Bearer token in the Authorization header as fallback', async () => {
    const supabase = createMockSupabase({ id: USER_A.id, phone: USER_A.phone });
    const prisma = createMockPrisma(ACTIVE_PROFILE);
    const reflector = createMockReflector({});
    guard = new JwtAuthGuard(reflector, supabase as never, prisma as never);

    const ctx = createMockExecutionContext({
      headers: { authorization: 'Bearer valid-token' },
      cookies: {},
    });
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(supabase.verifyToken).toHaveBeenCalledWith('valid-token');
  });
});

// ---------------------------------------------------------------------------
// RolesGuard tests
// ---------------------------------------------------------------------------

describe('RolesGuard', () => {
  it('allows any authenticated user when no @Roles() metadata is present', () => {
    const reflector = createMockReflector({}); // no ROLES_KEY
    const guard = new RolesGuard(reflector);
    const ctx = createMockExecutionContext({});
    (ctx.switchToHttp().getRequest() as { [k: string]: unknown })[CURRENT_USER_KEY] = USER_A;
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('skips @Public() routes', () => {
    const reflector = createMockReflector({
      [IS_PUBLIC_KEY]: true,
      [ROLES_KEY]: ['MODERATOR' as const],
    });
    const guard = new RolesGuard(reflector);
    const ctx = createMockExecutionContext({});
    // No user attached — would fail if guard ran
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('rejects a REGISTERED_USER from a MODERATOR-only route (role escalation prevention)', () => {
    const reflector = createMockReflector({
      [ROLES_KEY]: ['MODERATOR' as const],
    });
    const guard = new RolesGuard(reflector);
    const ctx = createMockExecutionContext({});
    (ctx.switchToHttp().getRequest() as { [k: string]: unknown })[CURRENT_USER_KEY] = USER_A;
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('allows a MODERATOR to access a MODERATOR-only route', () => {
    const reflector = createMockReflector({
      [ROLES_KEY]: ['MODERATOR' as const],
    });
    const guard = new RolesGuard(reflector);
    const ctx = createMockExecutionContext({});
    (ctx.switchToHttp().getRequest() as { [k: string]: unknown })[CURRENT_USER_KEY] = MODERATOR_USER;
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows access if the user has ANY of the required roles', () => {
    const reflector = createMockReflector({
      [ROLES_KEY]: ['MODERATOR' as const, 'DONOR' as const],
    });
    const guard = new RolesGuard(reflector);
    const ctx = createMockExecutionContext({});
    // USER_B is REGISTERED_USER + DONOR — has DONOR, should pass
    (ctx.switchToHttp().getRequest() as { [k: string]: unknown })[CURRENT_USER_KEY] = USER_B;
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('rejects when no user is attached (defensive — should never happen)', () => {
    const reflector = createMockReflector({
      [ROLES_KEY]: ['MODERATOR' as const],
    });
    const guard = new RolesGuard(reflector);
    const ctx = createMockExecutionContext({});
    // No user attached
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});

// ---------------------------------------------------------------------------
// IsOwnerPolicy tests (IDOR prevention)
// ---------------------------------------------------------------------------

describe('IsOwnerPolicy', () => {
  const policy = new IsOwnerPolicy();

  it('allows the owner of the resource (id matches user.id)', () => {
    const ctx = createMockExecutionContext({
      params: { id: USER_A.id },
    });
    expect(policy.canActivate({ user: USER_A, context: ctx })).toBe(true);
  });

  it('rejects a non-owner (IDOR prevention)', () => {
    // USER_A tries to access USER_B's resource
    const ctx = createMockExecutionContext({
      params: { id: USER_B.id },
    });
    expect(policy.canActivate({ user: USER_A, context: ctx })).toBe(false);
  });

  it('fails closed when no :id param is present', () => {
    const ctx = createMockExecutionContext({ params: {} });
    expect(policy.canActivate({ user: USER_A, context: ctx })).toBe(false);
  });

  it('rejects when the id is present but does not match', () => {
    const ctx = createMockExecutionContext({
      params: { id: 'not-a-matching-uuid' },
    });
    expect(policy.canActivate({ user: USER_A, context: ctx })).toBe(false);
  });
});
