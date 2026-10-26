'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchStaff, removeStaff, type OrganizationMemberDto } from '@/features/organizations/api';
import { useAuth } from '@/features/auth/auth-provider';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function OrganizationStaffPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [staff, setStaff] = useState<OrganizationMemberDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newProfileId, setNewProfileId] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  const load = async () => {
    try {
      const data = await fetchStaff();
      setStaff(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load staff');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) void load();
  }, [user]);

  const handleRemove = async (memberId: string) => {
    if (!confirm('Remove this staff member?')) return;
    try {
      await removeStaff(memberId);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove staff');
    }
  };

  if (authLoading || loading) return <main className="mx-auto flex min-h-dvh max-w-2xl items-center justify-center"><p className="text-sm text-neutral-500">Loading…</p></main>;
  if (!user) return null;

  return (
    <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6" role="main">
      <header className="mb-6">
        <Link href="/organizations/dashboard" className="mb-3 inline-block text-sm text-neutral-600 hover:text-neutral-900">← Back to dashboard</Link>
        <h1 className="text-2xl font-bold text-neutral-900">Staff Management</h1>
        <p className="mt-1 text-sm text-neutral-600">Manage who has access to your organization profile.</p>
      </header>

      {error && <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      {/* Staff list */}
      {staff.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-12 text-center"><p className="text-sm text-neutral-600">No staff members yet.</p></div>
      ) : (
        <div className="space-y-2">
          {staff.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-4">
              <div>
                <p className="font-medium text-neutral-900">{m.fullName}</p>
                <p className="text-sm text-neutral-600">{m.phone}</p>
                <p className="mt-1 text-xs text-neutral-400">Joined: {formatDate(m.joinedAt)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${m.role === 'OWNER' ? 'bg-brand-50 text-brand-700' : 'bg-neutral-100 text-neutral-600'}`}>
                  {m.role.toLowerCase()}
                </span>
                {m.role !== 'OWNER' && (
                  <button type="button" onClick={() => handleRemove(m.id)} className="text-xs text-red-600 hover:underline">Remove</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add staff (owner only) */}
      <section className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <h2 className="text-sm font-semibold text-neutral-900">Add Staff Member</h2>
        <p className="mt-1 text-xs text-neutral-600">Enter the profile UUID of the user you want to add as staff.</p>
        <div className="mt-3 flex gap-2">
          <input type="text" placeholder="Profile UUID" value={newProfileId} onChange={(e) => setNewProfileId(e.target.value)}
            className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm" />
          <button type="button" disabled={adding || !newProfileId} onClick={async () => {
            setAdding(true);
            try {
              const { addStaff } = await import('@/features/organizations/api');
              await addStaff(newProfileId);
              setNewProfileId('');
              void load();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to add staff');
            } finally {
              setAdding(false);
            }
          }} className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
            {adding ? 'Adding…' : 'Add'}
          </button>
        </div>
      </section>
    </main>
  );
}
