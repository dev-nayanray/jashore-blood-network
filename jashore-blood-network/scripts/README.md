# Operational scripts will live here.

Phase 2: this directory is empty. Future scripts will include:

- `backup-verify.sh` — verify the latest Supabase backup can be restored
- `seed-reference-data.ts` — seed Bangladesh, Jashore, and the 8 upazilas
- `migrate.ts` — wrapper around `prisma migrate deploy` for CI use
- `rotate-jwt-secret.ts` — rotate the Supabase JWT secret with zero downtime
