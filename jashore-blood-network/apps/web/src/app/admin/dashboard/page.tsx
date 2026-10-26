'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchDashboardMetrics, type DashboardMetrics } from '@/features/admin/api';

function MetricCard({ label, value, color, href }: { label: string; value: number; color: string; href?: string }) {
  const content = (
    <div className={`rounded-lg border p-4 ${href ? 'transition hover:shadow-md' : ''}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await fetchDashboardMetrics();
        setMetrics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-neutral-900">Dashboard</h1>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg border border-neutral-200 bg-neutral-100" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Dashboard</h1>
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-600">Platform overview for Jashore Blood Network.</p>
      </div>

      <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        These metrics represent platform activity only. They do not represent all blood donations
        in Jashore, and the platform cannot guarantee blood availability.
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard label="Total Users" value={metrics.totalUsers} color="text-neutral-900" />
        <MetricCard label="Total Donors" value={metrics.totalDonors} color="text-neutral-900" href="/admin/donors" />
        <MetricCard label="Verified Donors" value={metrics.verifiedDonors} color="text-green-700" href="/admin/donors" />
        <MetricCard
          label="Donors Pending"
          value={metrics.donorsPendingVerification}
          color="text-amber-700"
          href="/admin/verification"
        />
        <MetricCard
          label="Suspended"
          value={metrics.suspendedAccounts}
          color="text-red-700"
          href="/admin/donors"
        />
        <MetricCard
          label="Active Requests"
          value={metrics.activeBloodRequests}
          color="text-blue-700"
          href="/admin/blood-requests"
        />
        <MetricCard
          label="Requests Pending"
          value={metrics.requestsPendingVerification}
          color="text-amber-700"
          href="/admin/verification"
        />
        <MetricCard label="Urgent Requests" value={metrics.urgentBloodRequests} color="text-red-700" href="/admin/blood-requests" />
        <MetricCard label="Fulfilled" value={metrics.fulfilledRequests} color="text-green-700" href="/admin/blood-requests" />
        <MetricCard
          label="Open Reports"
          value={metrics.openAbuseReports}
          color="text-red-700"
          href="/admin/reports"
        />
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-neutral-900">Quick Actions</h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/verification" className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
            Review verification queue
          </Link>
          <Link href="/admin/blood-requests" className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
            Manage blood requests
          </Link>
          <Link href="/admin/reports" className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
            Review abuse reports
          </Link>
          <Link href="/admin/audit-logs" className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
            View audit logs
          </Link>
        </div>
      </div>
    </div>
  );
}
