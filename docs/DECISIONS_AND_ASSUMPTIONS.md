# Decisions and Assumptions (Stub)

> **Phase 2 stub.** The full decision log is in the architecture plan PDF,
> Chapter 16 (Open Questions) and inline per chapter.

## Pre-Resolved Decisions (Phase 1)

These were resolved during the architecture phase and are treated as fixed
inputs for Phase 2 onwards.

1. **Monorepo tooling: pnpm workspaces + Turborepo.**
   - Rationale: strict dependency isolation, content-hash caching, low friction.
2. **ORM: Prisma with Supabase connection pooler.**
   - Rationale: typed schema, audit-friendly migrations, IDE support.
   - Trade-off: service-role key bypasses RLS — mitigated by never exposing
     it to the browser and treating NestJS guards as the primary enforcement.
3. **RLS strategy: defense-in-depth.**
   - RLS on every PII table, but NestJS guards are the primary enforcement.
4. **Cover and document format: single PDF, English only.**

## Open Questions (Phase 1 → to be resolved per phase deadline)

See `docs/OPEN_QUESTIONS.md` (to be created) or the architecture plan PDF,
Chapter 16, Table 16.1 for the full list. Key open questions:

- **Q-L1** Authentication strategy (phone+OTP, email+pw, hybrid) — before Phase 4
- **Q-L2** Repository root (separate Git repo vs sub-directory) — before Phase 2 ✅
  RESOLVED: sub-directory at `jashore-blood-network/` inside the existing workspace.
- **Q-L3** Distance-based search (PostGIS vs upazila-only) — before Phase 5
- **Q-L11** SMS provider — before Phase 8

## Phase 2-Specific Assumptions

1. **Node 20 LTS** is available on the developer's machine. CI uses Node 20.
2. **pnpm 9** is the package manager. npm/yarn are not supported.
3. **Next.js 15.1.3** is used instead of Next.js 16 because Next.js 16 has
   not been released as stable at the time of writing. Will upgrade when
   Next.js 16 reaches stable.
4. **Tailwind 3.4.16** is used instead of Tailwind 4 for the same reason.
5. The `.env.example` file contains placeholder values only — no real
   credentials are committed.
