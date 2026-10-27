'use client';

import { useState, useEffect } from 'react';
import { fetchPublicHospitals, type PublicHospital } from '@/features/public/api';
import { fetchDistricts, fetchUpazilas, type District, type Upazila } from '@/features/locations/api';

export default function HospitalsPage() {
  const [hospitals, setHospitals] = useState<PublicHospital[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [upazilas, setUpazilas] = useState<Upazila[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedUpazila, setSelectedUpazila] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const d = await fetchDistricts();
        setDistricts(d);
      } catch { /* ok */ }
    })();
  }, []);

  useEffect(() => {
    if (!selectedDistrict) { setUpazilas([]); return; }
    void (async () => {
      try { setUpazilas(await fetchUpazilas(selectedDistrict)); } catch { setUpazilas([]); }
    })();
  }, [selectedDistrict]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPublicHospitals({ upazilaId: selectedUpazila || undefined, page });
      setHospitals(res.items);
      setTotalPages(res.totalPages);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load hospitals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [selectedUpazila, page]);

  return (
    <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6" role="main">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">Hospital Directory</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Browse verified healthcare facilities in Jashore District. This directory does not imply that every facility operates a blood bank or provides transfusion services.
        </p>
      </header>

      <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Always contact the facility directly to confirm services, hours, and availability. The platform does not guarantee real-time emergency service availability.
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-2">
        <select value={selectedDistrict} onChange={(e) => { setSelectedDistrict(e.target.value); setSelectedUpazila(''); setPage(1); }}
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm">
          <option value="">All districts</option>
          {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={selectedUpazila} onChange={(e) => { setSelectedUpazila(e.target.value); setPage(1); }} disabled={!selectedDistrict}
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm disabled:bg-neutral-100">
          <option value="">All upazilas</option>
          {upazilas.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      {error && <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      {loading ? (
        <div className="space-y-3" aria-live="polite">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-lg border border-neutral-200 bg-neutral-100" />)}
        </div>
      ) : hospitals.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-12 text-center">
          <p className="text-sm font-medium text-neutral-900">No verified hospitals found</p>
          <p className="mt-1 text-sm text-neutral-600">No verified healthcare facilities are listed for this area yet. Facility records are added by administrators after verification.</p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-neutral-600">Showing {hospitals.length} of {total} facilit{total === 1 ? 'y' : 'ies'}</p>
          <div className="space-y-3">
            {hospitals.map((h) => (
              <article key={h.id} className="rounded-lg border border-neutral-200 bg-white p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold text-neutral-900">{h.name}</h2>
                    <p className="mt-0.5 text-sm text-neutral-600">{h.upazila.name}</p>
                  </div>
                  <span className="shrink-0 rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Verified</span>
                </div>
                <dl className="mt-3 space-y-1 text-sm">
                  <div><dt className="inline font-medium text-neutral-500">Address: </dt><dd className="inline text-neutral-700">{h.address}</dd></div>
                  {h.phone && <div><dt className="inline font-medium text-neutral-500">Phone: </dt><dd className="inline text-neutral-700">{h.phone}</dd></div>}
                  {h.operatingHours && <div><dt className="inline font-medium text-neutral-500">Hours: </dt><dd className="inline text-neutral-700">{h.operatingHours}</dd></div>}
                  {h.servicesOffered && <div><dt className="inline font-medium text-neutral-500">Services: </dt><dd className="inline text-neutral-700">{h.servicesOffered}</dd></div>}
                </dl>
              </article>
            ))}
          </div>
          {totalPages > 1 && (
            <nav className="mt-6 flex items-center justify-center gap-2" aria-label="Pagination">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50">← Prev</button>
              <span className="text-sm text-neutral-600">Page {page} of {totalPages}</span>
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50">Next →</button>
            </nav>
          )}
        </>
      )}
    </main>
  );
}
