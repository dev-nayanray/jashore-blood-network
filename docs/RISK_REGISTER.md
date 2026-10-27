# Risk Register (Stub)

> **Phase 2 stub.** The full risk register is in the architecture plan PDF,
> Chapter 17, Table 17.1. This file will be expanded into a standalone
> document and reviewed at every phase boundary.

## Top 5 Risks for Phase 2

| Risk | L | I | Mitigation | Owner |
|---|---|---|---|---|
| Free-tier Render sleeps, 30s cold starts | H | H | Move to Render Starter before pilot | DevOps |
| `.env` accidentally committed | M | C | `.gitignore` covers all env variants; CI scans for secrets | Engineering |
| Workspace dependency cycles | M | M | pnpm reports cycles on install; turborepo enforces DAG | Engineering |
| Prisma + RLS interaction bypass | L | C | Service-role key never in browser; RLS as backstop, NestJS guards as primary | Security |
| Beta-version dependency breakage | M | M | Use only stable releases (Next.js 15, Tailwind 3, NestJS 10) | Engineering |

See the architecture plan PDF for the complete 16-entry risk register.
