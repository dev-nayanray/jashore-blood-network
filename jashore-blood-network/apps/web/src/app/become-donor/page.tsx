'use client';

/**
 * Become a Donor landing page — explains the process and links to registration.
 */

import Link from 'next/link';
import { useAuth } from '@/features/auth/auth-provider';

const STEPS = [
  { num: 1, title: 'Create an account', desc: 'Register with your phone number and verify via OTP. Your phone is your identity — we never share it publicly.' },
  { num: 2, title: 'Complete your donor profile', desc: 'Add your blood group, upazila, and availability preferences. This takes less than 2 minutes.' },
  { num: 3, title: 'Get notified about requests', desc: 'When a blood request matches your blood group, you will receive an in-app notification. You choose whether to respond.' },
  { num: 4, title: 'Respond and help', desc: 'If you are available, respond to the request. Coordinate with the requester through the platform and visit the hospital for donation.' },
];

const BENEFITS = [
  'Help save lives in your community',
  'Control your availability and notifications',
  'Your contact information stays private',
  'Get alerts for blood requests matching your group',
  'Set quiet hours and frequency limits',
  'No obligation — respond only when you can',
];

export default function BecomeDonorPage() {
  const { user } = useAuth();

  return (
    <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6" role="main">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">Become a Blood Donor</h1>
        <p className="mt-3 text-base text-neutral-600">
          Join the Jashore Blood Network and help connect patients in need with life-saving donors.
        </p>
      </header>

      {/* Benefits */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">Why Join?</h2>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {BENEFITS.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm text-neutral-700">
              <span aria-hidden="true" className="mt-0.5 text-brand-500">✓</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Steps */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">How to Register</h2>
        <div className="space-y-4">
          {STEPS.map((step) => (
            <div key={step.num} className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <span className="text-lg font-bold">{step.num}</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-neutral-900">{step.title}</h3>
                <p className="mt-1 text-sm text-neutral-600">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mb-8 rounded-lg border border-brand-200 bg-brand-50 p-6 text-center">
        <h2 className="text-lg font-semibold text-brand-900">Ready to save lives?</h2>
        <p className="mt-1 text-sm text-brand-800">Registration takes less than 5 minutes.</p>
        {user ? (
          <Link href="/donors/register" className="mt-4 inline-block rounded-md bg-brand-500 px-6 py-3 text-base font-medium text-white hover:bg-brand-600">
            Complete Your Donor Profile
          </Link>
        ) : (
          <Link href="/login" className="mt-4 inline-block rounded-md bg-brand-500 px-6 py-3 text-base font-medium text-white hover:bg-brand-600">
            Get Started — Login or Register
          </Link>
        )}
      </section>

      {/* Privacy */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-neutral-900">Your Privacy</h2>
        <p className="text-sm text-neutral-600">
          Your phone number and email are never shown in search results. Donors appear with a display name
          (first name + last initial) and general area only. You control your visibility, contact preferences,
          and notification settings at all times. You can temporarily disable notifications or mark yourself
          as unavailable at any time.
        </p>
      </section>

      {/* Medical Disclaimer */}
      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong>Medical eligibility:</strong> Registering as a donor does not guarantee you are medically
        eligible to donate. The receiving facility will determine eligibility through medical screening and
        blood compatibility tests at the time of donation. A matching blood group is only a preliminary
        search filter — clinical compatibility must be confirmed by qualified medical professionals.
      </div>
    </main>
  );
}
