'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/features/auth/auth-provider';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { fetchPublicStats, type PublicStats } from '@/features/public/api';

/**
 * Phase 10 public homepage.
 *
 * Sections:
 *   1. Header with nav + auth state + notification bell
 *   2. Hero with headline + 3 primary CTAs
 *   3. Live platform stats (real data from /public/stats)
 *   4. How the service works (3-step explanation)
 *   5. Blood group search shortcut
 *   6. Safety guidance
 *   7. FAQ preview
 *   8. Footer with contact info
 *
 * All stats come from real backend queries. If data is unavailable,
 * the stats section is hidden (no fabricated numbers).
 */

function StatCard({ label, value, loading }: { label: string; value: number; loading: boolean }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 text-center">
      <p className="text-2xl font-bold text-brand-700">
        {loading ? '…' : value.toLocaleString()}
      </p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
    </div>
  );
}

const FAQ_ITEMS = [
  {
    q: 'How do I search for blood donors?',
    a: 'Visit the Find Blood Donors page, select the blood group and upazila you need, and browse the list of consenting donors. You can filter by availability and locality.',
  },
  {
    q: 'How do I submit a blood request?',
    a: 'Create an account, then visit the Request Blood page. Fill in the required blood group, location, hospital, and date. A moderator will verify your request before it becomes publicly visible.',
  },
  {
    q: 'How does donor availability work?',
    a: 'Donors can set their availability status and reconfirm it regularly. Availability that has not been confirmed in 30 days is considered stale. The platform never guarantees a donor is available — always confirm directly.',
  },
  {
    q: 'How is my personal information protected?',
    a: 'Your phone number and email are never shown in search results. Donors appear with a display name (first name + last initial) and general area only. Contact happens through the platform, not directly.',
  },
  {
    q: 'Can the platform guarantee blood availability?',
    a: 'No. The platform coordinates connections between donors and patients. It does not guarantee that blood is available, that a donor is medically eligible, or that a donation will be successful. Always confirm with the healthcare facility.',
  },
  {
    q: 'Why must hospitals confirm eligibility?',
    a: 'A matching blood group is only a preliminary search filter. Blood compatibility, donor eligibility, and transfusion arrangements must be confirmed by qualified medical professionals at the receiving facility.',
  },
];

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const data = await fetchPublicStats();
        setStats(data);
      } catch {
        // If stats fail, we just hide the section — no fabricated data
        setStats(null);
      } finally {
        setStatsLoading(false);
      }
    })();
  }, []);

  return (
    <>
      {/* Header */}
      <header className="border-b border-neutral-200 bg-white" role="banner">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold text-neutral-900" aria-label="Jashore Blood Network — Home">
            <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full bg-brand-500" />
            <span>Jashore Blood Network</span>
          </Link>
          <nav aria-label="Primary">
            <ul className="flex items-center gap-4 text-sm text-neutral-600">
              <li><Link href="/donors/search" className="hover:text-neutral-900">Find Donors</Link></li>
              <li><Link href="/blood-requests" className="hover:text-neutral-900">Blood Requests</Link></li>
              <li><Link href="/hospitals" className="hover:text-neutral-900">Hospitals</Link></li>
              <li><Link href="/about" className="hover:text-neutral-900">About</Link></li>
              <li>
                {authLoading ? (
                  <span className="text-neutral-400">…</span>
                ) : user ? (
                  <div className="flex items-center gap-3">
                    <NotificationBell />
                    <Link href="/logout" className="hover:text-neutral-900">Logout</Link>
                  </div>
                ) : (
                  <Link href="/login" className="hover:text-neutral-900">Login</Link>
                )}
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-5xl flex-1" role="main">
        {/* Hero Section */}
        <section aria-labelledby="hero-heading" className="px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
          <div className="text-center">
            <p className="mb-3 text-sm font-medium uppercase tracking-wide text-brand-600">Jashore District, Bangladesh</p>
            <h1 id="hero-heading" className="mx-auto max-w-3xl text-3xl font-bold leading-tight text-neutral-900 sm:text-4xl sm:leading-tight md:text-5xl md:leading-tight">
              Connecting people who need blood with donors who care.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-neutral-600 sm:text-lg">
              A coordination platform helping residents of Jashore find consenting blood donors, submit
              verifiable blood requests, and connect with healthcare facilities — safely and efficiently.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/donors/search" className="w-full rounded-md bg-brand-500 px-6 py-3 text-center text-base font-medium text-white shadow-sm hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 sm:w-auto">
                Find Blood Donors
              </Link>
              <Link href="/become-donor" className="w-full rounded-md border border-brand-300 bg-brand-50 px-6 py-3 text-center text-base font-medium text-brand-700 hover:bg-brand-100 sm:w-auto">
                Become a Donor
              </Link>
              <Link href="/blood-requests/new" className="w-full rounded-md border border-neutral-300 bg-white px-6 py-3 text-center text-base font-medium text-neutral-700 hover:bg-neutral-50 sm:w-auto">
                Request Blood
              </Link>
            </div>
          </div>
        </section>

        {/* Live Platform Stats */}
        {stats && (
          <section aria-labelledby="stats-heading" className="border-y border-neutral-200 bg-neutral-50 px-4 py-8 sm:px-6">
            <h2 id="stats-heading" className="sr-only">Platform Statistics</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard label="Registered Donors" value={stats.registeredDonors} loading={statsLoading} />
              <StatCard label="Verified Donors" value={stats.verifiedDonors} loading={statsLoading} />
              <StatCard label="Active Requests" value={stats.activeBloodRequests} loading={statsLoading} />
              <StatCard label="Upazilas Covered" value={stats.supportedUpazilas} loading={statsLoading} />
            </div>
            <p className="mt-3 text-center text-xs text-neutral-400">
              These metrics represent platform activity only. They do not represent all blood donations in Jashore.
            </p>
          </section>
        )}

        {/* How It Works */}
        <section aria-labelledby="how-heading" className="px-4 py-12 sm:px-6">
          <h2 id="how-heading" className="text-center text-2xl font-bold text-neutral-900">How It Works</h2>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <span className="text-xl font-bold">1</span>
              </div>
              <h3 className="mt-3 text-base font-semibold text-neutral-900">Search for Donors</h3>
              <p className="mt-1 text-sm text-neutral-600">Filter by blood group and upazila to find consenting donors near you.</p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <span className="text-xl font-bold">2</span>
              </div>
              <h3 className="mt-3 text-base font-semibold text-neutral-900">Submit a Request</h3>
              <p className="mt-1 text-sm text-neutral-600">Create a blood request with details about the patient and required blood.</p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <span className="text-xl font-bold">3</span>
              </div>
              <h3 className="mt-3 text-base font-semibold text-neutral-900">Connect Safely</h3>
              <p className="mt-1 text-sm text-neutral-600">Donors respond to your request through the platform. Confirm arrangements with the hospital.</p>
            </div>
          </div>
        </section>

        {/* Quick Links */}
        <section aria-labelledby="quick-links-heading" className="bg-neutral-50 px-4 py-12 sm:px-6">
          <h2 id="quick-links-heading" className="text-center text-2xl font-bold text-neutral-900">Quick Actions</h2>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/donors/search" className="rounded-lg border border-brand-200 bg-brand-50 p-5 transition hover:border-brand-300 hover:shadow-sm">
              <h3 className="text-base font-semibold text-brand-700">Find Blood Donors</h3>
              <p className="mt-1 text-sm text-neutral-700">Search by blood group and location.</p>
            </Link>
            <Link href="/become-donor" className="rounded-lg border border-brand-200 bg-brand-50 p-5 transition hover:border-brand-300 hover:shadow-sm">
              <h3 className="text-base font-semibold text-brand-700">Become a Donor</h3>
              <p className="mt-1 text-sm text-neutral-700">Register and help your community.</p>
            </Link>
            <Link href="/blood-requests" className="rounded-lg border border-neutral-200 bg-white p-5 transition hover:border-neutral-300 hover:shadow-sm">
              <h3 className="text-base font-semibold text-neutral-900">Blood Requests</h3>
              <p className="mt-1 text-sm text-neutral-700">View active requests for blood.</p>
            </Link>
            <Link href="/hospitals" className="rounded-lg border border-neutral-200 bg-white p-5 transition hover:border-neutral-300 hover:shadow-sm">
              <h3 className="text-base font-semibold text-neutral-900">Find a Hospital</h3>
              <p className="mt-1 text-sm text-neutral-700">Browse verified healthcare facilities.</p>
            </Link>
          </div>
        </section>

        {/* Safety Guidance */}
        <section aria-labelledby="safety-heading" className="px-4 py-12 sm:px-6">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
            <h2 id="safety-heading" className="text-lg font-semibold text-amber-900">Important Safety Information</h2>
            <ul className="mt-3 space-y-2 text-sm text-amber-800">
              <li className="flex gap-2"><span aria-hidden="true">•</span><span>The platform is a coordination service, not a replacement for a licensed blood bank or medical professional.</span></li>
              <li className="flex gap-2"><span aria-hidden="true">•</span><span>A matching blood group is only a preliminary search filter. Clinical compatibility must be confirmed by qualified medical personnel.</span></li>
              <li className="flex gap-2"><span aria-hidden="true">•</span><span>The platform does not guarantee that a registered donor is available or medically eligible to donate.</span></li>
              <li className="flex gap-2"><span aria-hidden="true">•</span><span>Always confirm availability and arrangements with the requester and the healthcare facility.</span></li>
            </ul>
          </div>
        </section>

        {/* FAQ Preview */}
        <section aria-labelledby="faq-heading" className="bg-neutral-50 px-4 py-12 sm:px-6">
          <h2 id="faq-heading" className="text-center text-2xl font-bold text-neutral-900">Frequently Asked Questions</h2>
          <dl className="mx-auto mt-6 max-w-3xl space-y-4">
            {FAQ_ITEMS.slice(0, 4).map((item) => (
              <div key={item.q} className="rounded-lg border border-neutral-200 bg-white p-4">
                <dt className="text-sm font-semibold text-neutral-900">{item.q}</dt>
                <dd className="mt-1 text-sm text-neutral-600">{item.a}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 text-center">
            <Link href="/faq" className="text-sm font-medium text-brand-600 hover:underline">View all FAQs →</Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-neutral-200 bg-neutral-50" role="contentinfo">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <div>
              <h3 className="text-xs font-semibold uppercase text-neutral-500">Platform</h3>
              <ul className="mt-2 space-y-1 text-sm">
                <li><Link href="/donors/search" className="text-neutral-600 hover:text-neutral-900">Find Donors</Link></li>
                <li><Link href="/blood-requests" className="text-neutral-600 hover:text-neutral-900">Blood Requests</Link></li>
                <li><Link href="/hospitals" className="text-neutral-600 hover:text-neutral-900">Hospitals</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase text-neutral-500">Get Involved</h3>
              <ul className="mt-2 space-y-1 text-sm">
                <li><Link href="/become-donor" className="text-neutral-600 hover:text-neutral-900">Become a Donor</Link></li>
                <li><Link href="/login" className="text-neutral-600 hover:text-neutral-900">Login</Link></li>
                <li><Link href="/register" className="text-neutral-600 hover:text-neutral-900">Register</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase text-neutral-500">Information</h3>
              <ul className="mt-2 space-y-1 text-sm">
                <li><Link href="/about" className="text-neutral-600 hover:text-neutral-900">About</Link></li>
                <li><Link href="/faq" className="text-neutral-600 hover:text-neutral-900">FAQ</Link></li>
                <li><Link href="/report-abuse" className="text-neutral-600 hover:text-neutral-900">Report Abuse</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase text-neutral-500">Service Area</h3>
              <p className="mt-2 text-sm text-neutral-600">Jashore District, Bangladesh</p>
              <p className="mt-1 text-xs text-neutral-400">8 upazilas covered</p>
            </div>
          </div>
          <div className="mt-6 border-t border-neutral-200 pt-4">
            <p className="text-xs text-neutral-400">
              Jashore Blood Network — A donor coordination platform. Not a blood bank. Not a medical service.
              Always consult qualified medical professionals for blood compatibility and donor eligibility.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
