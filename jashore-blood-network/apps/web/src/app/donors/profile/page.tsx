/**
 * Donor profile management page.
 *
 * Authenticated users view and update their own donor profile here.
 * Allows:
 *   - Viewing current profile (blood group, location, availability, etc.)
 *   - Toggling availability status (reconfirms timestamp)
 *   - Updating contact preference, visibility, last donation date
 *   - Reconfirming availability (button)
 *
 * Does NOT allow:
 *   - Changing phone (identity anchor — use Supabase Auth flow)
 *   - Viewing another user's profile (IDOR prevented by backend)
 */

'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BLOOD_GROUPS, BLOOD_GROUP_LABELS, type BloodGroup } from '@jbn/shared-types';
import {
  fetchMyDonorProfile,
  updateMyDonorProfile,
  type OwnDonorProfile,
  type UpdateDonorProfileInput,
} from '@/features/donors/api';
import { useAuth } from '@/features/auth/auth-provider';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return 'Unknown';
  }
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

export default function DonorProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<OwnDonorProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [lastDonationAt, setLastDonationAt] = useState('');
  const [contactPreference, setContactPreference] =
    useState<UpdateDonorProfileInput['contactPreference']>('IN_APP_ONLY');
  const [visibility, setVisibility] =
    useState<UpdateDonorProfileInput['visibility']>('LISTED');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        const p = await fetchMyDonorProfile();
        if (p) {
          setProfile(p);
          setLastDonationAt(p.lastDonationAt ?? '');
          setContactPreference(p.contactPreference);
          setVisibility(p.visibility);
        } else {
          setProfile(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setProfileLoading(false);
      }
    })();
  }, [user]);

  const handleReconfirmAvailability = async () => {
    if (!profile) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await updateMyDonorProfile({ isAvailable: true });
      setProfile(updated);
      setSuccess('Availability reconfirmed. Your profile will appear as recently confirmed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reconfirm availability');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleAvailability = async () => {
    if (!profile) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await updateMyDonorProfile({ isAvailable: !profile.isAvailable });
      setProfile(updated);
      setSuccess(
        updated.isAvailable
          ? 'You are now marked as available.'
          : 'You are now marked as unavailable.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle availability');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdatePreferences = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await updateMyDonorProfile({
        lastDonationAt: lastDonationAt || null,
        contactPreference,
        visibility,
      });
      setProfile(updated);
      setSuccess('Preferences updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update preferences');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || profileLoading) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md items-center justify-center px-4 py-12">
        <p className="text-sm text-neutral-500">Loading…</p>
      </main>
    );
  }

  if (!user) {
    return null; // redirecting
  }

  if (!profile) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8 sm:py-12">
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-6 text-center">
          <h1 className="text-lg font-semibold text-amber-900">No donor profile yet</h1>
          <p className="mt-2 text-sm text-amber-800">
            You don&apos;t have a donor profile yet. Create one to start helping your community.
          </p>
          <Link
            href="/donors/register"
            className="mt-4 inline-block rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            Become a donor
          </Link>
        </div>
      </main>
    );
  }

  const daysSinceConfirmation = daysSince(profile.availabilityConfirmedAt);
  const isStale = daysSinceConfirmation > 30;

  return (
    <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6" role="main">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">My Donor Profile</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Manage your donor profile, availability, and contact preferences.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          {success}
        </div>
      )}

      {/* Profile summary */}
      <section
        className="mb-6 rounded-lg border border-neutral-200 bg-white p-4 sm:p-5"
        aria-labelledby="profile-summary"
      >
        <h2 id="profile-summary" className="mb-3 text-base font-semibold text-neutral-900">
          Profile summary
        </h2>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase text-neutral-500">Blood group</dt>
            <dd className="mt-0.5 font-semibold text-brand-700">
              {BLOOD_GROUP_LABELS[profile.bloodGroup]}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-neutral-500">Location</dt>
            <dd className="mt-0.5 text-neutral-900">
              {profile.upazila.name}, {profile.upazila.district.name}
              {profile.locality ? ` (${profile.locality.name})` : ''}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-neutral-500">Last donation</dt>
            <dd className="mt-0.5 text-neutral-900">
              {profile.lastDonationAt ? formatDate(profile.lastDonationAt) : 'Not shared'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-neutral-500">Member since</dt>
            <dd className="mt-0.5 text-neutral-900">{formatDate(profile.createdAt)}</dd>
          </div>
        </dl>
      </section>

      {/* Availability status */}
      <section
        className="mb-6 rounded-lg border border-neutral-200 bg-white p-4 sm:p-5"
        aria-labelledby="availability-heading"
      >
        <h2 id="availability-heading" className="mb-3 text-base font-semibold text-neutral-900">
          Availability status
        </h2>
        <div
          className={`mb-3 rounded-md px-3 py-2 text-sm ${
            profile.isAvailable
              ? isStale
                ? 'bg-amber-50 text-amber-800'
                : 'bg-green-50 text-green-800'
              : 'bg-neutral-100 text-neutral-700'
          }`}
        >
          {profile.isAvailable ? (
            isStale ? (
              <>
                <strong>Available</strong> but confirmation is stale ({daysSinceConfirmation} days
                ago). Reconfirm to stay in search results.
              </>
            ) : (
              <>
                <strong>Available</strong>{' — '}confirmed {daysSinceConfirmation} day
                {daysSinceConfirmation === 1 ? '' : 's'} ago.
              </>
            )
          ) : (
            <span>
              <strong>Currently unavailable</strong>{' — '}your profile is hidden from search.
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleReconfirmAvailability}
            disabled={submitting || !profile.isAvailable}
            className="rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reconfirm availability
          </button>
          <button
            type="button"
            onClick={handleToggleAvailability}
            disabled={submitting}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {profile.isAvailable ? 'Mark as unavailable' : 'Mark as available'}
          </button>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Availability is automatically considered stale after 30 days. Reconfirm regularly to
          stay visible in search results.
        </p>
      </section>

      {/* Preferences form */}
      <section
        className="mb-6 rounded-lg border border-neutral-200 bg-white p-4 sm:p-5"
        aria-labelledby="preferences-heading"
      >
        <h2 id="preferences-heading" className="mb-3 text-base font-semibold text-neutral-900">
          Update preferences
        </h2>
        <form onSubmit={handleUpdatePreferences} className="space-y-4">
          <div>
            <label htmlFor="lastDonationAt" className="block text-sm font-medium text-neutral-700">
              Last donation date
            </label>
            <input
              id="lastDonationAt"
              type="date"
              value={lastDonationAt}
              onChange={(e) => setLastDonationAt(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              disabled={submitting}
            />
          </div>

          <div>
            <label
              htmlFor="contactPreference"
              className="block text-sm font-medium text-neutral-700"
            >
              Contact preference
            </label>
            <select
              id="contactPreference"
              value={contactPreference}
              onChange={(e) =>
                setContactPreference(
                  e.target.value as UpdateDonorProfileInput['contactPreference'],
                )
              }
              className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              disabled={submitting}
            >
              <option value="IN_APP_ONLY">In-app messages only (recommended)</option>
              <option value="IN_APP_AND_PHONE">In-app + phone</option>
              <option value="IN_APP_AND_EMAIL">In-app + email</option>
            </select>
          </div>

          <div>
            <label htmlFor="visibility" className="block text-sm font-medium text-neutral-700">
              Profile visibility
            </label>
            <select
              id="visibility"
              value={visibility}
              onChange={(e) =>
                setVisibility(e.target.value as UpdateDonorProfileInput['visibility'])
              }
              className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              disabled={submitting}
            >
              <option value="LISTED">Listed in search (recommended)</option>
              <option value="UNLISTED">Hidden from search</option>
              <option value="HIDDEN">Hidden from everyone</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Saving…' : 'Save preferences'}
          </button>
        </form>
      </section>

      {/* Medical safety reminder */}
      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
        <p>
          <strong>Note:</strong> Registering as a donor does not guarantee medical eligibility.
          The receiving facility determines eligibility and compatibility at the time of donation.
        </p>
      </div>
    </main>
  );
}
