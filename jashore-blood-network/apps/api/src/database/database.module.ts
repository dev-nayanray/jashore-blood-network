import { Module, Global, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { prisma } from '../lib/prisma';

/**
 * Global database module.
 *
 * Exposes the Prisma client via `@InjectPrisma()` or direct import of `prisma`.
 * Lifecycle hooks ensure clean connection setup and teardown for graceful
 * shutdown.
 *
 * Note: this module does NOT authorize access. Every service that uses
 * `prisma` directly MUST enforce authorization via NestJS guards and the
 * role/permission policies in `src/common/policies` (Phase 4+). RLS is the
 * backstop, not the primary enforcement — see docs/MIGRATION_GUIDE.md.
 */

export const PRISMA_CLIENT = Symbol('PRISMA_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: PRISMA_CLIENT,
      useValue: prisma,
    },
  ],
  exports: [PRISMA_CLIENT],
})
export class DatabaseModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseModule.name);

  async onModuleInit() {
    try {
      // `connect()` is idempotent; safe to call on a cached singleton.
      await prisma.$connect();
      this.logger.log('Prisma client connected');
    } catch (err) {
      this.logger.error('Failed to connect Prisma client', err instanceof Error ? err.stack : String(err));
      throw err;
    }
  }

  async onModuleDestroy() {
    try {
      await prisma.$disconnect();
      this.logger.log('Prisma client disconnected');
    } catch (err) {
      this.logger.error('Error during Prisma client disconnect', err instanceof Error ? err.stack : String(err));
    }
  }
}
