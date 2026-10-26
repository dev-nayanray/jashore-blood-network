'use client';

import { useState, useEffect } from 'react';
import { fetchAdminDonors } from '@/features/admin/api';
import { BLOOD_GROUPS, BLOOD_GROUP_LABELS } from '@jbn/shared-types';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const VERIFICATION_STATUSES = ['UNVERIFIED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'SUSPENDED'];

export default function AdminDonorsPage() {
  const [donors, setDonors] = useState<Record<string, unknown>[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminDonors({ search: search || undefined, bloodGroup: bloodGroup || undefined, verificationStatus: verificationStatus || undefined, page });
      setDonors(res.items as Record<string, unknown>[]);
      setTotalPages(res.totalPages);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load donors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [page, bloodGroup, verificationStatus]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Donor Management</h1>
        <p className="mt-1 text-sm text-neutral-600">{total} donor{total === 1 ? '' : 's'}</p>
      </div>
      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <form onSubmit={(e) => { e.preventDefault(); setPage(1); void load(); }} className="flex flex-wrap gap-2">
        <input type="text" placeholder="Search name, phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm" />
        <select value={bloodGroup} onChange={(e) => { setBloodGroup(e.target.value); setPage(1); }} className="rounded-md border border-neutral-300 px-3 py-2 text-sm">
          <option value="">All blood groups</option>
          {BLOOD_GROUPS.map((bg) => <option key={bg} value={bg}>{BLOOD_GROUP_LABELS[bg]}</option>)}
        </select>
        <select value={verificationStatus} onChange={(e) => { setVerificationStatus(e.target.value); setPage(1); }} className="rounded-md border border-neutral-300 px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {VERIFICATION_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ').toLowerCase()}</option>)}
        </select>
        <button type="submit" className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">Search</button>
      </form>

      {loading ? (
        <div className="h-64 animate-pulse rounded-lg border border-neutral-200 bg-neutral-100" />
      ) : donors.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-12 text-center"><p className="text-sm text-neutral-600">No donors found.</p></div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-neutral-700">Name</th>
                <th className="px-4 py-2 text-left font-medium text-neutral-700">Blood Group</th>
                <th className="px-4 py-2 text-left font-medium text-neutral-700">Upazila</th>
                <th className="px-4 py-2 text-left font-medium text-neutral-700">Verification</th>
                <th className="px-4 py-2 text-left font-medium text-neutral-700">Available</th>
                <th className="px-4 py-2 text-left font-medium text-neutral-700">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {donors.map((d) => (
                <tr key={d.id as string}>
                  <td className="px-4 py-2 text-neutral-900">{d.fullName as string}</td>
                  <td className="px-4 py-2"><span className="font-bold text-brand-700">{BLOOD_GROUP_LABELS[d.bloodGroup as keyof typeof BLOOD_GROUP_LABELS] ?? d.bloodGroup}</span></td>
                  <td className="px-4 py-2 text-neutral-600">{d.upazila as string}</td>
                  <td className="px-4 py-2"><span className={`rounded px-1.5 py-0.5 text-xs ${
                    d.verificationStatus === 'VERIFIED' ? 'bg-green-100 text-green-800' :
                    d.verificationStatus === 'PENDING_REVIEW' ? 'bg-amber-100 text-amber-800' :
                    d.verificationStatus === 'SUSPENDED' ? 'bg-red-100 text-red-800' :
                    'bg-neutral-100 text-neutral-600'
                  }`}>{(d.verificationStatus as string).replace(/_/g, ' ').toLowerCase()}</span></td>
                  <td className="px-4 py-2">{d.isAvailable ? <span className="text-green-700">Yes</span> : <span className="text-neutral-400">No</span>}</td>
                  <td className="px-4 py-2 text-neutral-600">{formatDate(d.createdAt as string)}</td>
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

      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Platform verification does not certify medical eligibility. Only qualified medical professionals can determine donor eligibility and blood compatibility.
      </div>
    </div>
  );
}
