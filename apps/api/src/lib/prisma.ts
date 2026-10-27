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
// import everything from one place. Note: PrismaClient is exported as a
// value (not `export type`) so it can be used as a NestJS provider token.
export * from '../generated/prisma';
export { PrismaClient };

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
