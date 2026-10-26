/**
 * Public donor search page.
 *
 * Accessible without authentication. Searches donors by blood group,
 * district, upazila, locality, and recently-confirmed availability.
 *
 * Displays paginated donor cards with clear empty, loading, and error
 * states. Mobile-first responsive layout.
 */

'use client';

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { BLOOD_GROUPS, BLOOD_GROUP_LABELS, type BloodGroup } from '@jbn/shared-types';
import { searchDonors, type DonorSearchResult } from '@/features/donors/api';
import { fetchDistricts, fetchUpazilas, type District, type Upazila } from '@/features/locations/api';
import { DonorCard } from '@/features/donors/donor-card';
import { useAuth } from '@/features/auth/auth-provider';

const PAGE_SIZE = 12;

export default function DonorSearchPage() {
  const { user } = useAuth();
  const [districts, setDistricts] = useState<District[]>([]);
  const [upazilas, setUpazilas] = useState<Upazila[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedUpazila, setSelectedUpazila] = useState('');
  const [selectedBloodGroup, setSelectedBloodGroup] = useState('');
  const [recentlyAvailable, setRecentlyAvailable] = useState(false);
  const [page, setPage] = useState(1);

  const [results, setResults] = useState<DonorSearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Load districts on mount
  useEffect(() => {
    void (async () => {
      try {
        const d = await fetchDistricts();
        setDistricts(d);
      } catch {
        // Silently fail — the user can still search by blood group
      }
    })();
  }, []);

  // Load upazilas when district changes
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
    setHasSearched(true);
    try {
      const res = await searchDonors({
        bloodGroup: selectedBloodGroup ? (selectedBloodGroup as BloodGroup) : undefined,
        districtId: selectedDistrict || undefined,
        upazilaId: selectedUpazila || undefined,
        recentlyAvailable: recentlyAvailable || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setResults(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [selectedBloodGroup, selectedDistrict, selectedUpazila, recentlyAvailable, page]);

  // Search on filter change (debounced via useEffect)
  useEffect(() => {
    setPage(1);
    void doSearch();
  }, [doSearch]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    void doSearch();
  };

  return (
    <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6" role="main">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">Find Blood Donors</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Search for consenting blood donors in Jashore District by blood group and location.
        </p>
      </header>

      {/* Medical safety disclaimer */}
      <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong className="font-semibold">Important:</strong> A matching blood group is only a
        preliminary search filter. Medical eligibility and clinical compatibility are determined
        by qualified medical personnel at the receiving facility.
      </div>

      {/* Search filters */}
      <form
        onSubmit={handleSubmit}
        className="mb-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4 sm:p-5"
        aria-label="Donor search filters"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="bloodGroup" className="block text-xs font-medium text-neutral-700">
              Blood group
            </label>
            <select
              id="bloodGroup"
              value={selectedBloodGroup}
              onChange={(e) => setSelectedBloodGroup(e.target.value)}
              className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">Any</option>
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg} value={bg}>
                  {BLOOD_GROUP_LABELS[bg]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="district" className="block text-xs font-medium text-neutral-700">
              District
            </label>
            <select
              id="district"
              value={selectedDistrict}
              onChange={(e) => {
                setSelectedDistrict(e.target.value);
                setSelectedUpazila('');
              }}
              className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">Any</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="upazila" className="block text-xs font-medium text-neutral-700">
              Upazila
            </label>
            <select
              id="upazila"
              value={selectedUpazila}
              onChange={(e) => setSelectedUpazila(e.target.value)}
              disabled={!selectedDistrict}
              className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-neutral-100 disabled:text-neutral-400"
            >
              <option value="">Any</option>
              {upazilas.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={recentlyAvailable}
                onChange={(e) => setRecentlyAvailable(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-brand-500 focus:ring-brand-500"
              />
              Recently confirmed only
            </label>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </form>

      {/* Results */}
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-lg border border-neutral-200 bg-neutral-100"
            />
          ))}
        </div>
      )}

      {!loading && hasSearched && results.length === 0 && !error && (
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-12 text-center">
          <p className="text-sm font-medium text-neutral-900">No donors found</p>
          <p className="mt-1 text-sm text-neutral-600">
            Try widening your search — remove filters or select &ldquo;Any&rdquo; for blood group or location.
          </p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <>
          <p className="mb-4 text-sm text-neutral-600">
            Showing <strong>{results.length}</strong> of <strong>{total}</strong> donor
            {total === 1 ? '' : 's'}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((donor) => (
              <DonorCard
                key={donor.id}
                donor={donor}
                isAuthenticated={!!user}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav
              className="mt-8 flex items-center justify-center gap-2"
              aria-label="Pagination"
            >
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ← Previous
              </button>
              <span className="text-sm text-neutral-600">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next →
              </button>
            </nav>
          )}
        </>
      )}
    </main>
  );
}
