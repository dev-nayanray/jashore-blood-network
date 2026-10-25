/**
 * Frontend environment validation.
 *
 * Runs at module load time. If any required env var is missing or invalid,
 * the build fails loudly rather than producing a broken app.
 */

import { webEnvSchema, parseEnv } from '@jbn/validation';

export const env = parseEnv(webEnvSchema);

export const apiBaseUrl = env.NEXT_PUBLIC_API_URL;
export const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
export const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
