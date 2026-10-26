/**
 * Donor card — public search result.
 *
 * Displays a single donor from the search results. Shows ONLY the
 * PII-stripped fields returned by /api/v1/donors:
 *   - Display name (first name + last initial)
 *   - Blood group
 *   - General area (upazila + optional locality)
 *   - Availability confirmation date
 *   - Last donation date (if shared)
 *
 * Does NOT show phone, email, exact address, or full name.
 *
 * The "Contact donor" action is a placeholder for Phase 6+ (blood request
 * workflow). It links to /login if the user is unauthenticated, or shows
 * a disabled state with a tooltip if the user is authenticated.
 */

'use client';

import Link from 'next/link';
import { BLOOD_GROUP_LABELS } from '@jbn/shared-types';
import type { DonorSearchResult } from './api';

interface DonorCardProps {
  donor: DonorSearchResult;
  isAuthenticated?: boolean;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return 'Unknown';
  }
}

function daysSince(iso: string): number {
  const d = new Date(iso);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function DonorCard({ donor, isAuthenticated = false }: DonorCardProps) {
  const daysSinceConfirmation = daysSince(donor.availabilityConfirmedAt);
  const isRecentlyConfirmed = daysSinceConfirmation <= 30;

  return (
    <article
      className="flex flex-col rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5"
      aria-label={`Donor ${donor.displayName}, blood group ${BLOOD_GROUP_LABELS[donor.bloodGroup]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-neutral-900">
            {donor.displayName}
          </h3>
          <p className="mt-0.5 text-sm text-neutral-600">
            {donor.upazila.name}
            {donor.locality ? `, ${donor.locality.name}` : ''}
          </p>
        </div>
        <span
          className="inline-flex shrink-0 items-center rounded-md bg-brand-50 px-2.5 py-1 text-sm font-bold text-brand-700"
          aria-label={`Blood group ${BLOOD_GROUP_LABELS[donor.bloodGroup]}`}
        >
          {BLOOD_GROUP_LABELS[donor.bloodGroup]}
        </span>
      </div>

      <dl className="mt-3 space-y-1 text-xs text-neutral-600">
        <div className="flex justify-between gap-2">
          <dt className="font-medium text-neutral-500">Availability confirmed:</dt>
          <dd className="text-right">
            <span className={isRecentlyConfirmed ? 'text-green-700' : 'text-amber-700'}>
              {formatDate(donor.availabilityConfirmedAt)}
            </span>
            {isRecentlyConfirmed ? (
              <span className="ml-1 text-green-600">({daysSinceConfirmation}d ago)</span>
            ) : (
              <span className="ml-1 text-amber-600">(stale)</span>
            )}
          </dd>
        </div>
        {donor.lastDonationAt && (
          <div className="flex justify-between gap-2">
            <dt className="font-medium text-neutral-500">Last donation:</dt>
            <dd>{formatDate(donor.lastDonationAt)}</dd>
          </div>
        )}
      </dl>

      <div className="mt-4">
        {isAuthenticated ? (
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-400"
            title="Blood request workflow coming in Phase 6"
          >
            Contact donor (coming soon)
          </button>
        ) : (
          <Link
            href="/login"
            className="block w-full rounded-md bg-brand-500 px-3 py-2 text-center text-sm font-medium text-white hover:bg-brand-600"
          >
            Log in to contact
          </Link>
        )}
      </div>

      <p className="mt-3 text-[10px] leading-tight text-neutral-400">
        A matching blood group is only a preliminary filter. Medical
        eligibility is determined by the blood bank at donation time.
      </p>
    </article>
  );
}
