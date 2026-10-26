# Authentication & Authorization

> **Phase 4 — Auth Foundation.** This document describes the authentication
> and authorization architecture, the Supabase configuration, and the
> relationship between Supabase Auth identities and application Profile records.

## Architecture Overview

```
┌──────────────┐      OTP via SMS        ┌──────────────────┐
│  Next.js Web │ ──────────────────────► │  NestJS Backend  │
│  (Vercel)    │                         │  (Render)        │
│              │ ◄─── httpOnly cookies ─ │                  │
│              │   (access + refresh)    │                  │
└──────────────┘                         └────────┬─────────┘
                                                  │
                                  verifyToken()   │   upsert profile
                                                  ▼
                                         ┌──────────────────┐
                                         │  Supabase Auth   │
                                         │  (identity)      │
                                         └──────────────────┘
                                                  │
                                  auth.users.id = profiles.id
                                                  ▼
                                         ┌──────────────────┐
                                         │  PostgreSQL      │
                                         │  (profiles,      │
                                         │   user_roles,    │
                                         │   audit_logs)    │
                                         └──────────────────┘
```

## Identity Provider: Supabase Auth

Supabase Auth is the sole identity provider. It handles:
- Phone number collection and E.164 normalization
- OTP generation and delivery (via Supabase's SMS provider)
- OTP verification
- JWT access token issuance (1-hour lifetime)
- Refresh token issuance (7-day lifetime)
- Session revocation

The NestJS backend NEVER handles passwords. It only:
1. Requests OTPs from Supabase Auth (`auth.signInWithOtp`)
2. Verifies OTPs with Supabase Auth (`auth.verifyOtp`)
3. Verifies access tokens with Supabase Auth (`auth.getUser(token)`)
4. Refreshes sessions (`auth.refreshSession`)
5. Revokes sessions (`auth.signOut`)

### Relationship: Supabase Auth users ↔ Application profiles

The `profiles.id` column in the application database **exactly matches**
`auth.users.id` in Supabase Auth. This 1:1 mapping is established at first
login:

1. User submits phone + OTP to `POST /api/v1/auth/otp/verify`
2. Supabase Auth verifies the OTP and returns the user record (including `user.id`)
3. The backend upserts a `profiles` row with `id = supabase_user.id`
4. The backend grants `REGISTERED_USER` role (first login only)
5. The backend audit-logs the `ROLE_AUTO_GRANTED` action

Because the IDs match, Row Level Security policies that use `auth.uid()`
(returns the Supabase Auth user id) automatically scope to the correct
application profile.

## Session Management

### Cookie-based sessions (XSS-resistant)

The access token and refresh token are stored in **httpOnly cookies** —
NOT in `localStorage` or JavaScript-accessible closures. This is the
OWASP-recommended pattern because:

- `localStorage` is readable by any JavaScript running on the page,
  including XSS payloads. An XSS attack can steal the token and replay it.
- httpOnly cookies cannot be read by JavaScript. An XSS attack cannot
  steal the token from the cookie.

| Cookie | Purpose | Lifetime | Path | Attributes |
|---|---|---|---|---|
| `jbn_access_token` | JWT access token for API auth | 1 hour | `/` | httpOnly, Secure (prod), SameSite=Lax |
| `jbn_refresh_token` | Refresh token for getting new access tokens | 7 days | `/api/v1/auth` | httpOnly, Secure (prod), SameSite=Lax |

The refresh-token cookie is **path-restricted** to `/api/v1/auth` so it is
sent ONLY to auth-refresh and auth-logout endpoints — not on every request.
This limits the blast radius if the refresh token is somehow leaked.

### CSRF protection

SameSite=Lax cookies provide the primary CSRF defense: the browser will NOT
send the cookie on cross-site POST requests (only on top-level GET
navigations). This is sufficient for the OTP-based auth flow because:

1. State-changing endpoints (POST/PATCH/DELETE) require the access-token
   cookie, which SameSite=Lax blocks on cross-site requests.
2. The OTP flow does not use form submissions from third-party sites.

For additional defense, the API accepts an `X-CSRF-Token` header
(allowed in CORS config). A future phase may add a double-submit-token
pattern if threat modeling warrants it.

## API Endpoints

### Public endpoints (no authentication required)

| Method | Path | Purpose | Rate limit |
|---|---|---|---|
| POST | `/api/v1/auth/otp/request` | Request an OTP for a phone number | 3/hour/phone |
| POST | `/api/v1/auth/otp/verify` | Verify an OTP and establish a session | 10/hour/IP |
| POST | `/api/v1/auth/refresh` | Refresh an expired access token | 10/hour/IP |
| GET | `/health` | Health check (no auth, no rate limit) | — |

### Authenticated endpoints

| Method | Path | Purpose | Authorization |
|---|---|---|---|
| POST | `/api/v1/auth/logout` | Revoke the Supabase session, clear cookies | Any authenticated user |
| GET | `/api/v1/auth/me` | Get current user's profile + roles | Any authenticated user |
| PATCH | `/api/v1/users/me` | Update own profile (name, email) | Any authenticated user (cannot change phone or roles) |

### Anti-enumeration

The `POST /api/v1/auth/otp/request` endpoint **always returns 202 Accepted**
with the same response body, regardless of whether:
- The phone number is registered
- The OTP was actually sent
- The phone number is valid

This prevents account enumeration: an attacker cannot distinguish "phone
not registered" from "OTP sent" from the response. The underlying error
(if any) is logged server-side but NOT surfaced to the client.

## Authorization Model

### Three layers of enforcement (defense-in-depth)

1. **NestJS Guards (PRIMARY)** — `JwtAuthGuard` (global), `RolesGuard`,
   `PoliciesGuard`. These have full request context and make complex
   ownership decisions.
2. **Supabase Row Level Security (BACKSTOP)** — RLS policies on every PII
   table. Catches direct database access with the anon key and any guard
   bypass. See `docs/DATABASE_SCHEMA.md` for the policy matrix.
3. **Audit Logging** — Every privileged action writes to `audit_logs`
   (append-only). Enables post-incident investigation.

### Guards

#### `JwtAuthGuard` (global)
- Registered as a global guard via `APP_GUARD` — every route is authenticated
  by default.
- Routes marked `@Public()` skip authentication.
- Extracts the access token from the `jbn_access_token` cookie (preferred)
  or the `Authorization: Bearer` header (for non-browser clients).
- Verifies the token via `supabase.auth.getUser(token)` — this checks both
  the JWT signature AND whether the session is still valid (not revoked).
- Loads the user's Profile + active (non-revoked) roles from the database.
- Attaches `AuthenticatedUser` to the request for downstream guards and
  controllers.
- **Roles are loaded from the database, NOT from the JWT claims.** This
  means role changes take effect on the next request, not after the JWT
  expires. We deliberately do NOT trust role values in the JWT.

#### `RolesGuard` (per-route via `@Roles()`)
- Checks `@Roles('MODERATOR', 'DISTRICT_ADMINISTRATOR')` decorator metadata.
- If the user has ANY of the required roles (active, non-revoked), the
  request passes. Otherwise, 403 Forbidden.
- If no `@Roles()` metadata is present, the guard is a no-op (any
  authenticated user passes).
- **CRITICAL: users cannot self-assign roles.** The `user_roles` table has
  no INSERT/UPDATE/DELETE policy for authenticated users (see RLS migration).
  Role assignment happens only via the backend service-role connection
  (which bypasses RLS) and is audit-logged.

#### `PoliciesGuard` (per-route via `@Policy()`)
- Instantiates and runs policy classes attached via `@Policy(IsOwnerPolicy)`.
- All policies must return `true`; if any returns `false` or throws, 403.
- `IsOwnerPolicy` is the primary IDOR-prevention policy: it checks that the
  `:id` route param matches the authenticated user's id.
- Custom policies (e.g. `IsRequesterPolicy` for blood requests) will be
  added in Phase 6+.

### Role hierarchy

```
REGISTERED_USER (1)  ← granted automatically on first login
DONOR (2)            ← self-assigned via donor registration (Phase 5)
VOLUNTEER_COORDINATOR (3)  ← admin-appointed
HOSPITAL_REPRESENTATIVE (3) ← admin-appointed after facility verification
MODERATOR (4)              ← admin-appointed
DISTRICT_ADMINISTRATOR (5) ← admin-appointed
SUPER_ADMINISTRATOR (6)    ← admin-appointed by existing Super Admin
```

A user with role level N can grant roles up to level N-1. Role assignment
is performed by the admin role-assignment endpoint (Phase 7+) which is
gated by an `AssignRolePolicy` that enforces this hierarchy.

## Environment Configuration

### Server-only variables (NEVER exposed to the frontend)

| Variable | Purpose | Used by |
|---|---|---|
| `DATABASE_URL` | Prisma Client runtime (pooler port 6543) | NestJS app |
| `DIRECT_URL` | Prisma Migrate CLI (direct port 5432) | Migration scripts |
| `SUPABASE_URL` | Supabase project URL | NestJS app |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key — **BYPASSES RLS** | NestJS app only |
| `SUPABASE_JWT_SECRET` | JWT verification secret (fallback) | NestJS app |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed origins | NestJS app |
| `JWT_COOKIE_DOMAIN` | Cookie domain (empty for localhost) | NestJS app |

### Public variables (safe for the browser)

| Variable | Purpose | Used by |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API URL | Next.js app |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Next.js app (future client-side auth) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (RLS-enforced) | Next.js app (future client-side auth) |

### Supabase Dashboard Configuration

Configure the following in the Supabase dashboard:

1. **Authentication → Providers → Phone**
   - Enable Phone provider
   - Set OTP length to 6 digits
   - Set OTP expiry to 10 minutes
   - Configure SMS provider (Twilio, MessageBird, or Supabase's built-in)

2. **Authentication → URL Configuration**
   - Site URL: `https://jashore-blood-network.org` (production)
   - Redirect URLs:
     - `http://localhost:3000/auth/callback` (dev)
     - `https://jashore-blood-network.org/auth/callback` (prod)
     - `https://*-vercel.app/auth/callback` (preview deploys)

3. **Authentication → Email** (if email verification is enabled)
   - Confirm email template
   - Set "From" address

4. **API Settings**
   - Copy the `anon` key → set as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy the `service_role` key → set as `SUPABASE_SERVICE_ROLE_KEY`
     (NEVER in any NEXT_PUBLIC_ variable)
   - Copy the JWT secret → set as `SUPABASE_JWT_SECRET`

## Testing

### Unit tests (Phase 4)

`apps/api/test/auth.foundation.spec.ts` verifies:

1. **JwtAuthGuard**:
   - Rejects unauthenticated requests with 401
   - Allows `@Public()` routes without a token
   - Rejects invalid/expired tokens
   - Rejects deleted/inactive profiles
   - Attaches `AuthenticatedUser` with correct roles
   - Filters out revoked roles
   - Accepts Bearer token as fallback

2. **RolesGuard**:
   - Allows any authenticated user when no `@Roles()` is present
   - Skips `@Public()` routes
   - Rejects role escalation (REGISTERED_USER on MODERATOR-only route → 403)
   - Allows users with the required role
   - Allows access if user has ANY of multiple required roles
   - Fails closed when no user is attached (defensive)

3. **IsOwnerPolicy** (IDOR prevention):
   - Allows the owner of the resource
   - Rejects non-owners (IDOR prevention)
   - Fails closed when no `:id` param is present
   - Rejects when id does not match

### Integration tests (deferred to Phase 9+)

The following will be tested with a running NestJS app + Supabase + Postgres:
- Full OTP send → verify → me → logout flow
- Cookie setting and clearing
- Rate-limit enforcement
- Token refresh after expiry
- Session revocation across multiple devices

## Security Checklist

- [x] Users cannot self-assign privileged roles (RLS on `user_roles`)
- [x] Authentication validated on every protected endpoint (global `JwtAuthGuard`)
- [x] Authorization enforced on every protected operation (`@Roles()`, `@Policy()`)
- [x] Role values NOT trusted from the browser (loaded from DB on each request)
- [x] IDOR prevention via `IsOwnerPolicy`
- [x] Session cookies are httpOnly + Secure + SameSite=Lax
- [x] CSRF protection via SameSite=Lax cookies
- [x] CORS uses explicit allowed origins (no wildcard with credentials)
- [x] Auth endpoints rate-limited (3/hour/phone for OTP, 10/hour/IP for verify)
- [x] Anti-enumeration (OTP request always returns 202)
- [x] No passwords, tokens, or credentials in logs
- [x] Service-role key never exposed to frontend (server-only env var)
- [x] Access tokens verified via `supabase.auth.getUser()` (checks signature + revocation)
- [x] Deleted/inactive profiles rejected even with a valid token
