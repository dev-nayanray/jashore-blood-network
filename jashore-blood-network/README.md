# Jashore Blood Network

A district-wide blood donor discovery and blood request coordination platform for **Jashore District, Bangladesh**.

> **Status:** Phase 2 — Repository Foundation. No business logic implemented yet.
> This monorepo contains only the skeleton: tooling, configuration, empty apps,
> and a CI pipeline. Feature implementation begins in Phase 3 per the approved
> roadmap.

## ⚠️ Important Disclaimer

This platform is a **donor coordination service**, not a replacement for a licensed
blood bank, medical professional, blood testing, or clinical compatibility
assessment. The platform must never guarantee that a registered donor is available
or medically eligible to donate. Medical eligibility is determined by the blood
bank at the time of donation.

## Tech Stack

| Layer | Technology | Hosting |
|---|---|---|
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript 5 + Tailwind CSS 4 | Vercel |
| Backend | NestJS 11 + TypeScript 5 | Render |
| Database | PostgreSQL via Supabase | Supabase |
| Auth | Supabase Auth (OTP, JWT) | Supabase |
| ORM | Prisma 5 | — |
| Source control | Git + GitHub | GitHub |
| Package manager | pnpm 9 + Turborepo | — |

## Monorepo Layout

```
jashore-blood-network/
├── apps/
│   ├── web/                  # Next.js frontend (Vercel)
│   └── api/                  # NestJS backend (Render)
├── packages/
│   ├── shared-types/         # Cross-app TypeScript types and enums
│   └── validation/           # Cross-app Zod schemas
├── database/
│   ├── migrations/           # Prisma migration SQL (Phase 3)
│   └── seeds/                # Reference data only (Phase 3)
├── docs/                     # Architecture documentation
├── scripts/                  # Operational scripts
├── .github/workflows/        # CI pipeline
├── .env.example              # Placeholders only — never real credentials
├── .gitignore
├── .editorconfig
├── package.json              # Root devDependencies + scripts
├── pnpm-workspace.yaml       # Workspace declaration
├── turbo.json                # Task pipeline
├── README.md
└── CONTRIBUTING.md
```

## Prerequisites

- **Node.js** ≥ 20.11.0 (LTS recommended)
- **pnpm** ≥ 9.0.0 (install via `npm install -g pnpm@9`)
- **Git** ≥ 2.30

## Quick Start (Local Development)

```bash
# 1. Clone the repository
git clone <repo-url>
cd jashore-blood-network

# 2. Install dependencies (all workspaces)
pnpm install

# 3. Copy environment template
cp .env.example .env
# Edit .env and fill in real values for Supabase, API URL, etc.

# 4. Run typecheck, lint, and build to verify the install
pnpm typecheck
pnpm lint
pnpm build

# 5. Start both apps in dev mode (web on :3000, api on :3001)
pnpm dev
```

## Common Commands

| Command | Description |
|---|---|
| `pnpm install` | Install all dependencies across all workspaces |
| `pnpm dev` | Start frontend and backend in dev mode (parallel) |
| `pnpm build` | Build all workspaces (frontend + backend + packages) |
| `pnpm lint` | Run ESLint across all workspaces |
| `pnpm typecheck` | Run TypeScript compiler in `--noEmit` mode |
| `pnpm test` | Run all unit + integration tests |
| `pnpm format` | Format all files with Prettier |
| `pnpm format:check` | Check formatting without writing |
| `pnpm clean` | Remove all build artifacts and `node_modules` |

### Per-app commands

You can run commands against a single workspace:

```bash
pnpm --filter @jbn/web dev         # only the frontend
pnpm --filter @jbn/api dev         # only the backend
pnpm --filter @jbn/api test        # only backend tests
pnpm --filter @jbn/shared-types build
```

## Development URLs (Local)

| Service | URL |
|---|---|
| Frontend (Next.js) | http://localhost:3000 |
| Backend (NestJS) | http://localhost:3001 |
| Backend health check | http://localhost:3001/health |

## Project Structure Decisions

- **pnpm workspaces + Turborepo** for monorepo tooling. pnpm's strict
  dependency isolation prevents phantom-dependency bugs. Turborepo gives us
  content-hash caching of build/test/lint across workspaces.
- **Three shared packages** (`shared-types`, `validation`, and the future
  `api-client`) — no over-decomposition. Anything else stays inside the app
  that uses it until a clear cross-app need emerges.
- **Independent deploys** — the web app deploys to Vercel from `apps/web`; the
  API deploys to Render from `apps/api`. A frontend deploy does not require a
  backend deploy and vice versa.
- **Database migrations are run from a CI job** with the migration role key,
  not by either deploy pipeline, to avoid schema drift between environments.

## Security Notes

- **Never commit `.env` files.** The `.gitignore` covers `.env`, `.env.local`,
  `.env.*.local`, with an explicit `!.env.example` exception.
- **The Supabase service-role key bypasses Row Level Security.** It must
  never appear in any `NEXT_PUBLIC_` variable, never in client-side code,
  never in the Vercel frontend environment.
- **Frontend uses the Supabase anon key only**, which is safe to expose
  because RLS policies prevent it from reading other users' data.
- **CORS is restrictive.** The API allows only the configured origins
  (never wildcard `*` with credentials).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for branch policy, pull-request
template, code-review expectations, and commit-message conventions.

## License

MIT. See `LICENSE` (to be added before public release).

## Governance

Project owner: to be designated before pilot launch (open question Q-L8 in
the architecture plan). The Super Administrator role must be held by a named
individual with a named backup.
