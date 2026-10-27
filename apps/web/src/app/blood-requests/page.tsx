'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { BLOOD_GROUPS, BLOOD_GROUP_LABELS, type BloodGroup } from '@jbn/shared-types';
import {
  searchBloodRequests,
  type BloodRequestPublic,
  type UrgencyLevel,
  type RequestStatus,
} from '@/features/blood-requests/api';
import { fetchDistricts, fetchUpazilas, type District, type Upazila } from '@/features/locations/api';
import { BloodRequestCard } from '@/features/blood-requests/request-card';
import { useAuth } from '@/features/auth/auth-provider';

const PAGE_SIZE = 12;

const URGENCY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Any' },
  { value: 'URGENT', label: 'Urgent' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'FLEXIBLE', label: 'Flexible' },
];

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Any' },
  { value: 'SEARCHING', label: 'Searching' },
  { value: 'DONOR_RESPONDED', label: 'Donor Responded' },
  { value: 'ARRANGED', label: 'Arranged' },
  { value: 'COMPLETED', label: 'Completed' },
];

export default function BloodRequestsListPage() {
  const { user } = useAuth();
  const [districts, setDistricts] = useState<District[]>([]);
  const [upazilas, setUpazilas] = useState<Upazila[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedUpazila, setSelectedUpazila] = useState('');
  const [selectedBloodGroup, setSelectedBloodGroup] = useState('');
  const [selectedUrgency, setSelectedUrgency] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<BloodRequestPublic[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const d = await fetchDistricts();
        setDistricts(d);
      } catch {
        // ok
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedDistrict) {
      setUpazilas([]);
      return;
    }
    void (async () => {
      try {
        const u = await fetchUpazilas(selectedDistrict);
        setUpazilas(u);
      } catch {
        setUpazilas([]);
      }
    })();
  }, [selectedDistrict]);

  const doSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await searchBloodRequests({
        bloodGroup: (selectedBloodGroup || undefined) as BloodGroup | undefined,
        upazilaId: selectedUpazila || undefined,
        urgency: (selectedUrgency || undefined) as UrgencyLevel | undefined,
        status: (selectedStatus || undefined) as RequestStatus | undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setResults(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [selectedBloodGroup, selectedUpazila, selectedUrgency, selectedStatus, page]);

  useEffect(() => {
    setPage(1);
    void doSearch();
  }, [doSearch]);

  return (
    <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6" role="main">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">Blood Requests</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Browse active blood requests in Jashore District.
          </p>
        </div>
        {user && (
          <Link
            href="/blood-requests/new"
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            + Request Blood
          </Link>
        )}
      </header>

      <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong className="font-semibold">Important:</strong> This platform coordinates blood
        donation but does not determine medical eligibility. Hospitals and qualified medical
        professionals must confirm blood compatibility, donor eligibility, and transfusion
        arrangements.
      </div>

      <form className="mb-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label htmlFor="bloodGroup" className="block text-xs font-medium text-neutral-700">Blood group</label>
            <select id="bloodGroup" value={selectedBloodGroup} onChange={(e) => setSelectedBloodGroup(e.target.value)}
              className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm">
              <option value="">Any</option>
              {BLOOD_GROUPS.map((bg) => <option key={bg} value={bg}>{BLOOD_GROUP_LABELS[bg]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="district" className="block text-xs font-medium text-neutral-700">District</label>
            <select id="district" value={selectedDistrict} onChange={(e) => { setSelectedDistrict(e.target.value); setSelectedUpazila(''); }}
              className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm">
              <option value="">Any</option>
              {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="upazila" className="block text-xs font-medium text-neutral-700">Upazila</label>
            <select id="upazila" value={selectedUpazila} onChange={(e) => setSelectedUpazila(e.target.value)} disabled={!selectedDistrict}
              className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm disabled:bg-neutral-100">
              <option value="">Any</option>
              {upazilas.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="urgency" className="block text-xs font-medium text-neutral-700">Urgency</label>
            <select id="urgency" value={selectedUrgency} onChange={(e) => setSelectedUrgency(e.target.value)}
              className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm">
              {URGENCY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="status" className="block text-xs font-medium text-neutral-700">Status</label>
            <select id="status" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}
              className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm">
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </form>

      {error && (
        <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" aria-live="polite">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg border border-neutral-200 bg-neutral-100" />
          ))}
        </div>
      )}

      {!loading && results.length === 0 && !error && (
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-12 text-center">
          <p className="text-sm font-medium text-neutral-900">No blood requests found</p>
          <p className="mt-1 text-sm text-neutral-600">Try widening your search filters.</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <>
          <p className="mb-4 text-sm text-neutral-600">
            Showing <strong>{results.length}</strong> of <strong>{total}</strong> request{total === 1 ? '' : 's'}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {results.map((r) => <BloodRequestCard key={r.id} request={r} />)}
          </div>
          {totalPages > 1 && (
            <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Pagination">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm disabled:opacity-50">
                ← Previous
              </button>
              <span className="text-sm text-neutral-600">Page {page} of {totalPages}</span>
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm disabled:opacity-50">
                Next →
              </button>
            </nav>
          )}
        </>
      )}
    </main>
  );
}
