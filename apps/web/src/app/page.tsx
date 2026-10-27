'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/features/auth/auth-provider';
import { fetchPublicStats, type PublicStats } from '@/features/public/api';
import { BLOOD_GROUPS, BLOOD_GROUP_LABELS, type BloodGroup } from '@jbn/shared-types';

/**
 * Phase 17: Redesigned homepage matching reference design.
 *
 * Design elements from reference:
 *   - Red gradient header with welcome text
 *   - Blood drop + hands illustration
 *   - "Find Blood Donors" + "Register as Donor" buttons
 *   - Emergency blood request banner
 *   - Blood group filter pills (A+, A-, B+, AB+, O+, O-)
 *   - Nearby donor cards with avatar, blood type, location, distance
 *   - Bottom navigation (handled by AppShell)
 *   - Live stats from real backend data
 */

const DEMO_DONORS = [
  { id: 'd1', name: 'Karim A.', bloodGroup: 'O+' as const, area: 'Jashore Sadar', distance: '2.5 km', available: true },
  { id: 'd2', name: 'Rahim U.', bloodGroup: 'A+' as const, area: 'Abhaynagar', distance: '4.1 km', available: true },
  { id: 'd3', name: 'Salma K.', bloodGroup: 'B+' as const, area: 'Manirampur', distance: '5.3 km', available: true },
  { id: 'd4', name: 'Fatima R.', bloodGroup: 'AB+' as const, area: 'Jashore Sadar', distance: '3.2 km', available: false },
];

const EMERGENCY_REQUESTS = [
  { id: 'e1', bloodGroup: 'O+', units: 2, hospital: 'Jashore General Hospital', urgency: 'URGENT' },
  { id: 'e2', bloodGroup: 'B+', units: 1, hospital: 'Bagherpara Health Center', urgency: 'URGENT' },
];

export default function HomePage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const data = await fetchPublicStats();
        setStats(data);
      } catch {
        setStats(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredDonors = selectedGroup
    ? DEMO_DONORS.filter((d) => d.bloodGroup === selectedGroup)
    : DEMO_DONORS;

  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* Hero Section — red gradient matching reference */}
      <section className="relative overflow-hidden bg-gradient-to-br from-red-600 via-red-500 to-red-600 px-4 pb-8 pt-6 text-white sm:px-6 sm:pb-12 sm:pt-10">
        {/* Decorative blood drop pattern */}
        <div className="absolute right-0 top-0 opacity-10" aria-hidden="true">
          <svg className="h-64 w-64" fill="currentColor" viewBox="0 0 100 100">
            <path d="M50 10 C50 10, 20 45, 20 65 C20 80, 35 90, 50 90 C65 90, 80 80, 80 65 C80 45, 50 10, 50 10 Z"/>
          </svg>
        </div>

        <div className="relative">
          {/* Welcome text */}
          <p className="text-sm font-medium text-white/80">স্বাগতম!</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {user ? `Welcome back, ${user.fullName.split(' ')[0]}!` : 'Donate Blood, Save Lives'}
          </h1>
          <p className="mt-2 text-sm text-white/80 sm:text-base">
            Connecting blood donors with patients in Jashore District
          </p>

          {/* CTA Buttons */}
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
              href="/become-donor"
              className="flex items-center justify-center gap-2 rounded-xl bg-white/20 px-6 py-3 text-base font-bold text-white backdrop-blur transition hover:bg-white/30 active:scale-95"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              Register as Donor
            </Link>
          </div>

          {/* Live Stats */}
          {stats && (
            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-white/10 p-3 backdrop-blur">
                <p className="text-2xl font-bold">{loading ? '…' : stats.registeredDonors}</p>
                <p className="text-xs text-white/70">Donors</p>
              </div>
              <div className="rounded-xl bg-white/10 p-3 backdrop-blur">
                <p className="text-2xl font-bold">{loading ? '…' : stats.activeBloodRequests}</p>
                <p className="text-xs text-white/70">Active Requests</p>
              </div>
              <div className="rounded-xl bg-white/10 p-3 backdrop-blur">
                <p className="text-2xl font-bold">{loading ? '…' : stats.supportedUpazilas}</p>
                <p className="text-xs text-white/70">Upazilas</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Emergency Requests Banner */}
      <section className="px-4 pt-6 sm:px-6">
        <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white animate-pulse">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </span>
            <h2 className="text-base font-bold text-red-900">Emergency Blood Requests</h2>
          </div>
          <div className="mt-3 space-y-2">
            {EMERGENCY_REQUESTS.map((req) => (
              <Link
                key={req.id}
                href="/blood-requests"
                className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-sm font-bold text-red-700">
                    {req.bloodGroup}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{req.units} unit{req.units > 1 ? 's' : ''} needed</p>
                    <p className="text-xs text-neutral-500">{req.hospital}</p>
                  </div>
                </div>
                <span className="rounded-full bg-red-500 px-2.5 py-1 text-xs font-bold text-white">URGENT</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Blood Group Filter */}
      <section className="px-4 pt-6 sm:px-6">
        <h2 className="mb-3 text-base font-bold text-neutral-900">Find by Blood Group</h2>
        <div className="flex flex-wrap gap-2">
          {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
            <button
              key={bg}
              type="button"
              onClick={() => setSelectedGroup(selectedGroup === bg ? '' : bg)}
              className={`flex h-12 w-12 items-center justify-center rounded-xl text-sm font-bold transition active:scale-95 ${
                selectedGroup === bg
                  ? 'bg-red-600 text-white shadow-lg'
                  : 'bg-white text-neutral-700 shadow-sm hover:bg-red-50 hover:text-red-600'
              }`}
            >
              {bg}
            </button>
          ))}
        </div>
      </section>

      {/* Nearby Donors */}
      <section className="px-4 pt-6 sm:px-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-neutral-900">Nearby Donors</h2>
          <Link href="/donors/search" className="text-sm font-medium text-red-600 hover:underline">See all →</Link>
        </div>

        {filteredDonors.length === 0 ? (
          <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center">
            <p className="text-sm text-neutral-500">No donors found for {selectedGroup}. Try another blood group.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filteredDonors.map((donor) => (
              <Link
                key={donor.id}
                href="/donors/search"
                className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:shadow-md active:scale-[0.98]"
              >
                {/* Avatar */}
                <div className="relative">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-red-400 to-red-600 text-white">
                    <span className="text-sm font-bold">{donor.name.charAt(0)}</span>
                  </div>
                  {donor.available && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-500" />
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-neutral-900">{donor.name}</p>
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-red-50 text-xs font-bold text-red-700">
                      {donor.bloodGroup}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-neutral-500">{donor.area}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="flex items-center gap-1 text-xs text-neutral-400">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {donor.distance}
                    </span>
                    {donor.available ? (
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">Available</span>
                    ) : (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500">Unavailable</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Quick Actions Grid */}
      <section className="px-4 pt-6 sm:px-6">
        <h2 className="mb-3 text-base font-bold text-neutral-900">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link href="/blood-requests/new" className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:shadow-md active:scale-95">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
              <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
            <span className="text-xs font-medium text-neutral-700">Request Blood</span>
          </Link>
          <Link href="/hospitals" className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:shadow-md active:scale-95">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
              <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </span>
            <span className="text-xs font-medium text-neutral-700">Hospitals</span>
          </Link>
          <Link href="/faq" className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:shadow-md active:scale-95">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-50">
              <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <span className="text-xs font-medium text-neutral-700">FAQ</span>
          </Link>
          <Link href="/about" className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:shadow-md active:scale-95">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50">
              <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <span className="text-xs font-medium text-neutral-700">About</span>
          </Link>
        </div>
      </section>

      {/* Medical Safety Notice */}
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
