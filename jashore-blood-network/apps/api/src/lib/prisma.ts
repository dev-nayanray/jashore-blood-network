/**
 * Prisma client singleton.
 *
 * Prevents connection exhaustion in dev (where hot reloads can spawn many
 * PrismaClient instances) by caching the instance on `globalThis`.
 *
 * Usage:
 *   import { prisma } from '@/lib/prisma';
 *   const donors = await prisma.donorProfile.findMany({ ... });
 */

import { PrismaClient } from '../generated/prisma';

// Re-export the PrismaClient class and all generated types so consumers can
// import everything from one place.
export * from '../generated/prisma';
export type { PrismaClient } from '../generated/prisma';

declare global {
  var __jbnPrismaClient: PrismaClient | undefined;
}

export const prisma =
  globalThis.__jbnPrismaClient ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__jbnPrismaClient = prisma;
}
