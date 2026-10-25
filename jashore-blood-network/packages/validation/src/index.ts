/**
 * @jbn/validation
 *
 * Shared Zod schemas. The Next.js frontend uses these for client-side form
 * validation; the NestJS backend uses them inside a ZodValidationPipe to
 * validate request bodies before they reach controller handlers.
 *
 * Phase 2 contains only environment-variable schemas. Domain schemas (donor
 * profile, blood request, etc.) will be added in Phase 3+.
 */

export {
  envSchema,
  webEnvSchema,
  apiEnvSchema,
  sharedEnvSchema,
  parseEnv,
  type AppEnv,
  type WebEnv,
  type ApiEnv,
} from './env';
