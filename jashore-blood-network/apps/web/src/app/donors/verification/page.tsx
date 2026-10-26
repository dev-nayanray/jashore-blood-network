/**
 * Donor verification status page.
 *
 * Shows the donor their current verification status, feedback from admins,
 * and a button to request verification (if eligible).
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/features/auth/auth-provider';

interface VerificationInfo {
  verificationStatus: 'UNVERIFIED' | 'PENDING_REVIEW' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
  verificationRequestedAt: string | null;
  verificationReviewedAt: string | null;
  verificationFeedback: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  UNVERIFIED: { label: 'Unverified', color: 'bg-neutral-100 text-neutral-700' },
  PENDING_REVIEW: { label: 'Pending Review', color: 'bg-amber-100 text-amber-800' },
  VERIFIED: { label: 'Verified', color: 'bg-green-100 text-green-800' },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
  SUSPENDED: { label: 'Suspended', color: 'bg-red-100 text-red-800' },
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function DonorVerificationPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [info, setInfo] = useState<VerificationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        const data = await apiFetch<VerificationInfo>('/api/v1/donor-verification/me');
        setInfo(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load verification status');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const handleRequest = async () => {
    setRequesting(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await apiFetch<VerificationInfo>('/api/v1/donor-verification/request', {
        method: 'POST',
      });
      setInfo(data);
      setSuccess('Verification request submitted. An administrator will review your profile.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request verification');
    } finally {
      setRequesting(false);
    }
  };

  if (authLoading || loading) {
    return <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center"><p className="text-sm text-neutral-500">Loading…</p></main>;
  }
  if (!user) return null;
  if (!info) return <main className="mx-auto max-w-md px-4 py-8"><p className="text-sm text-neutral-600">Could not load verification status.</p></main>;

  const statusInfo = STATUS_LABELS[info.verificationStatus] ?? STATUS_LABELS.UNVERIFIED!;
  const canRequest = info.verificationStatus === 'UNVERIFIED' || info.verificationStatus === 'REJECTED';

  return (
    <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6" role="main">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">Donor Verification</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Verify your donor profile to help build trust in the community.
        </p>
      </header>

      <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong>Important:</strong> Verification confirms your profile information has been
        reviewed by an administrator. It does NOT certify medical eligibility or blood
        compatibility. Only a qualified medical professional at the receiving facility can
        determine eligibility.
      </div>

      {error && <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {success && <div role="status" className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{success}</div>}

      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-900">Current Status</h2>
          <span className={`rounded px-2.5 py-1 text-sm font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
        </div>

        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-neutral-500">Requested on</dt>
            <dd className="text-neutral-900">{formatDate(info.verificationRequestedAt)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-500">Reviewed on</dt>
            <dd className="text-neutral-900">{formatDate(info.verificationReviewedAt)}</dd>
          </div>
          {info.verificationFeedback && (
            <div>
              <dt className="text-neutral-500">Admin feedback</dt>
              <dd className="mt-1 rounded-md bg-neutral-50 p-3 text-neutral-700">{info.verificationFeedback}</dd>
            </div>
          )}
          {info.suspendedAt && (
            <>
              <div className="flex justify-between">
                <dt className="text-red-600">Suspended on</dt>
                <dd className="text-red-900">{formatDate(info.suspendedAt)}</dd>
              </div>
              {info.suspensionReason && (
                <div>
                  <dt className="text-red-600">Suspension reason</dt>
                  <dd className="mt-1 rounded-md bg-red-50 p-3 text-red-700">{info.suspensionReason}</dd>
                </div>
              )}
            </>
          )}
        </dl>

        {canRequest && (
          <button
            type="button"
            onClick={handleRequest}
            disabled={requesting}
            className="mt-5 w-full rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {requesting ? 'Submitting…' : 'Request verification'}
          </button>
        )}
      </div>
    </main>
  );
}
