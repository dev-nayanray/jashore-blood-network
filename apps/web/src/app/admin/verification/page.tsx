'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';

interface PendingDonor {
  donorProfileId: string;
  profileId: string;
  fullName: string;
  phone: string;
  bloodGroup: string;
  upazilaName: string;
  verificationStatus: string;
  verificationRequestedAt: string | null;
  createdAt: string;
}

interface PendingReport {
  id: string;
  reporterId: string | null;
  targetType: string;
  targetId: string;
  reason: string;
  description: string | null;
  status: string;
  createdAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function AdminVerificationPage() {
  const [donors, setDonors] = useState<PendingDonor[]>([]);
  const [reports, setReports] = useState<PendingReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [donorRes, reportRes] = await Promise.all([
        apiFetch<{ items: PendingDonor[] }>('/api/v1/donor-verification/pending'),
        apiFetch<{ items: PendingReport[] }>('/api/v1/moderation/reports/queue'),
      ]);
      setDonors(donorRes.items);
      setReports(reportRes.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleDonorAction = async (id: string, action: 'approve' | 'reject', reason?: string) => {
    try {
      await apiFetch(`/api/v1/donor-verification/${id}/${action}`, {
        method: 'POST',
        body: JSON.stringify(reason ? { reason } : {}),
      });
      void load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `Failed to ${action} donor`);
    }
  };

  const handleReportAction = async (id: string, status: string) => {
    const note = window.prompt(`Review note for ${status.toLowerCase()} (required):`);
    if (!note || note.trim().length < 3) return;
    try {
      await apiFetch(`/api/v1/moderation/reports/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ status, reviewNote: note }),
      });
      void load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to review report');
    }
  };

  if (loading) return <div className="h-64 animate-pulse rounded-lg border border-neutral-200 bg-neutral-100" />;
  if (error) return <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Verification & Moderation</h1>
        <p className="mt-1 text-sm text-neutral-600">Review pending donor verifications and abuse reports.</p>
      </div>

      {actionError && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{actionError}</div>}

      {/* Donor verification queue */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-neutral-900">Donor Verification Queue ({donors.length})</h2>
        {donors.length === 0 ? (
          <div className="rounded-lg border border-neutral-200 bg-white px-4 py-8 text-center"><p className="text-sm text-neutral-600">No donors pending verification.</p></div>
        ) : (
          <div className="space-y-2">
            {donors.map((d) => (
              <div key={d.donorProfileId} className="rounded-lg border border-neutral-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-neutral-900">{d.fullName}</p>
                    <p className="text-sm text-neutral-600">{d.phone} · {d.bloodGroup.replace(/_/g, ' ')} · {d.upazilaName}</p>
                    <p className="mt-1 text-xs text-neutral-500">Requested: {formatDate(d.verificationRequestedAt)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => handleDonorAction(d.donorProfileId, 'approve')}
                      className="rounded-md bg-green-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600">Approve</button>
                    <button type="button" onClick={() => {
                      const reason = window.prompt('Reason for rejection (required):');
                      if (reason && reason.trim().length >= 3) handleDonorAction(d.donorProfileId, 'reject', reason);
                    }} className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50">Reject</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Abuse reports queue */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-neutral-900">Abuse Reports Queue ({reports.length})</h2>
        {reports.length === 0 ? (
          <div className="rounded-lg border border-neutral-200 bg-white px-4 py-8 text-center"><p className="text-sm text-neutral-600">No open abuse reports.</p></div>
        ) : (
          <div className="space-y-2">
            {reports.map((r) => (
              <div key={r.id} className="rounded-lg border border-neutral-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-neutral-900">{r.reason}</p>
                    {r.description && <p className="mt-1 text-sm text-neutral-600">{r.description}</p>}
                    <p className="mt-1 text-xs text-neutral-500">Target: {r.targetType} ({r.targetId.slice(0, 8)}...) · Reported: {formatDate(r.createdAt)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => handleReportAction(r.id, 'ACTIONED')}
                      className="rounded-md bg-green-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600">Action</button>
                    <button type="button" onClick={() => handleReportAction(r.id, 'DISMISSED')}
                      className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50">Dismiss</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Platform verification confirms profile information has been reviewed. It does NOT certify medical eligibility or blood compatibility.
      </div>
    </div>
  );
}
