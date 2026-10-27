# Deployment Guide

This repository is a pnpm workspace monorepo:

| App | Path | Platform |
| --- | --- | --- |
| Web (Next.js 15) | `apps/web` | Vercel |
| API (NestJS 10) | `apps/api` | Render (`render.yaml` at repo root) |

**Repo root = workspace root.** Do not nest this project inside another folder —
both platforms detect the build from the repository root, where
`package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml` live.

## Vercel (web)

Vercel **cannot** configure the root directory from `vercel.json` for Git
deployments — it is a project setting. Set it once in the dashboard:

1. Open the project → **Settings → General → Root Directory**
2. Set it to `apps/web`
3. Framework Preset: **Next.js** (auto-detected)
4. Leave Build Command and Install Command empty (zero-config)
5. Add environment variables (Settings → Environment Variables):
   - `NEXT_PUBLIC_API_URL` — Render API URL, e.g. `https://jashore-blood-network-api.onrender.com`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Vercel automatically detects the pnpm workspace (root lockfile) and installs
with the correct filter.

## Render (API)

`render.yaml` at the repo root is a Render Blueprint.

1. Render Dashboard → **New → Blueprint** → select this repository
2. Enter the values for the prompted environment variables
   (`DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `SUPABASE_JWT_SECRET`, `CORS_ALLOWED_ORIGINS`, `EMAIL_FROM`, `RESEND_API_KEY`)
3. For an existing service, make sure **Root Directory is empty** (repo root)
   and the Build/Start commands match `render.yaml`:
   - Build: `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @jbn/api build`
   - Start: `node apps/api/dist/main.js`
   - Health check path: `/health`

Set `CORS_ALLOWED_ORIGINS` to your Vercel domain, e.g.
`https://<your-app>.vercel.app`.

## Local verification

```bash
pnpm install --frozen-lockfile
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

CI (`.github/workflows/ci.yml`) runs the same steps on every push to `main`.
