'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/features/auth/auth-provider';
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferencesDto,
} from '@/features/notifications/api';

/**
 * Unified account settings page.
 *
 * Sections:
 *   1. Profile (name, email)
 *   2. Donor settings (link to /donors/profile)
 *   3. Notification preferences (in-app, email, alerts, quiet hours)
 *   4. Privacy (link to donor visibility settings)
 *   5. Security (logout, session info)
 *   6. Account (deactivation)
 *
 * All settings use existing API endpoints — no new backend APIs except
 * the deactivation endpoint added in Phase 15.
 */

type Tab = 'profile' | 'notifications' | 'privacy' | 'security' | 'account';

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  // Profile state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Notification preferences state
  const [prefs, setPrefs] = useState<NotificationPreferencesDto | null>(null);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefsSubmitting, setPrefsSubmitting] = useState(false);
  const [prefsSuccess, setPrefsSuccess] = useState(false);
  const [prefsError, setPrefsError] = useState<string | null>(null);

  // Deactivation state
  const [deactivateConfirm, setDeactivateConfirm] = useState('');
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName);
      setEmail(user.email ?? '');
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        const p = await fetchNotificationPreferences();
        setPrefs(p);
      } catch (err) {
        setPrefsError(err instanceof Error ? err.message : 'Failed to load preferences');
      } finally {
        setPrefsLoading(false);
      }
    })();
  }, [user]);

  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setProfileSubmitting(true);
    setProfileError(null);
    setProfileSuccess(false);
    try {
      await apiFetch('/api/v1/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ fullName, email: email || null }),
      });
      setProfileSuccess(true);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setProfileSubmitting(false);
    }
  };

  const handlePrefsSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!prefs) return;
    setPrefsSubmitting(true);
    setPrefsError(null);
    setPrefsSuccess(false);
    try {
      const updated = await updateNotificationPreferences(prefs);
      setPrefs(updated);
      setPrefsSuccess(true);
    } catch (err) {
      setPrefsError(err instanceof Error ? err.message : 'Failed to update preferences');
    } finally {
      setPrefsSubmitting(false);
    }
  };

  const handleDeactivate = async () => {
    if (deactivateConfirm !== 'DEACTIVATE') return;
    setDeactivating(true);
    setDeactivateError(null);
    try {
      await apiFetch('/api/v1/users/me/deactivate', {
        method: 'POST',
        body: JSON.stringify({ confirm: deactivateConfirm }),
      });
      await logout();
      router.push('/');
    } catch (err) {
      setDeactivateError(err instanceof Error ? err.message : 'Failed to deactivate account');
    } finally {
      setDeactivating(false);
    }
  };

  if (authLoading) {
    return <main className="mx-auto flex min-h-dvh max-w-2xl items-center justify-center"><p className="text-sm text-neutral-500">Loading…</p></main>;
  }
  if (!user) return null;

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'profile', label: 'Profile' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'privacy', label: 'Privacy' },
    { id: 'security', label: 'Security' },
    { id: 'account', label: 'Account' },
  ];

  return (
    <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6" role="main">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">Account Settings</h1>
        <p className="mt-1 text-sm text-neutral-600">Manage your profile, notifications, privacy, and account.</p>
      </header>

      {/* Tab navigation */}
      <nav aria-label="Settings sections" className="mb-6 flex flex-wrap gap-1 border-b border-neutral-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-t-md px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.id
                ? 'border-b-2 border-brand-500 text-brand-700'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Profile tab */}
      {activeTab === 'profile' && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-neutral-900">Profile Information</h2>
          {profileError && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{profileError}</div>}
          {profileSuccess && <div role="status" className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">Profile updated successfully.</div>}
          <form onSubmit={handleProfileSubmit} className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-neutral-700">Full name</label>
              <input id="fullName" type="text" required minLength={2} maxLength={120} value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={profileSubmitting}
                className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base" />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700">Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={profileSubmitting}
                className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700">Phone</label>
              <p className="mt-1 rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-600">{user.phone}</p>
              <p className="mt-1 text-xs text-neutral-500">Phone number cannot be changed here. Contact support to update your phone number.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700">Roles</label>
              <div className="mt-1 flex flex-wrap gap-1">
                {user.roles.map((r) => (
                  <span key={r} className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">{r.replace(/_/g, ' ').toLowerCase()}</span>
                ))}
              </div>
              <p className="mt-1 text-xs text-neutral-500">Roles are assigned by administrators and cannot be self-modified.</p>
            </div>
            <button type="submit" disabled={profileSubmitting}
              className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
              {profileSubmitting ? 'Saving…' : 'Save profile'}
            </button>
          </form>
          {user.roles.includes('DONOR') && (
            <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
              <h3 className="text-sm font-semibold text-brand-900">Donor Profile</h3>
              <p className="mt-1 text-sm text-brand-800">Manage your blood group, availability, and donor verification.</p>
              <Link href="/donors/profile" className="mt-2 inline-block text-sm font-medium text-brand-600 hover:underline">Manage donor profile →</Link>
            </div>
          )}
        </section>
      )}

      {/* Notifications tab */}
      {activeTab === 'notifications' && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-neutral-900">Notification Preferences</h2>
          {prefsError && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{prefsError}</div>}
          {prefsSuccess && <div role="status" className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">Preferences saved.</div>}
          {prefsLoading || !prefs ? (
            <div className="h-48 animate-pulse rounded-lg border border-neutral-200 bg-neutral-100" />
          ) : (
            <form onSubmit={handlePrefsSubmit} className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={prefs.inAppEnabled} onChange={(e) => setPrefs({ ...prefs, inAppEnabled: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-brand-500" />
                <div><span className="text-sm font-medium text-neutral-900">In-app notifications</span><p className="text-xs text-neutral-600">Receive alerts in the platform (always recommended).</p></div>
              </label>
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={prefs.emailEnabled} onChange={(e) => setPrefs({ ...prefs, emailEnabled: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-brand-500" />
                <div><span className="text-sm font-medium text-neutral-900">Email notifications</span><p className="text-xs text-neutral-600">Receive alerts via email.</p></div>
              </label>
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={prefs.bloodRequestAlertsEnabled} onChange={(e) => setPrefs({ ...prefs, bloodRequestAlertsEnabled: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-brand-500" />
                <div><span className="text-sm font-medium text-neutral-900">Blood request alerts</span><p className="text-xs text-neutral-600">Get notified when a blood request matches your blood group.</p></div>
              </label>
              <div>
                <label htmlFor="maxAlerts" className="block text-sm font-medium text-neutral-700">Max alerts per day: {prefs.maxAlertsPerDay}</label>
                <input id="maxAlerts" type="range" min={0} max={50} value={prefs.maxAlertsPerDay} onChange={(e) => setPrefs({ ...prefs, maxAlertsPerDay: parseInt(e.target.value, 10) })}
                  className="mt-2 w-full" />
              </div>
              <button type="submit" disabled={prefsSubmitting}
                className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
                {prefsSubmitting ? 'Saving…' : 'Save preferences'}
              </button>
              <Link href="/notifications/preferences" className="block text-sm text-brand-600 hover:underline">Advanced preferences →</Link>
            </form>
          )}
        </section>
      )}

      {/* Privacy tab */}
      {activeTab === 'privacy' && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-neutral-900">Privacy Settings</h2>
          <div className="rounded-lg border border-neutral-200 bg-white p-5 space-y-3">
            <h3 className="text-sm font-semibold text-neutral-900">What information is public?</h3>
            <ul className="space-y-2 text-sm text-neutral-600">
              <li className="flex gap-2"><span className="text-green-600">✓</span><span><strong>Public:</strong> Display name (first name + last initial), blood group, upazila, availability confirmation date.</span></li>
              <li className="flex gap-2"><span className="text-red-600">✗</span><span><strong>Never public:</strong> Phone number, email address, full name, exact address.</span></li>
              <li className="flex gap-2"><span className="text-blue-600">•</span><span><strong>Admin only:</strong> Verification status details, moderation notes, audit history.</span></li>
            </ul>
            <div className="mt-4 border-t border-neutral-200 pt-4">
              <h3 className="text-sm font-semibold text-neutral-900">Donor Directory Visibility</h3>
              <p className="mt-1 text-sm text-neutral-600">Control whether you appear in public donor search results.</p>
              {user.roles.includes('DONOR') ? (
                <Link href="/donors/profile" className="mt-2 inline-block text-sm font-medium text-brand-600 hover:underline">Manage visibility in donor profile →</Link>
              ) : (
                <p className="mt-2 text-sm text-neutral-500">You are not registered as a donor. Register to manage donor visibility.</p>
              )}
            </div>
          </div>
          <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            Your privacy is enforced by Row Level Security at the database level. Client-side settings cannot bypass these rules.
          </div>
        </section>
      )}

      {/* Security tab */}
      {activeTab === 'security' && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-neutral-900">Security</h2>
          <div className="rounded-lg border border-neutral-200 bg-white p-5 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Authentication</h3>
              <p className="mt-1 text-sm text-neutral-600">You are signed in with phone number {user.phone}. Authentication is managed by Supabase Auth.</p>
            </div>
            <div className="border-t border-neutral-200 pt-3">
              <h3 className="text-sm font-semibold text-neutral-900">Session</h3>
              <p className="mt-1 text-sm text-neutral-600">Your session is stored in an httpOnly cookie. It expires automatically when the access token expires.</p>
              <button type="button" onClick={() => { void logout(); router.push('/'); }}
                className="mt-2 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
                Sign out
              </button>
            </div>
            <div className="border-t border-neutral-200 pt-3">
              <h3 className="text-sm font-semibold text-neutral-900">Verification Status</h3>
              {user.roles.includes('DONOR') ? (
                <Link href="/donors/verification" className="text-sm text-brand-600 hover:underline">View donor verification status →</Link>
              ) : (
                <p className="text-sm text-neutral-500">Donor verification is available after registering as a donor.</p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Account tab */}
      {activeTab === 'account' && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-neutral-900">Account Management</h2>
          <div className="rounded-lg border border-red-200 bg-red-50 p-5">
            <h3 className="text-base font-semibold text-red-900">Deactivate Account</h3>
            <p className="mt-2 text-sm text-red-800">
              Deactivating your account will:
            </p>
            <ul className="mt-1 ml-4 list-disc space-y-1 text-sm text-red-800">
              <li>Sign you out and disable your account immediately.</li>
              <li>Cancel all your active blood requests.</li>
              <li>Hide your donor profile from search results.</li>
              <li>Remove your organization memberships.</li>
              <li>Revoke all your roles.</li>
            </ul>
            <p className="mt-3 text-sm text-red-800">
              Your data will be retained per our retention policy. Audit logs and consent records
              are preserved for legal purposes. This action cannot be undone without contacting support.
            </p>
            {deactivateError && <div role="alert" className="mt-3 rounded-md border border-red-300 bg-red-100 px-3 py-2 text-sm text-red-900">{deactivateError}</div>}
            <div className="mt-4">
              <label htmlFor="confirm" className="block text-sm font-medium text-red-900">Type DEACTIVATE to confirm</label>
              <input id="confirm" type="text" value={deactivateConfirm} onChange={(e) => setDeactivateConfirm(e.target.value)}
                placeholder="DEACTIVATE" className="mt-1 block w-full rounded-md border border-red-300 bg-white px-3 py-2 text-base" disabled={deactivating} />
              <button type="button" onClick={handleDeactivate} disabled={deactivating || deactivateConfirm !== 'DEACTIVATE'}
                className="mt-3 rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60">
                {deactivating ? 'Deactivating…' : 'Deactivate my account'}
              </button>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
