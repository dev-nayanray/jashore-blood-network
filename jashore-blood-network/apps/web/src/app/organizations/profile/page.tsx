'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchMyOrganization, updateOrganizationProfile, type OrganizationDto } from '@/features/organizations/api';
import { useAuth } from '@/features/auth/auth-provider';

export default function OrganizationProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [org, setOrg] = useState<OrganizationDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [operatingHours, setOperatingHours] = useState('');
  const [servicesOffered, setServicesOffered] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        const data = await fetchMyOrganization();
        if (data) {
          setOrg(data);
          setName(data.name);
          setAddress(data.address);
          setPhone(data.phone ?? '');
          setEmail(data.email ?? '');
          setWebsite(data.website ?? '');
          setOperatingHours(data.operatingHours ?? '');
          setServicesOffered(data.servicesOffered ?? '');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load organization');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!org) return;
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const updated = await updateOrganizationProfile({
        name, address, phone: phone || undefined, email: email || undefined,
        website: website || undefined, operatingHours: operatingHours || undefined,
        servicesOffered: servicesOffered || undefined,
      });
      setOrg(updated);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) return <main className="mx-auto flex min-h-dvh max-w-2xl items-center justify-center"><p className="text-sm text-neutral-500">Loading…</p></main>;
  if (!user || !org) return null;

  return (
    <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6" role="main">
      <header className="mb-6">
        <Link href="/organizations/dashboard" className="mb-3 inline-block text-sm text-neutral-600 hover:text-neutral-900">← Back to dashboard</Link>
        <h1 className="text-2xl font-bold text-neutral-900">Edit Organization Profile</h1>
      </header>

      {error && <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {success && <div role="status" className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">Profile updated successfully.</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-neutral-700">Organization name</label>
          <input id="name" type="text" required maxLength={180} value={name} onChange={(e) => setName(e.target.value)} disabled={submitting}
            className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base" />
        </div>
        <div>
          <label htmlFor="address" className="block text-sm font-medium text-neutral-700">Address</label>
          <textarea id="address" required rows={2} value={address} onChange={(e) => setAddress(e.target.value)} disabled={submitting}
            className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-neutral-700">Phone</label>
            <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={submitting}
              className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base" />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-neutral-700">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={submitting}
              className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base" />
          </div>
        </div>
        <div>
          <label htmlFor="website" className="block text-sm font-medium text-neutral-700">Website</label>
          <input id="website" type="url" value={website} onChange={(e) => setWebsite(e.target.value)} disabled={submitting}
            className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base" />
        </div>
        <div>
          <label htmlFor="hours" className="block text-sm font-medium text-neutral-700">Operating hours</label>
          <input id="hours" type="text" value={operatingHours} onChange={(e) => setOperatingHours(e.target.value)} disabled={submitting}
            className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base" />
        </div>
        <div>
          <label htmlFor="services" className="block text-sm font-medium text-neutral-700">Services offered</label>
          <textarea id="services" rows={2} value={servicesOffered} onChange={(e) => setServicesOffered(e.target.value)} disabled={submitting}
            className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base" />
        </div>
        <button type="submit" disabled={submitting}
          className="w-full rounded-md bg-brand-500 px-4 py-2.5 text-base font-medium text-white hover:bg-brand-600 disabled:opacity-60">
          {submitting ? 'Saving…' : 'Save profile'}
        </button>
      </form>
    </main>
  );
}
