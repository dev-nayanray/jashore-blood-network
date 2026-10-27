/**
 * Frontend environment variables.
 *
 * In Next.js, NEXT_PUBLIC_* vars are inlined at build time.
 * We access them directly instead of using process.env at runtime
 * (which doesn't work in the browser).
 */

// These are replaced at build time by Next.js
export const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// For debugging
export const env = {
  NEXT_PUBLIC_API_URL: apiBaseUrl,
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
};
