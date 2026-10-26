'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';

interface EmergencyRequest {
  id: string;
  requesterName: string;
  patientDisplayName: string | null;
  bloodGroup: string;
  unitsRequested: number;
  upazilaName: string;
  hospitalName: string | null;
  requiredBy: string;
  urgency: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  ageMinutes: number;
  notificationCount: number;
}

function formatAge(minutes: number): string {
  if (minutes < 60) return `${minutes}m ago`;
  const h = Math.floor(minutes / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  VERIFIED: 'bg-blue-100 text-blue-800',
  SEARCHING: 'bg-green-100 text-green-800',
  DONOR_RESPONDED: 'bg-indigo-100 text-indigo-800',
  ARRANGED: 'bg-purple-100 text-purple-800',
};

const BLOOD_GROUP_LABELS: Record<string, string> = {
  A_POSITIVE: 'A+', A_NEGATIVE: 'A-', B_POSITIVE: 'B+', B_NEGATIVE: 'B-',
  AB_POSITIVE: 'AB+', AB_NEGATIVE: 'AB-', O_POSITIVE: 'O+', O_NEGATIVE: 'O-',
};

export default function AdminEmergencyPage() {
  const [requests, setRequests] = useState<EmergencyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<EmergencyRequest[]>('/api/v1/admin/emergency');
      setRequests(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load emergency requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const interval = setInterval(load, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Emergency Coordination</h1>
          <p className="mt-1 text-sm text-neutral-600">Active urgent blood requests requiring attention.</p>
        </div>
        <button type="button" onClick={load} disabled={loading}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <strong>Emergency coordination:</strong> These are active urgent requests. Verify, contact donors, and coordinate with healthcare facilities. The platform does not guarantee blood availability or medical compatibility.
      </div>

      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      {loading ? (
        <div className="space-y-3" aria-live="polite">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-lg border border-neutral-200 bg-neutral-100" />)}
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-12 text-center">
          <p className="text-sm font-medium text-neutral-900">No active urgent requests</p>
          <p className="mt-1 text-sm text-neutral-600">There are currently no urgent blood requests requiring coordination.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className={`rounded-lg border p-4 ${r.status === 'PENDING' ? 'border-amber-300 bg-amber-50' : 'border-neutral-200 bg-white'}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-md bg-brand-50 px-2 py-0.5 text-sm font-bold text-brand-700">
                      {BLOOD_GROUP_LABELS[r.bloodGroup] ?? r.bloodGroup}
                    </span>
                    <span className="text-sm text-neutral-600">{r.unitsRequested} unit{r.unitsRequested === 1 ? '' : 's'}</span>
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status] ?? 'bg-neutral-100 text-neutral-600'}`}>
                      {r.status.replace(/_/g, ' ').toLowerCase()}
                    </span>
                    {r.status === 'PENDING' && (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-bold text-red-700 animate-pulse">NEEDS VERIFICATION</span>
                    )}
                  </div>
                  <h3 className="mt-1.5 text-base font-semibold text-neutral-900">
                    {r.patientDisplayName || 'Patient (anonymous)'}
                  </h3>
                  <p className="mt-0.5 text-sm text-neutral-600">
                    {r.hospitalName || 'Hospital not specified'} · {r.upazilaName}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-neutral-500">
                    <span>Requester: {r.requesterName}</span>
                    <span>Created: {formatAge(r.ageMinutes)}</span>
                    <span>Updated: {formatDateTime(r.updatedAt)}</span>
                    <span>Required by: {formatDateTime(r.requiredBy)}</span>
                    <span>Donors notified: {r.notificationCount}</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <Link href={`/blood-requests/${r.id}`} className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600">
                    View details
                  </Link>
                  {r.status === 'PENDING' && (
                    <Link href="/admin/verification" className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50">
                      Verify now
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
