'use client';

/**
 * Register page — real account creation.
 *
 * Two steps:
 *   1. Full name + phone → POST /auth/otp/request
 *   2. OTP → POST /auth/otp/verify { phone, token, fullName }
 *
 * The verify endpoint creates the Profile (with the chosen name) on first
 * login and sets the session cookies — exactly like the Supabase flow, and
 * identical in local demo mode. After signup the user is redirected home
 * (and can complete donor registration at /become-donor).
 */

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiBaseUrl } from '@/lib/env';

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fullPhone = phone.startsWith('+880') ? phone : `+880${phone.replace(/^0/, '')}`;

  const handleSendOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (fullName.trim().length < 2) {
      setError('Please enter your full name');
      return;
    }
    if (phone.length < 10) {
      setError('Please enter a valid phone number');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/auth/otp/request`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone }),
      });
      const body = (await res.json().catch(() => ({}))) as { demoOtp?: string };
      if (res.status === 429) {
        setError('Too many attempts. Please wait a few minutes.');
      } else if (res.status === 202) {
        setStep('otp');
        setDemoOtp(body.demoOtp ?? null);
        setSuccess(
          body.demoOtp
            ? 'Demo mode: no SMS provider is connected — use the code shown below.'
            : 'OTP sent! Check your phone for the 6-digit code.',
        );
      } else {
        setError('Something went wrong. Please try again.');
      }
    } catch {
      setError('Could not connect to server. Check your internet connection.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError('Please enter the 6-digit OTP code');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/auth/otp/verify`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        // fullName is applied by the backend on FIRST login (account creation)
        body: JSON.stringify({ phone: fullPhone, token: otp, fullName: fullName.trim() }),
      });
      if (res.status === 429) {
        setError('Too many attempts. Please wait.');
      } else if (res.status === 401) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? 'Invalid OTP. Please check and try again.');
      } else if (res.ok) {
        router.push('/');
        router.refresh();
      } else {
        setError('Verification failed. Please try again.');
      }
    } catch {
      setError('Could not connect to server.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-br from-red-50 via-white to-red-50 px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Logo + heading */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-700 shadow-lg">
            <svg className="h-12 w-12 text-white" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M9.653 16.915V19h2.694v-2.085c1.604-.214 3.07-.937 4.092-2.085 1.022-1.148 1.529-2.582 1.529-4.283 0-1.7-.507-3.135-1.529-4.283-1.022-1.148-2.488-1.871-4.092-2.085V2.085H9.653v2.085C8.049 4.384 6.583 5.107 5.561 6.255 4.539 7.403 4.032 8.838 4.032 10.538c0 1.701.507 3.135 1.529 4.283 1.022 1.148 2.488 1.871 4.092 2.085z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">Create account</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {step === 'details' ? 'Join the Jashore Blood Network' : `Verify ${fullPhone}`}
          </p>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && !error && (
          <div role="status" className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        {step === 'otp' && demoOtp && (
          <div className="mb-4 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Demo mode — your OTP
            </p>
            <button
              type="button"
              onClick={() => setOtp(demoOtp)}
              className="mt-1 text-3xl font-bold tracking-[0.3em] text-amber-900 transition hover:text-amber-700"
              title="Tap to fill the code"
            >
              {demoOtp}
            </button>
            <p className="mt-1 text-[11px] text-amber-600">Tap the code to auto-fill · no SMS is sent</p>
          </div>
        )}

        <div className="rounded-2xl border border-neutral-100 bg-white p-6 shadow-xl">
          {step === 'details' ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-neutral-700">Full Name</label>
                <input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Nayeem Ahmed"
                  className="mt-1 block w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-3 text-base text-neutral-900 focus:border-red-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  disabled={submitting}
                  minLength={2}
                  maxLength={120}
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-neutral-700">Phone Number</label>
                <div className="mt-1 flex items-center rounded-xl border border-neutral-300 bg-neutral-50 focus-within:border-red-500 focus-within:ring-1 focus-within:ring-red-500">
                  <span className="px-3 py-3 text-sm font-medium text-neutral-500">+880</span>
                  <input
                    id="phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="1XXXXXXXXX"
                    className="block w-full bg-transparent py-3 pr-3 text-base text-neutral-900 focus:outline-none"
                    disabled={submitting}
                    maxLength={11}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting || fullName.trim().length < 2 || phone.length < 10}
                className="w-full rounded-xl bg-gradient-to-r from-red-600 to-red-500 py-3 text-base font-bold text-white shadow-lg transition hover:from-red-700 hover:to-red-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Sending OTP…' : 'Continue'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-neutral-600">
                  Signing up as <span className="font-semibold text-neutral-900">{fullName.trim()}</span>
                </p>
                <p className="text-sm text-neutral-600">Enter the code sent to {fullPhone}</p>
              </div>
              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-neutral-700">OTP Code</label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••"
                  className="mt-1 block w-full rounded-xl border border-neutral-300 bg-neutral-50 py-3 text-center text-2xl font-bold tracking-[0.5em] text-neutral-900 focus:border-red-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  disabled={submitting}
                  maxLength={6}
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={submitting || otp.length !== 6}
                className="w-full rounded-xl bg-gradient-to-r from-red-600 to-red-500 py-3 text-base font-bold text-white shadow-lg transition hover:from-red-700 hover:to-red-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Creating account…' : 'Verify & Create Account'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('details'); setOtp(''); setError(null); setSuccess(null); setDemoOtp(null); }}
                disabled={submitting}
                className="w-full text-center text-sm text-neutral-500 hover:text-neutral-800"
              >
                ← Edit my details
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-neutral-600">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-red-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
