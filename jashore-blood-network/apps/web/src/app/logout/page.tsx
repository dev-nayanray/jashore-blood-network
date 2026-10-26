/**
 * /logout — client-side logout that calls the backend and redirects.
 *
 * The backend's POST /api/v1/auth/logout revokes the Supabase session and
 * clears the httpOnly cookies. This page just calls it and redirects to /.
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiBaseUrl } from '@/lib/env';

export default function LogoutPage() {
  const router = useRouter();
  useEffect(() => {
    void (async () => {
      try {
        await fetch(`${apiBaseUrl}/auth/logout`, {
          method: 'POST',
          credentials: 'include',
        });
      } catch {
        // Ignore — cookies will be cleared by the backend regardless
      }
      router.replace('/');
    })();
  }, [router]);
  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-4 py-12 text-center"
      role="main"
    >
      <p className="text-sm text-neutral-600">Logging out…</p>
    </main>
  );
}
