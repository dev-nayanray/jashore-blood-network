'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api-client';

interface Report {
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ items: Report[]; total: number; totalPages: number }>(`/api/v1/moderation/reports/queue?page=${page}`);
      setReports(res.items);
      setTotalPages(res.totalPages);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [page]);

  const handleReview = async (id: string, status: string) => {
    const note = window.prompt(`Review note for ${status.toLowerCase()} (required):`);
    if (!note || note.trim().length < 3) return;
    try {
      await apiFetch(`/api/v1/moderation/reports/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ status, reviewNote: note }),
      });
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to review report');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Abuse Reports</h1>
        <p className="mt-1 text-sm text-neutral-600">{total} open report{total === 1 ? '' : 's'}</p>
      </div>
      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      {loading ? (
        <div className="h-64 animate-pulse rounded-lg border border-neutral-200 bg-neutral-100" />
      ) : reports.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-12 text-center"><p className="text-sm text-neutral-600">No open abuse reports.</p></div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <div key={r.id} className="rounded-lg border border-neutral-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="font-medium text-neutral-900">{r.reason}</p>
                  {r.description && <p className="mt-1 text-sm text-neutral-600">{r.description}</p>}
                  <p className="mt-1 text-xs text-neutral-500">
                    Target: {r.targetType} ({r.targetId.slice(0, 8)}...) · Reported: {formatDate(r.createdAt)}
                  </p>
                  <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">{r.status.replace(/_/g, ' ').toLowerCase()}</span>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => handleReview(r.id, 'ACTIONED')}
                    className="rounded-md bg-green-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600">Action</button>
                  <button type="button" onClick={() => handleReview(r.id, 'DISMISSED')}
                    className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50">Dismiss</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50">← Prev</button>
          <span className="text-sm text-neutral-600">Page {page} of {totalPages}</span>
          <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50">Next →</button>
        </div>
      )}
    </div>
  );
}
