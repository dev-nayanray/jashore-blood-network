'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { BLOOD_GROUP_LABELS } from '@jbn/shared-types';
import {
  fetchBloodRequest,
  cancelBloodRequest,
  type BloodRequestDetail,
} from '@/features/blood-requests/api';
import { useAuth } from '@/features/auth/auth-provider';
import { useRealtimeRequest, ConnectionStatusIndicator } from '@/features/realtime/realtime-hooks';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending verification',
  VERIFIED: 'Verified',
  SEARCHING: 'Searching for donors',
  DONOR_RESPONDED: 'Donor(s) responded',
  ARRANGED: 'Arranged',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
  REJECTED: 'Rejected',
};

const URGENCY_LABELS: Record<string, string> = {
  URGENT: 'Urgent',
  NORMAL: 'Normal',
  FLEXIBLE: 'Flexible',
};

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return 'Unknown'; }
}

export default function BloodRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const id = params.id as string;
  const [request, setRequest] = useState<BloodRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Refetch the request when a real-time update is detected
  const refetchRequest = useCallback(async () => {
    try {
      const r = await fetchBloodRequest(id);
      setRequest(r);
    } catch {
      // If refetch fails (e.g. request deleted), keep existing data
    }
  }, [id]);

  // Subscribe to real-time updates for this request
  const connectionStatus = useRealtimeRequest(id, refetchRequest);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetchBloodRequest(id);
        setRequest(r);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load request');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleCancel = async () => {
    if (!request) return;
    setCancelling(true);
    try {
      const updated = await cancelBloodRequest(request.id, cancelReason || undefined);
      setRequest(updated);
      setShowCancelForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <main className="mx-auto flex min-h-dvh max-w-2xl items-center justify-center"><p className="text-sm text-neutral-500">Loading…</p></main>;
  if (error) return <main className="mx-auto max-w-2xl px-4 py-8"><div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div></main>;
  if (!request) return <main className="mx-auto max-w-2xl px-4 py-8"><p className="text-sm text-neutral-600">Request not found.</p></main>;

  const canCancel = request.isOwner && ['PENDING', 'VERIFIED', 'SEARCHING', 'DONOR_RESPONDED', 'ARRANGED'].includes(request.status);

  return (
    <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6" role="main">
      <Link href="/blood-requests" className="mb-4 inline-block text-sm text-neutral-600 hover:text-neutral-900">← Back to requests</Link>

      <div className="rounded-lg border border-neutral-200 bg-white p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-brand-50 px-2.5 py-1 text-base font-bold text-brand-700">
                {BLOOD_GROUP_LABELS[request.bloodGroup]}
              </span>
              <span className="text-sm text-neutral-600">{request.unitsRequested} unit{request.unitsRequested === 1 ? '' : 's'}</span>
            </div>
            <h1 className="mt-2 text-xl font-bold text-neutral-900 sm:text-2xl">
              {request.patientDisplayName || 'Patient (anonymous)'}
            </h1>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
              {STATUS_LABELS[request.status] ?? request.status}
            </span>
            <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
              {URGENCY_LABELS[request.urgency] ?? request.urgency}
            </span>
            <ConnectionStatusIndicator status={connectionStatus} />
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase text-neutral-500">Hospital</dt>
            <dd className="mt-0.5 text-neutral-900">{request.hospitalName || 'Not specified'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-neutral-500">Upazila</dt>
            <dd className="mt-0.5 text-neutral-900">{request.upazila.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-neutral-500">Needed by</dt>
            <dd className="mt-0.5 text-neutral-900">{formatDateTime(request.requiredBy)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-neutral-500">Blood component</dt>
            <dd className="mt-0.5 text-neutral-900">
              {request.bloodComponent ? request.bloodComponent.replace(/_/g, ' ').toLowerCase() : 'Whole blood'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-neutral-500">Posted</dt>
            <dd className="mt-0.5 text-neutral-900">{formatDateTime(request.createdAt)}</dd>
          </div>
          {request.isOwner && (
            <div>
              <dt className="text-xs font-medium uppercase text-neutral-500">Contact method</dt>
              <dd className="mt-0.5 text-neutral-900">{request.contactMethod.replace(/_/g, ' ').toLowerCase()}</dd>
            </div>
          )}
        </dl>

        {request.isOwner && request.contactNote && (
          <div className="mt-4 rounded-md bg-neutral-50 p-3">
            <p className="text-xs font-medium uppercase text-neutral-500">Contact note</p>
            <p className="mt-1 text-sm text-neutral-700">{request.contactNote}</p>
          </div>
        )}

        {request.isOwner && request.notes && (
          <div className="mt-3 rounded-md bg-neutral-50 p-3">
            <p className="text-xs font-medium uppercase text-neutral-500">Notes</p>
            <p className="mt-1 text-sm text-neutral-700">{request.notes}</p>
          </div>
        )}

        {!request.isOwner && (
          <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <p>
              To contact the requester, please log in and use the response feature (coming in Phase 6+).
              Contact details are only shared with the requester&apos;s consent.
            </p>
          </div>
        )}

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <strong>Medical safety:</strong> A matching blood group is only a preliminary filter.
          Hospitals and qualified medical professionals must confirm blood compatibility, donor
          eligibility, and transfusion arrangements.
        </div>

        {canCancel && (
          <div className="mt-5 border-t border-neutral-200 pt-4">
            {!showCancelForm ? (
              <div className="flex flex-wrap gap-2">
                <Link href={`/blood-requests/${request.id}/edit`} className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
                  Edit request
                </Link>
                <button type="button" onClick={() => setShowCancelForm(true)} disabled={cancelling}
                  className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50">
                  Cancel request
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <label htmlFor="cancelReason" className="block text-sm font-medium text-neutral-700">
                  Reason for cancellation (optional)
                </label>
                <textarea id="cancelReason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={2} maxLength={1000}
                  className="block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm" />
                <div className="flex gap-2">
                  <button type="button" onClick={handleCancel} disabled={cancelling}
                    className="rounded-md bg-red-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-60">
                    {cancelling ? 'Cancelling…' : 'Confirm cancel'}
                  </button>
                  <button type="button" onClick={() => setShowCancelForm(false)} disabled={cancelling}
                    className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
                    Keep request
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
