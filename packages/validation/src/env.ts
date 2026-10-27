import { z } from 'zod';

/**
 * Application environment variable schema.
 *
 * Both the web app and the API app validate their environment using this
 * schema at process startup. If any required variable is missing or invalid,
 * the process exits with a clear error message rather than failing later at
 * runtime.
 *
 * Variables are split into shared (both apps), web-only, and api-only. Each
 * app composes the shared schema with its own additional fields.
 */

export const sharedEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export const webEnvSchema = sharedEnvSchema.extend({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
});

export const apiEnvSchema = sharedEnvSchema.extend({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url().startsWith('postgresql://', 'DATABASE_URL must be a postgresql:// URL'),
  DIRECT_URL: z.string().url().startsWith('postgresql://', 'DIRECT_URL must be a postgresql:// URL'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  SUPABASE_JWT_SECRET: z.string().min(1, 'SUPABASE_JWT_SECRET is required'),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .min(1, 'CORS_ALLOWED_ORIGINS is required (comma-separated list)')
    .refine((v) => v !== '*', 'CORS_ALLOWED_ORIGINS must not be "*" with credentials'),
  JWT_COOKIE_DOMAIN: z.string().default(''),
  EMAIL_FROM: z.string().email().optional(),
  RESEND_API_KEY: z.string().optional(),
  /**
   * Auth backend: 'supabase' (real Supabase project + SMS provider) or
   * 'local' (built-in free OTP: codes hashed in otp_codes, self-signed JWT
   * sessions, OTP returned to the client for demo delivery). Defaults to
   * auto-detection: supabase when the Supabase config is usable, else local.
   */
  AUTH_MODE: z.enum(['supabase', 'local']).optional(),
  /** Set 'false' to skip seeding demo data into an empty database on boot. */
  DEMO_SEED: z.enum(['true', 'false']).optional(),
  RATE_LIMIT_DEFAULT_PER_MINUTE: z.coerce.number().int().positive().optional(),
});

/**
 * Combined environment schema (union of web and api) — used by tools that
 * need to validate either environment.
 */
export const envSchema = z.union([webEnvSchema, apiEnvSchema]);

export type AppEnv = z.infer<typeof envSchema>;
export type WebEnv = z.infer<typeof webEnvSchema>;
export type ApiEnv = z.infer<typeof apiEnvSchema>;

/**
 * Parse and validate environment variables. Exits the process with a clear
 * error if validation fails.
 */
export function parseEnv<T extends z.ZodTypeAny>(
  schema: T,
  source: Record<string, string | undefined> = process.env,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    console.error(`\n❌ Invalid environment configuration:\n${issues}\n`);
    process.exit(1);
  }
  return result.data;
}
