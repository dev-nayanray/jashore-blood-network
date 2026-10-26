'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchMyOrganization, submitForVerification, type OrganizationDto } from '@/features/organizations/api';
import { useAuth } from '@/features/auth/auth-provider';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'bg-neutral-100 text-neutral-700' },
  UNVERIFIED: { label: 'Unverified', color: 'bg-neutral-100 text-neutral-700' },
  PENDING_REVIEW: { label: 'Pending Review', color: 'bg-amber-100 text-amber-800' },
  VERIFIED: { label: 'Verified', color: 'bg-green-100 text-green-800' },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
  SUSPENDED: { label: 'Suspended', color: 'bg-red-100 text-red-800' },
};

export default function OrganizationDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [org, setOrg] = useState<OrganizationDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        const data = await fetchMyOrganization();
        setOrg(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load organization');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const updated = await submitForVerification();
      setOrg(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) return <main className="mx-auto flex min-h-dvh max-w-2xl items-center justify-center"><p className="text-sm text-neutral-500">Loading…</p></main>;
  if (!user) return null;

  if (!org) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
          <h1 className="text-lg font-semibold text-amber-900">No Organization</h1>
          <p className="mt-2 text-sm text-amber-800">You are not a member of any organization.</p>
          <Link href="/organizations/register" className="mt-4 inline-block rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">Register an organization</Link>
        </div>
      </main>
    );
  }

  const statusInfo = STATUS_LABELS[org.verificationStatus] ?? STATUS_LABELS.UNVERIFIED!;
  const canSubmit = org.verificationStatus === 'DRAFT' || org.verificationStatus === 'REJECTED';

  return (
    <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6" role="main">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">{org.name}</h1>
          <p className="mt-1 text-sm text-neutral-600">{org.upazilaName}</p>
        </div>
        <span className={`rounded px-2.5 py-1 text-sm font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
      </header>

      {error && <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      {/* Verification status section */}
      <section className="mb-6 rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="mb-3 text-base font-semibold text-neutral-900">Verification Status</h2>
        {org.verificationFeedback && (
          <div className="mb-3 rounded-md bg-neutral-50 p-3">
            <p className="text-xs font-medium uppercase text-neutral-500">Admin feedback</p>
            <p className="mt-1 text-sm text-neutral-700">{org.verificationFeedback}</p>
          </div>
        )}
        {org.suspendedAt && org.suspensionReason && (
          <div className="mb-3 rounded-md bg-red-50 p-3">
            <p className="text-xs font-medium uppercase text-red-500">Suspension reason</p>
            <p className="mt-1 text-sm text-red-700">{org.suspensionReason}</p>
          </div>
        )}
        {canSubmit && (
          <button type="button" onClick={handleSubmit} disabled={submitting}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
            {submitting ? 'Submitting…' : 'Submit for verification'}
          </button>
        )}
      </section>

      {/* Profile info */}
      <section className="mb-6 rounded-lg border border-neutral-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-900">Organization Profile</h2>
          <Link href="/organizations/profile" className="text-sm text-brand-600 hover:underline">Edit</Link>
        </div>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs font-medium uppercase text-neutral-500">Address</dt><dd className="mt-0.5 text-neutral-900">{org.address}</dd></div>
          {org.phone && <div><dt className="text-xs font-medium uppercase text-neutral-500">Phone</dt><dd className="mt-0.5 text-neutral-900">{org.phone}</dd></div>}
          {org.email && <div><dt className="text-xs font-medium uppercase text-neutral-500">Email</dt><dd className="mt-0.5 text-neutral-900">{org.email}</dd></div>}
          {org.website && <div><dt className="text-xs font-medium uppercase text-neutral-500">Website</dt><dd className="mt-0.5 text-neutral-900">{org.website}</dd></div>}
          {org.operatingHours && <div><dt className="text-xs font-medium uppercase text-neutral-500">Hours</dt><dd className="mt-0.5 text-neutral-900">{org.operatingHours}</dd></div>}
          {org.servicesOffered && <div><dt className="text-xs font-medium uppercase text-neutral-500">Services</dt><dd className="mt-0.5 text-neutral-900">{org.servicesOffered}</dd></div>}
        </dl>
      </section>

      {/* Quick links */}
      <div className="flex flex-wrap gap-2">
        <Link href="/organizations/staff" className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">Manage Staff</Link>
        <Link href="/blood-requests" className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">View Blood Requests</Link>
      </div>

      <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Organization verification confirms profile information has been reviewed. It does NOT confirm blood inventory, medical capabilities, or real-time service availability.
      </div>
    </main>
  );
}
