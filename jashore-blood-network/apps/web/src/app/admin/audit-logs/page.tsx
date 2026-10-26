'use client';

import { useState, useEffect } from 'react';
import { fetchAuditLogs, type AuditLogItem } from '@/features/admin/api';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAuditLogs({ action: actionFilter || undefined, targetType: targetTypeFilter || undefined, page });
      setLogs(res.items);
      setTotalPages(res.totalPages);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [page, actionFilter, targetTypeFilter]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Audit Logs</h1>
        <p className="mt-1 text-sm text-neutral-600">{total} log entr{total === 1 ? 'y' : 'ies'}</p>
      </div>
      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <div className="flex flex-wrap gap-2">
        <input type="text" placeholder="Filter by action..." value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm" />
        <select value={targetTypeFilter} onChange={(e) => { setTargetTypeFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm">
          <option value="">All target types</option>
          <option value="profile">Profile</option>
          <option value="donor_profile">Donor Profile</option>
          <option value="blood_request">Blood Request</option>
          <option value="abuse_report">Abuse Report</option>
          <option value="notification">Notification</option>
        </select>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-lg border border-neutral-200 bg-neutral-100" />
      ) : logs.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-12 text-center"><p className="text-sm text-neutral-600">No audit logs found.</p></div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-neutral-700">Timestamp</th>
                <th className="px-4 py-2 text-left font-medium text-neutral-700">Actor</th>
                <th className="px-4 py-2 text-left font-medium text-neutral-700">Action</th>
                <th className="px-4 py-2 text-left font-medium text-neutral-700">Target</th>
                <th className="px-4 py-2 text-left font-medium text-neutral-700">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-2 text-neutral-600">{formatDateTime(l.createdAt)}</td>
                  <td className="px-4 py-2 text-neutral-900">{l.actorName ?? 'System'}</td>
                  <td className="px-4 py-2"><code className="text-xs text-brand-700">{l.action}</code></td>
                  <td className="px-4 py-2 text-neutral-600">{l.targetType}{l.targetId ? ` (${l.targetId.slice(0, 8)}...)` : ''}</td>
                  <td className="px-4 py-2 text-neutral-400">{l.ipAddress ?? '—'}</td>
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
