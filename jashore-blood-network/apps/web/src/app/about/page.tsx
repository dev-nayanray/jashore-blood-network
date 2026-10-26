/**
 * About page — static content about the platform.
 */

import Link from 'next/link';

export default function AboutPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6" role="main">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">About Jashore Blood Network</h1>
      </header>

      <div className="prose prose-sm max-w-none text-neutral-700">
        <p className="text-base">
          Jashore Blood Network is a district-wide blood donor coordination platform serving Jashore District,
          Bangladesh. Our mission is to connect people who need blood with consenting donors and appropriate
          healthcare facilities — safely, efficiently, and with respect for everyone&apos;s privacy.
        </p>

        <h2 className="mt-6 text-lg font-semibold text-neutral-900">What We Do</h2>
        <p className="mt-2">
          The platform helps residents of Jashore find potential blood donors, submit verifiable blood requests,
          and connect with healthcare facilities. Donors can register, manage their availability, and respond to
          requests that match their blood group — all through a privacy-preserving system that never exposes
          personal contact information publicly.
        </p>

        <h2 className="mt-6 text-lg font-semibold text-neutral-900">What We Are Not</h2>
        <ul className="mt-2 space-y-1">
          <li>We are not a blood bank or a licensed medical service.</li>
          <li>We do not determine medical eligibility, blood compatibility, or donor safety.</li>
          <li>We do not guarantee that a registered donor is available or will respond.</li>
          <li>We do not store or process blood — we coordinate connections only.</li>
        </ul>

        <h2 className="mt-6 text-lg font-semibold text-neutral-900">Coverage Area</h2>
        <p className="mt-2">
          The platform currently covers the eight upazilas of Jashore District: Jashore Sadar, Abhaynagar,
          Bagherpara, Chaugachha, Jhikargachha, Keshabpur, Manirampur, and Sharsha.
        </p>

        <h2 className="mt-6 text-lg font-semibold text-neutral-900">Privacy & Safety</h2>
        <p className="mt-2">
          Personal contact information is never shown in search results. Donors appear with a display name
          (first name + last initial) and general area only. Row Level Security policies enforce these rules
          at the database level. All privileged actions are audit-logged.
        </p>

        <h2 className="mt-6 text-lg font-semibold text-neutral-900">Get Involved</h2>
        <p className="mt-2">
          <Link href="/become-donor" className="text-brand-600 hover:underline">Become a donor</Link> to help
          your community, or <Link href="/donors/search" className="text-brand-600 hover:underline">search for
          donors</Link> if you need blood. For questions, visit our{' '}
          <Link href="/faq" className="text-brand-600 hover:underline">FAQ page</Link>.
        </p>
      </div>

      <div className="mt-8 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong>Medical disclaimer:</strong> This platform coordinates blood donation connections. It does not
        determine medical eligibility or guarantee blood compatibility. Always consult qualified medical
        professionals at the receiving facility.
      </div>
    </main>
  );
}
