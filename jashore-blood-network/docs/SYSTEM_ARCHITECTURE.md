# System Architecture (Stub)

> **Phase 2 stub.** The full system architecture is documented in the
> Phase 0–1 architecture plan PDF. This file will be expanded into a
> standalone architecture document during Phase 3.

## High-Level Components

```
[Users] ──HTTPS──> [Next.js on Vercel] ──REST/JWT──> [NestJS on Render]
                                                          │
                                                          ├──> [Supabase Auth] (JWT verify)
                                                          ├──> [Supabase Postgres via Prisma] (RLS)
                                                          └──> [Email service] (transactional)
```

## Decision Log

| # | Decision | Rationale | Date |
|---|---|---|---|
| 1 | pnpm workspaces + Turborepo | Strict dependency isolation, content-hash caching | Phase 1 |
| 2 | Prisma + Supabase with RLS defense-in-depth | Typed schema, audit, RLS as backstop | Phase 1 |
| 3 | NestJS guards + RLS, never client-side authz | Server-side enforcement is non-negotiable | Phase 1 |
| 4 | JWT in httpOnly cookie, not localStorage | XSS resistance | Phase 1 |
| 5 | Next.js 15 + Tailwind 3 (Phase 2) | Stable releases; will upgrade to 16/4 once stable | Phase 2 |

See the architecture plan PDF for the full decision log and open questions.
