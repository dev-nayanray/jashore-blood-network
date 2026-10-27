'use client';

import { useState, useEffect } from 'react';
import { fetchAdminUsers, suspendUser, reinstateUser, type AdminUser } from '@/features/admin/api';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<AdminUser | null>(null);
  const [suspendReason, setSuspendReason] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminUsers({ search: search || undefined, status: statusFilter || undefined, page });
      setUsers(res.items);
      setTotalPages(res.totalPages);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [page, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    void load();
  };

  const handleSuspend = async () => {
    if (!suspendTarget || !suspendReason.trim()) return;
    try {
      await suspendUser(suspendTarget.id, suspendReason);
      setSuspendTarget(null);
      setSuspendReason('');
      void load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to suspend user');
    }
  };

  const handleReinstate = async (userId: string) => {
    try {
      await reinstateUser(userId);
      void load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to reinstate user');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">User Management</h1>
        <p className="mt-1 text-sm text-neutral-600">{total} user{total === 1 ? '' : 's'} total</p>
      </div>

      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {actionError && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{actionError}</div>}

      {/* Filters */}
      <form onSubmit={handleSearch} className="flex flex-wrap gap-2">
        <input type="text" placeholder="Search name, phone, email..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm" />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="deleted">Deleted</option>
        </select>
        <button type="submit" className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">Search</button>
      </form>

      {/* Table */}
      {loading ? (
        <div className="h-64 animate-pulse rounded-lg border border-neutral-200 bg-neutral-100" />
      ) : users.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-12 text-center">
          <p className="text-sm text-neutral-600">No users found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-neutral-700">Name</th>
                <th className="px-4 py-2 text-left font-medium text-neutral-700">Phone</th>
                <th className="px-4 py-2 text-left font-medium text-neutral-700">Roles</th>
                <th className="px-4 py-2 text-left font-medium text-neutral-700">Status</th>
                <th className="px-4 py-2 text-left font-medium text-neutral-700">Joined</th>
                <th className="px-4 py-2 text-left font-medium text-neutral-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2 text-neutral-900">{u.fullName}</td>
                  <td className="px-4 py-2 text-neutral-600">{u.phone}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <span key={r} className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600">{r.replace(/_/g, ' ').toLowerCase()}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    {u.deletedAt ? <span className="text-red-700">Deleted</span> : u.isActive ? <span className="text-green-700">Active</span> : <span className="text-red-700">Suspended</span>}
                  </td>
                  <td className="px-4 py-2 text-neutral-600">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-2">
                    {u.isActive && !u.deletedAt && (
                      <button type="button" onClick={() => { setSuspendTarget(u); setSuspendReason(''); setActionError(null); }}
                        className="text-xs text-red-600 hover:underline">Suspend</button>
                    )}
                    {!u.isActive && !u.deletedAt && (
                      <button type="button" onClick={() => handleReinstate(u.id)}
                        className="text-xs text-green-600 hover:underline">Reinstate</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50">← Prev</button>
          <span className="text-sm text-neutral-600">Page {page} of {totalPages}</span>
          <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50">Next →</button>
        </div>
      )}

      {/* Suspend dialog */}
      {suspendTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSuspendTarget(null)}>
          <div className="w-full max-w-md rounded-lg bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-neutral-900">Suspend user</h2>
            <p className="mt-1 text-sm text-neutral-600">Suspend {suspendTarget.fullName}? A reason is required.</p>
            <textarea value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} rows={3} maxLength={1000}
              placeholder="Reason for suspension..." className="mt-3 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setSuspendTarget(null)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm">Cancel</button>
              <button type="button" onClick={handleSuspend} disabled={suspendReason.trim().length < 3}
                className="rounded-md bg-red-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-60">Confirm suspend</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
