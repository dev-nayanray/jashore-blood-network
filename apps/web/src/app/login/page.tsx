'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiBaseUrl } from '@/lib/env';

/**
 * Login page — redesigned to match reference design.
 *
 * Design from reference:
 *   - Blood drop logo with ECG line
 *   - "Donate Blood, Save Lives" tagline
 *   - Phone input with +880 prefix
 *   - Password field
 *   - Login button (red)
 *   - OTP verification option
 *   - Register new account link
 */

type LoginMode = 'password' | 'otp';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>('otp');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'input' | 'otp'>('input');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fullPhone = phone.startsWith('+880') ? phone : `+880${phone.replace(/^0/, '')}`;

  const handleSendOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
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
      // Always 202 — anti-enumeration
      if (res.status === 429) {
        setError('Too many attempts. Please wait a few minutes.');
      } else if (res.status === 202) {
        setStep('otp');
        setSuccess('OTP sent! Check your phone for the 6-digit code.');
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
        body: JSON.stringify({ phone: fullPhone, token: otp }),
      });
      if (res.status === 429) {
        setError('Too many attempts. Please wait.');
      } else if (res.status === 401) {
        setError('Invalid OTP. Please check and try again.');
      } else if (res.ok) {
        router.push('/');
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
        {/* Logo + Tagline */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-700 shadow-lg">
            <svg className="h-12 w-12 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.653 16.915V19h2.694v-2.085c1.604-.214 3.07-.937 4.092-2.085 1.022-1.148 1.529-2.582 1.529-4.283 0-1.7-.507-3.135-1.529-4.283-1.022-1.148-2.488-1.871-4.092-2.085V2.085H9.653v2.085C8.049 4.384 6.583 5.107 5.561 6.255 4.539 7.403 4.032 8.838 4.032 10.538c0 1.701.507 3.135 1.529 4.283 1.022 1.148 2.488 1.871 4.092 2.085z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">রক্ত দেই</h1>
          <p className="mt-1 text-sm text-neutral-500">Donate Blood, Save Lives</p>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div role="status" className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        {/* Login Card */}
        <div className="rounded-2xl border border-neutral-100 bg-white p-6 shadow-xl">
          {step === 'input' ? (
            <>
              {/* Phone Input */}
              <form onSubmit={handleSendOtp} className="space-y-4">
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

                {/* OTP Button */}
                <button
                  type="submit"
                  disabled={submitting || phone.length < 10}
                  className="w-full rounded-xl bg-gradient-to-r from-red-600 to-red-500 py-3 text-base font-bold text-white shadow-lg transition hover:from-red-700 hover:to-red-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? 'Sending OTP…' : 'Send OTP'}
                </button>
              </form>

              {/* Divider */}
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-neutral-200" />
                <span className="text-xs text-neutral-400">or</span>
                <div className="h-px flex-1 bg-neutral-200" />
              </div>

              {/* Register Link */}
              <p className="text-center text-sm text-neutral-600">
                New here?{' '}
                <Link href="/register" className="font-semibold text-red-600 hover:underline">
                  Create new account
                </Link>
              </p>
            </>
          ) : (
            <>
              {/* OTP Step */}
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="text-center">
                  <p className="text-sm text-neutral-600">Enter the 6-digit code sent to</p>
                  <p className="mt-1 font-semibold text-neutral-900">{fullPhone}</p>
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
                  {submitting ? 'Verifying…' : 'Verify & Login'}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('input'); setOtp(''); setError(null); setSuccess(null); }}
                  disabled={submitting}
                  className="w-full text-center text-sm text-neutral-500 hover:text-neutral-800"
                >
                  ← Change phone number
                </button>
              </form>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-neutral-400">
          By logging in, you agree to our{' '}
          <Link href="/about" className="text-red-500 hover:underline">Terms</Link> &{' '}
          <Link href="/about" className="text-red-500 hover:underline">Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
}
