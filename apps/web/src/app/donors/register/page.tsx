/**
 * Donor registration page.
 *
 * Authenticated users create their donor profile here. The form collects:
 *   - Blood group (required, controlled enum)
 *   - Upazila (required, loaded from /locations/upazilas)
 *   - Last donation date (optional, ISO date)
 *   - Contact preference (required, default IN_APP_ONLY)
 *   - Visibility (required, default LISTED)
 *   - Consent checkbox (required — must agree to be contacted)
 *
 * Validation is done client-side via the shared Zod schema, and the
 * backend re-validates via ZodValidationPipe.
 *
 * On success, redirects to /donors/profile.
 */

'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BLOOD_GROUPS, BLOOD_GROUP_LABELS } from '@jbn/shared-types';
import {
  createMyDonorProfile,
  fetchMyDonorProfile,
  type CreateDonorProfileInput,
} from '@/features/donors/api';
import { fetchDistricts, fetchUpazilas, type District, type Upazila } from '@/features/locations/api';
import { useAuth } from '@/features/auth/auth-provider';

export default function DonorRegisterPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [districts, setDistricts] = useState<District[]>([]);
  const [upazilas, setUpazilas] = useState<Upazila[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [existingProfile, setExistingProfile] = useState<boolean | null>(null);

  const [bloodGroup, setBloodGroup] = useState('');
  const [upazilaId, setUpazilaId] = useState('');
  const [lastDonationAt, setLastDonationAt] = useState('');
  const [contactPreference, setContactPreference] =
    useState<CreateDonorProfileInput['contactPreference']>('IN_APP_ONLY');
  const [visibility, setVisibility] =
    useState<CreateDonorProfileInput['visibility']>('LISTED');
  const [consent, setConsent] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  // Load districts + check for existing profile
  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        const [d, profile] = await Promise.all([fetchDistricts(), fetchMyDonorProfile()]);
        setDistricts(d);
        setExistingProfile(profile !== null);
      } catch {
        setExistingProfile(false);
      }
    })();
  }, [user]);

  // Load upazilas when district changes
  useEffect(() => {
    if (!selectedDistrict) {
      setUpazilas([]);
      return;
    }
    void (async () => {
      try {
        const u = await fetchUpazilas(selectedDistrict);
        setUpazilas(u);
      } catch {
        setUpazilas([]);
      }
    })();
  }, [selectedDistrict]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!consent) {
      setError('You must consent to being contacted about blood donation requests.');
      return;
    }
    if (!bloodGroup || !upazilaId) {
      setError('Please select a blood group and upazila.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createMyDonorProfile({
        bloodGroup: bloodGroup as CreateDonorProfileInput['bloodGroup'],
        upazilaId,
        lastDonationAt: lastDonationAt || null,
        contactPreference,
        visibility,
      });
      router.push('/donors/profile');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md items-center justify-center px-4 py-12">
        <p className="text-sm text-neutral-500">Loading…</p>
      </main>
    );
  }

  if (existingProfile === true) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8 sm:py-12">
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-6 text-center">
          <h1 className="text-lg font-semibold text-amber-900">Profile already exists</h1>
          <p className="mt-2 text-sm text-amber-800">
            You already have a donor profile. You can update it from your profile page.
          </p>
          <Link
            href="/donors/profile"
            className="mt-4 inline-block rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            Go to my profile
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-12" role="main">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">Become a Donor</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Register as a blood donor and help your community. Your contact information stays
          private — people in need can only reach you through the platform.
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

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-neutral-900">Required information</legend>

          <div>
            <label htmlFor="bloodGroup" className="block text-sm font-medium text-neutral-700">
              Blood group <span className="text-red-600">*</span>
            </label>
            <select
              id="bloodGroup"
              required
              value={bloodGroup}
              onChange={(e) => setBloodGroup(e.target.value)}
              className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              disabled={submitting}
            >
              <option value="">Select blood group</option>
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg} value={bg}>
                  {BLOOD_GROUP_LABELS[bg]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="district" className="block text-sm font-medium text-neutral-700">
              District <span className="text-red-600">*</span>
            </label>
            <select
              id="district"
              required
              value={selectedDistrict}
              onChange={(e) => {
                setSelectedDistrict(e.target.value);
                setUpazilaId('');
              }}
              className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              disabled={submitting}
            >
              <option value="">Select district</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="upazila" className="block text-sm font-medium text-neutral-700">
              Upazila <span className="text-red-600">*</span>
            </label>
            <select
              id="upazila"
              required
              value={upazilaId}
              onChange={(e) => setUpazilaId(e.target.value)}
              disabled={!selectedDistrict || submitting}
              className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-neutral-100 disabled:text-neutral-400"
            >
              <option value="">Select upazila</option>
              {upazilas.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-neutral-900">Optional information</legend>

          <div>
            <label htmlFor="lastDonationAt" className="block text-sm font-medium text-neutral-700">
              Last donation date (if known)
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
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-neutral-900">Privacy & contact preferences</legend>

          <div>
            <label htmlFor="contactPreference" className="block text-sm font-medium text-neutral-700">
              How can people contact you?
            </label>
            <select
              id="contactPreference"
              value={contactPreference}
              onChange={(e) =>
                setContactPreference(e.target.value as CreateDonorProfileInput['contactPreference'])
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
                setVisibility(e.target.value as CreateDonorProfileInput['visibility'])
              }
              className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              disabled={submitting}
            >
              <option value="LISTED">Listed in search (recommended)</option>
              <option value="UNLISTED">Hidden from search (respond to requests only)</option>
              <option value="HIDDEN">Hidden from everyone (admin only)</option>
            </select>
          </div>
        </fieldset>

        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4">
          <label className="flex items-start gap-3 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              required
              className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-brand-500 focus:ring-brand-500"
              disabled={submitting}
            />
            <span>
              I consent to being contacted about blood donation requests through the Jashore
              Blood Network platform. I understand that registering does not guarantee I am
              medically eligible to donate, and that the receiving facility will determine
              eligibility at donation time.
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting || !consent || !bloodGroup || !upazilaId}
          className="w-full rounded-md bg-brand-500 px-4 py-2.5 text-base font-medium text-white shadow-sm hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Registering…' : 'Register as donor'}
        </button>
      </form>
    </main>
  );
}
