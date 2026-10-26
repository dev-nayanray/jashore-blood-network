'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchAdminBloodRequests } from '@/features/admin/api';
import { BLOOD_GROUPS, BLOOD_GROUP_LABELS } from '@jbn/shared-types';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const STATUSES = ['PENDING', 'VERIFIED', 'SEARCHING', 'DONOR_RESPONDED', 'ARRANGED', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'REJECTED'];
const URGENCIES = ['URGENT', 'NORMAL', 'FLEXIBLE'];

export default function AdminBloodRequestsPage() {
  const [requests, setRequests] = useState<Record<string, unknown>[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [urgency, setUrgency] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminBloodRequests({ status: status || undefined, bloodGroup: bloodGroup || undefined, urgency: urgency || undefined, page });
      setRequests(res.items as Record<string, unknown>[]);
      setTotalPages(res.totalPages);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [page, status, bloodGroup, urgency]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Blood Request Management</h1>
        <p className="mt-1 text-sm text-neutral-600">{total} request{total === 1 ? '' : 's'}</p>
      </div>
      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <div className="flex flex-wrap gap-2">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-md border border-neutral-300 px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ').toLowerCase()}</option>)}
        </select>
        <select value={bloodGroup} onChange={(e) => { setBloodGroup(e.target.value); setPage(1); }} className="rounded-md border border-neutral-300 px-3 py-2 text-sm">
          <option value="">All blood groups</option>
          {BLOOD_GROUPS.map((bg) => <option key={bg} value={bg}>{BLOOD_GROUP_LABELS[bg]}</option>)}
        </select>
        <select value={urgency} onChange={(e) => { setUrgency(e.target.value); setPage(1); }} className="rounded-md border border-neutral-300 px-3 py-2 text-sm">
          <option value="">All urgencies</option>
          {URGENCIES.map((u) => <option key={u} value={u}>{u.toLowerCase()}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-lg border border-neutral-200 bg-neutral-100" />
      ) : requests.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-12 text-center"><p className="text-sm text-neutral-600">No blood requests found.</p></div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-neutral-700">Requester</th>
                <th className="px-4 py-2 text-left font-medium text-neutral-700">Blood Group</th>
                <th className="px-4 py-2 text-left font-medium text-neutral-700">Units</th>
                <th className="px-4 py-2 text-left font-medium text-neutral-700">Upazila</th>
                <th className="px-4 py-2 text-left font-medium text-neutral-700">Urgency</th>
                <th className="px-4 py-2 text-left font-medium text-neutral-700">Status</th>
                <th className="px-4 py-2 text-left font-medium text-neutral-700">Required By</th>
                <th className="px-4 py-2 text-left font-medium text-neutral-700">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {requests.map((r) => (
                <tr key={r.id as string}>
                  <td className="px-4 py-2 text-neutral-900">{r.requesterName as string}</td>
                  <td className="px-4 py-2 font-bold text-brand-700">{BLOOD_GROUP_LABELS[r.bloodGroup as keyof typeof BLOOD_GROUP_LABELS] ?? r.bloodGroup}</td>
                  <td className="px-4 py-2 text-neutral-600">{String(r.unitsRequested)}</td>
                  <td className="px-4 py-2 text-neutral-600">{r.upazila as string}</td>
                  <td className="px-4 py-2">{r.urgency === 'URGENT' ? <span className="text-red-700 font-medium">Urgent</span> : <span className="text-neutral-600">{(r.urgency as string).toLowerCase()}</span>}</td>
                  <td className="px-4 py-2"><span className={`rounded px-1.5 py-0.5 text-xs ${
                    r.status === 'COMPLETED' ? 'bg-neutral-100 text-neutral-600' :
                    r.status === 'CANCELLED' || r.status === 'REJECTED' || r.status === 'EXPIRED' ? 'bg-red-100 text-red-800' :
                    r.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                    'bg-green-100 text-green-800'
                  }`}>{(r.status as string).replace(/_/g, ' ').toLowerCase()}</span></td>
                  <td className="px-4 py-2 text-neutral-600">{formatDateTime(r.requiredBy as string)}</td>
                  <td className="px-4 py-2"><Link href={`/blood-requests/${r.id}`} className="text-brand-600 hover:underline">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
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
