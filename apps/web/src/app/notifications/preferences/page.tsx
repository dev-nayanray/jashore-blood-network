'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BLOOD_GROUPS, BLOOD_GROUP_LABELS } from '@jbn/shared-types';
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferencesDto,
} from '@/features/notifications/api';
import { useAuth } from '@/features/auth/auth-provider';

export default function NotificationPreferencesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPreferencesDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        const p = await fetchNotificationPreferences();
        setPrefs(p);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load preferences');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!prefs) return;
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const updated = await updateNotificationPreferences(prefs);
      setPrefs(updated);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update preferences');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleBloodGroup = (bg: string) => {
    if (!prefs) return;
    const current = new Set(prefs.preferredBloodGroups);
    if (current.has(bg)) current.delete(bg);
    else current.add(bg);
    setPrefs({ ...prefs, preferredBloodGroups: Array.from(current) });
  };

  if (authLoading || loading) {
    return <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center"><p className="text-sm text-neutral-500">Loading…</p></main>;
  }
  if (!user) return null;
  if (!prefs) return <main className="mx-auto max-w-md px-4 py-8"><p className="text-sm text-neutral-600">Could not load preferences.</p></main>;

  return (
    <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6" role="main">
      <header className="mb-6">
        <Link href="/notifications" className="mb-3 inline-block text-sm text-neutral-600 hover:text-neutral-900">← Back to notifications</Link>
        <h1 className="text-2xl font-bold text-neutral-900">Notification Preferences</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Control how and when you receive blood request alerts.
        </p>
      </header>

      {error && (
        <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}
      {success && (
        <div role="status" className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">Preferences saved.</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <fieldset className="space-y-3 rounded-lg border border-neutral-200 p-4">
          <legend className="px-1 text-sm font-semibold text-neutral-900">Blood request alerts</legend>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={prefs.bloodRequestAlertsEnabled}
              onChange={(e) => setPrefs({ ...prefs, bloodRequestAlertsEnabled: e.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-brand-500 focus:ring-brand-500"
            />
            <div>
              <span className="text-sm font-medium text-neutral-900">Receive blood request alerts</span>
              <p className="text-xs text-neutral-600">Get notified when a blood request matches your blood group.</p>
            </div>
          </label>

          <div>
            <p className="text-sm font-medium text-neutral-700">Preferred blood groups (optional)</p>
            <p className="text-xs text-neutral-600">If set, you will only be alerted for these groups. If empty, you will be alerted for all compatible groups.</p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {BLOOD_GROUPS.map((bg) => (
                <label key={bg} className="flex items-center justify-center gap-1 rounded-md border border-neutral-200 p-2 text-sm">
                  <input
                    type="checkbox"
                    checked={prefs.preferredBloodGroups.includes(bg)}
                    onChange={() => toggleBloodGroup(bg)}
                    className="h-4 w-4 rounded border-neutral-300 text-brand-500 focus:ring-brand-500"
                  />
                  <span>{BLOOD_GROUP_LABELS[bg]}</span>
                </label>
              ))}
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-3 rounded-lg border border-neutral-200 p-4">
          <legend className="px-1 text-sm font-semibold text-neutral-900">Channels</legend>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={prefs.inAppEnabled}
              onChange={(e) => setPrefs({ ...prefs, inAppEnabled: e.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-brand-500 focus:ring-brand-500"
            />
            <div>
              <span className="text-sm font-medium text-neutral-900">In-app notifications</span>
              <p className="text-xs text-neutral-600">Show notifications in the platform (always recommended).</p>
            </div>
          </label>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={prefs.emailEnabled}
              onChange={(e) => setPrefs({ ...prefs, emailEnabled: e.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-brand-500 focus:ring-brand-500"
            />
            <div>
              <span className="text-sm font-medium text-neutral-900">Email notifications</span>
              <p className="text-xs text-neutral-600">Receive alerts via email (requires a verified email address).</p>
            </div>
          </label>
        </fieldset>

        <fieldset className="space-y-3 rounded-lg border border-neutral-200 p-4">
          <legend className="px-1 text-sm font-semibold text-neutral-900">Quiet hours</legend>
          <p className="text-xs text-neutral-600">No alerts during these hours (UTC). Leave empty to receive alerts at any time.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="quietStart" className="block text-sm font-medium text-neutral-700">Start (UTC)</label>
              <select
                id="quietStart"
                value={prefs.quietHoursStart ?? ''}
                onChange={(e) => setPrefs({ ...prefs, quietHoursStart: e.target.value ? parseInt(e.target.value, 10) : null })}
                className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">None</option>
                {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="quietEnd" className="block text-sm font-medium text-neutral-700">End (UTC)</label>
              <select
                id="quietEnd"
                value={prefs.quietHoursEnd ?? ''}
                onChange={(e) => setPrefs({ ...prefs, quietHoursEnd: e.target.value ? parseInt(e.target.value, 10) : null })}
                className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">None</option>
                {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>)}
              </select>
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-3 rounded-lg border border-neutral-200 p-4">
          <legend className="px-1 text-sm font-semibold text-neutral-900">Frequency limit</legend>
          <div>
            <label htmlFor="maxAlerts" className="block text-sm font-medium text-neutral-700">
              Max alerts per day: {prefs.maxAlertsPerDay}
            </label>
            <input
              id="maxAlerts"
              type="range"
              min={0}
              max={50}
              value={prefs.maxAlertsPerDay}
              onChange={(e) => setPrefs({ ...prefs, maxAlertsPerDay: parseInt(e.target.value, 10) })}
              className="mt-2 w-full"
            />
            <p className="text-xs text-neutral-600">Set to 0 to disable all blood request alerts for the day.</p>
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-brand-500 px-4 py-2.5 text-base font-medium text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {submitting ? 'Saving…' : 'Save preferences'}
        </button>
      </form>
    </main>
  );
}
