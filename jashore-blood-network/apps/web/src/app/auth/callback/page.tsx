/**
 * /auth/callback — reserved for future OAuth (Google/Facebook) redirect.
 *
 * Supabase Auth's OTP flow does NOT redirect here (the OTP is verified via
 * POST /api/v1/auth/otp/verify). This page exists only to handle the email-
 * confirmation and OAuth-redirect flows that may be added in a later phase.
 *
 * For Phase 4, it simply redirects to the homepage.
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthCallbackPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);
  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-4 py-12 text-center"
      role="main"
    >
      <p className="text-sm text-neutral-600">Redirecting…</p>
    </main>
  );
}
