'use client';

import Link from 'next/link';
import { useAuth } from '@/features/auth/auth-provider';
import { NotificationBell } from '@/features/notifications/notification-bell';

/**
 * Phase 5 landing page.
 *
 * Phase 2: mobile-first, accessible layout, four primary CTAs (disabled placeholders).
 * Phase 4: header now shows login/account link based on auth state via useAuth().
 * Phase 5: Find Blood and Become a Donor CTAs are now ENABLED — they link to
 * the donor search and donor registration pages respectively.
 *
 * The Request Blood and Find a Hospital CTAs remain disabled placeholders
 * until Phase 6+.
 */

const PRIMARY_CTAS = [
  {
    label: 'Find Blood',
    description: 'Search for available donors by blood group and upazila.',
    href: '/donors/search',
    disabled: false,
  },
  {
    label: 'Become a Donor',
    description: 'Register as a blood donor and help your community.',
    href: '/donors/register',
    disabled: false,
  },
  {
    label: 'Request Blood',
    description: 'Submit a blood request and reach consenting donors.',
    href: '/blood-request',
    disabled: true,
  },
  {
    label: 'Find a Hospital',
    description: 'Browse verified hospitals and blood banks in Jashore.',
    href: '/hospitals',
    disabled: true,
  },
] as const;

const STATUS_BADGES = [
  { label: 'Phase 2', value: 'Repository Foundation' },
  { label: 'Pilot', value: 'Jashore District' },
  { label: 'Status', value: 'In Development' },
] as const;

export default function HomePage() {
  const { user, loading } = useAuth();
  return (
    <>
      <header className="border-b border-neutral-200 bg-white" role="banner">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold text-neutral-900"
            aria-label="Jashore Blood Network — Home"
          >
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3 rounded-full bg-brand-500"
            />
            <span>Jashore Blood Network</span>
          </Link>
          <nav aria-label="Primary">
            <ul className="flex items-center gap-4 text-sm text-neutral-600">
              <li>
                <Link href="/about" className="hover:text-neutral-900">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-neutral-900">
                  Contact
                </Link>
              </li>
              <li>
                {loading ? (
                  <span className="text-neutral-400">…</span>
                ) : user ? (
                  <div className="flex items-center gap-3">
                    <NotificationBell />
                    <Link href="/logout" className="hover:text-neutral-900">
                      Logout ({user.fullName})
                    </Link>
                  </div>
                ) : (
                  <Link href="/login" className="hover:text-neutral-900">
                    Login
                  </Link>
                )}
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <main
        id="main"
        className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 sm:py-16"
        role="main"
      >
        <section aria-labelledby="hero-heading" className="mb-12 sm:mb-16">
          <p className="mb-3 text-sm font-medium uppercase tracking-wide text-brand-600">
            Jashore District, Bangladesh
          </p>
          <h1
            id="hero-heading"
            className="max-w-2xl text-3xl font-bold leading-tight text-neutral-900 sm:text-4xl sm:leading-tight md:text-5xl md:leading-tight"
          >
            Connecting blood donors with patients in need.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-neutral-600 sm:text-lg">
            A coordination platform helping people in Jashore find consenting
            blood donors, submit verifiable blood requests, and reach out
            safely. We are not a blood bank and we do not determine medical
            eligibility — that decision belongs to the blood bank at the time
            of donation.
          </p>

          <dl className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {STATUS_BADGES.map((badge) => (
              <div
                key={badge.label}
                className="rounded-lg border border-neutral-200 bg-neutral-50 p-4"
              >
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  {badge.label}
                </dt>
                <dd className="mt-1 text-sm font-semibold text-neutral-900">
                  {badge.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="cta-heading" className="mb-12 sm:mb-16">
          <h2
            id="cta-heading"
            className="mb-2 text-xl font-semibold text-neutral-900 sm:text-2xl"
          >
            What would you like to do?
          </h2>
          <p className="mb-6 text-sm text-neutral-600">
            Find blood donors in Jashore District, or register as a donor to help your community.
            Blood request and hospital directory features are coming soon.
          </p>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {PRIMARY_CTAS.map((cta) => (
              <li key={cta.label}>
                {cta.disabled ? (
                  <div
                    aria-disabled={cta.disabled}
                    className="flex h-full flex-col rounded-lg border border-neutral-200 bg-white p-5 transition hover:border-neutral-300 hover:shadow-sm"
                  >
                    <span className="text-base font-semibold text-neutral-900">
                      {cta.label}
                    </span>
                    <span className="mt-1 flex-1 text-sm text-neutral-600">
                      {cta.description}
                    </span>
                    <span className="mt-4 inline-flex items-center text-xs font-medium uppercase tracking-wide text-neutral-400">
                      Coming soon
                    </span>
                  </div>
                ) : (
                  <Link
                    href={cta.href}
                    className="flex h-full flex-col rounded-lg border border-brand-200 bg-brand-50 p-5 transition hover:border-brand-300 hover:shadow-sm"
                  >
                    <span className="text-base font-semibold text-brand-700">
                      {cta.label}
                    </span>
                    <span className="mt-1 flex-1 text-sm text-neutral-700">
                      {cta.description}
                    </span>
                    <span className="mt-4 inline-flex items-center text-xs font-medium uppercase tracking-wide text-brand-600">
                      Get started →
                    </span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="trust-heading" className="mb-12 sm:mb-16">
          <h2
            id="trust-heading"
            className="mb-3 text-xl font-semibold text-neutral-900 sm:text-2xl"
          >
            What this platform is — and is not
          </h2>
          <ul className="space-y-2 text-sm text-neutral-700">
            <li className="flex gap-2">
              <span aria-hidden="true" className="text-brand-500">
                •
              </span>
              <span>
                A coordination service that helps donors and patients find each
                other.
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true" className="text-brand-500">
                •
              </span>
              <span>
                A directory of consenting donors who have voluntarily registered.
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true" className="text-neutral-400">
                •
              </span>
              <span className="text-neutral-600">
                Not a replacement for a licensed blood bank or medical
                professional.
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true" className="text-neutral-400">
                •
              </span>
              <span className="text-neutral-600">
                Not able to guarantee a donor&apos;s medical eligibility or
                availability.
              </span>
            </li>
          </ul>
        </section>
      </main>

      <footer
        className="mt-auto border-t border-neutral-200 bg-neutral-50"
        role="contentinfo"
      >
        <div className="mx-auto max-w-5xl px-4 py-6 text-xs text-neutral-500 sm:px-6">
          <p>
            Jashore Blood Network — Phase 2 (Repository Foundation). For
            demonstration only; no live services are available yet.
          </p>
        </div>
      </footer>
    </>
  );
}
