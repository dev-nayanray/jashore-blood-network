/**
 * Login page — phone + OTP flow.
 *
 * Two-step flow:
 *   1. User enters phone (E.164 format, e.g. +8801712345678)
 *   2. Backend sends OTP via Supabase Auth
 *   3. User enters the 6-digit OTP
 *   4. Backend verifies, sets httpOnly cookies, returns user
 *
 * If the user is logging in for the first time, the backend creates a
 * Profile row with id = Supabase user id. The user is then redirected to
 * /register to complete their profile (full name).
 *
 * Accessibility:
 *   - All inputs have associated <label> elements
 *   - Error messages are announced via aria-live
 *   - Form is keyboard-navigable
 *   - Submit button is disabled during async operations
 */

'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiBaseUrl } from '@/lib/env';

type Step = 'phone' | 'otp' | 'success';
type ErrorKind = 'network' | 'invalid' | 'rate_limit' | 'unknown';

const ERROR_MESSAGES: Record<ErrorKind, string> = {
  network: 'Could not connect to the server. Please check your internet connection and try again.',
  invalid: 'The phone number or OTP is invalid. Please check and try again.',
  rate_limit: 'Too many attempts. Please wait a few minutes before trying again.',
  unknown: 'Something went wrong. Please try again.',
};

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ErrorKind | null>(null);

  const handlePhoneSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/auth/otp/request`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      // Always 202 — even if the phone is not registered (anti-enumeration)
      if (res.status === 429) {
        setError('rate_limit');
      } else if (res.status === 202) {
        setStep('otp');
      } else {
        setError('unknown');
      }
    } catch {
      setError('network');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOtpSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/auth/otp/verify`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, token: otp, fullName: fullName || undefined }),
      });
      if (res.status === 429) {
        setError('rate_limit');
      } else if (res.status === 401) {
        setError('invalid');
      } else if (res.ok) {
        setStep('success');
        // Redirect to homepage after a brief success state
        setTimeout(() => router.push('/'), 800);
      } else {
        setError('unknown');
      }
    } catch {
      setError('network');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-stretch px-4 py-8 sm:py-12"
      role="main"
    >
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-neutral-900">Log in to Jashore Blood Network</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Enter your phone number to receive a one-time password.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {ERROR_MESSAGES[error]}
        </div>
      )}

      {step === 'phone' && (
        <form onSubmit={handlePhoneSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-neutral-700">
              Phone number
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+8801XXXXXXXXX"
              pattern="^\+[1-9]\d{5,14}$"
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-base text-neutral-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              disabled={submitting}
              aria-describedby="phone-help"
            />
            <p id="phone-help" className="mt-1 text-xs text-neutral-500">
              E.164 format with country code, e.g. +8801712345678
            </p>
          </div>
          <button
            type="submit"
            disabled={submitting || !phone}
            className="w-full rounded-md bg-brand-500 px-4 py-2.5 text-base font-medium text-white shadow-sm hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Sending…' : 'Send OTP'}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={handleOtpSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="otp" className="block text-sm font-medium text-neutral-700">
              One-time password
            </label>
            <input
              id="otp"
              name="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              pattern="^\d{6}$"
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-base tracking-widest text-neutral-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              disabled={submitting}
              aria-describedby="otp-help"
            />
            <p id="otp-help" className="mt-1 text-xs text-neutral-500">
              Enter the 6-digit code sent to {phone}
            </p>
          </div>
          <details className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-neutral-700">
              First time logging in? Add your name
            </summary>
            <div className="mt-2">
              <label htmlFor="fullName" className="block text-xs font-medium text-neutral-700">
                Full name (optional, required on first login)
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                disabled={submitting}
              />
            </div>
          </details>
          <button
            type="submit"
            disabled={submitting || otp.length !== 6}
            className="w-full rounded-md bg-brand-500 px-4 py-2.5 text-base font-medium text-white shadow-sm hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Verifying…' : 'Verify OTP'}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep('phone');
              setOtp('');
              setError(null);
            }}
            disabled={submitting}
            className="w-full text-center text-sm text-neutral-600 hover:text-neutral-900"
          >
            ← Use a different phone number
          </button>
        </form>
      )}

      {step === 'success' && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-6 text-center">
          <p className="text-sm font-medium text-green-800">Logged in successfully.</p>
          <p className="mt-1 text-xs text-green-700">Redirecting…</p>
        </div>
      )}

      <footer className="mt-8 text-center text-xs text-neutral-500">
        <p>
          By logging in, you agree to our{' '}
          <Link href="/privacy" className="text-brand-600 hover:underline">
            Privacy Policy
          </Link>{' '}
          and{' '}
          <Link href="/terms" className="text-brand-600 hover:underline">
            Terms of Service
          </Link>
          .
        </p>
      </footer>
    </main>
  );
}
