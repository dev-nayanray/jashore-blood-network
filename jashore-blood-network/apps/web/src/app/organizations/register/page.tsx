'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { registerOrganization } from '@/features/organizations/api';
import { fetchDistricts, fetchUpazilas, type District, type Upazila } from '@/features/locations/api';
import { useAuth } from '@/features/auth/auth-provider';
import { useEffect } from 'react';

export default function OrganizationRegisterPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [districts, setDistricts] = useState<District[]>([]);
  const [upazilas, setUpazilas] = useState<Upazila[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [name, setName] = useState('');
  const [upazilaId, setUpazilaId] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [operatingHours, setOperatingHours] = useState('');
  const [servicesOffered, setServicesOffered] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  useEffect(() => {
    void (async () => {
      try { setDistricts(await fetchDistricts()); } catch { /* ok */ }
    })();
  }, []);

  useEffect(() => {
    if (!selectedDistrict) { setUpazilas([]); return; }
    void (async () => {
      try { setUpazilas(await fetchUpazilas(selectedDistrict)); } catch { setUpazilas([]); }
    })();
  }, [selectedDistrict]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name || !upazilaId || !address) {
      setError('Please fill in all required fields.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await registerOrganization({
        name, upazilaId, address,
        phone: phone || undefined,
        email: email || undefined,
        website: website || undefined,
        operatingHours: operatingHours || undefined,
        servicesOffered: servicesOffered || undefined,
      });
      router.push('/organizations/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register organization');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) return <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center"><p className="text-sm text-neutral-500">Loading…</p></main>;

  return (
    <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6" role="main">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">Register Your Organization</h1>
        <p className="mt-2 text-sm text-neutral-600">Register your hospital or blood bank to coordinate blood requests and manage your facility profile.</p>
      </header>

      <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Organization verification confirms your profile information has been reviewed. It does NOT confirm blood inventory, medical capabilities, or service availability.
      </div>

      {error && <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-neutral-700">Organization name <span className="text-red-600">*</span></label>
          <input id="name" type="text" required maxLength={180} value={name} onChange={(e) => setName(e.target.value)} disabled={submitting}
            className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base" />
        </div>
        <div>
          <label htmlFor="district" className="block text-sm font-medium text-neutral-700">District <span className="text-red-600">*</span></label>
          <select id="district" required value={selectedDistrict} onChange={(e) => { setSelectedDistrict(e.target.value); setUpazilaId(''); }} disabled={submitting}
            className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base">
            <option value="">Select district</option>
            {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="upazila" className="block text-sm font-medium text-neutral-700">Upazila <span className="text-red-600">*</span></label>
          <select id="upazila" required value={upazilaId} onChange={(e) => setUpazilaId(e.target.value)} disabled={!selectedDistrict || submitting}
            className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base disabled:bg-neutral-100">
            <option value="">Select upazila</option>
            {upazilas.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="address" className="block text-sm font-medium text-neutral-700">Address <span className="text-red-600">*</span></label>
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
            placeholder="e.g. 24/7 or 9am-5pm" className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base" />
        </div>
        <div>
          <label htmlFor="services" className="block text-sm font-medium text-neutral-700">Services offered</label>
          <textarea id="services" rows={2} value={servicesOffered} onChange={(e) => setServicesOffered(e.target.value)} disabled={submitting}
            className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-base" />
        </div>
        <button type="submit" disabled={submitting || !name || !upazilaId || !address}
          className="w-full rounded-md bg-brand-500 px-4 py-2.5 text-base font-medium text-white hover:bg-brand-600 disabled:opacity-60">
          {submitting ? 'Registering…' : 'Register organization'}
        </button>
        <Link href="/" className="block text-center text-sm text-neutral-600 hover:text-neutral-900">Cancel</Link>
      </form>
    </main>
  );
}
