'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/features/auth/auth-provider';
import { apiFetch } from '@/lib/api-client';
import { BLOOD_GROUPS, BLOOD_GROUP_LABELS } from '@jbn/shared-types';

/**
 * Home page — live data from the public API.
 *
 * Sections: hero + live stats, active blood requests (real), blood-group
 * quick search, available donors (real), how-it-works, quick actions,
 * safety notice. Donor cards show no PII — the public search endpoint is
 * designed that way (contact requires an authenticated blood request).
 */

interface PublicStats {
  registeredDonors: number;
  verifiedDonors: number;
  activeBloodRequests: number;
  supportedUpazilas: number;
}

interface DonorCard {
  id: string;
  displayName: string;
  bloodGroup: string;
  upazila: { name: string };
  isVerified: boolean;
  availabilityConfirmedAt: string;
}

interface RequestCard {
  id: string;
  patientDisplayName: string | null;
  bloodGroup: string;
  unitsRequested: number;
  hospitalName: string | null;
  urgency: string;
  requiredBy: string;
}

const URGENCY_BADGES: Record<string, string> = {
  URGENT: 'bg-red-600 text-white',
  NORMAL: 'bg-orange-500 text-white',
  FLEXIBLE: 'bg-neutral-100 text-neutral-600',
};

function timeUntil(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'any time now';
  const days = Math.round(ms / 86_400_000);
  if (days >= 1) return `in ${days} day${days > 1 ? 's' : ''}`;
  const hours = Math.max(1, Math.round(ms / 3_600_000));
  return `in ${hours} hour${hours > 1 ? 's' : ''}`;
}

export default function HomePage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [donors, setDonors] = useState<DonorCard[]>([]);
  const [requests, setRequests] = useState<RequestCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const [s, d, r] = await Promise.all([
          apiFetch<PublicStats>('/api/v1/public/stats').catch(() => null),
          apiFetch<{ items: DonorCard[] }>('/api/v1/donors?page=1&pageSize=6').catch(() => null),
          apiFetch<{ items: RequestCard[] }>('/api/v1/blood-requests?page=1&pageSize=4').catch(
            () => null,
          ),
        ]);
        if (s) setStats(s);
        if (d) setDonors(d.items ?? []);
        if (r) setRequests(r.items ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="mx-auto w-full max-w-5xl pb-6">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-red-600 via-red-500 to-red-600 px-4 pb-8 pt-6 text-white sm:px-6 sm:pb-12 sm:pt-10">
        <div className="absolute right-0 top-0 opacity-10" aria-hidden="true">
          <svg className="h-64 w-64" fill="currentColor" viewBox="0 0 100 100">
            <path d="M50 10 C50 10, 20 45, 20 65 C20 80, 35 90, 50 90 C65 90, 80 80, 80 65 C80 45, 50 10, 50 10 Z" />
          </svg>
        </div>

        <div className="relative">
          <p className="text-sm font-medium text-white/80">স্বাগতম!</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {user ? `Welcome back, ${user.fullName.split(' ')[0]}!` : 'Donate Blood, Save Lives'}
          </h1>
          <p className="mt-2 text-sm text-white/80 sm:text-base">
            Connecting blood donors with patients across Jashore District
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/donors/search"
              className="flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-base font-bold text-red-600 shadow-lg transition hover:bg-red-50 active:scale-95"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Find Blood Donors
            </Link>
            <Link
              href={user ? '/become-donor' : '/register'}
              className="flex items-center justify-center gap-2 rounded-xl bg-white/20 px-6 py-3 text-base font-bold text-white backdrop-blur transition hover:bg-white/30 active:scale-95"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {user ? 'Become a Donor' : 'Create Free Account'}
            </Link>
          </div>

          {/* Live stats */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { value: stats?.registeredDonors, label: 'Donors' },
              { value: stats?.verifiedDonors, label: 'Verified' },
              { value: stats?.activeBloodRequests, label: 'Active Requests' },
              { value: stats?.supportedUpazilas, label: 'Upazilas' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-white/10 p-3 backdrop-blur">
                <p className="text-2xl font-bold">{loading ? '…' : (s.value ?? '—')}</p>
                <p className="text-xs text-white/70">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Active blood requests (live) */}
      <section className="px-4 pt-6 sm:px-6">
        <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white animate-pulse">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </span>
              <h2 className="text-base font-bold text-red-900">Blood Requests Near You</h2>
            </div>
            <Link href="/blood-requests" className="text-xs font-semibold text-red-700 hover:underline">
              View all →
            </Link>
          </div>

          {loading ? (
            <div className="mt-3 space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-white/60" />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <p className="mt-3 rounded-lg bg-white p-4 text-center text-sm text-neutral-500">
              No active requests right now. 🎉
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {requests.map((req) => (
                <Link
                  key={req.id}
                  href={`/blood-requests/${req.id}`}
                  className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-sm font-bold text-red-700">
                      {BLOOD_GROUP_LABELS[req.bloodGroup as keyof typeof BLOOD_GROUP_LABELS] ?? req.bloodGroup}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">
                        {req.unitsRequested} unit{req.unitsRequested > 1 ? 's' : ''} needed
                        {req.patientDisplayName ? ` · ${req.patientDisplayName}` : ''}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {req.hospitalName ?? 'Jashore'} · needed {timeUntil(req.requiredBy)}
                      </p>
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${URGENCY_BADGES[req.urgency] ?? URGENCY_BADGES.STANDARD}`}>
                    {req.urgency}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Blood group quick search */}
      <section className="px-4 pt-6 sm:px-6">
        <h2 className="mb-3 text-base font-bold text-neutral-900">Find by Blood Group</h2>
        <div className="flex flex-wrap gap-2">
          {BLOOD_GROUPS.map((bg) => (
            <Link
              key={bg}
              href="/donors/search"
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-sm font-bold text-neutral-700 shadow-sm transition hover:bg-red-50 hover:text-red-600 active:scale-95"
            >
              {BLOOD_GROUP_LABELS[bg]}
            </Link>
          ))}
        </div>
      </section>

      {/* Available donors (live) */}
      <section className="px-4 pt-6 sm:px-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-neutral-900">Available Donors</h2>
          <Link href="/donors/search" className="text-sm font-medium text-red-600 hover:underline">
            See all →
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-neutral-100" />
            ))}
          </div>
        ) : donors.length === 0 ? (
          <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center">
            <p className="text-sm text-neutral-500">
              No donors listed yet — be the first!{' '}
              <Link href="/become-donor" className="font-semibold text-red-600 hover:underline">
                Register as a donor
              </Link>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {donors.map((donor) => (
              <Link
                key={donor.id}
                href="/donors/search"
                className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:shadow-md active:scale-[0.98]"
              >
                <div className="relative">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-red-400 to-red-600 text-white">
                    <span className="text-sm font-bold">{donor.displayName.charAt(0)}</span>
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-neutral-900">{donor.displayName}</p>
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-red-50 text-[10px] font-bold text-red-700">
                      {BLOOD_GROUP_LABELS[donor.bloodGroup as keyof typeof BLOOD_GROUP_LABELS] ?? donor.bloodGroup}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-neutral-500">{donor.upazila?.name ?? 'Jashore'}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">Available</span>
                    {donor.isVerified && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">✓ Verified</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="px-4 pt-6 sm:px-6">
        <h2 className="mb-3 text-base font-bold text-neutral-900">How It Works</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            {
              step: '1',
              title: 'Create your account',
              body: 'Sign up free with just your phone number and name — no paperwork.',
              href: '/register',
              cta: 'Sign up',
            },
            {
              step: '2',
              title: 'Register as a donor',
              body: 'Add your blood group and area. Verify once, stay listed for those in need.',
              href: '/become-donor',
              cta: 'Become a donor',
            },
            {
              step: '3',
              title: 'Request or donate',
              body: 'Patients search for nearby donors and connect safely through the platform.',
              href: '/blood-requests/new',
              cta: 'Request blood',
            },
          ].map((s) => (
            <div key={s.step} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-sm font-bold text-white">
                {s.step}
              </span>
              <h3 className="mt-3 text-sm font-bold text-neutral-900">{s.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500">{s.body}</p>
              <Link href={s.href} className="mt-3 inline-block text-xs font-semibold text-red-600 hover:underline">
                {s.cta} →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Quick actions */}
      <section className="px-4 pt-6 sm:px-6">
        <h2 className="mb-3 text-base font-bold text-neutral-900">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              href: '/blood-requests/new',
              label: 'Request Blood',
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              ),
              color: 'bg-red-50 text-red-600',
            },
            {
              href: '/hospitals',
              label: 'Hospitals',
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              ),
              color: 'bg-blue-50 text-blue-600',
            },
            {
              href: '/faq',
              label: 'FAQ',
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              ),
              color: 'bg-purple-50 text-purple-600',
            },
            {
              href: '/notifications',
              label: 'Notifications',
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              ),
              color: 'bg-green-50 text-green-600',
            },
          ].map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:shadow-md active:scale-95"
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-full ${a.color}`}>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {a.icon}
                </svg>
              </span>
              <span className="text-xs font-medium text-neutral-700">{a.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Safety notice */}
      <section className="px-4 pt-6 sm:px-6">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs text-amber-800">
            <strong>Important:</strong> This platform coordinates blood donation connections. It does not determine medical eligibility or guarantee blood compatibility. Always consult qualified medical professionals.
          </p>
        </div>
      </section>
    </div>
  );
}
