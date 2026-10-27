/**
 * Abuse report form — accessible from blood request detail pages.
 *
 * Allows authenticated users to report:
 * - Fake blood requests
 * - Impersonation
 * - Spam
 * - Harassment
 * - Suspicious donor profiles
 * - Misleading information
 */

'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/features/auth/auth-provider';

const REPORT_CATEGORIES = [
  { value: 'BLOOD_REQUEST', label: 'Fake or misleading blood request' },
  { value: 'DONOR_PROFILE', label: 'Suspicious donor profile' },
  { value: 'PROFILE', label: 'Impersonation or harassment' },
  { value: 'HOSPITAL', label: 'Incorrect hospital information' },
  { value: 'OTHER', label: 'Other concern' },
];

export default function ReportAbusePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [targetType, setTargetType] = useState('BLOOD_REQUEST');
  const [targetId, setTargetId] = useState('');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (authLoading) return <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center"><p className="text-sm text-neutral-500">Loading…</p></main>;
  if (!user) {
    router.push('/login');
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!targetId || !reason || reason.trim().length < 3) {
      setError('Please provide a target ID and a reason (at least 3 characters).');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/api/v1/moderation/reports', {
        method: 'POST',
        body: JSON.stringify({ targetType, targetId, reason, description: description || undefined }),
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <main id="main" className="mx-auto w-full max-w-md flex-1 px-4 py-8" role="main">
        <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
          <h1 className="text-lg font-semibold text-green-900">Report Submitted</h1>
          <p className="mt-2 text-sm text-green-800">
            Thank you for your report. Our moderation team will review it.
          </p>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="mt-4 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            Back to home
          </button>
        </div>
      </main>
    );
  }

  return (
    <main id="main" className="mx-auto w-full max-w-md flex-1 px-4 py-8" role="main">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">Report Abuse</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Report fake requests, impersonation, spam, or other concerns. Your identity is
          kept confidential from the reported user.
        </p>
      </header>

      {error && <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-neutral-700">What are you reporting?</label>
          <select id="category" value={targetType} onChange={(e) => setTargetType(e.target.value)}
            className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base">
            {REPORT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="targetId" className="block text-sm font-medium text-neutral-700">Target ID</label>
          <input id="targetId" type="text" required value={targetId} onChange={(e) => setTargetId(e.target.value)}
            placeholder="e.g. abc123-def456..."
            className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base" />
        </div>
        <div>
          <label htmlFor="reason" className="block text-sm font-medium text-neutral-700">Reason <span className="text-red-600">*</span></label>
          <input id="reason" type="text" required minLength={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Brief summary of the issue"
            className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base" />
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-neutral-700">Additional details (optional)</label>
          <textarea id="description" rows={4} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)}
            className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base" />
        </div>
        <button type="submit" disabled={submitting || !targetId || !reason}
          className="w-full rounded-md bg-brand-500 px-4 py-2.5 text-base font-medium text-white hover:bg-brand-600 disabled:opacity-60">
          {submitting ? 'Submitting…' : 'Submit report'}
        </button>
      </form>
    </main>
  );
}
