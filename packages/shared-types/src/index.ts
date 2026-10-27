/**
 * @jbn/shared-types
 *
 * Cross-app TypeScript types and enums. These mirror the Prisma schema and
 * the database enum types. They are the single source of truth for shared
 * shapes used by both the Next.js frontend and the NestJS backend.
 *
 * NOTE: Phase 2 contains only foundational types. Blood-group, role, and
 * status enums will be added in Phase 3 once the Prisma schema is written.
 */

export * from './enums';
export * from './types';
