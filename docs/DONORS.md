# Donor Registration & Search

> **Phase 5 — Donor MVP.** Donor profile CRUD, public search, and the
> medical safety model.

## Overview

Phase 5 implements two user-facing features:

1. **Donor registration** — authenticated users create and manage their
   donor profile (blood group, location, availability, contact preferences).
2. **Public donor search** — anyone (including unauthenticated visitors)
   can search for consenting donors by blood group and location.

## Medical Safety Model

**CRITICAL: a matching blood group is only a preliminary search filter.**

The platform NEVER claims that a donor is:
- Medically eligible to donate
- Clinically compatible with a specific recipient
- Available at the time of contact

Medical eligibility and clinical compatibility are determined by qualified
medical personnel at the receiving facility (blood bank or hospital) at
the time of donation. The donor profile captures self-reported information
that may be out of date, incomplete, or wrong.

Every search result card displays this disclaimer. The donor registration
form requires explicit consent acknowledging this.

## API Endpoints

### Public endpoints

| Method | Path | Purpose | Rate limit |
|---|---|---|---|
| GET | `/api/v1/donors` | Search donors (paginated, PII-stripped) | 60/min/IP |
| GET | `/api/v1/locations/districts` | List districts | 60/min/IP |
| GET | `/api/v1/locations/upazilas` | List upazilas (optional `?districtId=`) | 60/min/IP |

### Authenticated endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/donors/me` | Get own donor profile |
| POST | `/api/v1/donors/me` | Create own donor profile |
| PATCH | `/api/v1/donors/me` | Update own donor profile |

There is **no** `GET /api/v1/donors/:id` endpoint — IDOR is prevented by
construction. A user can only access their own profile via `/donors/me`.

## Search Filters

| Filter | Type | Notes |
|---|---|---|
| `bloodGroup` | enum | One of `A_POSITIVE`, `A_NEGATIVE`, `B_POSITIVE`, `B_NEGATIVE`, `AB_POSITIVE`, `AB_NEGATIVE`, `O_POSITIVE`, `O_NEGATIVE` |
| `districtId` | UUID | Filters via the upazila→district relation |
| `upazilaId` | UUID | Filters directly on `donor_profiles.upazila_id` |
| `localityId` | UUID | Filters directly on `donor_profiles.locality_id` |
| `recentlyAvailable` | boolean | When `true`, only returns donors whose `availability_confirmed_at` is within the last 30 days |
| `page` | integer | Default 1, min 1 |
| `pageSize` | integer | Default 20, min 1, max 50 |

All search results are additionally filtered by:
- `visibility = 'LISTED'`
- `is_available = true`
- `deleted_at IS NULL`

These filters are enforced BOTH in the Prisma WHERE clause AND by RLS
policies (defense-in-depth).

## PII Protection

The search endpoint returns a **stripped projection** — only the fields
needed to decide whether to contact the donor:

| Field | Returned? | Notes |
|---|---|---|
| `id` | ✅ | Donor profile UUID (not the user profile UUID) |
| `displayName` | ✅ | First name + last initial (e.g. "Nayan R.") |
| `bloodGroup` | ✅ | Enum value |
| `upazila` | ✅ | `{ id, name }` |
| `locality` | ✅ | `{ id, name }` or null |
| `availabilityConfirmedAt` | ✅ | ISO timestamp |
| `lastDonationAt` | ✅ | ISO date or null (only if donor chose to share) |
| `phone` | ❌ | Never returned in search |
| `email` | ❌ | Never returned in search |
| `profileId` | ❌ | Never returned (would link to user identity) |
| `contactPreference` | ❌ | Not relevant for public search |
| `visibility` | ❌ | Always LISTED (filtered) |

To contact a donor, a requester must submit a blood request (Phase 6+).
The donor then chooses whether to respond. There is no direct contact
channel from search.

## Availability Model

Donor availability has two components:

1. `isAvailable` (boolean) — the donor's current on/off switch
2. `availabilityConfirmedAt` (timestamp) — when the donor last reconfirmed

A donor appears in search results only if:
- `isAvailable = true` AND
- `availabilityConfirmedAt` is within the last 30 days (when
  `recentlyAvailable=true` is set)

Donors whose `availabilityConfirmedAt` is older than 30 days are shown a
"stale availability" warning on their profile page and prompted to
reconfirm. Setting `isAvailable = true` via PATCH automatically updates
`availabilityConfirmedAt` to `now()`.

## Security

### IDOR prevention
- No `/donors/:id` endpoint exists
- All writes scoped to `where: { profileId: userId }` (the authenticated
  user's own profile)
- The `profileId` field is NOT in the update schema (mass-assignment
  prevention)

### Mass-assignment prevention
- Zod validation schemas enforce a strict field whitelist
- The backend `ZodValidationPipe` has `forbidNonWhitelisted: true`
- The service ignores any field not in the schema, even if it reaches
  the service (defense-in-depth)

### Audit logging
Security-sensitive field changes are audit-logged:
- `DONOR_PROFILE_CREATED` — on profile creation
- `DONOR_PROFILE_UPDATED` — when `visibility`, `isAvailable`, or
  `contactPreference` change

Non-sensitive changes (e.g. `lastDonationAt`) are NOT audit-logged to
avoid log noise.

### Rate limiting
- Search: 60 requests/min/IP (global ThrottlerGuard)
- Profile CRUD: 60 requests/min/IP (global default)
- Auth endpoints have stricter limits (see Phase 4 docs)

## Testing

### Unit tests (25 tests in `apps/api/test/donors.foundation.spec.ts`)

**Search (8 tests):**
- Paginated response shape
- PII stripping (no phone, email, full name, profileId)
- Blood group filter
- Upazila filter
- District filter (via upazila relation)
- Recently-available filter (30-day window)
- Always filters by LISTED + available + non-deleted
- Empty results handling

**Create (3 tests):**
- Creates profile + audit-logs creation
- Throws ConflictException on duplicate
- Throws BadRequestException on invalid upazila

**Update (5 tests):**
- Throws NotFoundException without existing profile
- Scopes update to authenticated user (IDOR prevention)
- Does NOT include profileId in update data (mass-assignment prevention)
- Updates availabilityConfirmedAt when isAvailable=true
- Does NOT update availabilityConfirmedAt when isAvailable=false
- Audit-logs sensitive field changes
- Does NOT audit-log non-sensitive changes

**Get own profile (3 tests):**
- Returns full detail for owner
- Throws NotFoundException without profile
- Throws NotFoundException for soft-deleted profile

**Display name generation (3 tests):**
- Single-name handling
- Empty-name fallback (Anonymous)
- Three-part name handling

### Integration tests (deferred to Phase 9+)
- Full HTTP flow with cookies
- Real Prisma queries against Postgres
- RLS policy enforcement
- Rate-limit enforcement

## UI Pages

| Page | Auth | Purpose |
|---|---|---|
| `/donors/search` | Public | Search donors with filters + pagination |
| `/donors/register` | Authenticated | Create donor profile |
| `/donors/profile` | Authenticated | View + update own profile |

All pages are:
- Mobile-first responsive
- Accessible (semantic HTML, ARIA labels, keyboard navigable)
- Performance-optimized for slow networks (minimal JS, skeleton loaders)
- Clear about loading, empty, error, and success states

## Setup & Testing

### Local development

```bash
# 1. Install dependencies
pnpm install

# 2. Set up environment variables (apps/api/.env and apps/web/.env)
#    See .env.example files

# 3. Run database migrations + seed
pnpm --filter @jbn/api prisma:migrate:deploy
pnpm --filter @jbn/api prisma:seed

# 4. Start both apps in dev mode
pnpm dev
```

### Running tests

```bash
# All tests
pnpm test

# Donor tests only
pnpm --filter @jbn/api test -- --reporter=verbose test/donors.foundation.spec.ts

# Watch mode
pnpm --filter @jbn/api test:watch
```

### Verifying the search endpoint

```bash
# Start the API
pnpm --filter @jbn/api dev

# Search for O+ donors (public, no auth needed)
curl http://localhost:3001/api/v1/donors?bloodGroup=O_POSITIVE

# Search with upazila filter
curl http://localhost:3001/api/v1/donors?bloodGroup=O_POSITIVE&upazilaId=<uuid>

# Search with recently-available filter
curl 'http://localhost:3001/api/v1/donors?recentlyAvailable=true'
```

## Future Enhancements (out of Phase 5 scope)

- **Distance-based search** — the schema is designed to support PostGIS
  radius search in a future phase without breaking the current API
- **Locality filter UI** — the API supports it but the UI doesn't expose
  it yet (localities are user-submitted and need moderator approval)
- **Donor profile deletion** — the schema supports soft-delete; the
  endpoint will be added in Phase 8+ with the data retention workflow
- **Contact workflow** — Phase 6+ blood request system will provide the
  contact channel (currently the "Contact donor" button is a placeholder)
