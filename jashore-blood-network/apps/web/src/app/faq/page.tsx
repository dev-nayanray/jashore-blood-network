/**
 * FAQ page — static content, no database dependency.
 */

import Link from 'next/link';

const FAQ_SECTIONS = [
  {
    title: 'Searching for Donors',
    items: [
      { q: 'How do I search for blood donors?', a: 'Visit the Find Blood Donors page, select the blood group and upazila you need, and browse the list of consenting donors. You can filter by availability and locality.' },
      { q: 'What information is shown about donors?', a: 'Search results show only a display name (first name + last initial), blood group, general area (upazila), availability confirmation date, and last donation date if shared. Phone numbers and email addresses are never shown publicly.' },
      { q: 'Why might a donor not appear in search results?', a: 'Donors may have set their profile to unlisted, marked themselves as unavailable, or their availability confirmation may be stale (older than 30 days). The platform never claims a donor is available unless their profile supports it.' },
    ],
  },
  {
    title: 'Submitting Blood Requests',
    items: [
      { q: 'How do I submit a blood request?', a: 'Create an account, then visit the Request Blood page. Fill in the required blood group, location, hospital, and date. A moderator will verify your request before it becomes publicly visible.' },
      { q: 'Why does my request need verification?', a: 'Verification helps prevent fake requests and ensures the platform remains trustworthy. A moderator reviews each request before it appears publicly. This process typically takes a few hours.' },
      { q: 'What happens after I submit a request?', a: 'Your request starts in PENDING status. Once a moderator verifies it, it transitions to SEARCHING status and becomes publicly visible. Donors with compatible blood groups are notified automatically.' },
    ],
  },
  {
    title: 'Donor Availability & Notifications',
    items: [
      { q: 'How does donor availability work?', a: 'Donors can set their availability status and reconfirm it regularly. Availability that has not been confirmed in 30 days is considered stale. The platform never guarantees a donor is available — always confirm directly.' },
      { q: 'How are donors notified about blood requests?', a: 'When a request is verified and transitions to SEARCHING status, the platform matches donors with compatible blood groups and sends them in-app notifications. Donors can configure their notification preferences, including quiet hours and preferred blood groups.' },
      { q: 'Can I control which notifications I receive?', a: 'Yes. Visit Notification Preferences to enable or disable blood request alerts, set preferred blood groups, configure quiet hours, and limit the number of alerts per day.' },
    ],
  },
  {
    title: 'Privacy & Safety',
    items: [
      { q: 'How is my personal information protected?', a: 'Your phone number and email are never shown in search results. Donors appear with a display name (first name + last initial) and general area only. Contact happens through the platform, not directly. Row Level Security policies enforce these rules at the database level.' },
      { q: 'How do I report suspicious activity?', a: 'Use the Report Abuse page to report fake requests, impersonation, spam, or other concerns. Your identity is kept confidential from the reported user. Our moderation team reviews all reports.' },
      { q: 'What does donor verification mean?', a: 'Verification means an administrator has reviewed the donor profile information. It does NOT certify medical eligibility, blood compatibility, or safety to donate. Only qualified medical professionals can determine these.' },
    ],
  },
  {
    title: 'Medical Eligibility',
    items: [
      { q: 'Can the platform guarantee blood availability?', a: 'No. The platform coordinates connections between donors and patients. It does not guarantee that blood is available, that a donor is medically eligible, or that a donation will be successful. Always confirm with the healthcare facility.' },
      { q: 'Why must hospitals confirm eligibility?', a: 'A matching blood group is only a preliminary search filter. Blood compatibility, donor eligibility, and transfusion arrangements must be confirmed by qualified medical professionals at the receiving facility through cross-matching tests and medical screening.' },
      { q: 'Does the platform collect medical records?', a: 'No. The platform does not collect national ID documents, medical records, or other highly sensitive documents. Donor profiles contain only basic information needed for search and contact.' },
    ],
  },
];

export default function FAQPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6" role="main">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">Frequently Asked Questions</h1>
        <p className="mt-2 text-sm text-neutral-600">Answers to common questions about the Jashore Blood Network.</p>
      </header>

      {FAQ_SECTIONS.map((section) => (
        <section key={section.title} className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-neutral-900">{section.title}</h2>
          <dl className="space-y-4">
            {section.items.map((item) => (
              <div key={item.q} className="rounded-lg border border-neutral-200 bg-white p-4">
                <dt className="text-sm font-semibold text-neutral-900">{item.q}</dt>
                <dd className="mt-1 text-sm text-neutral-600">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <div className="mt-8 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong>Need more help?</strong>{' '}
        <Link href="/about" className="text-brand-600 hover:underline">Contact us</Link> or{' '}
        <Link href="/report-abuse" className="text-brand-600 hover:underline">report a concern</Link>.
      </div>
    </main>
  );
}
